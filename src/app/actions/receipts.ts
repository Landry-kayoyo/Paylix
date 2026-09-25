'use server'

import { createClient } from '@/lib/supabase/server'
import { formatPeriodMonthLabel } from '@/lib/month-label'

export interface GetReceiptsFilters {
  school_year_id?: string;
  class_id?: string;
  status?: string;
  currency?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getReceipts(filters: GetReceiptsFilters = {}) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized', data: [], total: 0 }
  }

  // Vérification de la membership active
  const { data: membership } = await supabase
    .from('user_memberships')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership || (membership.role !== 'accountant' && membership.role !== 'director')) {
    return { error: 'Forbidden', data: [], total: 0 }
  }

  const tenantId = membership.tenant_id;
  const isAccountant = membership.role === 'accountant';
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('receipts')
    .select(`
      id,
      receipt_number,
      verification_token,
      issued_at,
      created_at,
      payments!inner (
        id,
        amount,
        currency,
        payment_group_id,
        payment_date,
        status,
        cancellation_reason,
        cancelled_at,
        school_year_id,
        student_id,
        recorded_by,
        students!inner (
          id,
          first_name,
          last_name,
          post_name,
          matricule
        ),
        profiles:recorded_by (
          first_name,
          last_name
        )
      )
    `, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  // Comptable: ne voit que ses propres reçus
  if (isAccountant) {
    query = query.eq('payments.recorded_by', user.id)
  }

  if (filters.school_year_id) {
    query = query.eq('payments.school_year_id', filters.school_year_id)
  }

  if (filters.status) {
    query = query.eq('payments.status', filters.status)
  }

  if (filters.currency) {
    query = query.eq('payments.currency', filters.currency)
  }

  if (filters.start_date) {
    query = query.gte('payments.payment_date', filters.start_date)
  }

  if (filters.end_date) {
    query = query.lte('payments.payment_date', filters.end_date)
  }

  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) {
    console.error('Erreur lors de la récupération des reçus:', JSON.stringify(error))
    return { error: error.message, data: [], total: 0 }
  }

  const studentIds = Array.from(new Set((data || []).map((row: any) => row.payments?.students?.id).filter(Boolean)));
  const classNames = new Map<string, string>();
  if (studentIds.length > 0) {
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('student_enrollments')
      .select('student_id, classes (name)')
      .in('student_id', studentIds)
      .eq('status', 'active');

    if (enrollmentError) {
      console.error('Erreur lors de la récupération des classes:', JSON.stringify(enrollmentError));
    }

    (enrollments || []).forEach((enrollment: any) => {
      const className = Array.isArray(enrollment.classes) ? enrollment.classes[0]?.name : enrollment.classes?.name;
      if (className && !classNames.has(enrollment.student_id)) {
        classNames.set(enrollment.student_id, className);
      }
    });
  }

  // Récupérer les noms des comptables via leurs IDs (recorded_by)
  const recordedByIds = Array.from(new Set((data || []).map((row: any) => row.payments?.recorded_by).filter(Boolean)));
  const profilesMap = new Map<string, string>();
  if (recordedByIds.length > 0) {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', recordedByIds);

    (profilesData || []).forEach((prof: any) => {
      profilesMap.set(prof.id, `${prof.first_name} ${prof.last_name}`.trim());
    });
  }

  // Formater les données pour l'UI
  const formattedData = (data || []).map((r: any) => {
    const p = r.payments;
    const s = p?.students;
    const className = classNames.get(s?.id) || 'Non assigné';

    return {
      id: r.id,
      receipt_number: r.receipt_number,
      verification_token: r.verification_token,
      issued_at: r.issued_at,
      payment_id: p.id,
      payment_group_id: p.payment_group_id,
      payment_date: p.payment_date,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      cancellation_reason: p.cancellation_reason,
      cancelled_at: p.cancelled_at,
      student_name: [s?.last_name, s?.post_name, s?.first_name].filter(Boolean).join(' ').toUpperCase(),
      matricule: s?.matricule || '-',
      class_name: className,
      recorded_by: (p.recorded_by && profilesMap.get(p.recorded_by)) || 'Système',
    }
  })

  // Regrouper les reçus par payment_group_id (paiements multi-devises = 1 seul reçu)
  const groupedMap = new Map<string, any>();
  const ungrouped: any[] = [];

  formattedData.forEach((r: any) => {
    if (r.payment_group_id) {
      if (groupedMap.has(r.payment_group_id)) {
        const existing = groupedMap.get(r.payment_group_id);
        // Ajouter les montants des autres devises
        if (!existing.amounts) {
          existing.amounts = [{ amount: existing.amount, currency: existing.currency }];
        }
        existing.amounts.push({ amount: r.amount, currency: r.currency });
      } else {
        (r as any).amounts = [{ amount: r.amount, currency: r.currency }];
        groupedMap.set(r.payment_group_id, r);
      }
    } else {
      (r as any).amounts = [{ amount: r.amount, currency: r.currency }];
      ungrouped.push(r);
    }
  });

  const mergedData = [...groupedMap.values(), ...ungrouped];
  mergedData.sort((a, b) => new Date(b.issued_at || b.payment_date).getTime() - new Date(a.issued_at || a.payment_date).getTime());

  // Filtrage par recherche texte si renseigné
  let finalResult = mergedData;
  if (filters.search && filters.search.trim() !== '') {
    const q = filters.search.toLowerCase().trim();
    finalResult = mergedData.filter(r => 
      r.receipt_number.toLowerCase().includes(q) ||
      r.student_name.toLowerCase().includes(q) ||
      r.matricule.toLowerCase().includes(q)
    );
  }

  return { data: finalResult, total: count || finalResult.length }
}

export async function getReceiptDetails(receiptId: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  // 1. Récupérer le reçu et le paiement associé
  const { data: receipt, error: rError } = await supabase
    .from('receipts')
    .select(`
      id,
      tenant_id,
      receipt_number,
      verification_token,
      issued_at,
      payments (
        id,
        amount,
        currency,
        payment_group_id,
        payment_date,
        status,
        notes,
        cancellation_reason,
        cancelled_at,
        school_year_id,
        student_id,
        recorded_by,
        students (
          id,
          first_name,
          last_name,
          post_name,
          matricule,
          student_enrollments (
            classes (id, name)
          )
        ),
        profiles:recorded_by (first_name, last_name),
        cancelled_by_user:cancelled_by (first_name, last_name),
        school_years (name, start_date, end_date)
      )
    `)
    .eq('id', receiptId)
    .single()

  if (rError || !receipt) {
    return { error: rError?.message || 'Reçu introuvable' }
  }

  // 2. Récupérer les informations de l'établissement
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, logo_url, address, phone, email, city, country')
    .eq('id', receipt.tenant_id)
    .single()

  // 3. Récupérer le détail des allocations du paiement
  const payment = receipt.payments as any;
  const { data: groupedPayments } = payment.payment_group_id
    ? await supabase
        .from('payments')
        .select('id, amount, currency, status')
        .eq('payment_group_id', payment.payment_group_id)
    : { data: [payment] };
  const paymentsInReceipt = groupedPayments?.length ? groupedPayments : [payment];
  const paymentIds = paymentsInReceipt.map((item: any) => item.id);
  const { data: allocations } = await supabase
    .from('payment_allocations')
    .select(`
      id,
      payment_id,
      amount,
      financial_obligations (
        id,
        initial_amount,
        paid_amount,
        remaining_amount,
        currency,
        status,
        fees (name),
        fee_schedules (month, due_date)
      )
    `)
    .in('payment_id', paymentIds)

  const student = payment.students;
  const className = student?.student_enrollments?.[0]?.classes?.name || 'Non assigné';

  // Calculer pour chaque allocation la situation avant et après ce paiement
  const formattedAllocations = (allocations || []).map((a: any) => {
    const ob = a.financial_obligations;
    const allocAmount = Number(a.amount);
    const currentPaid = Number(ob?.paid_amount || 0);
    const initialAmount = Number(ob?.initial_amount || 0);
    
    // Si le paiement est actif, le montant payé avant ce paiement était (currentPaid - allocAmount)
    // Si le paiement est annulé, paid_amount en DB est déjà soustrait.
    const allocationPayment = paymentsInReceipt.find((item: any) => item.id === a.payment_id) || payment;
    const paidBefore = allocationPayment.status === 'confirmed' ? Math.max(0, currentPaid - allocAmount) : currentPaid;
    const remainingAfter = allocationPayment.status === 'confirmed' ? Math.max(0, initialAmount - (paidBefore + allocAmount)) : ob?.remaining_amount;

    return {
      id: a.id,
      fee_name: ob?.fees?.name || 'Frais scolaire',
      period_month: formatPeriodMonthLabel(ob?.fee_schedules?.month ?? null),
      initial_amount: initialAmount,
      paid_before: paidBefore,
      allocated_amount: allocAmount,
      remaining_after: remainingAfter,
      currency: ob?.currency || payment.currency,
    }
  })

  return {
    data: {
      receipt_id: receipt.id,
      receipt_number: receipt.receipt_number,
      verification_token: receipt.verification_token,
      issued_at: receipt.issued_at,
      payment_id: payment.id,
      payment_date: payment.payment_date,
      amount: payment.amount,
      currency: payment.currency,
      currency_totals: formattedAllocations.reduce((totals: Record<string, number>, allocation: any) => {
        totals[allocation.currency] = (totals[allocation.currency] || 0) + Number(allocation.allocated_amount || 0);
        return totals;
      }, {}),
      status: payment.status,
      cancellation_reason: payment.cancellation_reason,
      cancelled_at: payment.cancelled_at,
      cancelled_by: payment.cancelled_by_user ? `${payment.cancelled_by_user.first_name} ${payment.cancelled_by_user.last_name}` : null,
      school_year_name: payment.school_years?.name || '',
      recorded_by: payment.profiles ? `${payment.profiles.first_name} ${payment.profiles.last_name}` : 'Système',
      student: {
        id: student?.id,
        first_name: student?.first_name,
        last_name: student?.last_name,
        post_name: student?.post_name,
        full_name: [student?.last_name, student?.post_name, student?.first_name].filter(Boolean).join(' ').toUpperCase(),
        matricule: student?.matricule,
        class_name: className,
      },
      tenant: tenant || { name: 'Établissement' },
      allocations: formattedAllocations,
    }
  }
}

export async function verifyReceiptPublic(token: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('verify_receipt_public', {
    p_token: token
  })

  if (error || !data) {
    return { valid: false, message: 'Erreur lors de la vérification du reçu.' }
  }

  return data
}
