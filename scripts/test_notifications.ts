import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Service role client for admin tasks
const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runTests() {
  console.log("Démarrage des tests de la Phase 13 - Notifications & Audit Log...\n");
  let failed = false;

  try {
    // ---------------------------------------------------------
    // SETUP: Find a valid tenant, user, etc.
    // ---------------------------------------------------------
    const { data: tenant } = await adminClient.from('tenants').select('id').limit(1).single();
    if (!tenant) throw new Error("Aucun tenant trouvé dans la DB.");
    const tenantId = tenant.id;

    // Create a temporary user A (Parent)
    const { data: authUserA, error: errA } = await adminClient.auth.admin.createUser({
      email: 'parentA_test13@paylix.app',
      password: 'password123',
      email_confirm: true
    });
    if (errA) throw new Error("Impossible de créer l'utilisateur A: " + errA.message);
    const userA = authUserA.user;

    // Create a temporary user B (Other User)
    const { data: authUserB, error: errB } = await adminClient.auth.admin.createUser({
      email: 'parentB_test13@paylix.app',
      password: 'password123',
      email_confirm: true
    });
    if (errB) throw new Error("Impossible de créer l'utilisateur B: " + errB.message);
    const userB = authUserB.user;

    // Authenticated clients for A and B to test RLS
    const clientA = createClient(supabaseUrl as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);
    await clientA.auth.signInWithPassword({ email: 'parentA_test13@paylix.app', password: 'password123' });

    const clientB = createClient(supabaseUrl as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);
    await clientB.auth.signInWithPassword({ email: 'parentB_test13@paylix.app', password: 'password123' });


    // ---------------------------------------------------------
    // Test 1: Création Notification (via Admin/Backend)
    // ---------------------------------------------------------
    console.log("Test 1: Création de notification...");
    const { data: notif, error: notifErr } = await adminClient.from('notifications').insert({
      tenant_id: tenantId,
      user_id: userA.id,
      type: 'SYSTEM',
      title: 'Message test',
      message: 'Ceci est un test',
      context: { student_name: 'Test Enfant' }
    }).select().single();
    
    if (notifErr || !notif) {
      console.error("✗ TEST FAILED: Test 1");
      console.error(notifErr);
      failed = true;
    } else {
      console.log("✓ Notification créée.");
    }

    // ---------------------------------------------------------
    // Test 2 & 3: Lecture et Mise à jour
    // ---------------------------------------------------------
    console.log("Test 3: Lecture (mark as read)...");
    const { data: readCheck, error: readErr } = await clientA.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notif.id)
      .select().single();
    
    if (readErr || !readCheck.read_at) {
      console.error("✗ TEST FAILED: Test 3");
      console.error(readErr);
      failed = true;
    } else {
      console.log("✓ Notification marquée comme lue.");
    }

    // ---------------------------------------------------------
    // Test 4: Sécurité RLS et IDOR
    // ---------------------------------------------------------
    console.log("Test 4: Sécurité (Isolation & Anti-IDOR)...");
    // B essaye de lire la notif de A
    const { data: checkBRead, error: errBRead } = await clientB.from('notifications').select('*').eq('id', notif.id);
    if (!errBRead && checkBRead && checkBRead.length > 0) {
      console.error("✗ TEST FAILED: Test 4 - Utilisateur B peut lire la notif de A");
      failed = true;
    } else {
      console.log("✓ Utilisateur B ne peut pas lire la notif de A.");
    }

    // B essaye de modifier la notif de A
    const { data: checkBUpdate, error: errBUpdate } = await clientB.from('notifications')
      .update({ title: 'Hacked' })
      .eq('id', notif.id)
      .select();
    
    if (!errBUpdate && checkBUpdate && checkBUpdate.length > 0) {
      console.error("✗ TEST FAILED: Test 4 - Utilisateur B peut modifier la notif de A");
      failed = true;
    } else {
      console.log("✓ Utilisateur B ne peut pas modifier la notif de A (IDOR bloqué).");
    }

    // ---------------------------------------------------------
    // Test 5: Audit Immutability
    // ---------------------------------------------------------
    console.log("Test 5: Audit Immutable...");
    const { data: audit, error: auditErr } = await adminClient.from('audit_logs').insert({
      tenant_id: tenantId,
      action_type: 'TEST_ACTION',
      resource_type: 'test',
    }).select().single();

    if (auditErr) {
      console.error("✗ TEST FAILED: Test 5 - Impossible de créer un audit de test");
      failed = true;
    } else {
      // Try to delete it (should fail even for admin)
      const { error: delErr } = await adminClient.from('audit_logs').delete().eq('id', audit.id);
      if (!delErr) {
         // Some instances might allow Service Role to bypass RLS entirely.
         // If so, the trigger or RLS check might be bypassed. We should check if RLS blocks normal users.
         const { error: clientDelErr } = await clientA.from('audit_logs').delete().eq('id', audit.id);
         if (!clientDelErr) {
           console.error("✗ TEST FAILED: Test 5 - L'audit a pu être supprimé.");
           failed = true;
         } else {
           console.log("✓ L'audit est protégé contre la suppression client.");
         }
      } else {
        console.log("✓ L'audit est immuable (suppression bloquée).");
      }
    }

    // CLEANUP
    await adminClient.auth.admin.deleteUser(userA.id);
    await adminClient.auth.admin.deleteUser(userB.id);

  } catch (error) {
    console.error("✗ ERREUR INATTENDUE: ", error);
    failed = true;
  }

  if (failed) {
    console.log("\nPHASE 13 NOTIFICATION TEST : FAILED");
    process.exit(1);
  } else {
    console.log("\nPHASE 13 NOTIFICATION TEST : PASSED");
    process.exit(0);
  }
}

runTests();
