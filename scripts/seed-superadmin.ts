/**
 * Script idempotent de création du superadmin de production.
 * Exécuté automatiquement par GitHub Actions après les migrations.
 * Ne crée le compte que s'il n'existe pas déjà.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD;
const SUPERADMIN_FIRST_NAME = process.env.SUPERADMIN_FIRST_NAME ?? 'Platform';
const SUPERADMIN_LAST_NAME = process.env.SUPERADMIN_LAST_NAME ?? 'Admin';

// Validation des variables requises
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD) {
  console.error("❌ Variables manquantes. Requis: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function seedSuperAdmin() {
  console.log(`🔍 Vérification si le superadmin existe déjà (${SUPERADMIN_EMAIL})...`);

  // Vérifier si l'utilisateur existe déjà dans Supabase Auth
  const { data: existingUsers, error: searchError } = await supabaseAdmin.auth.admin.listUsers();

  if (searchError) {
    console.error("❌ Erreur lors de la vérification des utilisateurs:", searchError.message);
    process.exit(1);
  }

  const existingUser = existingUsers.users.find(u => u.email === SUPERADMIN_EMAIL);

  if (existingUser) {
    console.log("✅ Le compte superadmin existe déjà — aucune action effectuée.");
    process.exit(0);
  }

  // Créer l'utilisateur dans Supabase Auth
  console.log("⏳ Création du compte superadmin...");
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
    email_confirm: true,
  });

  if (authError) {
    console.error("❌ Erreur Auth:", authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;

  // Créer le profil
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: userId, first_name: SUPERADMIN_FIRST_NAME, last_name: SUPERADMIN_LAST_NAME });

  if (profileError) {
    console.error("❌ Erreur profil:", profileError.message);
    process.exit(1);
  }

  // Assigner le rôle platform_admin (tenant_id = null car global)
  const { error: membershipError } = await supabaseAdmin
    .from('user_memberships')
    .insert({
      user_id: userId,
      tenant_id: null,
      role: 'platform_admin',
      status: 'active'
    });

  if (membershipError) {
    console.error("❌ Erreur rôle:", membershipError.message);
    process.exit(1);
  }

  console.log(`🎉 Superadmin créé avec succès ! (ID: ${userId}, Email: ${SUPERADMIN_EMAIL})`);
}

seedSuperAdmin();
