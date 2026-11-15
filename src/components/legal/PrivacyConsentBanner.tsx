import React, { useState } from 'react';
import { ShieldCheck, Cookie } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  readPrivacyConsent,
  savePrivacyConsent
} from '../../services/legal/legalCompliance';

export const PrivacyConsentBanner: React.FC = () => {
  const { navigate, currentPath, addToast } = useApp();
  const [savedConsent, setSavedConsent] = useState(() => readPrivacyConsent());

  // Don't obstruct the Admin login portal or show once consent preference is stored
  if (savedConsent || currentPath.startsWith('/admin')) {
    return null;
  }

  const handleChoice = (allowOptionalTelemetry: boolean) => {
    const next = savePrivacyConsent(allowOptionalTelemetry);
    setSavedConsent(next);
    addToast(
      allowOptionalTelemetry
        ? 'Privacy preferences saved (All session & functional tools enabled).'
        : 'Saved: Essential Only mode active (optional Google Apps Script telemetry disabled).',
      'info'
    );
  };

  return (
    <aside
      aria-label="Privacy and Cookie Notice"
      className="fixed bottom-4 left-4 right-4 z-40 max-w-4xl mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-4 sm:p-5 text-xs text-slate-700 dark:text-slate-300"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center shrink-0 text-[#14A3A0]">
            <Cookie className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Privacy, Cookies &amp; Browser Storage Notice (India DPDP Act)</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              BIO-NEXA uses strictly necessary browser storage for bookmarks/theme, an Admin-only session cookie, and an optional session visit ping via Google Apps Script. No advertising trackers are used.{' '}
              <button
                type="button"
                onClick={() => navigate('/privacy')}
                className="font-semibold text-[#0B2A5B] dark:text-sky-300 underline cursor-pointer"
              >
                Privacy Policy
              </button>
              {' · '}
              <button
                type="button"
                onClick={() => navigate('/cookies')}
                className="font-semibold text-[#0B2A5B] dark:text-sky-300 underline cursor-pointer"
              >
                Cookie &amp; Tracking Inventory
              </button>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleChoice(false)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[11px] transition-colors cursor-pointer"
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={() => handleChoice(true)}
            className="px-4 py-2 rounded-xl bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold text-[11px] transition-colors shadow-xs cursor-pointer"
          >
            Accept All
          </button>
        </div>
      </div>
    </aside>
  );
};
