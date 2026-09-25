const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const SUPABASE_URL = 'http://127.0.0.1:54341';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  const email = 'parent.consent.test@example.com';
  const password = 'password123';

  // 1. Create two tenants.
  const tenantA = await supabase
    .from('tenants')
    .upsert({
      id: '11111111-1111-1111-1111-000000000001',
      name: 'École Alpha Test',
      slug: 'ecole-alpha-test',
      code: 'ALPHA',
      email: 'contact.alpha@test.local',
      phone: '+2430000000',
      city: 'Kinshasa',
      country: 'RDC',
    })
    .select()
    .single();

  const tenantB = await supabase
    .from('tenants')
    .upsert({
      id: '11111111-1111-1111-1111-000000000002',
      name: 'École Beta Test',
      slug: 'ecole-beta-test',
      code: 'BETA',
      email: 'contact.beta@test.local',
      phone: '+2430000001',
      city: 'Lubumbashi',
      country: 'RDC',
    })
    .select()
    .single();

  if (tenantA.error) console.log('tenantA error', tenantA.error);
  if (tenantB.error) console.log('tenantB error', tenantB.error);

  // 2. Create auth user for parent (or reuse existing one if rerun).
  let userId;
  const { data: existingUsers, error: listUsersError } = await supabase.auth.admin.listUsers();
  if (!listUsersError) {
    const existing = existingUsers?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) {
      userId = existing.id;
    }
  }

  if (!userId) {
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Parent', last_name: 'Consent' },
    });

    if (userError) {
      console.log('createUser error', userError.message);
      return;
    }

    userId = userData.user.id;
  }

  // 3. Upsert profile.
  await supabase.from('profiles').upsert({
    id: userId,
    first_name: 'Parent',
    last_name: 'Consent',
    phone: '+2430000009',
    status: 'active',
    must_change_password: false,
  });

  // 4. Active membership into tenantA.
  await supabase.from('user_memberships').upsert({
    user_id: userId,
    tenant_id: tenantA.data.id,
    role: 'parent',
    status: 'active',
  });

  // 5. Parent record in tenantA (already active).
  const { data: parentA, error: parentAError } = await supabase
    .from('parents')
    .upsert({
      id: 'bbbbbbbb-1111-1111-1111-111111111101',
      tenant_id: tenantA.data.id,
      user_id: userId,
      first_name: 'Parent',
      last_name: 'Consent',
      phone: '+2430000009',
      email,
      account_status: 'active',
      activated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (parentAError) console.log('parentA error', parentAError.message);

  // 6. Parent record in tenantB only as invited record; no access granted.
  const { data: parentB, error: parentBError } = await supabase
    .from('parents')
    .upsert({
      id: 'bbbbbbbb-1111-1111-1111-111111111102',
      tenant_id: tenantB.data.id,
      user_id: userId,
      first_name: 'Parent',
      last_name: 'Consent',
      phone: '+2430000009',
      email,
      account_status: 'invited',
      invited_at: new Date().toISOString(),
      last_invitation_sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (parentBError) console.log('parentB error', parentBError.message);

  // 7. Director user as acting inviter in tenantB (reuse if already exists).
  let directorId;
  const { data: directorUsers, error: directorUserListError } = await supabase.auth.admin.listUsers();
  if (!directorUserListError) {
    const existingDirector = directorUsers?.users?.find((u) => u.email?.toLowerCase() === 'director.beta@test.local');
    if (existingDirector) {
      directorId = existingDirector.id;
    }
  }

  if (!directorId) {
    const directorForTenantB = await supabase.auth.admin.createUser({
      email: 'director.beta@test.local',
      password: 'password123',
      email_confirm: true,
      user_metadata: { first_name: 'Beta', last_name: 'Director' },
    });
    directorId = directorForTenantB.data.user.id;
  }

  await supabase.from('profiles').upsert({
    id: directorId,
    first_name: 'Beta',
    last_name: 'Director',
    phone: '+2430000011',
    status: 'active',
    must_change_password: false,
  });
  await supabase.from('user_memberships').upsert({
    user_id: directorId,
    tenant_id: tenantB.data.id,
    role: 'director',
    status: 'active',
  });

  // 8. Invitation record.
  const token = randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invitation, error: invitationError } = await supabase
    .from('parent_tenant_invitations')
    .insert({
      tenant_id: tenantB.data.id,
      parent_id: parentB.id,
      auth_user_id: userId,
      invited_by: directorId,
      token,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('id, token')
    .single();

  if (invitationError) {
    console.log('invitation error', invitationError.message);
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const consentUrl = new URL('/auth/callback', siteUrl);
  consentUrl.searchParams.set('next', `/parent/join?token=${invitation.token}`);
  const consentLink = consentUrl.toString();

  // 9. Send OTP email with redirect to consent URL.
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: consentLink,
      shouldCreateUser: false,
    },
  });

  console.log('OTP status:', otpError ? otpError.message : 'OK');
  console.log('Consent URL:', consentLink);
  console.log('Created invitation:', invitation.id);
})();
