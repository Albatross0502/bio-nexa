/**
 * BIO-NEXA Visitor Tracking Utility
 * 
 * Prepares tracking data and handles communication with Google Apps Script Web App
 * connected to Google Sheets.
 * 
 * Columns: Entry No. | Date | Time
 * Timezone: Asia/Kolkata
 */

export interface IndianDateTime {
  date: string;
  time: string;
  iso: string;
  timezone: string;
}

export interface VisitorTrackingPayload {
  action: 'record_entry';
  timestamp: string;
  indianDate: string;
  indianTime: string;
  timezone: string;
  referrer: string;
  userAgent: string;
  screenResolution?: string;
  language?: string;
}

/**
 * Returns the current date and time formatted in Asia/Kolkata timezone
 */
export function getIndianDateTime(inputDate: Date = new Date()): IndianDateTime {
  const timeZone = 'Asia/Kolkata';

  // Format date: DD-MM-YYYY or readable English (e.g. 06 Nov 2026)
  const dateFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // Format time: hh:mm:ss a (e.g. 09:05:30 AM)
  const timeFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return {
    date: dateFormatter.format(inputDate),
    time: timeFormatter.format(inputDate),
    iso: inputDate.toISOString(),
    timezone: timeZone
  };
}

/**
 * Creates the visitor tracking payload for Google Apps Script
 */
export function buildTrackingPayload(date: Date = new Date()): VisitorTrackingPayload {
  const indian = getIndianDateTime(date);

  let referrer = 'direct';
  let userAgent = 'browser';
  let screenResolution = '1440x900';
  let language = 'en-US';

  if (typeof window !== 'undefined') {
    referrer = document.referrer || 'direct';
    userAgent = navigator.userAgent || 'unknown';
    screenResolution = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
    language = navigator.language || 'en-US';
  }

  return {
    action: 'record_entry',
    timestamp: indian.iso,
    indianDate: indian.date,
    indianTime: indian.time,
    timezone: indian.timezone,
    referrer,
    userAgent,
    screenResolution,
    language
  };
}

/**
 * Sends visitor tracking request to Google Apps Script Web App.
 * Non-blocking, failsafe, handles CORS restrictions with mode: 'no-cors'.
 */
export async function sendVisitorTracking(scriptUrl?: string): Promise<{ success: boolean; mode: string }> {
  const targetUrl = scriptUrl || 
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_APPS_SCRIPT_URL) ||
    (typeof window !== 'undefined' && (window as unknown as { __BIONEXA_GAS_URL__?: string }).__BIONEXA_GAS_URL__) ||
    '';

  const payload = buildTrackingPayload();

  if (!targetUrl || targetUrl.trim() === '') {
    // URL not configured yet - log helpful guidance without throwing
    if (typeof console !== 'undefined' && console.info) {
      console.info(
        '[BIO-NEXA] Visitor tracking initialized. Configure VITE_GOOGLE_APPS_SCRIPT_URL or window.__BIONEXA_GAS_URL__ to record entries to your Google Sheet.'
      );
    }
    return { success: true, mode: 'local-ready' };
  }

  try {
    // Google Apps Script Web Apps require no-cors for client-side POST without preflight failure
    await fetch(targetUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    return { success: true, mode: 'remote-dispatched' };
  } catch (error) {
    // Silent failover - never block user entry or display errors to visitors
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[BIO-NEXA] Visitor tracking network dispatch note:', error);
    }
    return { success: false, mode: 'network-fallback' };
  }
}
