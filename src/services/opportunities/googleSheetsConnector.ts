/**
 * BIO-INEXA Server-Side Google Sheets API & Feed Connector
 *
 * Acyclic server connector supporting:
 * 1. Google Sheets API v4 with Service Account JWT (RS256 OAuth2 Bearer)
 * 2. Google Sheets API v4 with API Key
 * 3. Server-side Google Apps Script Web App JSON feed (+ optional token)
 * 4. Server-side Published CSV URL
 *
 * Strictly server-side: never exposes credentials or tokens to the frontend.
 */

import crypto from 'node:crypto';
import { fetchWithRetry, FetchWithRetryOptions } from '../../utils/fetchWithRetry';
import { validateApplicationUrl } from '../jobs/jobVerification';
import {
  parseCsvToSheetMatrix,
  parseSheetValuesToRows,
  RawSheetRow,
  STANDARD_SHEET_COLUMNS,
} from './googleSheetsSync';

export type GoogleSheetsIntegrationMode =
  | 'service_account'
  | 'api_key'
  | 'webapp'
  | 'csv'
  | 'unconfigured';

export interface GoogleSheetsConfigSummary {
  configured: boolean;
  mode: GoogleSheetsIntegrationMode;
  maskedSpreadsheetId: string;
  range: string;
  serviceAccountConfigured: boolean;
  apiKeyConfigured: boolean;
  webAppConfigured: boolean;
  csvUrlConfigured: boolean;
  requiredColumns: string[];
  allStandardColumns: readonly string[];
  note: string;
}

export interface FetchedSheetRawPayload {
  configured: boolean;
  mode: GoogleSheetsIntegrationMode;
  headers: string[];
  rows: RawSheetRow[];
  sourceUrlLabel: string;
  error?: string;
}

const DEFAULT_SHEET_RANGE = 'Opportunities!A1:S500';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

function maskIdentifier(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '****';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function getGoogleSheetsConfigSummary(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
): GoogleSheetsConfigSummary {
  const spreadsheetId = (env.GOOGLE_SHEETS_SPREADSHEET_ID || '').trim();
  const range = (env.GOOGLE_SHEETS_RANGE || DEFAULT_SHEET_RANGE).trim() || DEFAULT_SHEET_RANGE;
  const serviceEmail = (env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
  const serviceKey = (env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').trim();
  const apiKey = (env.GOOGLE_SHEETS_API_KEY || '').trim();
  const webAppUrl = (env.GOOGLE_SHEETS_WEBAPP_URL || '').trim();
  const csvUrl = (env.GOOGLE_SHEETS_CSV_URL || '').trim();

  const serviceAccountConfigured = Boolean(spreadsheetId && serviceEmail && serviceKey);
  const apiKeyConfigured = Boolean(spreadsheetId && apiKey);
  const webAppConfigured = Boolean(webAppUrl);
  const csvUrlConfigured = Boolean(csvUrl);

  let mode: GoogleSheetsIntegrationMode = 'unconfigured';
  if (serviceAccountConfigured) mode = 'service_account';
  else if (apiKeyConfigured) mode = 'api_key';
  else if (webAppConfigured) mode = 'webapp';
  else if (csvUrlConfigured) mode = 'csv';

  const configured = mode !== 'unconfigured';

  const note =
    mode === 'service_account'
      ? 'Configured using Google Service Account (OAuth2 RS256 Bearer token, server-side only).'
      : mode === 'api_key'
      ? 'Configured using Google Sheets API v4 Key (server-side only).'
      : mode === 'webapp'
      ? 'Configured using server-side Google Apps Script Web App JSON endpoint.'
      : mode === 'csv'
      ? 'Configured using server-side published CSV spreadsheet URL.'
      : 'Not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY + GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SHEETS_API_KEY + GOOGLE_SHEETS_SPREADSHEET_ID, or GOOGLE_SHEETS_WEBAPP_URL on the server.';

  return {
    configured,
    mode,
    maskedSpreadsheetId: maskIdentifier(spreadsheetId),
    range,
    serviceAccountConfigured,
    apiKeyConfigured,
    webAppConfigured,
    csvUrlConfigured,
    requiredColumns: ['Title', 'Organization', 'Application URL (or Registration URL)'],
    allStandardColumns: STANDARD_SHEET_COLUMNS,
    note,
  };
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function createServiceAccountJwtAssertion(params: {
  clientEmail: string;
  privateKey: string;
  scope?: string;
  audience?: string;
  nowEpochSec?: number;
}): string {
  const now = params.nowEpochSec ?? Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: params.clientEmail,
    scope: params.scope || SHEETS_READONLY_SCOPE,
    aud: params.audience || GOOGLE_OAUTH_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const normalizedKey = params.privateKey.replace(/\\n/g, '\n');

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(normalizedKey);

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function exchangeServiceAccountToken(
  clientEmail: string,
  privateKey: string,
  fetchOptions: FetchWithRetryOptions
): Promise<string> {
  const assertion = createServiceAccountJwtAssertion({ clientEmail, privateKey });
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  }).toString();

  const res = await fetchWithRetry(
    GOOGLE_OAUTH_TOKEN_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
    fetchOptions
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google OAuth2 token exchange failed (HTTP ${res.status}): ${errText.slice(0, 180)}`);
  }

  const tokenData: any = await res.json();
  if (!tokenData?.access_token) {
    throw new Error('Google OAuth2 response did not contain an access_token.');
  }
  return String(tokenData.access_token);
}

export async function fetchGoogleSheetsRawData(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
  fetchOptions: FetchWithRetryOptions = {}
): Promise<FetchedSheetRawPayload> {
  const summary = getGoogleSheetsConfigSummary(env);
  if (!summary.configured) {
    return {
      configured: false,
      mode: 'unconfigured',
      headers: [],
      rows: [],
      sourceUrlLabel: 'https://sheets.googleapis.com',
    };
  }

  const spreadsheetId = (env.GOOGLE_SHEETS_SPREADSHEET_ID || '').trim();
  const range = summary.range;

  try {
    if (summary.mode === 'service_account') {
      const accessToken = await exchangeServiceAccountToken(
        (env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim(),
        (env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').trim(),
        fetchOptions
      );
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
      const res = await fetchWithRetry(
        url,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        },
        fetchOptions
      );
      if (!res.ok) {
        return {
          configured: true,
          mode: 'service_account',
          headers: [],
          rows: [],
          sourceUrlLabel: 'https://sheets.googleapis.com/v4/spreadsheets',
          error: `Google Sheets API v4 returned HTTP ${res.status}`,
        };
      }
      const data: any = await res.json();
      const values = Array.isArray(data?.values) ? data.values : [];
      const parsed = parseSheetValuesToRows(values);
      return {
        configured: true,
        mode: 'service_account',
        headers: parsed.headers,
        rows: parsed.rows,
        sourceUrlLabel: 'https://sheets.googleapis.com/v4/spreadsheets',
      };
    }

    if (summary.mode === 'api_key') {
      const apiKey = (env.GOOGLE_SHEETS_API_KEY || '').trim();
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?key=${encodeURIComponent(apiKey)}`;
      const res = await fetchWithRetry(
        url,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        },
        fetchOptions
      );
      if (!res.ok) {
        return {
          configured: true,
          mode: 'api_key',
          headers: [],
          rows: [],
          sourceUrlLabel: 'https://sheets.googleapis.com/v4/spreadsheets',
          error: `Google Sheets API v4 returned HTTP ${res.status}`,
        };
      }
      const data: any = await res.json();
      const values = Array.isArray(data?.values) ? data.values : [];
      const parsed = parseSheetValuesToRows(values);
      return {
        configured: true,
        mode: 'api_key',
        headers: parsed.headers,
        rows: parsed.rows,
        sourceUrlLabel: 'https://sheets.googleapis.com/v4/spreadsheets',
      };
    }

    if (summary.mode === 'webapp') {
      const rawUrl = (env.GOOGLE_SHEETS_WEBAPP_URL || '').trim();
      const check = validateApplicationUrl(rawUrl);
      if (!check.valid) {
        return {
          configured: true,
          mode: 'webapp',
          headers: [],
          rows: [],
          sourceUrlLabel: 'https://script.google.com/macros/s/exec',
          error: `Invalid GOOGLE_SHEETS_WEBAPP_URL: ${check.reason}`,
        };
      }
      const webAppToken = (env.GOOGLE_SHEETS_WEBAPP_TOKEN || '').trim();
      const base = check.normalizedUrl;
      const fetchUrl = base.includes('?') ? `${base}&action=getOpportunities` : `${base}?action=getOpportunities`;
      const headersInit: Record<string, string> = { Accept: 'application/json' };
      if (webAppToken) headersInit['X-Sheet-Token'] = webAppToken;

      const res = await fetchWithRetry(fetchUrl, { method: 'GET', headers: headersInit }, fetchOptions);
      if (!res.ok) {
        return {
          configured: true,
          mode: 'webapp',
          headers: [],
          rows: [],
          sourceUrlLabel: 'https://script.google.com/macros/s/exec',
          error: `Google Apps Script Web App returned HTTP ${res.status}`,
        };
      }

      const text = await res.text();
      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch {
        return {
          configured: true,
          mode: 'webapp',
          headers: [],
          rows: [],
          sourceUrlLabel: 'https://script.google.com/macros/s/exec',
          error: 'Google Apps Script returned non-JSON response (verify JSON deployment & permissions).',
        };
      }

      if (payload?.status === 'error') {
        return {
          configured: true,
          mode: 'webapp',
          headers: [],
          rows: [],
          sourceUrlLabel: 'https://script.google.com/macros/s/exec',
          error: String(payload.message || 'Google Apps Script returned an error response.'),
        };
      }

      if (Array.isArray(payload?.values)) {
        const parsed = parseSheetValuesToRows(payload.values);
        return {
          configured: true,
          mode: 'webapp',
          headers: parsed.headers,
          rows: parsed.rows,
          sourceUrlLabel: 'https://script.google.com/macros/s/exec',
        };
      }

      const rows: RawSheetRow[] = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
        ? payload
        : [];
      const explicitHeaders: string[] = Array.isArray(payload?.headers)
        ? payload.headers.map((h: any) => String(h || '').trim()).filter(Boolean)
        : rows.length > 0
        ? Object.keys(rows[0])
        : [];

      return {
        configured: true,
        mode: 'webapp',
        headers: explicitHeaders,
        rows,
        sourceUrlLabel: 'https://script.google.com/macros/s/exec',
      };
    }

    // Mode: csv
    const csvUrl = (env.GOOGLE_SHEETS_CSV_URL || '').trim();
    const csvCheck = validateApplicationUrl(csvUrl);
    if (!csvCheck.valid) {
      return {
        configured: true,
        mode: 'csv',
        headers: [],
        rows: [],
        sourceUrlLabel: 'https://docs.google.com/spreadsheets',
        error: `Invalid GOOGLE_SHEETS_CSV_URL: ${csvCheck.reason}`,
      };
    }

    const csvRes = await fetchWithRetry(
      csvCheck.normalizedUrl,
      { method: 'GET', headers: { Accept: 'text/csv,text/plain' } },
      fetchOptions
    );
    if (!csvRes.ok) {
      return {
        configured: true,
        mode: 'csv',
        headers: [],
        rows: [],
        sourceUrlLabel: 'https://docs.google.com/spreadsheets',
        error: `CSV endpoint returned HTTP ${csvRes.status}`,
      };
    }

    const csvText = await csvRes.text();
    const matrix = parseCsvToSheetMatrix(csvText);
    const parsedCsv = parseSheetValuesToRows(matrix);
    return {
      configured: true,
      mode: 'csv',
      headers: parsedCsv.headers,
      rows: parsedCsv.rows,
      sourceUrlLabel: 'https://docs.google.com/spreadsheets',
    };
  } catch (err: any) {
    return {
      configured: true,
      mode: summary.mode,
      headers: [],
      rows: [],
      sourceUrlLabel: 'https://sheets.googleapis.com',
      error: err?.message || 'Google Sheets network request failed.',
    };
  }
}
