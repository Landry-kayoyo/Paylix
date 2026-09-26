import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Charger le fichier .env.prod
dotenv.config({ path: '.env.prod' });

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("❌ ERREUR: Variables Supabase manquantes dans .env.prod");
  process.exit(1);
}

const supabase = createClient(url, key);

async function testConnection() {
  console.log(`🔌 Test de connexion à Supabase: ${url}...`);
  
  // Test simple : récupérer la date du serveur PostgreSQL
  const { data, error } = await supabase.from('schools').select('id').limit(1);
  
  if (error) {
    console.error("❌ ERREUR DE CONNEXION SUPABASE:");
    console.error(error.message);
  } else {
    console.log("✅ CONNEXION RÉUSSIE !");
    console.log("Les clés sont valides et la base de données répond correctement.");
  }
}

testConnection();
