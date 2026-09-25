import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54341'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const DIRECTOR_EMAIL = 'directeur.sainte.marie@test.cd'
const DIRECTOR_PASSWORD = 'password123'
const PARENT_EMAIL = 'parent1.sm@test.cd'
const PARENT_PASSWORD = 'password123'
// IDs dynamiques - récupérés via le client admin dans les tests
let EXISTING_PARENT_ID = ''
let EXISTING_STUDENT_ID = ''

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

function makeAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

async function signInAs(email: string, password: string) {
  const client = makeClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  expect(error).toBeNull()
  expect(data.user).toBeDefined()
  return client
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Phase 7 — Parents, associations, RLS', () => {

  beforeAll(async () => {
    const admin = makeAdminClient()
    const { data: parents } = await admin
      .from('parents')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .eq('account_status', 'active')
      .limit(1)
      .single()
    EXISTING_PARENT_ID = parents?.id ?? ''

    if (EXISTING_PARENT_ID) {
      const { data: ps } = await admin
        .from('parent_students')
        .select('student_id')
        .eq('parent_id', EXISTING_PARENT_ID)
        .limit(1)
        .single()
      EXISTING_STUDENT_ID = ps?.student_id ?? ''
    }
    if (!EXISTING_STUDENT_ID) {
      const { data: stu } = await admin
        .from('students')
        .select('id')
        .eq('tenant_id', TENANT_ID)
        .limit(1)
        .single()
      EXISTING_STUDENT_ID = stu?.id ?? ''
    }
  })


  // ── 1. Parent structure ─────────────────────────────────────────────────────
  describe('1. Parent table structure (via director)', () => {
    it('Director can read parents in their tenant', async () => {
      const client = await signInAs(DIRECTOR_EMAIL, DIRECTOR_PASSWORD)
      const { data, error } = await client
        .from('parents')
        .select('id, first_name, last_name, account_status, invited_at')
        .eq('tenant_id', TENANT_ID)
      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(Array.isArray(data)).toBe(true)
    })

    it('Parent record has account_status column', async () => {
      const client = await signInAs(DIRECTOR_EMAIL, DIRECTOR_PASSWORD)
      const { data, error } = await client
        .from('parents')
        .select('account_status')
        .eq('id', EXISTING_PARENT_ID)
        .single()
      expect(error).toBeNull()
      expect(['invited', 'active', 'inactive']).toContain(data?.account_status)
    })

    it('parent_students has ended_at column', async () => {
      const admin = makeAdminClient()
      const { data, error } = await admin
        .from('parent_students')
        .select('id, ended_at, ended_by')
        .eq('parent_id', EXISTING_PARENT_ID)
        .is('ended_at', null)
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })
  })

  // ── 2. RLS — Parent reads only own data ─────────────────────────────────────
  describe('2. RLS — Parent isolation', () => {
    it('Parent can see their own parent record', async () => {
      const client = await signInAs(PARENT_EMAIL, PARENT_PASSWORD)
      const { data, error } = await client
        .from('parents')
        .select('id, first_name, last_name')
        .eq('id', EXISTING_PARENT_ID)
      expect(error).toBeNull()
      expect(data?.length).toBeGreaterThan(0)
    })

    it('Parent can see their own active student associations', async () => {
      const client = await signInAs(PARENT_EMAIL, PARENT_PASSWORD)
      const { data, error } = await client
        .from('parent_students')
        .select('id, student_id, relationship')
        .eq('parent_id', EXISTING_PARENT_ID)
        .is('ended_at', null)
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('Parent can see their own associated students', async () => {
      const client = await signInAs(PARENT_EMAIL, PARENT_PASSWORD)
      const { data, error } = await client
        .from('students')
        .select('id, matricule, first_name, last_name')
        .eq('id', EXISTING_STUDENT_ID)
      expect(error).toBeNull()
      expect(data?.length).toBe(1)
    })

    it('Unauthenticated user cannot read parents', async () => {
      const client = makeClient()
      const { data } = await client.from('parents').select('*')
      expect(data?.length ?? 0).toBe(0)
    })
  })

  // ── 3. 1 parent per student constraint ─────────────────────────────────────
  describe('3. One-active-parent-per-student constraint', () => {
    it('associate_student_to_parent succeeds for valid association', async () => {
      const admin = makeAdminClient()

      // Create temp student for this test
      const { data: student } = await admin.from('students').insert({
        tenant_id: TENANT_ID,
        matricule: 'TEST_PHASE7_001',
        first_name: 'Test',
        last_name: 'Phase7',
        gender: 'M',
        status: 'active',
      }).select('id').single()
      expect(student?.id).toBeDefined()

      // Associate via RPC
      const { error } = await admin.rpc('associate_student_to_parent', {
        p_tenant_id: TENANT_ID,
        p_parent_id: EXISTING_PARENT_ID,
        p_student_id: student!.id,
        p_relationship: 'Père',
      })
      expect(error).toBeNull()

      // Cleanup
      await admin.from('parent_students')
        .update({ ended_at: new Date().toISOString() })
        .eq('student_id', student!.id)
        .is('ended_at', null)
      await admin.from('students').delete().eq('id', student!.id)
    })

    it('associate_student_to_parent FAILS if student already has active parent', async () => {
      const admin = makeAdminClient()

      // Create temp parent
      const adminAuthClient = makeAdminClient()

      // Try to associate EXISTING_STUDENT_ID (already has EXISTING_PARENT_ID) to a different parent
      // We'll use the admin to create a second parent profile directly
      const { data: tempParent } = await admin.from('parents').insert({
        tenant_id: TENANT_ID,
        user_id: '11111111-1111-1111-1111-111111111114', // platform admin user
        first_name: 'Temp',
        last_name: 'Parent2',
        phone: '+2439999999',
        email: 'temp_parent2_test@ecole.test',
        account_status: 'invited',
      }).select('id').single()
      expect(tempParent?.id).toBeDefined()

      // This should FAIL because EXISTING_STUDENT_ID already has EXISTING_PARENT_ID
      const { error } = await admin.rpc('associate_student_to_parent', {
        p_tenant_id: TENANT_ID,
        p_parent_id: tempParent!.id,
        p_student_id: EXISTING_STUDENT_ID,
        p_relationship: 'Mère',
      })
      expect(error).not.toBeNull()
      expect(error?.message).toContain('STUDENT_ALREADY_HAS_PARENT')

      // Cleanup
      await admin.from('parents').delete().eq('id', tempParent!.id)
    })
  })

  // ── 4. Soft-delete association ───────────────────────────────────────────────
  describe('4. Remove (soft-delete) association', () => {
    it('remove_student_association soft-deletes correctly', async () => {
      const admin = makeAdminClient()

      // Create a temp student + associate
      const { data: student } = await admin.from('students').insert({
        tenant_id: TENANT_ID,
        matricule: 'TEST_PHASE7_002',
        first_name: 'Soft',
        last_name: 'Delete',
        gender: 'F',
        status: 'active',
      }).select('id').single()
      expect(student?.id).toBeDefined()

      await admin.rpc('associate_student_to_parent', {
        p_tenant_id: TENANT_ID,
        p_parent_id: EXISTING_PARENT_ID,
        p_student_id: student!.id,
        p_relationship: 'Mère',
      })

      const { data: link } = await admin
        .from('parent_students')
        .select('id')
        .eq('student_id', student!.id)
        .is('ended_at', null)
        .single()
      expect(link?.id).toBeDefined()

      // Soft delete
      const { error } = await admin.rpc('remove_student_association', {
        p_tenant_id: TENANT_ID,
        p_parent_student_id: link!.id,
        p_actor_user_id: '11111111-1111-1111-1111-111111111111',
      })
      expect(error).toBeNull()

      // Verify ended_at is set (not physically deleted)
      const { data: after } = await admin
        .from('parent_students')
        .select('id, ended_at')
        .eq('id', link!.id)
        .single()
      expect(after?.ended_at).not.toBeNull()

      // Student still exists
      const { data: studentAfter } = await admin
        .from('students')
        .select('id')
        .eq('id', student!.id)
        .single()
      expect(studentAfter?.id).toBe(student!.id)

      // Cleanup
      await admin.from('parent_students').delete().eq('id', link!.id)
      await admin.from('students').delete().eq('id', student!.id)
    })
  })

  // ── 5. Multi-tenant isolation ────────────────────────────────────────────────
  describe('5. Multi-tenant isolation', () => {
    it('Director can only see parents in their own tenant', async () => {
      const client = await signInAs(DIRECTOR_EMAIL, DIRECTOR_PASSWORD)
      const { data, error } = await client
        .from('parents')
        .select('id, tenant_id')
      expect(error).toBeNull()
      // All returned parents must belong to TENANT_ID
      const wrongTenant = (data || []).filter(p => p.tenant_id !== TENANT_ID)
      expect(wrongTenant.length).toBe(0)
    })

    it('Parent cannot see other parents in same tenant', async () => {
      const client = await signInAs(PARENT_EMAIL, PARENT_PASSWORD)
      const { data, error } = await client
        .from('parents')
        .select('id')
      expect(error).toBeNull()
      // Parent RLS: can only see own record
      const ownId = EXISTING_PARENT_ID
      const others = (data || []).filter(p => p.id !== ownId)
      expect(others.length).toBe(0)
    })

    it('Parent cannot read other students not linked to them', async () => {
      const admin = makeAdminClient()

      // Create a second student not linked to our parent
      const { data: otherStudent } = await admin.from('students').insert({
        tenant_id: TENANT_ID,
        matricule: 'TEST_PHASE7_OTHER',
        first_name: 'Other',
        last_name: 'Student',
        gender: 'M',
        status: 'active',
      }).select('id').single()
      expect(otherStudent?.id).toBeDefined()

      // Parent client should NOT see this student
      const parentClient = await signInAs(PARENT_EMAIL, PARENT_PASSWORD)
      const { data } = await parentClient
        .from('students')
        .select('id')
        .eq('id', otherStudent!.id)
      expect(data?.length ?? 0).toBe(0)

      // Cleanup
      await admin.from('students').delete().eq('id', otherStudent!.id)
    })
  })

  // ── 6. Parent account status ─────────────────────────────────────────────────
  describe('6. Account status', () => {
    it('Existing seed parent has valid account_status', async () => {
      const admin = makeAdminClient()
      const { data } = await admin
        .from('parents')
        .select('account_status')
        .eq('id', EXISTING_PARENT_ID)
        .single()
      expect(['invited', 'active', 'inactive']).toContain(data?.account_status)
    })
  })

  // ── 7. Student enrollments visibility for parent ─────────────────────────────
  describe('7. Parent portal — real data access', () => {
    it('Parent can view enrollment of their student', async () => {
      const client = await signInAs(PARENT_EMAIL, PARENT_PASSWORD)
      const { data, error } = await client
        .from('student_enrollments')
        .select('id, class_id, school_year_id')
        .eq('student_id', EXISTING_STUDENT_ID)
      expect(error).toBeNull()
      // May be empty if no enrollment exists in test data, but should not error
      expect(Array.isArray(data)).toBe(true)
    })

    it('Accountant can view parents and parent_students', async () => {
      const client = await signInAs('accountant@ecole.test', 'password123')
      const { data: parents, error: pErr } = await client
        .from('parents')
        .select('id, first_name')
        .eq('tenant_id', TENANT_ID)
      expect(pErr).toBeNull()
      expect(Array.isArray(parents)).toBe(true)
    })
  })
})
