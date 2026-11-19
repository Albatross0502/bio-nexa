import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  ExternalLink,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { adminApi, AdminJob, AdminSyncLog } from '../../services/admin/adminApiClient';
import { googleSheetsSync } from '../../services/opportunities/googleSheetsSync';
import { useApp } from '../../context/AppContext';

interface GoogleSheetsSyncPanelProps {
  pendingReviewCount: number;
  pendingSheetsJobs: AdminJob[];
  onApproveJob: (id: string, title: string) => Promise<void>;
  onRejectJob: (id: string, title: string) => Promise<void>;
  onRefreshDashboard: () => Promise<void> | void;
  onNavigateToReview: () => void;
}

type SheetsStatusResponse = Awaited<ReturnType<typeof adminApi.getGoogleSheetsStatus>>;

export const GoogleSheetsSyncPanel: React.FC<GoogleSheetsSyncPanelProps> = ({
  pendingReviewCount,
  pendingSheetsJobs,
  onApproveJob,
  onRejectJob,
  onRefreshDashboard,
  onNavigateToReview,
}) => {
  const { addToast } = useApp();
  const [data, setData] = useState<SheetsStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const pendingSheetsCount = pendingSheetsJobs.length;

  const handleModerate = async (action: 'approve' | 'reject', job: AdminJob) => {
    setModeratingId(job.id);
    try {
      if (action === 'approve') {
        await onApproveJob(job.id, job.title);
      } else {
        await onRejectJob(job.id, job.title);
      }
      await loadStatus();
    } finally {
      setModeratingId(null);
    }
  };

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await adminApi.getGoogleSheetsStatus();
      setData(res);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load Google Sheets synchronization status.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleRunSync = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const res = await adminApi.runGoogleSheetsSync();
      addToast(res.message, res.success ? 'success' : 'error');
      await Promise.all([loadStatus(), Promise.resolve(onRefreshDashboard())]);
    } catch (err: any) {
      const msg = err?.message || 'Google Sheets sync failed.';
      setErrorMsg(msg);
      addToast(msg, 'error');
      await loadStatus();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyAppsScript = async () => {
    try {
      await navigator.clipboard.writeText(googleSheetsSync.getAppsScriptCode());
      addToast('Google Apps Script v2 snippet copied to clipboard.', 'success');
    } catch {
      addToast('Copy failed — select code block manually.', 'info');
    }
  };

  const modeLabel = (mode?: string) => {
    switch (mode) {
      case 'service_account':
        return 'Google Sheets API v4 (Service Account RS256)';
      case 'api_key':
        return 'Google Sheets API v4 (Server API Key)';
      case 'webapp':
        return 'Google Apps Script Web App (Server Endpoint)';
      case 'csv':
        return 'Published CSV Spreadsheet Feed (Server)';
      default:
        return 'Not Configured on Server';
    }
  };

  const status = data?.status;
  const config = data?.config;
  const lastReport = status?.lastReport;
  const colValidation = status?.columnValidation;
  const syncHistory: AdminSyncLog[] = data?.syncHistory || [];

  return (
    <div className="space-y-4 text-xs">
      {/* Header & Primary Action Bar */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-teal-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Server-Side Google Sheets Synchronization Console
              </h2>
              {config && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    config.configured
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                  }`}
                >
                  {config.configured ? 'Configured Server-Side' : 'Unconfigured'}
                </span>
              )}
            </div>
            <p className="text-slate-500 text-[11px] max-w-2xl leading-relaxed">
              Google Sheets acts strictly as an institutional staging &amp; import feed. Every newly imported opportunity enters the database as{' '}
              <strong className="text-slate-700 dark:text-slate-300">Pending Verification</strong> (never auto-published), existing database records are never deleted on sync failure, and zero Google credentials are ever exposed to browsers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onNavigateToReview}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold rounded-xl border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                Review Pending Queue ({pendingSheetsCount > 0 ? `${pendingSheetsCount} from Sheets · ` : ''}
                {pendingReviewCount} total)
              </span>
            </button>

            <button
              type="button"
              onClick={handleRunSync}
              disabled={isSyncing || isLoading}
              className="px-4 py-2 bg-[#0B2A5B] hover:bg-blue-900 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Synchronizing...' : 'Run Google Sheets Sync'}</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-center gap-2 text-[11px]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Server Config Summary (Sanitized) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active Transport Mode
            </div>
            <div className="font-bold text-slate-900 dark:text-slate-100">
              {modeLabel(config?.mode)}
            </div>
            <div className="text-[11px] text-slate-500">
              {config?.maskedSpreadsheetId
                ? `Spreadsheet ID: ${config.maskedSpreadsheetId}`
                : 'No Spreadsheet ID configured'}
              {config?.range ? ` · Range: ${config.range}` : ''}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Synchronization Timestamps</span>
            </div>
            <div className="text-[11px] text-slate-700 dark:text-slate-300">
              <span className="font-semibold">Last Attempt:</span>{' '}
              {status?.lastSyncAttemptAt ? new Date(status.lastSyncAttemptAt).toLocaleString() : 'Never'}
            </div>
            <div className="text-[11px] text-slate-700 dark:text-slate-300">
              <span className="font-semibold">Last Success:</span>{' '}
              {status?.lastSuccessfulSyncAt ? new Date(status.lastSuccessfulSyncAt).toLocaleString() : 'Never'}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-teal-600" />
              <span>Integrity &amp; Resilience</span>
            </div>
            <div className="font-bold text-slate-900 dark:text-slate-100">
              Zero Auto-Verify · Zero Auto-Delete
            </div>
            <div className="text-[11px] text-slate-500">
              {config?.note || 'Checking server environment...'}
            </div>
          </div>
        </div>

        {/* Last Error Banner (if recorded) */}
        {status?.lastError && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-[11px] flex items-start gap-2">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <span className="font-bold">Last Sync Notice / Error: </span>
              <span>{status.lastError}</span>
            </div>
          </div>
        )}
      </div>

      {/* Latest Report & Column Mapping Validation */}
      {(lastReport || colValidation) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {lastReport && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Latest Google Sheets Sync Metrics
              </h3>
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {lastReport.rowsFetched}
                  </div>
                  <div className="text-[10px] text-slate-500">Rows Read</div>
                </div>
                <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40">
                  <div className="text-lg font-extrabold text-teal-700 dark:text-teal-300">
                    {lastReport.importedCount}
                  </div>
                  <div className="text-[10px] text-teal-700 dark:text-teal-400">Pending Review</div>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40">
                  <div className="text-lg font-extrabold text-blue-700 dark:text-blue-300">
                    {lastReport.updatedCount}
                  </div>
                  <div className="text-[10px] text-blue-700 dark:text-blue-400">Updated Safely</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <div className="text-lg font-extrabold text-slate-700 dark:text-slate-200">
                    {lastReport.duplicatesSkippedCount}
                  </div>
                  <div className="text-[10px] text-slate-500">Duplicates Skipped</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40">
                  <div className="text-lg font-extrabold text-rose-700 dark:text-rose-300">
                    {lastReport.invalidRowsCount}
                  </div>
                  <div className="text-[10px] text-rose-700 dark:text-rose-400">Invalid Rows</div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
                  <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">
                    {lastReport.deletedCount}
                  </div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400">Records Deleted</div>
                </div>
              </div>
            </div>
          )}

          {colValidation && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Spreadsheet Column Mapping Validation
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    colValidation.valid
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                  }`}
                >
                  {colValidation.valid ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> Valid Schema
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" /> Schema Error
                    </>
                  )}
                </span>
              </div>

              <div className="space-y-2 text-[11px]">
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Mapped Standard Columns ({Object.keys(colValidation.matchedColumns || {}).length}):{' '}
                  </span>
                  <span className="text-slate-500">
                    {Object.keys(colValidation.matchedColumns || {}).length > 0
                      ? Object.entries(colValidation.matchedColumns)
                          .map(([field, header]) => `${field} <- "${header}"`)
                          .join(', ')
                      : 'None'}
                  </span>
                </div>
                {colValidation.missingRequired.length > 0 && (
                  <div className="text-rose-600 font-semibold">
                    Missing Required Columns: {colValidation.missingRequired.join(', ')}
                  </div>
                )}
                {colValidation.warnings && colValidation.warnings.length > 0 && (
                  <div className="text-amber-700 dark:text-amber-400">
                    Notes: {colValidation.warnings.join(' · ')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rejected / Invalid Spreadsheet Rows Details */}
      {lastReport && lastReport.invalidRows && lastReport.invalidRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Rejected Invalid Spreadsheet Rows ({lastReport.invalidRows.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
            {lastReport.invalidRows.map((item, idx) => (
              <div key={`${item.rowNumber}-${idx}`} className="px-4 py-2.5 flex items-center justify-between gap-3 text-[11px]">
                <div>
                  <span className="font-mono font-bold text-slate-500 mr-2">Row {item.rowNumber}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</span>
                </div>
                <span className="text-rose-600 dark:text-rose-400">{item.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Verification Records Imported from Google Sheets */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Google Sheets Imports Awaiting Admin Verification ({pendingSheetsCount})
            </h3>
          </div>
          <span className="text-[10px] font-semibold text-slate-500">
            Imported records remain hidden from public pages until approved
          </span>
        </div>

        {pendingSheetsCount === 0 ? (
          <div className="p-6 text-center text-slate-400 text-[11px]">
            No unverified Google Sheets records are awaiting review right now.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
            {pendingSheetsJobs.map((job) => {
              const isBusy = moderatingId === job.id;
              return (
                <div
                  key={job.id}
                  className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-[11px]"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-bold text-[10px] border border-amber-200 dark:border-amber-800">
                        {job.verificationStatus || 'Pending Verification'}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        {job.title}
                      </span>
                    </div>
                    <div className="text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span>{job.company || 'Institution'}</span>
                      <span>· {job.location || 'India'}</span>
                      {job.deadline && <span>· Deadline: {job.deadline}</span>}
                      {(job.applicationUrl || job.originalJobUrl) && (
                        <a
                          href={job.applicationUrl || job.originalJobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#0B2A5B] dark:text-teal-400 hover:underline font-semibold"
                        >
                          <span>Verify Apply URL</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleModerate('approve', job)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve &amp; Publish</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleModerate('reject', job)}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 disabled:opacity-50 font-bold rounded-lg inline-flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Google Sheets Sync Log History */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Google Sheets Sync Audit History ({syncHistory.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowSetupGuide((prev) => !prev)}
            className="text-[11px] font-bold text-[#0B2A5B] dark:text-teal-400 hover:underline cursor-pointer"
          >
            {showSetupGuide ? 'Hide Server Setup Guide' : 'Show Server Setup & Apps Script Guide'}
          </button>
        </div>

        {syncHistory.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-[11px]">
            No Google Sheets synchronization runs have been logged yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
            {syncHistory.map((log) => (
              <div key={log.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                        log.status === 'Success'
                          ? 'bg-emerald-50 text-emerald-700'
                          : log.status === 'Partial'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {log.status}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{log.sourceName}</span>
                  </div>
                  <p className="text-slate-500">{log.details}</p>
                </div>
                <span className="text-slate-400 shrink-0">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Server Environment Variable Reference & Apps Script Snippet */}
      {showSetupGuide && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-[11px]">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-slate-100">
              Server Environment Variables &amp; Apps Script v2 Reference
            </h3>
            <button
              type="button"
              onClick={handleCopyAppsScript}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3 h-3" /> Copy Apps Script
            </button>
          </div>
          <p className="text-slate-500">
            Configure credentials strictly in deployment environment variables (Netlify / Server `.env`). Never place Google API keys or private keys in client code:
          </p>
          <pre className="p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-[10px] overflow-x-auto leading-relaxed">
{`# Option 1 (Recommended Production): Service Account OAuth2 (RS256)
GOOGLE_SHEETS_SPREADSHEET_ID=<your-sheet-id>
GOOGLE_SHEETS_RANGE=Opportunities!A1:S500
GOOGLE_SERVICE_ACCOUNT_EMAIL=<service-account@project.iam.gserviceaccount.com>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"

# Option 2: Sheets API v4 Server Key
GOOGLE_SHEETS_SPREADSHEET_ID=<your-sheet-id>
GOOGLE_SHEETS_API_KEY=<server-only-api-key>

# Option 3: Apps Script Web App JSON Feed
GOOGLE_SHEETS_WEBAPP_URL=https://script.google.com/macros/s/<deployment-id>/exec
GOOGLE_SHEETS_WEBAPP_TOKEN=<optional-shared-header-token>`}
          </pre>
          <p className="text-slate-500">
            Standard Spreadsheet Headers:{' '}
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {(config?.allStandardColumns || []).join(', ')}
            </span>
          </p>
        </div>
      )}
    </div>
  );
};
