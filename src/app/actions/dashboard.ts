'use server'

import { createClient } from '@/lib/supabase/server'

export interface DashboardStats {
  collected_month_cdf: number;
  collected_month_usd: number;
  remaining_cdf: number;
  remaining_usd: number;
  overdue_count: number;
  overdue_obligations: Array<{
    student_name: string;
    class_name: string;
    amount: number;
    currency: string;
    days_overdue: number;
  }>;
  recent_payments: Array<{
    receipt_number: string;
    student_name: string;
    amount: number;
    currency: string;
    status: string;
    payment_date: string;
  }>;
  daily_chart: Array<{
    day: string;
    cdf: number;
    usd: number;
  }>;
}

export async function getDashboardStats(): Promise<{ data?: DashboardStats; error?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  const { data: membership } = await supabase
    .from('user_memberships')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership || (membership.role !== 'accountant' && membership.role !== 'director')) {
    return { error: 'Forbidden' }
  }

  const tenantId = membership.tenant_id

  // Current month boundaries
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  // 1. Payments this month (confirmed)
  const { data: monthPayments } = await supabase
    .from('payments')
    .select('amount, currency')
    .eq('tenant_id', tenantId)
    .eq('status', 'confirmed')
    .gte('payment_date', monthStart)
    .lte('payment_date', monthEnd)

  let collected_month_cdf = 0
  let collected_month_usd = 0
  ;(monthPayments || []).forEach(p => {
    if (p.currency === 'CDF') collected_month_cdf += Number(p.amount)
    else if (p.currency === 'USD') collected_month_usd += Number(p.amount)
  })

  // 2. Remaining obligations
  const { data: obligations } = await supabase
    .from('financial_obligations')
    .select('remaining_amount, currency, status, due_date, student_id, students(first_name, last_name, student_enrollments(class_school_years(classes(name))))')
    .eq('tenant_id', tenantId)
    .in('status', ['unpaid', 'partial', 'overdue'])

  let remaining_cdf = 0
  let remaining_usd = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const overdueList: DashboardStats['overdue_obligations'] = []

  ;(obligations || []).forEach((ob: any) => {
    const rem = Number(ob.remaining_amount || 0)
    if (ob.currency === 'CDF') remaining_cdf += rem
    else if (ob.currency === 'USD') remaining_usd += rem

    if (ob.due_date) {
      const dueDate = new Date(ob.due_date)
      dueDate.setHours(0, 0, 0, 0)
      if (dueDate < today && rem > 0) {
        const days = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        const s = ob.students
        const className = s?.student_enrollments?.[0]?.class_school_years?.classes?.name || 'Non assigné'
        overdueList.push({
          student_name: s ? `${s.first_name} ${s.last_name}`.trim() : 'Élève',
          class_name: className,
          amount: rem,
          currency: ob.currency,
          days_overdue: days,
        })
      }
    }
  })

  overdueList.sort((a, b) => b.days_overdue - a.days_overdue)
  const overdue_obligations = overdueList.slice(0, 5)
  const overdue_count = overdueList.length

  // 3. Recent payments (with receipt number)
  const { data: recentRaw } = await supabase
    .from('payments')
    .select(`
      id, amount, currency, payment_date, status,
      students(first_name, last_name),
      receipts(receipt_number)
    `)
    .eq('tenant_id', tenantId)
    .order('payment_date', { ascending: false })
    .limit(8)

  const recent_payments = (recentRaw || []).map((p: any) => {
    const s = p.students
    const receipt = Array.isArray(p.receipts) ? p.receipts[0] : p.receipts
    return {
      receipt_number: receipt?.receipt_number || p.id.slice(0, 8).toUpperCase(),
      student_name: s ? `${s.first_name} ${s.last_name}`.trim() : 'Élève',
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      payment_date: p.payment_date,
    }
  })

  // 4. Daily chart — last 7 days confirmed payments
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

  const { data: dailyPayments } = await supabase
    .from('payments')
    .select('amount, currency, payment_date')
    .eq('tenant_id', tenantId)
    .eq('status', 'confirmed')
    .gte('payment_date', sevenDaysAgoStr)

  // Build chart map
  const dayMap = new Map<string, { cdf: number; usd: number }>()
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    dayMap.set(key, { cdf: 0, usd: 0 })
  }

  ;(dailyPayments || []).forEach(p => {
    const key = p.payment_date
    if (dayMap.has(key)) {
      const entry = dayMap.get(key)!
      if (p.currency === 'CDF') entry.cdf += Number(p.amount)
      else if (p.currency === 'USD') entry.usd += Number(p.amount)
    }
  })

  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const daily_chart = Array.from(dayMap.entries()).map(([dateStr, vals]) => {
    const d = new Date(dateStr)
    return {
      day: dayNames[d.getDay()],
      cdf: vals.cdf,
      usd: vals.usd,
    }
  })

  return {
    data: {
      collected_month_cdf,
      collected_month_usd,
      remaining_cdf,
      remaining_usd,
      overdue_count,
      overdue_obligations,
      recent_payments,
      daily_chart,
    }
  }
}
