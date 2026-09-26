/**
 * Script de migration automatique — exécuté lors du prebuild Vercel.
 * Utilise une connexion PostgreSQL directe (DATABASE_URL) — ne expire jamais.
 * Idempotent : ne réapplique pas les migrations déjà exécutées.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL manquant — migrations ignorées.");
  process.exit(0);
}

async function runMigrations() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("🔌 Connecté à la base de données.");

  // Créer la table de suivi des migrations si elle n'existe pas
  await client.query(`
    CREATE TABLE IF NOT EXISTS _paylix_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Lire les migrations déjà appliquées
  const { rows } = await client.query(`SELECT name FROM _paylix_migrations ORDER BY name;`);
  const appliedNames = new Set(rows.map((r: { name: string }) => r.name));
  console.log(`📋 ${appliedNames.size} migration(s) déjà appliquée(s).`);

  // Lire les fichiers de migration, triés par nom
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

    console.log(`⏳ Application: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `INSERT INTO _paylix_migrations (name) VALUES ($1)`,
        [file]
      );
      await client.query('COMMIT');
      console.log(`✅ Appliquée: ${file}`);
      applied_count++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ Échec sur ${file}:`, err);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log(`\n🎉 Migrations terminées — ${applied_count} appliquée(s), ${skipped_count} ignorée(s).`);
}

runMigrations();
