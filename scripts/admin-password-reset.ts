#!/usr/bin/env npx tsx
/**
 * BIO-INEXA Operator CLI: Administrator Credential & Password Reset Utility
 *
 * Commands:
 *   npx tsx scripts/admin-password-reset.ts --generate-env [--password <pass>] [--username <user>] [--totp]
 *   npx tsx scripts/admin-password-reset.ts --set-password --username <user> --password <pass> [--role super_admin]
 *   npx tsx scripts/admin-password-reset.ts --issue-reset --username <user>
 */

import crypto from 'node:crypto';
import {
  buildTotpOtpAuthUri,
  createPasswordResetToken,
  generateTotpSecret,
  hashPassword,
  normalizeAdminRole,
  validateAdminPasswordStrength,
} from '../src/services/admin/adminAuthService.js';
import { bionexaDb } from '../src/db/bionexaDatabase.js';

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function generateStrongPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_';
  const bytes = crypto.randomBytes(20);
  let out = 'Bx!9';
  for (const b of bytes) {
    out += chars[b % chars.length];
  }
  return out;
}

function printUsage(): void {
  console.log(`
BIO-INEXA Administrator Credential & Password Reset Utility

Usage:
  1) Generate production environment variables (ADMIN_PASSWORD_HASH + ADMIN_SESSION_SECRET + optional TOTP):
     npx tsx scripts/admin-password-reset.ts --generate-env [--username admin@bio-inexa.org] [--password "<strong-password>"] [--totp]

  2) Set or rotate an administrator password directly in local SQLite (db/bionexa.db) & revoke active sessions:
     npx tsx scripts/admin-password-reset.ts --set-password --username admin@bio-inexa.org --password "<strong-password>" [--role super_admin]

  3) Issue a single-use 15-minute password reset token in SQLite:
     npx tsx scripts/admin-password-reset.ts --issue-reset --username admin@bio-inexa.org
`);
}

function main(): void {
  if (hasFlag('--generate-env')) {
    const username = getArg('--username') || 'admin@bio-inexa.org';
    const rawPassword = getArg('--password') || generateStrongPassword();
    const strength = validateAdminPasswordStrength(rawPassword);
    if (!strength.valid) {
      console.error(`Error: ${strength.error}`);
      process.exit(1);
    }

    const passwordHash = hashPassword(rawPassword);
    const sessionSecret = crypto.randomBytes(32).toString('hex');
    const enableTotp = hasFlag('--totp');
    const totpSecret = enableTotp ? generateTotpSecret() : '';

    console.log('\n# Copy into your .env / Netlify environment settings (never commit to Git):');
    console.log(`ADMIN_USERNAME=${username}`);
    console.log(`ADMIN_PASSWORD_HASH=${passwordHash}`);
    console.log(`ADMIN_SESSION_SECRET=${sessionSecret}`);
    console.log(`ADMIN_ROLE=super_admin`);
    if (enableTotp) {
      console.log(`ADMIN_TOTP_SECRET=${totpSecret}`);
      console.log(`# Authenticator URI: ${buildTotpOtpAuthUri(username, totpSecret)}`);
    }
    if (!getArg('--password')) {
      console.log(`# Generated one-time display password (save securely): ${rawPassword}`);
    }
    console.log('');
    return;
  }

  if (hasFlag('--set-password')) {
    const username = (getArg('--username') || '').trim();
    const password = getArg('--password') || '';
    const role = normalizeAdminRole(getArg('--role') || 'super_admin');

    if (!username || !password) {
      console.error('Error: --username and --password are required for --set-password.');
      process.exit(1);
    }

    const strength = validateAdminPasswordStrength(password);
    if (!strength.valid) {
      console.error(`Error: ${strength.error}`);
      process.exit(1);
    }

    const passwordHash = hashPassword(password);
    const existing = bionexaDb.getAdminUserByUsername(username);
    if (existing) {
      bionexaDb.updateAdminPasswordHash(existing.id, passwordHash);
      const revoked = bionexaDb.revokeAllAdminSessions(existing.id);
      bionexaDb.recordAdminAuditLog({
        adminUserId: existing.id,
        actorUsername: existing.username,
        action: 'CLI_ADMIN_PASSWORD_ROTATED',
        entityType: 'admin_user',
        entityId: existing.id,
        details: { revokedSessions: revoked },
      });
      console.log(`Updated password hash for '${existing.username}' and revoked ${revoked} active session(s).`);
    } else {
      const created = bionexaDb.upsertAdminUser({
        id: `admin-${crypto.randomBytes(4).toString('hex')}`,
        username,
        email: username.includes('@') ? username : `${username}@bionexa.org`,
        displayName: 'BIO-INEXA Administrator',
        role,
        passwordHash,
      });
      bionexaDb.recordAdminAuditLog({
        adminUserId: created.id,
        actorUsername: created.username,
        action: 'CLI_ADMIN_CREATED',
        entityType: 'admin_user',
        entityId: created.id,
        details: { role },
      });
      console.log(`Created administrator '${created.username}' (role=${created.role}) in SQLite database.`);
    }
    return;
  }

  if (hasFlag('--issue-reset')) {
    const username = (getArg('--username') || '').trim();
    if (!username) {
      console.error('Error: --username is required for --issue-reset.');
      process.exit(1);
    }

    const user = bionexaDb.getAdminUserByUsername(username);
    if (!user) {
      console.error(`Error: Administrator '${username}' not found in SQLite database.`);
      process.exit(1);
    }

    const reset = createPasswordResetToken();
    bionexaDb.createPasswordResetRecord({
      adminUserId: user.id,
      actorUsername: user.username,
      tokenHash: reset.tokenHash,
      expiresAtIso: reset.expiresAtIso,
    });
    bionexaDb.recordAdminAuditLog({
      adminUserId: user.id,
      actorUsername: user.username,
      action: 'CLI_ADMIN_RESET_TOKEN_ISSUED',
      entityType: 'admin_password_reset',
      details: { expiresAt: reset.expiresAtIso },
    });

    console.log('\nSingle-use administrator password reset token generated (valid 15 minutes):');
    console.log(`  Token:      ${reset.rawToken}`);
    console.log(`  Expires At: ${reset.expiresAtIso}`);
    console.log('Confirm via POST /api/admin/password-reset/confirm with { "token": "...", "newPassword": "..." }\n');
    return;
  }

  printUsage();
}

main();
