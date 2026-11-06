/**
 * BIO-NEXA Google Sheets Visitor Tracking Utility
 * 
 * Connected to Google Apps Script Web App:
 * Columns recorded automatically: Entry No. | Date | Time
 */

export const BIO_NEXA_TRACKING_URL =
  "https://script.google.com/macros/s/AKfycbwCSGpoOJHEtqnVEKqf07kORQ3jfb0EqfMQn8NOo5QiAqYLGg4C33Oy2G7JXQ7iPwi8/exec";

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
    // Send visitor entry to Google Sheets
    fetch(BIO_NEXA_TRACKING_URL, {
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
