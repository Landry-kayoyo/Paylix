import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54341'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

describe('Phase 5 Architecture & Business Rules Tests', () => {
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const directorClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  let tenantId = '00000000-0000-0000-0000-000000000001'

  beforeAll(async () => {
    // Authenticate director
    const { error: signInError } = await directorClient.auth.signInWithPassword({
      email: 'director@ecole.test',
      password: 'password123',
    })
    expect(signInError).toBeNull()
  })

  it('1. Column must_change_password exists on profiles', async () => {
    const { data: profile, error } = await adminClient
      .from('profiles')
      .select('id, must_change_password, status')
      .limit(1)
      .single()

    expect(error).toBeNull()
    expect(profile).toBeDefined()
    if (!profile) {
      return
    }
    expect(typeof profile.must_change_password).toBe('boolean')
  })

  it('2. Enforces only ONE active school year per tenant via database constraint', async () => {
    // Clean up existing test school years
    await adminClient
      .from('school_years')
      .delete()
      .eq('name', 'Année Test Unique 1')
    await adminClient
      .from('school_years')
      .delete()
      .eq('name', 'Année Test Unique 2')

    // Create a first active school year
    const { data: y1, error: err1 } = await adminClient
      .from('school_years')
      .insert({
        tenant_id: tenantId,
        name: 'Année Test Unique 1',
        start_date: '2027-09-01',
        end_date: '2028-06-30',
        status: 'active',
      })
      .select()
      .single()

    // Note: if there is already an active year, err1 might fail if another is active.
    // Let's archive existing active years for this test:
    if (err1) {
      await adminClient
        .from('school_years')
        .update({ status: 'archived' })
        .eq('tenant_id', tenantId)
        .eq('status', 'active')

      const retry1 = await adminClient
        .from('school_years')
        .insert({
          tenant_id: tenantId,
          name: 'Année Test Unique 1',
          start_date: '2027-09-01',
          end_date: '2028-06-30',
          status: 'active',
        })
        .select()
        .single()

      expect(retry1.error).toBeNull()
    }

    // Now inserting a second ACTIVE year for the same tenant must violate unique index one_active_year_per_tenant
    const { data: y2, error: err2 } = await adminClient
      .from('school_years')
      .insert({
        tenant_id: tenantId,
        name: 'Année Test Unique 2',
        start_date: '2028-09-01',
        end_date: '2029-06-30',
        status: 'active',
      })

    expect(err2).not.toBeNull()
    expect(err2?.message).toContain('one_active_year_per_tenant')

    // Cleanup
    await adminClient.from('school_years').delete().eq('name', 'Année Test Unique 1')
  })

  it('3. Classes are permanent and linked through class_school_years junction table', async () => {
    // 1. Create two test school years: Year A (archived) and Year B (preparation)
    const { data: yearA } = await adminClient
      .from('school_years')
      .insert({
        tenant_id: tenantId,
        name: 'Test An A 2024',
        start_date: '2024-09-01',
        end_date: '2025-06-30',
        status: 'archived',
      })
      .select()
      .single()

    const { data: yearB } = await adminClient
      .from('school_years')
      .insert({
        tenant_id: tenantId,
        name: 'Test An B 2025',
        start_date: '2025-09-01',
        end_date: '2026-06-30',
        status: 'preparation',
      })
      .select()
      .single()

    // 2. Create two permanent classes
    const { data: class1 } = await adminClient
      .from('classes')
      .insert({
        tenant_id: tenantId,
        name: 'Test Classe CP-1',
        code: 'TCP1',
        status: 'active',
      })
      .select()
      .single()

    const { data: class2 } = await adminClient
      .from('classes')
      .insert({
        tenant_id: tenantId,
        name: 'Test Classe CE1-1',
        code: 'TCE1',
        status: 'active',
      })
      .select()
      .single()

    expect(class1).toBeDefined()
    expect(class2).toBeDefined()

    // 3. Associate class1 to yearA
    const { error: linkErrA } = await adminClient
      .from('class_school_years')
      .insert({
        tenant_id: tenantId,
        class_id: class1!.id,
        school_year_id: yearA!.id,
      })
    expect(linkErrA).toBeNull()

    // 4. Associate both class1 and class2 to yearB
    const { error: linkErrB } = await adminClient
      .from('class_school_years')
      .insert([
        { tenant_id: tenantId, class_id: class1!.id, school_year_id: yearB!.id },
        { tenant_id: tenantId, class_id: class2!.id, school_year_id: yearB!.id },
      ])
    expect(linkErrB).toBeNull()

    // 5. Query classes for Year A -> only class1
    const { data: yearALinks } = await directorClient
      .from('class_school_years')
      .select('class_id')
      .eq('school_year_id', yearA!.id)

    expect(yearALinks?.length).toBe(1)
    expect(yearALinks![0].class_id).toBe(class1!.id)

    // 6. Query classes for Year B -> both class1 and class2
    const { data: yearBLinks } = await directorClient
      .from('class_school_years')
      .select('class_id')
      .eq('school_year_id', yearB!.id)

    expect(yearBLinks?.length).toBe(2)

    // 7. Cleanup
    await adminClient.from('classes').delete().in('id', [class1!.id, class2!.id])
    await adminClient.from('school_years').delete().in('id', [yearA!.id, yearB!.id])
  })

  it('4. Director RLS protects class_school_years across tenants', async () => {
    // Another tenant
    const otherTenantId = '00000000-0000-0000-0000-000000000002'
    
    // Director tries to query class_school_years for other tenant
    const { data, error } = await directorClient
      .from('class_school_years')
      .select('*')
      .eq('tenant_id', otherTenantId)

    expect(error).toBeNull()
    expect(data?.length).toBe(0) // RLS blocked access
  })
})
