import { DEFAULT_APPS_SCRIPT_URL, googleSheetsSync } from '../services/opportunities/googleSheetsSync';

export const BIO_NEXA_TRACKING_URL = DEFAULT_APPS_SCRIPT_URL;

let bioNexaEntrySent = false;

/**
 * Sends visitor entry to Google Sheets via Google Apps Script Web App.
 * Uses GET with mode: 'no-cors', cache: 'no-store', keepalive: true.
 * Duplicate protection ensures each session triggers at most one entry.
 */
export function sendBioNexaVisitorEntry(): boolean {
  // Prevent duplicate tracking requests
  if (bioNexaEntrySent) {
    return false;
  }

  bioNexaEntrySent = true;

  try {
    const config = typeof window !== 'undefined' ? googleSheetsSync.getConfig() : null;
    const targetUrl = config?.scriptUrl || BIO_NEXA_TRACKING_URL;

    // Send visitor entry to Google Sheets
    fetch(targetUrl, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      keepalive: true
    }).catch(error => {
      console.error("BIO-NEXA tracking request failed:", error);
    });
    return true;
  } catch (error) {
    console.error("BIO-NEXA tracking dispatch error:", error);
    return false;
  }
}

/**
 * Resets the entry sent flag (useful for testing or session reset)
 */
export function resetBioNexaTrackingFlag(): void {
  bioNexaEntrySent = false;
}

// Retain alias for backwards compatibility
export const sendVisitorTracking = sendBioNexaVisitorEntry;

