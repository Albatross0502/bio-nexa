/**
 * Environment & Runtime Configuration Helper for BIO-INEXA
 *
 * Cleanly separates development (Express + Vite + SQLite) from
 * production (Netlify Functions + CDN SPA) without leaking secrets.
 */

export type RuntimeMode = 'express-dev' | 'express-prod' | 'netlify-serverless';

export interface RuntimeEnvironmentConfig {
  nodeEnv: string;
  isProduction: boolean;
  isNetlify: boolean;
  isDevelopment: boolean;
  runtimeMode: RuntimeMode;
  siteUrl: string;
  allowedCorsOrigins: string[];
  cookieSecure: boolean;
  cookieSameSite: 'lax' | 'strict' | 'none';
  supabaseConfigured: boolean;
  adzunaConfigured: boolean;
  googleSheetsConfigured: boolean;
  adminCredentialsConfiguredInEnv: boolean;
  sessionSecretConfiguredInEnv: boolean;
}

const DEFAULT_PRODUCTION_SITE_URL = 'https://bio-inexa-0.netlify.app';
const DEFAULT_DEV_SITE_URL = 'http://localhost:3000';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://bio-inexa-0.netlify.app',
  'https://bio-nexa.netlify.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8888',
  'http://127.0.0.1:8888',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function normalizeOrigin(rawUrl?: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    return null;
  }
}

export function getRuntimeEnvironmentConfig(
  env: Record<string, string | undefined> = process.env
): RuntimeEnvironmentConfig {
  const nodeEnv = (env.NODE_ENV || 'development').trim().toLowerCase();
  const isNetlify =
    env.NETLIFY === 'true' ||
    Boolean(env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(env.NETLIFY_LOCAL) ||
    Boolean(env.CONTEXT);
  const isProduction = nodeEnv === 'production' || (isNetlify && env.CONTEXT === 'production');
  const isDevelopment = !isProduction && !isNetlify;

  const runtimeMode: RuntimeMode = isNetlify
    ? 'netlify-serverless'
    : isProduction
    ? 'express-prod'
    : 'express-dev';

  const resolvedSiteOrigin =
    normalizeOrigin(env.URL) ||
    normalizeOrigin(env.DEPLOY_PRIME_URL) ||
    normalizeOrigin(env.SITE_URL) ||
    (isProduction || isNetlify ? DEFAULT_PRODUCTION_SITE_URL : DEFAULT_DEV_SITE_URL);

  const originSet = new Set<string>(DEFAULT_ALLOWED_ORIGINS);
  if (resolvedSiteOrigin) originSet.add(resolvedSiteOrigin);

  const deployPrimeOrigin = normalizeOrigin(env.DEPLOY_PRIME_URL);
  if (deployPrimeOrigin) originSet.add(deployPrimeOrigin);

  if (env.CORS_ALLOWED_ORIGINS) {
    for (const entry of env.CORS_ALLOWED_ORIGINS.split(',')) {
      const origin = normalizeOrigin(entry);
      if (origin) originSet.add(origin);
    }
  }

  const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
  const supabaseServiceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const supabaseConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);

  const adzunaAppId = (env.ADZUNA_APP_ID || '').trim();
  const adzunaAppKey = (env.ADZUNA_APP_KEY || '').trim();
  const adzunaConfigured = Boolean(adzunaAppId && adzunaAppKey);

  const spreadsheetId = (env.GOOGLE_SHEETS_SPREADSHEET_ID || '').trim();
  const googleSheetsConfigured = Boolean(
    (spreadsheetId &&
      (((env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim() &&
        (env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').trim()) ||
        (env.GOOGLE_SHEETS_API_KEY || '').trim())) ||
      (env.GOOGLE_SHEETS_WEBAPP_URL || '').trim() ||
      (env.GOOGLE_SHEETS_CSV_URL || '').trim()
  );

  const adminPassword = (env.ADMIN_PASSWORD || '').trim();
  const adminPasswordHash = (env.ADMIN_PASSWORD_HASH || '').trim();
  const sessionSecret = (env.ADMIN_SESSION_SECRET || '').trim();
  const adminCredentialsConfiguredInEnv = Boolean(adminPassword || adminPasswordHash);
  const sessionSecretConfiguredInEnv = Boolean(sessionSecret && sessionSecret !== adminPassword);

  const cookieSecure = isProduction || resolvedSiteOrigin.startsWith('https://');

  return {
    nodeEnv,
    isProduction,
    isNetlify,
    isDevelopment,
    runtimeMode,
    siteUrl: resolvedSiteOrigin,
    allowedCorsOrigins: Array.from(originSet),
    cookieSecure,
    cookieSameSite: 'lax',
    supabaseConfigured,
    adzunaConfigured,
    googleSheetsConfigured,
    adminCredentialsConfiguredInEnv,
    sessionSecretConfiguredInEnv,
  };
}

/**
 * Resolves a safe Access-Control-Allow-Origin value without using '*'
 * when credentials are enabled.
 */
export function resolveCorsOrigin(
  requestOrigin: string | undefined,
  config: RuntimeEnvironmentConfig
): string {
  if (!requestOrigin) {
    return config.siteUrl;
  }

  const normalized = normalizeOrigin(requestOrigin);
  if (!normalized) {
    return config.siteUrl;
  }

  if (config.allowedCorsOrigins.includes(normalized)) {
    return normalized;
  }

  // Allow Netlify deploy preview subdomains for bio-inexa / bio-nexa sites
  try {
    const parsed = new URL(normalized);
    if (
      parsed.protocol === 'https:' &&
      parsed.hostname.endsWith('.netlify.app') &&
      (parsed.hostname.includes('bio-inexa') || parsed.hostname.includes('bio-nexa'))
    ) {
      return normalized;
    }
  } catch {
    // Ignore malformed origin
  }

  return config.siteUrl;
}

export interface ServerlessAdminCredentialConfig {
  username: string;
  password?: string;
  passwordHash?: string;
  sessionSecret: string;
  role: string;
  totpSecret?: string;
}

/**
 * Reads administrator credentials for serverless handlers from environment variables.
 * Returns null when credentials or dedicated session secret are not configured so we
 * never expose a hardcoded fallback password or reuse the password as an HMAC signing key.
 */
export function getServerlessAdminCredentials(
  env: Record<string, string | undefined> = process.env
): ServerlessAdminCredentialConfig | null {
  const password = (env.ADMIN_PASSWORD || '').trim();
  const passwordHash = (env.ADMIN_PASSWORD_HASH || '').trim();
  const username = (env.ADMIN_USERNAME || '').trim();
  const sessionSecret = (env.ADMIN_SESSION_SECRET || '').trim();

  if ((!password && !passwordHash) || !username) {
    return null;
  }

  // Require an explicit session secret distinct from the password
  if (!sessionSecret || sessionSecret.length < 16 || (password && sessionSecret === password)) {
    return null;
  }

  const role = (env.ADMIN_ROLE || 'super_admin').trim();
  const totpSecret = (env.ADMIN_TOTP_SECRET || '').trim() || undefined;

  return {
    username,
    ...(password ? { password } : {}),
    ...(passwordHash ? { passwordHash } : {}),
    sessionSecret,
    role,
    ...(totpSecret ? { totpSecret } : {}),
  };
}
