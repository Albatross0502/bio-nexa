import { canSendNonEssentialTelemetry } from '../services/legal/legalCompliance';

const DEFAULT_PUBLIC_VISITOR_PING_URL =
  'https://script.google.com/macros/s/AKfycbwCSGpoOJHEtqnVEKqf07kORQ3jfb0EqfMQn8NOo5QiAqYLGg4C33Oy2G7JXQ7iPwi8/exec';

export const BIO_NEXA_TRACKING_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_VISITOR_TRACKING_URL) ||
  DEFAULT_PUBLIC_VISITOR_PING_URL;

let bioNexaEntrySent = false;

/**
 * Sends anonymous session entry ping if user consent permits non-essential telemetry.
 * Duplicate protection ensures each session triggers at most one entry.
 */
export function sendBioNexaVisitorEntry(): boolean {
  if (bioNexaEntrySent) {
    return false;
  }

  if (!canSendNonEssentialTelemetry()) {
    return false;
  }

  bioNexaEntrySent = true;

  try {
    fetch(BIO_NEXA_TRACKING_URL, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      keepalive: true,
    }).catch((error) => {
      console.error('BIO-INEXA tracking request failed:', error);
    });
    return true;
  } catch (error) {
    console.error('BIO-INEXA tracking dispatch error:', error);
    return false;
  }
}

export function resetBioNexaTrackingFlag(): void {
  bioNexaEntrySent = false;
}

export const sendVisitorTracking = sendBioNexaVisitorEntry;
