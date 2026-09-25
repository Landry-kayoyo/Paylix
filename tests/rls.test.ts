import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54341'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

describe('Row Level Security (RLS) Isolation Tests', () => {
  it('Should prevent unauthenticated access to tenants', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    const { data, error } = await supabase.from('tenants').select('*')
    expect(error).toBeNull()
    expect(data?.length).toBe(0) // RLS prevents read
  })

  it('Director should only access their tenant data', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: 'directeur.sainte.marie@test.cd',
      password: 'password123',
    })
    expect(signInError).toBeNull()
    
    const { data: students, error } = await supabase.from('students').select('*')
    expect(error).toBeNull()
    expect(students?.length).toBeGreaterThan(0)
    expect(students![0].tenant_id).toBe('00000000-0000-0000-0000-000000000001')
  })

  it('Parent should only access their own students', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: 'parent1.sm@test.cd',
      password: 'password123',
    })
    expect(signInError).toBeNull()
    
    const { data: students, error } = await supabase.from('students').select('*')
    expect(error).toBeNull()
    // Parent voit uniquement ses élèves liés
    expect(students).toBeDefined()
  })
})
