import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// Charger les variables de production
dotenv.config({ path: '.env.prod' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Variables NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquantes dans .env.prod");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => new Promise(resolve => rl.question(query, resolve));

async function createSuperAdmin() {
  console.log("🛠️  Création du compte SuperAdmin (Platform Admin) de production\n");
  
  const email = await question("📧 Adresse email du superadmin : ");
  const password = await question("🔒 Mot de passe (min 6 caractères) : ");
  const firstName = await question("👤 Prénom : ");
  const lastName = await question("👤 Nom : ");
  
  rl.close();

  if (password.length < 6) {
    console.error("\n❌ Le mot de passe doit faire au moins 6 caractères.");
    return;
  }

  console.log("\n⏳ Création de l'utilisateur dans Supabase Auth...");
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    console.error("❌ Erreur lors de la création Auth:", authError.message);
    return;
  }

  const userId = authData.user.id;
  console.log(`✅ Utilisateur créé (ID: ${userId})`);

  console.log("⏳ Mise à jour du profil...");
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: userId, first_name: firstName, last_name: lastName });

  if (profileError) {
    console.error("❌ Erreur lors de la mise à jour du profil:", profileError.message);
    return;
  }

  console.log("⏳ Assignation du rôle 'platform_admin'...");
  const { error: membershipError } = await supabaseAdmin
    .from('user_memberships')
    .insert({
      user_id: userId,
      tenant_id: null, // Les platform_admins ne sont rattachés à aucun tenant spécifique
      role: 'platform_admin',
      status: 'active'
    });

  if (membershipError) {
    console.error("❌ Erreur lors de l'assignation du rôle:", membershipError.message);
    return;
  }

  console.log("\n🎉 SUCCÈS ! Le compte superadmin a été créé et est prêt à être utilisé sur la production.");
}

createSuperAdmin();
