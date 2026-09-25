const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://127.0.0.1:54341';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const APP_URL = process.env.PAYLIX_APP_URL || 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const ACCOUNTS = [
  {
    email: 'admin@paylix.local',
    role: 'platform_admin',
    first_name: 'Admin',
    last_name: 'Paylix',
    phone: '+2430000004',
  },
  {
    email: 'director@ecole.test',
    role: 'director',
    first_name: 'Directeur',
    last_name: 'Kabila',
    phone: '+2430000001',
  },
  {
    email: 'accountant@ecole.test',
    role: 'accountant',
    first_name: 'Comptable',
    last_name: 'Mukendi',
    phone: '+2430000002',
    employee_code: 'CPT001',
  },
  {
    email: 'parent@ecole.test',
    role: 'parent',
    first_name: 'Parent',
    last_name: 'Ilunga',
    phone: '+2430000003',
  },
];

async function main() {
  console.log('=== Recreating Accounts and Sending Invitation Emails ===\n');

  // 1. Ensure Tenant exists
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .upsert({
      id: TENANT_ID,
      name: 'Ecole Primaire Test',
      slug: 'ecole-test',
      code: 'ECO001',
      email: 'contact@ecole.test',
      phone: '+2430000000',
      city: 'Kinshasa',
      country: 'RDC',
    })
    .select()
    .single();

  if (tenantErr) {
    console.error('Error ensuring tenant:', tenantErr.message);
  } else {
    console.log('Tenant confirmed:', tenant.name, `(${tenant.id})`);
  }

  // 2. Fetch existing auth users to delete them cleanly for a fresh invite
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 100 });
  if (listErr) {
    console.error('Error listing users:', listErr);
    return;
  }

  for (const acc of ACCOUNTS) {
    console.log(`\nProcessing account: ${acc.email} (${acc.role})...`);

    const existingUser = users.find(u => u.email === acc.email);
    if (existingUser) {
      console.log(`  Deleting existing user ${existingUser.id} to reset invite...`);
      const { error: delErr } = await supabase.auth.admin.deleteUser(existingUser.id);
      if (delErr) {
        console.error(`  Failed to delete existing user:`, delErr.message);
      }
    }

    // 3. Send fresh Supabase invitation email
    console.log(`  Sending invitation email via Supabase GoTrue...`);
    const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(
      acc.email,
      {
        redirectTo: `${APP_URL}/update-password`,
      }
    );

    if (inviteErr) {
      console.error(`  Error sending invitation:`, inviteErr.message);
      continue;
    }

    const userId = inviteData.user.id;
    console.log(`  Created invited user ID: ${userId}`);

    // 4. Create Profile
    const { error: profErr } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        first_name: acc.first_name,
        last_name: acc.last_name,
        phone: acc.phone,
        status: 'active',
      });

    if (profErr) {
      console.error(`  Error creating profile:`, profErr.message);
    } else {
      console.log(`  Profile created for ${acc.first_name} ${acc.last_name}`);
    }

    // Set a known default password for direct login testing while email invite is also in Mailpit
    await supabase.auth.admin.updateUserById(userId, {
      password: 'password123',
      email_confirm: true,
    });

    // 5. Create user_memberships
    const { error: memErr } = await supabase
      .from('user_memberships')
      .upsert({
        user_id: userId,
        tenant_id: TENANT_ID,
        role: acc.role,
        status: 'active',
      });

    if (memErr) {
      console.error(`  Error creating membership:`, memErr.message);
    } else {
      console.log(`  Membership created: role = ${acc.role}`);
    }

    // 6. Role-specific records
    if (acc.role === 'accountant') {
      await supabase.from('accountants').upsert({
        tenant_id: TENANT_ID,
        user_id: userId,
        employee_code: acc.employee_code,
        phone: acc.phone,
      });
      console.log(`  Accountant record linked with employee_code = ${acc.employee_code}`);
    }

    if (acc.role === 'parent') {
      const { data: parentRecord } = await supabase.from('parents').upsert({
        tenant_id: TENANT_ID,
        user_id: userId,
        first_name: acc.first_name,
        last_name: acc.last_name,
        phone: acc.phone,
        email: acc.email,
      }).select().single();

      // Link to demo student MAT001 if present
      const { data: student } = await supabase.from('students').select('id').limit(1).maybeSingle();
      if (student && parentRecord) {
        await supabase.from('parent_students').upsert({
          tenant_id: TENANT_ID,
          parent_id: parentRecord.id,
          student_id: student.id,
          relationship: 'Parent / Tuteur',
          is_primary: true,
        });
        console.log(`  Parent linked to student: ${student.id}`);
      }
    }
  }

  console.log('\n=== All Accounts Successfully Recreated & Invited! ===');
}

main().catch(console.error);
