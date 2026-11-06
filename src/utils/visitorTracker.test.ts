import test from 'node:test';
import assert from 'node:assert/strict';
import { getIndianDateTime, buildTrackingPayload, sendVisitorTracking } from './visitorTracker';

test('getIndianDateTime returns formatted Indian date and time in Asia/Kolkata', () => {
  // Use a known UTC instant: 2026-11-06T03:00:00Z -> IST is +05:30 -> 8:30 AM on 06 Nov 2026
  const testDate = new Date('2026-11-06T03:00:00.000Z');
  const indian = getIndianDateTime(testDate);

  assert.equal(indian.timezone, 'Asia/Kolkata');
  assert.ok(indian.date.includes('2026'), 'Date must contain year 2026');
  assert.ok(indian.time.includes('AM') || indian.time.includes('pm') || indian.time.includes('am') || indian.time.includes('PM'), 'Time must format with AM/PM');
});

test('buildTrackingPayload generates correct schema for Google Sheets Entry', () => {
  const payload = buildTrackingPayload();

  assert.equal(payload.action, 'record_entry');
  assert.equal(payload.timezone, 'Asia/Kolkata');
  assert.ok(payload.indianDate.length > 0);
  assert.ok(payload.indianTime.length > 0);
  assert.ok(payload.timestamp.length > 0);
});

test('sendVisitorTracking gracefully handles empty URL without throwing', async () => {
  const result = await sendVisitorTracking('');
  assert.equal(result.success, true);
  assert.equal(result.mode, 'local-ready');
});
