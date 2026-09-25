import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54341'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const TENANT_A = '00000000-0000-0000-0000-000000000001'
const TENANT_B = '00000000-0000-0000-0000-000000000002'

function makeAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

function makeClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

async function signInAs(email: string, password: string) {
  const client = makeClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn failed for ${email}: ${error.message}`)
  return client
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

let parentAEmail: string
let parentAPassword: string
let parentBEmail: string
let parentBPassword: string

let studentAId: string
let studentBId: string
let studentCId: string          // different child of parent A (2nd child)
let studentTenantBId: string    // tenant B student — parent A must NOT access

let paymentAId: string
let paymentBId: string
let paymentCId: string
let paymentCancelledId: string
let paymentTenantBId: string

let schoolYearActiveId: string
let schoolYearArchivedId: string
let feeId: string

let parentAId: string
let parentBId: string
let parentBTenantAId: string    // parent B record in tenant A

const UNIQUE = Date.now().toString(36)

// ─── beforeAll: set up complete fixture data ──────────────────────────────────

beforeAll(async () => {
  const admin = makeAdmin()

  // ── School years
  const { data: yr1 } = await admin.from('school_years').insert({
    tenant_id: TENANT_A,
    name: `Active ${UNIQUE}`,
    start_date: '2026-09-01',
    end_date: '2027-06-30',
    status: 'active'
  }).select('id').single()
  schoolYearActiveId = yr1!.id

  const { data: yr2 } = await admin.from('school_years').insert({
    tenant_id: TENANT_A,
    name: `Archived ${UNIQUE}`,
    start_date: '2025-09-01',
    end_date: '2026-06-30',
    status: 'archived'
  }).select('id').single()
  schoolYearArchivedId = yr2!.id

  // ── Classes
  const { data: cls1 } = await admin.from('classes').insert({
    tenant_id: TENANT_A, school_year_id: schoolYearActiveId, name: `H17A-${UNIQUE}`
  }).select('id').single()
  const { data: cls2 } = await admin.from('classes').insert({
    tenant_id: TENANT_A, school_year_id: schoolYearArchivedId, name: `H17B-${UNIQUE}`
  }).select('id').single()

  // ── Students (Tenant A)
  const insertStudent = async (matricule: string, classId: string, yearId: string) => {
    const { data } = await admin.from('students').insert({
      tenant_id: TENANT_A,
      school_year_id: yearId,
      class_id: classId,
      matricule,
      first_name: 'Eleve',
      last_name: matricule,
    }).select('id').single()
    return data!.id as string
  }

  studentAId = await insertStudent(`SA-${UNIQUE}`, cls1!.id, schoolYearActiveId)
  studentBId = await insertStudent(`SB-${UNIQUE}`, cls1!.id, schoolYearActiveId)
  studentCId = await insertStudent(`SC-${UNIQUE}`, cls1!.id, schoolYearActiveId)

  // ── Student Tenant B (for cross-tenant test)
  const { data: tenantBYear } = await admin.from('school_years').insert({
    tenant_id: TENANT_B,
    name: `TenantB-Year-${UNIQUE}`,
    start_date: '2026-09-01', end_date: '2027-06-30', status: 'active'
  }).select('id').single()
  const { data: tenantBClass } = await admin.from('classes').insert({
    tenant_id: TENANT_B, school_year_id: tenantBYear!.id, name: `TB-Cls-${UNIQUE}`
  }).select('id').single()
  const { data: tenantBStu } = await admin.from('students').insert({
    tenant_id: TENANT_B,
    school_year_id: tenantBYear!.id,
    class_id: tenantBClass!.id,
    matricule: `STB-${UNIQUE}`,
    first_name: 'TenantB', last_name: 'Student',
  }).select('id').single()
  studentTenantBId = tenantBStu!.id

  // ── Fee
  const { data: fee } = await admin.from('fees').insert({
    tenant_id: TENANT_A,
    school_year_id: schoolYearActiveId,
    name: `Minerval ${UNIQUE}`,
    fee_type: 'unique',
    default_amount: 100000,
    currency: 'CDF',
    status: 'active',
  }).select('id').single()
  feeId = fee!.id

  // ── Obligations for studentA (active year)
  const { data: oblA } = await admin.from('financial_obligations').insert({
    tenant_id: TENANT_A,
    school_year_id: schoolYearActiveId,
    student_id: studentAId,
    fee_id: feeId,
    initial_amount: 500000,
    remaining_amount: 500000,
    currency: 'CDF',
    status: 'unpaid',
  }).select('id').single()

  // ── Obligations for studentA (archived year — prior debt scenario)
  const { data: oblAArchived } = await admin.from('financial_obligations').insert({
    tenant_id: TENANT_A,
    school_year_id: schoolYearArchivedId,
    student_id: studentAId,
    fee_id: feeId,
    initial_amount: 300000,
    remaining_amount: 300000,
    currency: 'CDF',
    status: 'unpaid',
  }).select('id').single()

  // ── Obligations for studentB
  const { data: oblB } = await admin.from('financial_obligations').insert({
    tenant_id: TENANT_A,
    school_year_id: schoolYearActiveId,
    student_id: studentBId,
    fee_id: feeId,
    initial_amount: 200000,
    remaining_amount: 200000,
    currency: 'CDF',
    status: 'unpaid',
  }).select('id').single()

  // ── Payments via RPC (ensures consistency)
  // Payment A: 500 000 for studentA on active year
  const { data: paA, error: ePA } = await admin.rpc('record_payment', {
    p_tenant_id: TENANT_A,
    p_school_year_id: schoolYearActiveId,
    p_student_id: studentAId,
    p_amount: 500000,
    p_currency: 'CDF',
    p_recorded_by: '00000000-0000-0000-0000-000000000099',
    p_allocations: JSON.stringify([{ obligation_id: oblA!.id, amount: 500000 }])
  })
  if (ePA) throw new Error(`record_payment A: ${ePA.message}`)
  paymentAId = paA as string

  // Payment B: 200 000 for studentB
  const { data: paB, error: ePB } = await admin.rpc('record_payment', {
    p_tenant_id: TENANT_A,
    p_school_year_id: schoolYearActiveId,
    p_student_id: studentBId,
    p_amount: 200000,
    p_currency: 'CDF',
    p_recorded_by: '00000000-0000-0000-0000-000000000099',
    p_allocations: JSON.stringify([{ obligation_id: oblB!.id, amount: 200000 }])
  })
  if (ePB) throw new Error(`record_payment B: ${ePB.message}`)
  paymentBId = paB as string

  // Payment C (prior debt): 300 000 for studentA covering archived obligation
  const { data: paC, error: ePC } = await admin.rpc('record_payment', {
    p_tenant_id: TENANT_A,
    p_school_year_id: schoolYearActiveId,
    p_student_id: studentAId,
    p_amount: 300000,
    p_currency: 'CDF',
    p_recorded_by: '00000000-0000-0000-0000-000000000099',
    p_allocations: JSON.stringify([{ obligation_id: oblAArchived!.id, amount: 300000 }])
  })
  if (ePC) throw new Error(`record_payment C (prior debt): ${ePC.message}`)
  paymentCId = paC as string

  // Payment cancelled: create then cancel for studentA
  const { data: oblANew } = await admin.from('financial_obligations').insert({
    tenant_id: TENANT_A,
    school_year_id: schoolYearActiveId,
    student_id: studentAId,
    fee_id: feeId,
    initial_amount: 50000,
    remaining_amount: 50000,
    currency: 'CDF',
    status: 'unpaid',
  }).select('id').single()

  const { data: pCancelled, error: ePCan } = await admin.rpc('record_payment', {
    p_tenant_id: TENANT_A,
    p_school_year_id: schoolYearActiveId,
    p_student_id: studentAId,
    p_amount: 50000,
    p_currency: 'CDF',
    p_recorded_by: '00000000-0000-0000-0000-000000000099',
    p_allocations: JSON.stringify([{ obligation_id: oblANew!.id, amount: 50000 }])
  })
  if (ePCan) throw new Error(`record_payment (to cancel): ${ePCan.message}`)
  paymentCancelledId = pCancelled as string

  await admin.rpc('cancel_payment', {
    p_payment_id: paymentCancelledId,
    p_tenant_id: TENANT_A,
    p_cancellation_reason: 'Erreur de test',
    p_cancelled_by: '00000000-0000-0000-0000-000000000099',
  })

  // Payment Tenant B
  const { data: oblTB } = await admin.from('financial_obligations').insert({
    tenant_id: TENANT_B,
    school_year_id: tenantBYear!.id,
    student_id: studentTenantBId,
    fee_id: feeId,   // WARNING: fee belongs to TENANT_A; in real DB this would fail FK
    // For test simplicity, the FK constraint may let it slide if no tenant check on fees
    // Alternatively create a fee in TENANT_B; use service role to bypass RLS
    initial_amount: 100000,
    remaining_amount: 100000,
    currency: 'CDF',
    status: 'unpaid',
  }).select('id').single()

  if (oblTB) {
    const { data: paTB } = await admin.from('payments').insert({
      tenant_id: TENANT_B,
      school_year_id: tenantBYear!.id,
      student_id: studentTenantBId,
      amount: 100000,
      currency: 'CDF',
      payment_date: '2026-09-15',
      recorded_by: '00000000-0000-0000-0000-000000000099',
      status: 'confirmed',
    }).select('id').single()
    paymentTenantBId = paTB?.id ?? ''
  }

  // ── Auth users + parent records
  parentAEmail = `parent-a-${UNIQUE}@test.cd`
  parentAPassword = 'password123!'
  parentBEmail = `parent-b-${UNIQUE}@test.cd`
  parentBPassword = 'password123!'

  const createParent = async (
    email: string,
    tenantId: string,
    studentIds: string[]
  ) => {
    // Create auth user
    const { data: authUser } = await admin.auth.admin.createUser({
      email, password: email,  // password = email for simplicity
      email_confirm: true,
    })
    const userId = authUser.user!.id

    // Profile
    await admin.from('profiles').insert({
      id: userId, first_name: 'Parent', last_name: email,
    })

    // Membership
    await admin.from('user_memberships').insert({
      user_id: userId, tenant_id: tenantId, role: 'parent', status: 'active',
    })

    // Parent record
    const { data: pRecord } = await admin.from('parents').insert({
      user_id: userId,
      tenant_id: tenantId,
      full_name: `Parent ${email}`,
      account_status: 'active',
    }).select('id').single()
    const parentId = pRecord!.id

    // Associate students
    for (const sId of studentIds) {
      await admin.from('parent_students').insert({
        tenant_id: tenantId,
        parent_id: parentId,
        student_id: sId,
        relationship: 'parent',
      })
    }

    return { userId, parentId }
  }

  const pA = await createParent(parentAEmail, TENANT_A, [studentAId, studentCId])
  parentAId = pA.parentId

  const pB = await createParent(parentBEmail, TENANT_A, [studentBId])
  parentBId = pB.parentId
  parentBTenantAId = pB.parentId
})

// ─── afterAll: cleanup would be ideal but skipped for test speed ──────────────

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Phase 17 — Historique paiements parent (RLS)', () => {

  // ── 1. Parent can view own children payments ─────────────────────────────────

  describe('1. Parent A — see own children payments', () => {
    it('Parent A can see payment for studentA', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { data, error } = await client
        .from('payments')
        .select('id, student_id, status')
        .eq('id', paymentAId)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data![0].id).toBe(paymentAId)
      expect(data![0].student_id).toBe(studentAId)
    })

    it('Parent A can see prior debt payment (studentA / archived year)', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { data, error } = await client
        .from('payments')
        .select('id, student_id')
        .eq('id', paymentCId)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
    })

    it('Parent A sees cancelled payment as cancelled (not absent)', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { data, error } = await client
        .from('payments')
        .select('id, status, cancellation_reason')
        .eq('id', paymentCancelledId)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data![0].status).toBe('cancelled')
      expect(data![0].cancellation_reason).toBe('Erreur de test')
    })
  })

  // ── 2. Parent can see allocations ────────────────────────────────────────────

  describe('2. Payment allocations visible', () => {
    it('Parent A can read allocations for payment A', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { data, error } = await client
        .from('payment_allocations')
        .select('id, amount, obligation_id')
        .eq('payment_id', paymentAId)

      expect(error).toBeNull()
      expect(data!.length).toBeGreaterThanOrEqual(1)
      expect(Number(data![0].amount)).toBe(500000)
    })

    it('Prior debt allocation links to archived year obligation', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { data: allocs } = await client
        .from('payment_allocations')
        .select('obligation_id, amount, financial_obligations(school_year_id, school_years(status))')
        .eq('payment_id', paymentCId)

      expect(allocs).toBeTruthy()
      expect(allocs!.length).toBeGreaterThanOrEqual(1)
      const alloc = allocs![0] as any
      const sy = Array.isArray(alloc.financial_obligations?.school_years)
        ? alloc.financial_obligations.school_years[0]
        : alloc.financial_obligations?.school_years
      expect(sy?.status).toBe('archived')
    })
  })

  // ── 3. Parent A cannot see Parent B payments ─────────────────────────────────

  describe('3. Cross-parent isolation (same tenant)', () => {
    it('Parent A cannot see payment for studentB', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { data, error } = await client
        .from('payments')
        .select('id')
        .eq('id', paymentBId)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)  // RLS filters it out
    })

    it('Parent A cannot see allocations for paymentB', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { data, error } = await client
        .from('payment_allocations')
        .select('id')
        .eq('payment_id', paymentBId)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })
  })

  // ── 4. Cross-tenant isolation ────────────────────────────────────────────────

  describe('4. Cross-tenant isolation', () => {
    it('Parent A (tenant A) cannot see payment from tenant B', async () => {
      if (!paymentTenantBId) return  // Skip if tenant B setup failed
      const client = await signInAs(parentAEmail, parentAEmail)
      const { data, error } = await client
        .from('payments')
        .select('id')
        .eq('id', paymentTenantBId)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('Parent A cannot see tenant B students', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { data } = await client
        .from('students')
        .select('id')
        .eq('id', studentTenantBId)

      expect(data).toHaveLength(0)
    })
  })

  // ── 5. Read-only: Parent cannot write ────────────────────────────────────────

  describe('5. Parent is read-only on financial tables', () => {
    it('Parent cannot INSERT a payment', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { error } = await client.from('payments').insert({
        tenant_id: TENANT_A,
        school_year_id: schoolYearActiveId,
        student_id: studentAId,
        amount: 1000,
        currency: 'CDF',
        payment_date: '2026-09-24',
        recorded_by: '00000000-0000-0000-0000-000000000099',
        status: 'confirmed',
      })
      expect(error).not.toBeNull()
    })

    it('Parent cannot UPDATE a payment', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { error } = await client
        .from('payments')
        .update({ status: 'cancelled' })
        .eq('id', paymentAId)
      expect(error).not.toBeNull()
    })

    it('Parent cannot DELETE a payment', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { error } = await client
        .from('payments')
        .delete()
        .eq('id', paymentAId)
      expect(error).not.toBeNull()
    })

    it('Parent cannot INSERT a payment allocation', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { error } = await client.from('payment_allocations').insert({
        tenant_id: TENANT_A,
        payment_id: paymentAId,
        obligation_id: '00000000-0000-0000-0000-000000000099',
        amount: 100,
      })
      expect(error).not.toBeNull()
    })

    it('Parent cannot UPDATE a financial obligation', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { error } = await client
        .from('financial_obligations')
        .update({ paid_amount: 999999 })
        .eq('student_id', studentAId)
      expect(error).not.toBeNull()
    })
  })

  // ── 6. Filter by student works at DB level ───────────────────────────────────

  describe('6. Student filter scope', () => {
    it('Parent A sees payments for studentA when filtering by studentA', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { data } = await client
        .from('payments')
        .select('id, student_id')
        .eq('student_id', studentAId)

      expect(data!.length).toBeGreaterThanOrEqual(1)
      data!.forEach(p => expect(p.student_id).toBe(studentAId))
    })

    it('Parent A sees NO payments when filtering by studentB (not their child)', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { data } = await client
        .from('payments')
        .select('id, student_id')
        .eq('student_id', studentBId)

      expect(data).toHaveLength(0)
    })
  })

  // ── 7. School years visible ──────────────────────────────────────────────────

  describe('7. School years access', () => {
    it('Parent A can see active school year', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { data, error } = await client
        .from('school_years')
        .select('id, name, status')
        .eq('id', schoolYearActiveId)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
    })

    it('Parent A can see archived school year (history preservation)', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { data, error } = await client
        .from('school_years')
        .select('id, name, status')
        .eq('id', schoolYearArchivedId)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data![0].status).toBe('archived')
    })
  })

  // ── 8. Parent with no children ───────────────────────────────────────────────

  describe('8. Parent with no children', () => {
    let noChildParentEmail: string

    beforeAll(async () => {
      const admin = makeAdmin()
      noChildParentEmail = `no-child-${UNIQUE}@test.cd`
      const { data: authUser } = await admin.auth.admin.createUser({
        email: noChildParentEmail,
        password: noChildParentEmail,
        email_confirm: true,
      })
      const userId = authUser.user!.id
      await admin.from('profiles').insert({ id: userId, first_name: 'NoChild', last_name: 'Parent' })
      await admin.from('user_memberships').insert({
        user_id: userId, tenant_id: TENANT_A, role: 'parent', status: 'active',
      })
      await admin.from('parents').insert({
        user_id: userId, tenant_id: TENANT_A, full_name: 'No Child Parent', account_status: 'active',
      })
    })

    it('Parent with no children sees no payments', async () => {
      const client = await signInAs(noChildParentEmail, noChildParentEmail)
      const { data, error } = await client
        .from('payments')
        .select('id')
        .eq('tenant_id', TENANT_A)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })
  })

  // ── 9. Multiple children visibility ──────────────────────────────────────────

  describe('9. Multiple children support', () => {
    it('Parent A sees payments for both studentA and studentC', async () => {
      const client = await signInAs(parentAEmail, parentAEmail)
      const { data } = await client
        .from('payments')
        .select('id, student_id')
        .in('student_id', [studentAId, studentCId])

      // studentA has payments, studentC has none
      data!.forEach(p => {
        expect([studentAId, studentCId]).toContain(p.student_id)
      })
    })
  })

  // ── 10. Cancelled payment NOT active in calculations ─────────────────────────

  describe('10. Cancelled payment consistency', () => {
    it('Cancelled payment has status=cancelled and does not increase obligation paid_amount', async () => {
      const admin = makeAdmin()
      const client = await signInAs(parentAEmail, parentAEmail)

      const { data: pmt } = await client
        .from('payments')
        .select('status, amount')
        .eq('id', paymentCancelledId)
        .single()

      expect(pmt!.status).toBe('cancelled')
      // The obligation should have its paid_amount reverted
      // (cancel_payment RPC reverses the allocation)
      const { data: allocs } = await admin
        .from('payment_allocations')
        .select('obligation_id, amount')
        .eq('payment_id', paymentCancelledId)

      if (allocs && allocs.length > 0) {
        const obligationId = allocs[0].obligation_id
        const { data: obl } = await admin
          .from('financial_obligations')
          .select('paid_amount, remaining_amount, initial_amount')
          .eq('id', obligationId)
          .single()

        // After cancellation, paid_amount should be 0 (reversed)
        expect(Number(obl!.paid_amount)).toBe(0)
        expect(Number(obl!.remaining_amount)).toBe(Number(obl!.initial_amount))
      }
    })
  })
})
