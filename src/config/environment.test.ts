import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRuntimeEnvironmentConfig,
  getServerlessAdminCredentials,
  resolveCorsOrigin,
} from './environment';

test('detects Express development environment cleanly', () => {
  const config = getRuntimeEnvironmentConfig({ NODE_ENV: 'development' });
  assert.equal(config.runtimeMode, 'express-dev');
  assert.equal(config.isDevelopment, true);
  assert.equal(config.isProduction, false);
  assert.equal(config.isNetlify, false);
  assert.equal(config.siteUrl, 'http://localhost:3000');
  assert.equal(config.cookieSecure, false);
});

test('detects Netlify serverless production environment cleanly', () => {
  const config = getRuntimeEnvironmentConfig({
    NODE_ENV: 'production',
    NETLIFY: 'true',
    CONTEXT: 'production',
    URL: 'https://bio-inexa-0.netlify.app',
    ADMIN_USERNAME: 'admin@bio-inexa.org',
    ADMIN_PASSWORD: 'StrongPassword123!',
  });
  assert.equal(config.runtimeMode, 'netlify-serverless');
  assert.equal(config.isNetlify, true);
  assert.equal(config.isProduction, true);
  assert.equal(config.cookieSecure, true);
  assert.equal(config.siteUrl, 'https://bio-inexa-0.netlify.app');
  assert.equal(config.adminCredentialsConfiguredInEnv, true);
  assert.equal(config.supabaseConfigured, false);
});

test('resolveCorsOrigin allows configured origins and deploy previews, rejects unknown origins', () => {
  const config = getRuntimeEnvironmentConfig({
    NODE_ENV: 'production',
    NETLIFY: 'true',
    URL: 'https://bio-inexa-0.netlify.app',
    CORS_ALLOWED_ORIGINS: 'https://custom.bio-inexa.in',
  });

  assert.equal(
    resolveCorsOrigin('https://bio-inexa-0.netlify.app', config),
    'https://bio-inexa-0.netlify.app'
  );
  assert.equal(
    resolveCorsOrigin('https://deploy-preview-12--bio-inexa-0.netlify.app', config),
    'https://deploy-preview-12--bio-inexa-0.netlify.app'
  );
  assert.equal(
    resolveCorsOrigin('https://custom.bio-inexa.in', config),
    'https://custom.bio-inexa.in'
  );
  // Untrusted origin falls back to canonical siteUrl rather than echoing '*' or untrusted domain
  assert.equal(
    resolveCorsOrigin('https://evil.example.com', config),
    'https://bio-inexa-0.netlify.app'
  );
});

test('getServerlessAdminCredentials never invents a fallback password in production', () => {
  assert.equal(getServerlessAdminCredentials({}), null);
  assert.equal(getServerlessAdminCredentials({ ADMIN_USERNAME: 'admin' }), null);

  const creds = getServerlessAdminCredentials({
    ADMIN_USERNAME: 'ops@bio-inexa.org',
    ADMIN_PASSWORD: 'TestPassword!99',
    ADMIN_SESSION_SECRET: 'SigningSecret!99',
  });
  assert.ok(creds);
  assert.equal(creds.username, 'ops@bio-inexa.org');
  assert.equal(creds.password, 'TestPassword!99');
  assert.equal(creds.sessionSecret, 'SigningSecret!99');
});
