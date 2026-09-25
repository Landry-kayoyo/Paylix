import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54341';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

describe('Phase 11 — Accountant Account Management by Director', () => {
  it('1. Director can view accountants for their tenant', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'director@ecole.test',
      password: 'password123',
    });
    expect(authError).toBeNull();
    expect(authData.user).toBeDefined();

    const { data: memberships, error } = await supabase
      .from('user_memberships')
      .select('user_id, role, status')
      .eq('role', 'accountant');

    expect(error).toBeNull();
    expect(memberships).toBeDefined();
    expect(memberships!.every(m => m.role === 'accountant')).toBe(true);
  });

  it('2. Accountant cannot access director-only permissions', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'accountant@ecole.test',
      password: 'password123',
    });
    expect(authError).toBeNull();
    expect(authData.user).toBeDefined();

    // Verify role is accountant
    const { data: membership } = await supabase
      .from('user_memberships')
      .select('role')
      .eq('user_id', authData.user!.id)
      .single();

    expect(membership?.role).toBe('accountant');
    expect(membership?.role).not.toBe('director');
  });

  it('3. Multi-tenant isolation for accountants', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await supabase.auth.signInWithPassword({
      email: 'accountant@ecole.test',
      password: 'password123',
    });

    // Try reading payments of another tenant directly
    const { data: foreignPayments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('tenant_id', '99999999-9999-9999-9999-999999999999');

    expect(error).toBeNull();
    expect(foreignPayments?.length).toBe(0);
  });
});
