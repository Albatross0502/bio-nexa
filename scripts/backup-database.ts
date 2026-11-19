/**
 * BIO-INEXA Backup & Recovery CLI Script
 * Creates both:
 *  1) Atomic SQLite VACUUM INTO binary snapshot under db/backups/
 *  2) SHA-256 verified portable JSON snapshot for cross-engine Supabase recovery
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { bionexaDb } from '../src/db/bionexaDatabase.js';
import {
  buildDatabaseSnapshotPayload,
  verifyDatabaseSnapshotPayload,
} from '../src/db/supabaseMigration.js';

function main() {
  const binaryBackup = bionexaDb.createBackup();
  const snapshot = buildDatabaseSnapshotPayload(bionexaDb);
  const verify = verifyDatabaseSnapshotPayload(snapshot);
  if (!verify.valid) {
    throw new Error(verify.reason || 'Generated snapshot failed checksum verification');
  }

  const backupDir = path.resolve(process.cwd(), 'db', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const jsonFilename = `bionexa_snapshot_${snapshot.createdAt.replace(/[:.]/g, '-')}.json`;
  const jsonPath = path.join(backupDir, jsonFilename);
  fs.writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2), 'utf8');

  console.log(
    JSON.stringify(
      {
        success: true,
        sqliteBinaryBackup: binaryBackup,
        portableJsonSnapshot: {
          filename: jsonFilename,
          path: jsonPath,
          checksumSha256: snapshot.checksumSha256,
          counts: snapshot.counts,
        },
      },
      null,
      2
    )
  );
}

main();
