import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54341'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

describe('Local Supabase Auth & Multi-Tenant Roles', () => {
  it('1. Unauthenticated users cannot read tenants table', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data, error } = await supabase.from('tenants').select('*')
    expect(error).toBeNull()
    expect(data?.length).toBe(0)
  })

  it('2. Director can sign in and retrieve director role from user_memberships', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'director@ecole.test',
      password: 'password123',
    })
    expect(authError).toBeNull()
    expect(authData.user).toBeDefined()
    expect(authData.session).toBeDefined()

    const { data: membership, error: memError } = await supabase
      .from('user_memberships')
      .select('role, tenant_id')
      .eq('user_id', authData.user!.id)
      .eq('status', 'active')
      .single()

    expect(memError).toBeNull()
    expect(membership?.role).toBe('director')

    // Director can view their tenant
    const { data: tenants, error: tenantError } = await supabase.from('tenants').select('*')
    expect(tenantError).toBeNull()
    expect(tenants?.length).toBeGreaterThan(0)
    expect(tenants![0].name).toBe('Ecole Primaire Test')
  })

  it('3. Accountant can sign in and retrieve accountant role', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'accountant@ecole.test',
      password: 'password123',
    })
    expect(authError).toBeNull()
    expect(authData.user).toBeDefined()

    const { data: membership, error: memError } = await supabase
      .from('user_memberships')
      .select('role')
      .eq('user_id', authData.user!.id)
      .eq('status', 'active')
      .single()

    expect(memError).toBeNull()
    expect(membership?.role).toBe('accountant')

    // Accountant can access obligations
    const { data: obligations, error: obError } = await supabase.from('financial_obligations').select('*')
    expect(obError).toBeNull()
    expect(obligations?.length).toBeGreaterThan(0)
  })

  it('4. Parent can sign in and retrieve parent role', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'parent@ecole.test',
      password: 'password123',
    })
    expect(authError).toBeNull()
    expect(authData.user).toBeDefined()

    const { data: membership, error: memError } = await supabase
      .from('user_memberships')
      .select('role')
      .eq('user_id', authData.user!.id)
      .eq('status', 'active')
      .single()

    expect(memError).toBeNull()
    expect(membership?.role).toBe('parent')
  })

  it('5. Platform Admin can sign in and retrieve platform_admin role', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@paylix.test',
      password: 'password123',
    })
    expect(authError).toBeNull()
    expect(authData.user).toBeDefined()

    const { data: membership, error: memError } = await supabase
      .from('user_memberships')
      .select('role')
      .eq('user_id', authData.user!.id)
      .eq('status', 'active')
      .single()

    expect(memError).toBeNull()
    expect(membership?.role).toBe('platform_admin')
  })

  it('6. Invalid credentials return error', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'director@ecole.test',
      password: 'wrongpassword',
    })
    expect(error).not.toBeNull()
    expect(data.session).toBeNull()
  })
})
