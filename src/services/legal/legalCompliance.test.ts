import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COOKIE_AND_STORAGE_INVENTORY,
  LEGAL_COUNSEL_REVIEW_CHECKLIST,
  OPERATIONAL_FACT_SHEET,
  POLICY_SECTIONS,
  PRIVACY_CONSENT_KEY,
  canSendNonEssentialTelemetry,
  clearBioNexaLocalData,
  createComplianceReferenceId,
  normalizeComplianceRequestType,
  readPrivacyConsent,
  savePrivacyConsent,
  validateComplianceRequest
} from './legalCompliance';
import { parseRoute } from '../../utils/routeMatcher';
import { BionexaDatabase } from '../../db/bionexaDatabase';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    }
  };
}

test('All 8 required policy sections (A-H) exist and map cleanly in routeMatcher', () => {
  assert.equal(POLICY_SECTIONS.length, 8);
  assert.deepEqual(
    POLICY_SECTIONS.map((s) => s.code),
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  );

  for (const sec of POLICY_SECTIONS) {
    const parsed = parseRoute(sec.route);
    assert.notEqual(parsed.route, 'not-found', `Route ${sec.route} should resolve cleanly`);
  }
});

test('Operational fact audit and counsel checklist explicitly flag placeholder items without inventing legal credentials', () => {
  assert.equal(OPERATIONAL_FACT_SHEET.length, 7);
  assert.ok(LEGAL_COUNSEL_REVIEW_CHECKLIST.length >= 4);

  const combinedText = JSON.stringify({
    OPERATIONAL_FACT_SHEET,
    LEGAL_COUNSEL_REVIEW_CHECKLIST,
    COOKIE_AND_STORAGE_INVENTORY
  });
  // Ensure no fabricated CIN / GSTIN / fake street address leaks
  assert.equal(/L\d{5}[A-Z]{2}\d{4}PTC\d{6}/.test(combinedText), false);
  assert.equal(combinedText.includes('Biotech City, Bengaluru, Karnataka 560100'), false);
  assert.ok(COOKIE_AND_STORAGE_INVENTORY.some((item) => item.name === 'bionexa_admin_session'));
  assert.ok(COOKIE_AND_STORAGE_INVENTORY.some((item) => item.name.includes('Google Apps Script')));
});

test('Consent preferences properly gate non-essential telemetry and clear local data', () => {
  const ls = createMemoryStorage();
  const ss = createMemoryStorage();
  ls.setItem('bionexa_saved_ids', '["job-1"]');
  ss.setItem('bionexa_welcome_entered', 'true');

  // Respects browser Do-Not-Track when no explicit choice stored
  assert.equal(canSendNonEssentialTelemetry(ls, '1'), false);
  assert.equal(canSendNonEssentialTelemetry(ls, null), true);

  // Essential Only blocks optional Google Apps Script telemetry
  savePrivacyConsent(false, ls);
  const stored = readPrivacyConsent(ls);
  assert.equal(stored?.essential, true);
  assert.equal(stored?.optionalTelemetry, false);
  assert.equal(canSendNonEssentialTelemetry(ls, null), false);

  // Accept All allows optional telemetry
  savePrivacyConsent(true, ls);
  assert.equal(canSendNonEssentialTelemetry(ls, null), true);

  // Clear local browser data wipes consent + user local items cleanly
  const clearedCount = clearBioNexaLocalData(ls, ss);
  assert.ok(clearedCount > 5);
  assert.equal(ls.getItem(PRIVACY_CONSENT_KEY), null);
  assert.equal(ls.getItem('bionexa_saved_ids'), null);
  assert.equal(ss.getItem('bionexa_welcome_entered'), null);
});

test('Compliance request validation enforces consent, target URL for reports/removals, and email format', () => {
  assert.equal(normalizeComplianceRequestType('privacy'), 'privacy_request');
  assert.equal(normalizeComplianceRequestType('removal'), 'content_removal');

  const noConsent = validateComplianceRequest({
    requestType: 'privacy_request',
    subCategory: 'DPDP Right to Access Personal Data (Sec. 11)',
    requesterName: 'Dr. Meera Iyer',
    requesterEmail: 'meera@institute.edu.in',
    details: 'Requesting export of any records held for my reporting email.',
    consentAccepted: false
  });
  assert.equal(noConsent.valid, false);

  const missingTarget = validateComplianceRequest({
    requestType: 'job_report',
    subCategory: 'Demanded Application Fee / Fraudulent Recruiter',
    requesterName: 'Rohan Das',
    requesterEmail: 'rohan@bio.org',
    targetTitleOrUrl: '',
    details: 'They asked for INR 2,000 refundable registration fee via UPI.',
    consentAccepted: true
  });
  assert.equal(missingTarget.valid, false);

  const validRemoval = validateComplianceRequest({
    requestType: 'content_removal',
    subCategory: 'Remove Unauthorized Job / Internship Listing',
    requesterName: 'HR Compliance Team',
    requesterEmail: 'hr@examplepharma.in',
    organization: 'Example Pharma Ltd',
    targetTitleOrUrl: 'https://bio-nexa.netlify.app/jobs/job-99',
    details: 'This recruitment window closed ahead of schedule; please unpublish immediately.',
    consentAccepted: true
  });
  assert.equal(validRemoval.valid, true);

  const refId = createComplianceReferenceId(Date.UTC(2026, 10, 14), 'a1b2c3');
  assert.equal(refId, 'BN-COMP-20261114-A1B2C3');
});

test('BionexaDatabase persists, filters, updates, and deletes compliance requests in SQLite', () => {
  const db = new BionexaDatabase(':memory:');
  const created = db.createComplianceRequest({
    requestType: 'content_removal',
    subCategory: 'Remove Unauthorized Job / Internship Listing',
    requesterName: 'Prof. S. Kulkarni',
    requesterEmail: 'sk@ncl.res.in',
    organization: 'Research Lab',
    targetTitleOrUrl: '/jobs/job-2',
    details: 'Position filled internally; please take down this listing.',
    consentAccepted: true
  });

  assert.ok(created.referenceId.startsWith('BN-COMP-'));
  assert.equal(created.status, 'Pending');

  const list = db.getComplianceRequests({ requestType: 'content_removal' });
  assert.equal(list.length, 1);
  assert.equal(list[0].id, created.id);

  const updated = db.updateComplianceRequestStatus(created.id, 'Action Taken', 'Unpublished listing.');
  assert.equal(updated?.status, 'Action Taken');
  assert.equal(updated?.resolutionNotes, 'Unpublished listing.');

  const deleted = db.deleteComplianceRequest(created.id);
  assert.equal(deleted, true);
  assert.equal(db.getComplianceRequests().length, 0);
});
