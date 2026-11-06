import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BIO_NEXA_TRACKING_URL,
  sendBioNexaVisitorEntry,
  resetBioNexaTrackingFlag
} from './visitorTracker';

test('BIO_NEXA_TRACKING_URL is configured with the Google Apps Script Web App', () => {
  assert.ok(BIO_NEXA_TRACKING_URL.includes('script.google.com/macros/s/'));
  assert.ok(BIO_NEXA_TRACKING_URL.endsWith('/exec'));
});

test('sendBioNexaVisitorEntry prevents duplicate requests in the same session', () => {
  resetBioNexaTrackingFlag();
  // First call should proceed
  const first = sendBioNexaVisitorEntry();
  assert.equal(first, true);

  // Immediate second call should be blocked by duplicate guard
  const second = sendBioNexaVisitorEntry();
  assert.equal(second, false);

  resetBioNexaTrackingFlag();
});
