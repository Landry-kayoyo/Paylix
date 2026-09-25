'use server'

import { createClient } from '@/lib/supabase/server'

export interface FinancialReportsParams {
  school_year_id?: string;
  class_id?: string;
  period?: 'today' | 'week' | 'month' | 'custom';
  start_date?: string;
  end_date?: string;
  currency?: 'CDF' | 'USD';
  status?: string;
  accountant_id?: string;
}

// Utility: picks the first director membership from a list
export async function pickFirstDirectorMembership(
  memberships: Array<{ role: string; tenant_id: string; status?: string }>
) {
  return memberships.find((m) => m.role === 'director') ?? null;
}

export async function getSchoolYears() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: membership, error: memError } = await supabase
    .from('user_memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (memError || !membership) return { error: memError?.message || 'Forbidden' };

  const { data, error } = await supabase
    .from('school_years')
    .select('id, name, status')
    .eq('tenant_id', membership.tenant_id)
    .order('start_date', { ascending: false });

  if (error) return { error: error.message };
  return { data };
}

export async function getGlobalFinancialReport(schoolYearId?: string, accountantId?: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const { data: membership, error: memError } = await supabase
    .from('user_memberships')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (memError || !membership || (membership.role !== 'accountant' && membership.role !== 'director')) {
    return { error: memError?.message || 'Forbidden' }
  }

  const tenantId = membership.tenant_id;
  const isAccountant = membership.role === 'accountant';
  const targetAccountantId = isAccountant ? user.id : accountantId;

  // Si l'année n'est pas spécifiée, récupérer l'année active du tenant
  let targetYearId = schoolYearId;
  if (!targetYearId) {
    const { data: activeYear } = await supabase
      .from('school_years')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    targetYearId = activeYear?.id;
  }

  // 1. Récupérer toutes les obligations de l'année scolaire ciblée
  let obligationsQuery = supabase
    .from('financial_obligations')
    .select('id, initial_amount, paid_amount, remaining_amount, currency, status, due_date')
    .eq('tenant_id', tenantId)

  if (targetYearId) {
    obligationsQuery = obligationsQuery.eq('school_year_id', targetYearId)
  }

  const { data: obligations, error: obError } = await obligationsQuery;

  if (obError) {
    console.error('Erreur lors du calcul des obligations:', obError)
    return { error: obError.message }
  }

  // Agrégations Obligations
  let total_expected_cdf = 0;
  let total_paid_cdf = 0;
  let total_remaining_cdf = 0;

  let total_expected_usd = 0;
  let total_paid_usd = 0;
  let total_remaining_usd = 0;

  const obligation_counts = {
    unpaid: 0,
    partial: 0,
    paid: 0,
    overdue: 0,
  };

  (obligations || []).forEach((ob) => {
    const init = Number(ob.initial_amount || 0);
    const paid = Number(ob.paid_amount || 0);
    const rem = Number(ob.remaining_amount || 0);

    if (ob.currency === 'CDF') {
      total_expected_cdf += init;
      total_paid_cdf += paid;
      total_remaining_cdf += rem;
    } else if (ob.currency === 'USD') {
      total_expected_usd += init;
      total_paid_usd += paid;
      total_remaining_usd += rem;
    }

    if (ob.status === 'paid') obligation_counts.paid++;
    else if (ob.status === 'partial') obligation_counts.partial++;
    else if (ob.status === 'overdue') obligation_counts.overdue++;
    else obligation_counts.unpaid++;
  });

  // 2. Récupérer les statistiques de paiements confirmés pour l'année
  let paymentsQuery = supabase
    .from('payments')
    .select('id, amount, currency, student_id, recorded_by')
    .eq('tenant_id', tenantId)
    .eq('status', 'confirmed')

  if (targetYearId) {
    paymentsQuery = paymentsQuery.eq('school_year_id', targetYearId)
  }

  if (targetAccountantId) {
    paymentsQuery = paymentsQuery.eq('recorded_by', targetAccountantId)
  }

  const { data: payments } = await paymentsQuery;

  const uniquePayingStudents = new Set<string>();
  let count_payments_cdf = 0;
  let count_payments_usd = 0;
  let total_collected_payments_cdf = 0;
  let total_collected_payments_usd = 0;

  (payments || []).forEach((p) => {
    uniquePayingStudents.add(p.student_id);
    const amt = Number(p.amount || 0);
    if (p.currency === 'CDF') {
      count_payments_cdf++;
      total_collected_payments_cdf += amt;
    } else if (p.currency === 'USD') {
      count_payments_usd++;
      total_collected_payments_usd += amt;
    }
  });

  return {
    data: {
      school_year_id: targetYearId,
      total_paying_students: uniquePayingStudents.size,
      total_payments_count: (payments || []).length,
      cdf: {
        total_expected: total_expected_cdf,
        total_paid: total_paid_cdf,
        total_remaining: total_remaining_cdf,
        payments_count: count_payments_cdf,
        total_collected: total_collected_payments_cdf,
      },
      usd: {
        total_expected: total_expected_usd,
        total_paid: total_paid_usd,
        total_remaining: total_remaining_usd,
        payments_count: count_payments_usd,
        total_collected: total_collected_payments_usd,
      },
      obligations_breakdown: obligation_counts,
    }
  }
}

export async function getPeriodFinancialReport(params: FinancialReportsParams) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const { data: membership } = await supabase
    .from('user_memberships')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership) return { error: 'Forbidden' }

  const isAccountant = membership.role === 'accountant';
  const targetAccountantId = isAccountant ? user.id : params.accountant_id;

  let startDate: string | null = null;
  let endDate: string | null = null;

  const now = new Date();
  if (params.period === 'today') {
    startDate = now.toISOString().split('T')[0];
    endDate = startDate;
  } else if (params.period === 'week') {
    const day = now.getDay();
    const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diffToMon));
    startDate = monday.toISOString().split('T')[0];
    endDate = new Date().toISOString().split('T')[0];
  } else if (params.period === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate = firstDay.toISOString().split('T')[0];
    endDate = new Date().toISOString().split('T')[0];
  } else if (params.period === 'custom') {
    startDate = params.start_date || null;
    endDate = params.end_date || null;
  }

  let query = supabase
    .from('payments')
    .select(`
      id,
      amount,
      currency,
      payment_date,
      status,
      receipts (receipt_number),
      students (first_name, last_name, matricule)
    `)
    .eq('tenant_id', membership.tenant_id)
    .eq('status', 'confirmed')
    .order('payment_date', { ascending: false })

  if (params.school_year_id) {
    query = query.eq('school_year_id', params.school_year_id)
  }

  if (targetAccountantId) {
    query = query.eq('recorded_by', targetAccountantId)
  }

  if (startDate) {
    query = query.gte('payment_date', startDate)
  }

  if (endDate) {
    query = query.lte('payment_date', endDate)
  }

  const { data: payments, error } = await query;

  if (error) return { error: error.message }

  let total_cdf = 0;
  let total_usd = 0;
  let count_cdf = 0;
  let count_usd = 0;

  (payments || []).forEach((p: any) => {
    const amt = Number(p.amount);
    if (p.currency === 'CDF') {
      total_cdf += amt;
      count_cdf++;
    } else {
      total_usd += amt;
      count_usd++;
    }
  });

  return {
    data: {
      period: params.period,
      start_date: startDate,
      end_date: endDate,
      payments: payments || [],
      totals: {
        cdf: { total: total_cdf, count: count_cdf },
        usd: { total: total_usd, count: count_usd },
      }
    }
  }
}

export async function getClassFinancialReport(schoolYearId?: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const { data: membership } = await supabase
    .from('user_memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership) return { error: 'Forbidden' }

  const tenantId = membership.tenant_id;

  // Récupérer l'année cible
  let targetYearId = schoolYearId;
  if (!targetYearId) {
    const { data: activeYear } = await supabase
      .from('school_years')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    targetYearId = activeYear?.id;
  }

  if (!targetYearId) return { data: [] }

  // 1. Récupérer toutes les classes associées à cette année scolaire
  const { data: classYears, error: cyError } = await supabase
    .from('class_school_years')
    .select('id, class_id, classes (id, name)')
    .eq('tenant_id', tenantId)
    .eq('school_year_id', targetYearId)

  if (cyError || !classYears) return { error: cyError?.message || 'Erreur classes' }

  // 2. Récupérer toutes les inscriptions et obligations pour l'année
  const { data: enrollments } = await supabase
    .from('student_enrollments')
    .select('student_id, class_id, school_year_id')
    .eq('tenant_id', tenantId)
    .eq('school_year_id', targetYearId);

  const { data: obligations } = await supabase
    .from('financial_obligations')
    .select('student_id, initial_amount, paid_amount, remaining_amount, currency, status')
    .eq('tenant_id', tenantId)
    .eq('school_year_id', targetYearId)

  // Map student_id -> class_school_year_id
  const studentToClassMap = new Map<string, string>();
  (enrollments || []).forEach((enrollment: any) => {
    studentToClassMap.set(enrollment.student_id, enrollment.class_id);
  });

  // Calcul par classe
  const result = classYears.map(cy => {
    const classId = cy.class_id;
    const classRelation = Array.isArray(cy.classes) ? cy.classes[0] : cy.classes;
    const className = classRelation?.name || 'Classe';

    let studentCount = 0;
    studentToClassMap.forEach((cId) => {
      if (cId === classId) studentCount++;
    });

    let expected_cdf = 0;
    let paid_cdf = 0;
    let remaining_cdf = 0;

    let expected_usd = 0;
    let paid_usd = 0;
    let remaining_usd = 0;

    let count_paid_ob = 0;
    let count_partial_ob = 0;
    let count_overdue_ob = 0;

    (obligations || []).forEach(ob => {
      const studentClassId = studentToClassMap.get(ob.student_id);
      if (studentClassId === classId) {
        const init = Number(ob.initial_amount || 0);
        const paid = Number(ob.paid_amount || 0);
        const rem = Number(ob.remaining_amount || 0);

        if (ob.currency === 'CDF') {
          expected_cdf += init;
          paid_cdf += paid;
          remaining_cdf += rem;
        } else if (ob.currency === 'USD') {
          expected_usd += init;
          paid_usd += paid;
          remaining_usd += rem;
        }

        if (ob.status === 'paid') count_paid_ob++;
        else if (ob.status === 'partial') count_partial_ob++;
        else if (ob.status === 'overdue') count_overdue_ob++;
      }
    });

    return {
      class_id: cy.class_id,
      class_name: className,
      student_count: studentCount,
      cdf: {
        expected: expected_cdf,
        paid: paid_cdf,
        remaining: remaining_cdf,
      },
      usd: {
        expected: expected_usd,
        paid: paid_usd,
        remaining: remaining_usd,
      },
      obligations: {
        paid: count_paid_ob,
        partial: count_partial_ob,
        overdue: count_overdue_ob,
      }
    }
  });

  return { data: result }
}

export async function getStudentFinancialReport(studentId: string, schoolYearId?: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const { data: membership } = await supabase
    .from('user_memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership) return { error: 'Forbidden' }

  // 1. Informations de l'élève
  const { data: student } = await supabase
    .from('students')
    .select(`
      id, first_name, last_name, matricule,
      student_enrollments (
        school_year_id,
        class_id,
        classes (name),
        school_years (name)
      )
    `)
    .eq('id', studentId)
    .single()

  if (!student) return { error: 'Élève introuvable' }

  // 2. Obligations financières
  let obQuery = supabase
    .from('financial_obligations')
    .select(`
      id, initial_amount, paid_amount, remaining_amount, currency, status, due_date,
      fees (name), fee_schedules (month)
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: true })

  if (schoolYearId) {
    obQuery = obQuery.eq('school_year_id', schoolYearId)
  }

  const { data: obligations } = await obQuery;

  // 3. Historique des paiements
  let payQuery = supabase
    .from('payments')
    .select(`
      id, amount, currency, payment_date, status, cancellation_reason, payment_group_id,
      receipts (receipt_number)
    `)
    .eq('student_id', studentId)
    .order('payment_date', { ascending: false })

  if (schoolYearId) {
    payQuery = payQuery.eq('school_year_id', schoolYearId)
  }

  const { data: payments } = await payQuery;

  const paymentGroupIds = Array.from(new Set(
    (payments || []).map((payment: any) => payment.payment_group_id).filter(Boolean)
  ));
  const { data: groupedReceiptPayments } = paymentGroupIds.length > 0
    ? await supabase
        .from('payments')
        .select('id, payment_group_id, receipts (receipt_number)')
        .in('payment_group_id', paymentGroupIds)
    : { data: [] };
  const receiptByPaymentGroup = new Map<string, string>();

  (groupedReceiptPayments || []).forEach((payment: any) => {
    const receipt = Array.isArray(payment.receipts) ? payment.receipts[0] : payment.receipts;
    if (payment.payment_group_id && receipt?.receipt_number) {
      receiptByPaymentGroup.set(payment.payment_group_id, receipt.receipt_number);
    }
  });

  const paymentsWithReceipt = (payments || []).map((payment: any) => {
    const directReceipt = Array.isArray(payment.receipts) ? payment.receipts[0] : payment.receipts;
    return {
      ...payment,
      receipt_number: directReceipt?.receipt_number
        || (payment.payment_group_id ? receiptByPaymentGroup.get(payment.payment_group_id) : null)
        || null,
    };
  });

  // Calcul des totaux par devise pour l'élève
  let total_cdf = { expected: 0, paid: 0, remaining: 0 };
  let total_usd = { expected: 0, paid: 0, remaining: 0 };

  (obligations || []).forEach(ob => {
    const init = Number(ob.initial_amount || 0);
    const paid = Number(ob.paid_amount || 0);
    const rem = Number(ob.remaining_amount || 0);

    if (ob.currency === 'CDF') {
      total_cdf.expected += init;
      total_cdf.paid += paid;
      total_cdf.remaining += rem;
    } else {
      total_usd.expected += init;
      total_usd.paid += paid;
      total_usd.remaining += rem;
    }
  });

  const matchingEnrollment = ((student.student_enrollments || []) as any[]).find(
    (enrollment) => !schoolYearId || enrollment.school_year_id === schoolYearId
  );
  const classRelation = matchingEnrollment?.classes;
  const classRecord = Array.isArray(classRelation) ? classRelation[0] : classRelation;

  return {
    data: {
      student: {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        matricule: student.matricule,
        class_name: classRecord?.name || 'Non assigné',
      },
      totals: { cdf: total_cdf, usd: total_usd },
      obligations: obligations || [],
      payments: paymentsWithReceipt,
    }
  }
}

export async function getUnpaidReport(filters: FinancialReportsParams = {}) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized', data: [] }

  const { data: membership } = await supabase
    .from('user_memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership) return { error: 'Forbidden', data: [] }

  let query = supabase
    .from('financial_obligations')
    .select(`
      id,
      initial_amount,
      paid_amount,
      remaining_amount,
      currency,
      status,
      due_date,
      created_at,
      fees (name),
      students!inner (
        id, first_name, last_name, matricule,
        student_enrollments (
          school_year_id,
          class_id,
          classes (name)
        )
      )
    `)
    .eq('tenant_id', membership.tenant_id)
    .gt('remaining_amount', 0)
    .order('due_date', { ascending: true })

  if (filters.school_year_id) {
    query = query.eq('school_year_id', filters.school_year_id)
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (filters.currency) {
    query = query.eq('currency', filters.currency)
  }

  const { data, error } = await query;

  if (error) return { error: error.message, data: [] }

  const formattedData = (data || []).map((ob: any) => {
    const s = ob.students;
    const enrollments = s?.student_enrollments || [];
    const matchingEnrollment = filters.school_year_id
      ? enrollments.find((enrollment: any) => enrollment.school_year_id === filters.school_year_id)
      : enrollments[0];
    const classRelation = matchingEnrollment?.classes;
    const classRecord = Array.isArray(classRelation) ? classRelation[0] : classRelation;
    const className = classRecord?.name || 'Non assigné';

    return {
      id: ob.id,
      fee_name: ob.fees?.name || 'Frais',
      initial_amount: Number(ob.initial_amount),
      paid_amount: Number(ob.paid_amount),
      remaining_amount: Number(ob.remaining_amount),
      currency: ob.currency,
      status: ob.status,
      due_date: ob.due_date || ob.created_at,
      student_name: `${s?.first_name || ''} ${s?.last_name || ''}`.trim(),
      matricule: s?.matricule || '-',
      class_name: className,
    }
  });

  return { data: formattedData }
}

export async function getAccountants() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  const { data: membership } = await supabase
    .from('user_memberships')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership || membership.role !== 'director') return { data: [] }

  const { data: accountants } = await supabase
    .from('user_memberships')
    .select(`
      user_id,
      profiles (first_name, last_name)
    `)
    .eq('tenant_id', membership.tenant_id)
    .eq('role', 'accountant')
    .eq('status', 'active')

  return { data: accountants || [] }
}

export async function getDirectorAccountantsActivity(schoolYearId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  const { data: membership } = await supabase
    .from('user_memberships')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership || membership.role !== 'director') return { data: [] }

  let targetYearId = schoolYearId;
  if (!targetYearId) {
    const { data: activeYear } = await supabase
      .from('school_years')
      .select('id')
      .eq('tenant_id', membership.tenant_id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    targetYearId = activeYear?.id;
  }

  // 1. Fetch accountants
  const { data: accountants } = await supabase
    .from('user_memberships')
    .select('user_id')
    .eq('tenant_id', membership.tenant_id)
    .eq('role', 'accountant')
    .eq('status', 'active')

  if (!accountants) return { data: [] }

  // 1b. Fetch their profiles
  const accountantIds = accountants.map(a => a.user_id);
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', accountantIds);

  const profileMap = new Map<string, any>();
  (profilesData || []).forEach((p: any) => {
    profileMap.set(p.id, p);
  });

  // 2. Fetch all confirmed payments
  let payQuery = supabase
    .from('payments')
    .select('amount, currency, recorded_by')
    .eq('tenant_id', membership.tenant_id)
    .eq('status', 'confirmed')

  if (targetYearId) {
    payQuery = payQuery.eq('school_year_id', targetYearId)
  }

  const { data: payments } = await payQuery;

  const result = accountants.map((acc: any) => {
    let count = 0;
    let cdf = 0;
    let usd = 0;

    (payments || []).forEach((p: any) => {
      if (p.recorded_by === acc.user_id) {
        count++;
        if (p.currency === 'CDF') cdf += Number(p.amount);
        else usd += Number(p.amount);
      }
    });

    const prof = profileMap.get(acc.user_id);
    const name = prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() : 'Inconnu';

    return {
      accountant_id: acc.user_id,
      name: name || 'Inconnu',
      payments_count: count,
      total_cdf: cdf,
      total_usd: usd,
    }
  });

  return { data: result.sort((a, b) => b.payments_count - a.payments_count) };
}

export async function getDirectorFeesReport(schoolYearId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  const { data: membership } = await supabase
    .from('user_memberships')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership || membership.role !== 'director') return { data: [] }

  let targetYearId = schoolYearId;
  if (!targetYearId) {
    const { data: activeYear } = await supabase
      .from('school_years')
      .select('id')
      .eq('tenant_id', membership.tenant_id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    targetYearId = activeYear?.id;
  }
  
  if (!targetYearId) return { data: [] }

  // Fetch obligations for the year with joined fee and schedule info
  const { data: obligations } = await supabase
    .from('financial_obligations')
    .select('initial_amount, paid_amount, remaining_amount, currency, fees(id, name), fee_schedules(id, month)')
    .eq('tenant_id', membership.tenant_id)
    .eq('school_year_id', targetYearId)

  const groups = new Map<string, any>();

  const monthNames = [
    '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  (obligations || []).forEach((ob: any) => {
    const fee = Array.isArray(ob.fees) ? ob.fees[0] : ob.fees;
    const schedule = Array.isArray(ob.fee_schedules) ? ob.fee_schedules[0] : ob.fee_schedules;
    
    if (!fee) return;

    const feeId = fee.id;
    const feeName = fee.name;
    const scheduleId = schedule?.id || 'none';
    
    let monthName = schedule?.month;
    const monthNumber = parseInt(monthName, 10);
    if (!isNaN(monthNumber) && monthNumber >= 1 && monthNumber <= 12) {
      monthName = monthNames[monthNumber];
    }
    
    const groupKey = `${feeId}-${scheduleId}`;
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        fee_id: groupKey, // For React key mapping
        fee_name: monthName ? `${feeName} ${monthName}` : feeName,
        cdf: { expected: 0, paid: 0, remaining: 0 },
        usd: { expected: 0, paid: 0, remaining: 0 },
      });
    }

    const g = groups.get(groupKey);
    
    if (ob.currency === 'CDF') {
      g.cdf.expected += Number(ob.initial_amount || 0);
      g.cdf.paid += Number(ob.paid_amount || 0);
      g.cdf.remaining += Number(ob.remaining_amount || 0);
    } else {
      g.usd.expected += Number(ob.initial_amount || 0);
      g.usd.paid += Number(ob.paid_amount || 0);
      g.usd.remaining += Number(ob.remaining_amount || 0);
    }
  });

  const result = Array.from(groups.values());

  return { data: result.filter(r => r.cdf.expected > 0 || r.usd.expected > 0) };
}
