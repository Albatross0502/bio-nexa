/**
 * BIO-INEXA Phase 04 Migration CLI Script
 * Usage:
 *   npx tsx scripts/migrate-to-supabase.ts --dry-run
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-to-supabase.ts
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { bionexaDb } from '../src/db/bionexaDatabase.js';
import { migrateSqliteToSupabase } from '../src/db/supabaseMigration.js';
import { getSupabaseAdminClient } from '../netlify/functions/_shared/supabaseDb.js';

async function main() {
  const args = process.argv.slice(2);
  const dryRunFlag = args.includes('--dry-run');
  const outArg = args.find((a) => a.startsWith('--output='));

  const client = dryRunFlag ? null : getSupabaseAdminClient(process.env);
  if (!dryRunFlag && !client) {
    console.error(
      '[BIO-INEXA Migrate] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
        'Set them in .env or pass --dry-run to preview migration counts without remote writes.'
    );
    process.exit(1);
  }

  const report = await migrateSqliteToSupabase({
    db: bionexaDb,
    client,
    dryRun: dryRunFlag,
  });

  if (outArg) {
    const outPath = path.resolve(process.cwd(), outArg.slice('--output='.length));
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`[BIO-INEXA Migrate] Report written to ${outPath}`);
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.success) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('[BIO-INEXA Migrate] Fatal error:', err?.message || err);
  process.exit(1);
});
