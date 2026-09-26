/**
 * Script de migration automatique — exécuté lors du prebuild Vercel.
 * Utilise l'API de gestion Supabase pour appliquer les migrations SQL.
 * Idempotent : ne réapplique pas les migrations déjà exécutées.
 */

import * as fs from 'fs';
import * as path from 'path';

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;

if (!ACCESS_TOKEN || !PROJECT_REF) {
  console.warn("⚠️  SUPABASE_ACCESS_TOKEN ou SUPABASE_PROJECT_REF manquant — migrations ignorées.");
  process.exit(0);
}

const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function runSQL(sql: string): Promise<void> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SQL Error ${res.status}: ${body}`);
  }
}

async function querySQL(sql: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SQL Error ${res.status}: ${body}`);
  }

  return res.json();
}

async function runMigrations() {
  console.log("🚀 Démarrage des migrations automatiques...");

  // Créer la table de suivi des migrations si elle n'existe pas
  await runSQL(`
    CREATE TABLE IF NOT EXISTS _paylix_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Lire les migrations déjà appliquées
  const applied = await querySQL(`SELECT name FROM _paylix_migrations ORDER BY name;`);
  const appliedNames = new Set((applied as {name: string}[]).map((r) => r.name));
  console.log(`📋 ${appliedNames.size} migration(s) déjà appliquée(s).`);

  // Lire les fichiers de migration locaux, triés par nom
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let applied_count = 0;
  let skipped_count = 0;

  for (const file of files) {
    if (appliedNames.has(file)) {
      skipped_count++;
      continue;
    }

    console.log(`⏳ Applying: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    try {
      await runSQL(sql);
      await runSQL(`INSERT INTO _paylix_migrations (name) VALUES ('${file.replace(/'/g, "''")}');`);
      console.log(`✅ Applied: ${file}`);
      applied_count++;
    } catch (err) {
      console.error(`❌ Échec sur ${file}:`, err);
      process.exit(1);
    }
  }

  console.log(`\n✅ Migrations terminées — ${applied_count} appliquée(s), ${skipped_count} ignorée(s).`);
}

runMigrations();
