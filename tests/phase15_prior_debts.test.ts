import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54341'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

function makeAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

// ─── Data refs ─────────────────────────────────────────────────────────────────
let archivedYearId: string
let studentIdA: string   // will have a CDF debt
let studentIdB: string   // fully paid, no debt
let studentIdC: string   // USD debt
let studentIdD: string   // two historical years
let archivedYear2Id: string

describe('Phase 15 — Prior Debts (Dettes antérieures)', () => {
  const admin = makeAdminClient()

  // ── Setup ──────────────────────────────────────────────────────────────────
  beforeAll(async () => {
    // 1. Archived year 1 (2025-2026)
    const { data: yr1, error: e1 } = await admin.from('school_years').insert({
      tenant_id: TENANT_ID,
      name: '2025-2026 Hist',
      start_date: '2025-09-01',
      end_date: '2026-06-30',
      status: 'archived'
    }).select('id').single()
    expect(e1).toBeNull()
    archivedYearId = yr1!.id

    // 2. Archived year 2 (2024-2025) for multi-year test
    const { data: yr2, error: e2 } = await admin.from('school_years').insert({
      tenant_id: TENANT_ID,
      name: '2024-2025 Hist',
      start_date: '2024-09-01',
      end_date: '2025-06-30',
      status: 'archived'
    }).select('id').single()
    expect(e2).toBeNull()
    archivedYear2Id = yr2!.id

    // 3. Class in each year
    const { data: cls1 } = await admin.from('classes').insert({
      tenant_id: TENANT_ID, school_year_id: archivedYearId, name: 'Hist-A'
    }).select('id').single()
    const { data: cls2 } = await admin.from('classes').insert({
      tenant_id: TENANT_ID, school_year_id: archivedYear2Id, name: 'Hist-B'
    }).select('id').single()

    // 4. Students
    const insertStudent = async (matricule: string, classId: string, yearId: string) => {
      const { data, error } = await admin.from('students').insert({
        tenant_id: TENANT_ID,
        school_year_id: yearId,
        class_id: classId,
        matricule,
        first_name: `Eleve`,
        last_name: matricule
      }).select('id').single()
      expect(error).toBeNull()
      return data!.id as string
    }

    studentIdA = await insertStudent('PHASETEST-A', cls1!.id, archivedYearId)
    studentIdB = await insertStudent('PHASETEST-B', cls1!.id, archivedYearId)
    studentIdC = await insertStudent('PHASETEST-C', cls1!.id, archivedYearId)
    studentIdD = await insertStudent('PHASETEST-D', cls1!.id, archivedYearId)

    // 5. Fees
    const makeFee = async (name: string, currency: string) => {
      const { data } = await admin.from('fees').insert({
        tenant_id: TENANT_ID,
        name,
        default_amount: 100000,
        currency,
        type: 'one_time',
        category: 'other',
        created_by: null
      }).select('id').single()
      return data!.id as string
    }

    const feeCDFId = await makeFee('Frais CDF Test', 'CDF')
    const feeUSDId = await makeFee('Frais USD Test', 'USD')

    // Helper to create obligation (initial_amount = remaining, paid_amount = 0 by default via trigger)
    const makeObligation = async (studentId: string, yearId: string, feeId: string, amount: number, currency: string) => {
      const { data, error } = await admin.from('financial_obligations').insert({
        tenant_id: TENANT_ID,
        school_year_id: yearId,
        student_id: studentId,
        fee_id: feeId,
        initial_amount: amount,
        paid_amount: 0,
        remaining_amount: amount,
        currency,
        status: 'unpaid'
      }).select('id').single()
      expect(error).toBeNull()
      return data!.id as string
    }

    // Student A — CDF debt: 1,500,000, will pay 1,200,000 → debt 300,000
    const oblA = await makeObligation(studentIdA, archivedYearId, feeCDFId, 1500000, 'CDF')

    // Student B — CDF: 500,000, fully paid
    const oblB = await makeObligation(studentIdB, archivedYearId, feeCDFId, 500000, 'CDF')

    // Student C — USD debt: 50 USD unpaid
    const oblC = await makeObligation(studentIdC, archivedYearId, feeUSDId, 50, 'USD')

    // Student D — two years of debt
    await makeObligation(studentIdD, archivedYearId, feeCDFId, 200000, 'CDF')
    const { data: clsDy } = await admin.from('classes').insert({
      tenant_id: TENANT_ID, school_year_id: archivedYear2Id, name: 'Hist-D-Year2'
    }).select('id').single()
    const studentDYear2 = await insertStudent('PHASETEST-D2', clsDy!.id, archivedYear2Id)
    // D also exists in the 2nd year with 100,000 debt
    await makeObligation(studentDYear2, archivedYear2Id, feeCDFId, 100000, 'CDF')

    // Payment method
    const { data: pm } = await admin.from('payment_methods').insert({
      tenant_id: TENANT_ID, name: 'Cash P15', code: 'CASH_P15'
    }).select('id').single()

    const { data: profile } = await admin.from('profiles').select('id').limit(1).single()
    const recordedBy = profile!.id

    // Pay student A 1,200,000 / 1,500,000
    const { data: payA } = await admin.from('payments').insert({
      tenant_id: TENANT_ID,
      school_year_id: archivedYearId,
      student_id: studentIdA,
      amount: 1200000,
      currency: 'CDF',
      payment_date: '2026-03-01',
      payment_method_id: pm!.id,
      recorded_by: recordedBy,
      status: 'confirmed'
    }).select('id').single()

    await admin.from('payment_allocations').insert({
      tenant_id: TENANT_ID,
      payment_id: payA!.id,
      obligation_id: oblA,
      amount: 1200000
    })
    // Update obligation paid_amount
    await admin.from('financial_obligations').update({
      paid_amount: 1200000, remaining_amount: 300000
    }).eq('id', oblA)

    // Pay student B fully
    const { data: payB } = await admin.from('payments').insert({
      tenant_id: TENANT_ID,
      school_year_id: archivedYearId,
      student_id: studentIdB,
      amount: 500000,
      currency: 'CDF',
      payment_date: '2026-03-01',
      payment_method_id: pm!.id,
      recorded_by: recordedBy,
      status: 'confirmed'
    }).select('id').single()
    await admin.from('payment_allocations').insert({
      tenant_id: TENANT_ID,
      payment_id: payB!.id,
      obligation_id: oblB,
      amount: 500000
    })
    await admin.from('financial_obligations').update({
      paid_amount: 500000, remaining_amount: 0, status: 'paid'
    }).eq('id', oblB)
  })

  // ── 1. Basic debt generation ────────────────────────────────────────────────
  it('Student A has a CDF debt of 300,000', async () => {
    const { data, error } = await admin
      .from('prior_debts')
      .select('*')
      .eq('student_id', studentIdA)
      .eq('currency', 'CDF')
    expect(error).toBeNull()
    expect(data?.length).toBe(1)
    expect(Number(data![0].initial_amount)).toBe(1500000)
    expect(Number(data![0].remaining_amount)).toBe(300000)
    expect(data![0].status).toBe('OPEN')
  })

  it('Student B has no debt (fully paid)', async () => {
    const { data } = await admin
      .from('prior_debts')
      .select('*')
      .eq('student_id', studentIdB)
    expect(data?.length).toBe(0)
  })

  it('Student C has a USD debt of 50', async () => {
    const { data, error } = await admin
      .from('prior_debts')
      .select('*')
      .eq('student_id', studentIdC)
      .eq('currency', 'USD')
    expect(error).toBeNull()
    expect(data?.length).toBe(1)
    expect(Number(data![0].remaining_amount)).toBe(50)
    expect(data![0].currency).toBe('USD')
  })

  // ── 2. Idempotence ──────────────────────────────────────────────────────────
  it('Running the view twice does not double the debt', async () => {
    const { data: first } = await admin.from('prior_debts').select('remaining_amount').eq('student_id', studentIdA)
    const { data: second } = await admin.from('prior_debts').select('remaining_amount').eq('student_id', studentIdA)
    expect(Number(first![0].remaining_amount)).toBe(Number(second![0].remaining_amount))
  })

  // ── 3. Multi-currency strict separation ────────────────────────────────────
  it('CDF and USD debts are never merged', async () => {
    // Student A only has CDF, Student C only has USD
    const { data: aDebts } = await admin.from('prior_debts').select('currency').eq('student_id', studentIdA)
    const { data: cDebts } = await admin.from('prior_debts').select('currency').eq('student_id', studentIdC)
    expect(aDebts?.every(d => d.currency === 'CDF')).toBe(true)
    expect(cDebts?.every(d => d.currency === 'USD')).toBe(true)
  })

  // ── 4. Cancelled payments do NOT reduce debt ────────────────────────────────
  it('Cancelled payment on Student C does not reduce their debt', async () => {
    const { data: profile } = await admin.from('profiles').select('id').limit(1).single()
    const { data: pm } = await admin.from('payment_methods').select('id').eq('code', 'CASH_P15').single()
    
    const { data: oblC } = await admin.from('financial_obligations')
      .select('id').eq('student_id', studentIdC).single()

    // Create a payment then cancel it
    const { data: pay } = await admin.from('payments').insert({
      tenant_id: TENANT_ID,
      school_year_id: archivedYearId,
      student_id: studentIdC,
      amount: 25,
      currency: 'USD',
      payment_date: '2026-01-01',
      payment_method_id: pm!.id,
      recorded_by: profile!.id,
      status: 'cancelled'
    }).select('id').single()

    await admin.from('payment_allocations').insert({
      tenant_id: TENANT_ID,
      payment_id: pay!.id,
      obligation_id: oblC!.id,
      amount: 25
    })

    // View only counts confirmed payments → debt should still be 50
    const { data } = await admin.from('prior_debts').select('remaining_amount').eq('student_id', studentIdC)
    expect(Number(data![0].remaining_amount)).toBe(50)
  })

  // ── 5. Multi-year debts are separate ──────────────────────────────────────
  it('Multiple archived years produce separate debt rows', async () => {
    const { data } = await admin
      .from('prior_debts')
      .select('school_year_id, remaining_amount')
      .eq('currency', 'CDF')
      .in('school_year_id', [archivedYearId, archivedYear2Id])
    // Student D in year1, and PHASETEST-D2 in year2 each have debts
    expect(data!.length).toBeGreaterThanOrEqual(2)
    const yearIds = data!.map(d => d.school_year_id)
    expect(yearIds).toContain(archivedYearId)
    expect(yearIds).toContain(archivedYear2Id)
  })

  // ── 6. Debt linked to archived years only ─────────────────────────────────
  it('Obligations in active years do NOT appear in prior_debts', async () => {
    // Any active year obligations should not appear
    const { data: activeYears } = await admin
      .from('school_years')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .eq('status', 'active')

    if (!activeYears || activeYears.length === 0) return

    for (const yr of activeYears) {
      const { data } = await admin
        .from('prior_debts')
        .select('school_year_id')
        .eq('school_year_id', yr.id)
      expect(data?.length).toBe(0)
    }
  })
})
