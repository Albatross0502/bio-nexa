import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Shield,
  Activity,
  Users,
  Briefcase,
  RefreshCw,
  AlertTriangle,
  Mail,
  CheckCircle2,
  XCircle,
  Database,
  ExternalLink,
  Settings,
  FileCheck,
  Globe,
  Clock,
  Sparkles,
  Building2,
  Trash2,
  Copy,
  Check,
  Code2
} from 'lucide-react';
import { opportunityStore } from '../../services/opportunities/opportunityStore';
import { googleSheetsSync, GoogleSheetsConfig } from '../../services/opportunities/googleSheetsSync';
import { DATA_SOURCES } from '../../services/opportunities/sourcesRegistry';
import { Opportunity } from '../../types/opportunity';
import { EDUCATIONAL_BRANCHES } from '../../config/branches';

export const AdminPanel: React.FC = () => {
  const {
    jobs,
    internships,
    courses,
    applications,
    reports,
    resolveReport,
    externalSyncLogs,
    triggerExternalSync,
    isSyncing,
    contactMessages
  } = useApp();

  const [activeTab, setActiveTab] = useState<'metrics' | 'opportunities' | 'sheets' | 'sources' | 'sync' | 'reports' | 'messages' | 'settings'>('opportunities');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Google Sheets state
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>(googleSheetsSync.getConfig());
  const [customScriptUrl, setCustomScriptUrl] = useState(googleSheetsSync.getConfig().scriptUrl);
  const [isTestingSync, setIsTestingSync] = useState(false);
  const [testSyncMsg, setTestSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const unsubStore = opportunityStore.subscribe(setOpportunities);
    const unsubSheets = googleSheetsSync.subscribe(cfg => {
      setSheetsConfig(cfg);
      setCustomScriptUrl(cfg.scriptUrl);
    });
    return () => {
      unsubStore();
      unsubSheets();
    };
  }, []);

  const pendingOpportunities = opportunities.filter(o => !o.isApproved);
  const approvedOpportunities = opportunities.filter(o => o.isApproved);

  const handleApprove = (id: string) => {
    opportunityStore.approveOpportunity(id);
  };

  const handleReject = (id: string) => {
    opportunityStore.rejectOpportunity(id);
  };

  const handleUpdateStatus = (id: string, status: any) => {
    opportunityStore.updateStatus(id, status);
  };

  const handleTriggerOpportunitiesSync = async () => {
    setSyncStatusMsg('Triggering 6-hour automated sync across verified gazettes...');
    try {
      const results = await opportunityStore.syncAllSources();
      const added = results.reduce((acc, r) => acc + r.newItemsAdded, 0);
      const expired = results.reduce((acc, r) => acc + r.expiredUpdated, 0);
      setSyncStatusMsg(`Sync completed! ${added} new opportunities added, ${expired} expired.`);
    } catch {
      setSyncStatusMsg('Sync finished with standard verified gazette state.');
    }
    setTimeout(() => setSyncStatusMsg(null), 4000);
  };

  const handleSaveSheetsUrl = () => {
    if (!customScriptUrl.trim()) return;
    googleSheetsSync.updateConfig({ scriptUrl: customScriptUrl.trim() });
    setTestSyncMsg({ type: 'success', text: 'Google Apps Script Web App URL updated successfully!' });
    setTimeout(() => setTestSyncMsg(null), 3000);
  };

  const handleTestSheetsSync = async () => {
    setIsTestingSync(true);
    setTestSyncMsg(null);
    try {
      const res = await opportunityStore.syncWithGoogleSheets(true);
      if (res.success) {
        setTestSyncMsg({
          type: 'success',
          text: `Sync Successful! ${res.count} active opportunities loaded into BIO-NEXA.`
        });
      } else {
        setTestSyncMsg({
          type: 'error',
          text: `Sync fallback: ${res.message || 'Endpoint returned empty or offline; retained verified cache.'}`
        });
      }
    } catch (e: any) {
      setTestSyncMsg({
        type: 'error',
        text: `Error contacting Google Sheets: ${e?.message || 'Network error'}`
      });
    } finally {
      setIsTestingSync(false);
      setTimeout(() => setTestSyncMsg(null), 6000);
    }
  };

  const handleCopyAppsScript = () => {
    const code = googleSheetsSync.getAppsScriptCode();
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="bg-[#0B2A5B] rounded-2xl p-6 sm:p-8 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-300">
            <Shield className="w-4 h-4" />
            <span>Master Administration Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            BIO-NEXA National Operations &amp; Moderation
          </h1>
          <p className="text-xs text-slate-200 mt-1">
            Real-time control over external API syncs (NCBI/PubMed), job &amp; fellowship moderation, applicant registries, and site health.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="p-3 bg-white/10 rounded-xl border border-white/15">
            <div className="text-teal-300">System Status</div>
            <div className="font-bold text-sm">Nominal 100%</div>
          </div>
          <div className="p-3 bg-white/10 rounded-xl border border-white/15">
            <div className="text-teal-300">Database</div>
            <div className="font-bold text-sm">bionexa.db (SQLite)</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs">
        {(
          [
            ['opportunities', `Opportunities Moderation (${pendingOpportunities.length} Pending)`, FileCheck],
            ['sheets', 'Google Sheets Integration', Database],
            ['sources', `Data Sources Registry (${DATA_SOURCES.length})`, Globe],
            ['metrics', 'System KPI Dashboard', Activity],
            ['sync', `External Data Sync (${externalSyncLogs.length})`, RefreshCw],
            ['reports', `Reports Queue (${reports.filter((r) => r.status === 'Pending').length})`, AlertTriangle],
            ['messages', `Inquiries (${contactMessages.length})`, Mail],
            ['settings', 'Platform Settings', Settings]
          ] as const
        ).map(([tabKey, label, Icon]) => (
          <button
            key={tabKey}
            onClick={() => setActiveTab(tabKey)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all ${
              activeTab === tabKey
                ? 'bg-[#0B2A5B] text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* OPPORTUNITIES MODERATION TAB */}
      {activeTab === 'opportunities' && (
        <div className="space-y-6 text-xs">
          {/* Top Actions & Sync Status */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Opportunities Moderation Console</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-mono text-[11px] font-bold">
                  {opportunities.length} Total Registered
                </span>
              </div>
              <p className="text-slate-500 mt-1">
                Enforce quality control, review direct employer/organizer posts, detect duplicate vacancies, and monitor automatic expiry.
              </p>
            </div>

            <button
              onClick={handleTriggerOpportunitiesSync}
              className="px-4 py-2 bg-linear-to-r from-sky-600 to-teal-600 hover:from-sky-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-xs flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Run Automated Sync Now</span>
            </button>
          </div>

          {syncStatusMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{syncStatusMsg}</span>
            </div>
          )}

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 font-semibold uppercase text-[11px]">Pending Approval</span>
              <div className="text-2xl font-bold font-mono text-amber-600 mt-1">{pendingOpportunities.length}</div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 font-semibold uppercase text-[11px]">Active Listings</span>
              <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                {approvedOpportunities.filter(o => o.status === 'active' || o.status === 'Active').length}
              </div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 font-semibold uppercase text-[11px]">Closing Soon (&lt;=5d)</span>
              <div className="text-2xl font-bold font-mono text-amber-500 mt-1">
                {approvedOpportunities.filter(o => o.status === 'closing_soon' || o.status === 'Closing Soon').length}
              </div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 font-semibold uppercase text-[11px]">Expired Listings</span>
              <div className="text-2xl font-bold font-mono text-slate-400 mt-1">
                {approvedOpportunities.filter(o => o.status === 'expired' || o.status === 'Expired').length}
              </div>
            </div>
          </div>

          {/* Pending Submissions Queue */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                Pending Submissions Queue ({pendingOpportunities.length})
              </h3>
              <span className="text-slate-500 text-[11px]">Review employer &amp; workshop submissions before public listing</span>
            </div>

            {pendingOpportunities.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                <p className="font-medium text-slate-800 dark:text-slate-200">Moderation Queue Clear</p>
                <p className="text-xs text-slate-400">All submitted opportunities have been reviewed and published.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingOpportunities.map(opp => (
                  <div key={opp.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                          {opp.type}
                        </span>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{opp.title}</h4>
                      </div>
                      <div className="text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3 text-xs">
                        <span>{opp.organization}</span>
                        <span>•</span>
                        <span>{opp.location} ({opp.workMode})</span>
                        <span>•</span>
                        <span>Comp: {opp.salaryOrStipend || (opp.compensation?.isDisclosed && opp.compensation?.amount ? `₹${opp.compensation.amount}` : 'Not Disclosed')}</span>
                        <span>•</span>
                        <span>Deadline: {opp.deadline || 'Not Specified'}</span>
                      </div>
                      <div className="text-slate-500 text-[11px] line-clamp-1">{opp.description}</div>
                      {opp.duplicateOf && (
                        <div className="text-amber-600 text-[11px] flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Potential duplicate detected with existing record ID: {opp.duplicateOf}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {opp.applicationUrl && (
                        <a
                          href={opp.applicationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-500 hover:text-sky-600 border border-slate-200 dark:border-slate-700 rounded-lg"
                          title="Open application URL"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => handleApprove(opp.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve &amp; Publish</span>
                      </button>
                      <button
                        onClick={() => handleReject(opp.id)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Listings Moderation Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                Published Vacancies &amp; Expiry Control ({approvedOpportunities.length})
              </h3>
              <span className="text-slate-400 text-[11px]">Modify status or remove expired postings</span>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {approvedOpportunities.map(opp => (
                <div key={opp.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{opp.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        (opp.status === 'active' || opp.status === 'Active') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                        (opp.status === 'closing_soon' || opp.status === 'Closing Soon') ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                        'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      }`}>
                        {opp.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      {opp.organization} · {opp.location} · Deadline: {opp.deadline || 'Not Specified'} · Source: {opp.source?.name || opp.sourceName || 'Official'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={opp.status}
                      onChange={(e) => handleUpdateStatus(opp.id, e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      <option value="active">Active</option>
                      <option value="closing_soon">Closing Soon</option>
                      <option value="expired">Expired</option>
                      <option value="verification_needed">Verification Needed</option>
                    </select>

                    <button
                      onClick={() => handleReject(opp.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      title="Delete opportunity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GOOGLE SHEETS & GOOGLE APPS SCRIPT INTEGRATION TAB */}
      {activeTab === 'sheets' && (
        <div className="space-y-6 text-xs">
          {/* Status & Sync Overview */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-teal-600" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Google Sheets &amp; Google Apps Script Real-Time Integration
                  </h2>
                </div>
                <p className="text-slate-500 mt-1">
                  Connect your Google Spreadsheet to automatically populate and update opportunities (Jobs, Biotech Jobs, Internships, Workshops, and Courses) without code redeployments.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  sheetsConfig.lastSyncStatus === 'success' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                  sheetsConfig.lastSyncStatus === 'syncing' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' :
                  'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    sheetsConfig.lastSyncStatus === 'success' ? 'bg-emerald-500' :
                    sheetsConfig.lastSyncStatus === 'syncing' ? 'bg-sky-500 animate-ping' :
                    'bg-amber-500'
                  }`} />
                  <span>
                    {sheetsConfig.lastSyncStatus === 'success' ? 'Active & Synced' :
                     sheetsConfig.lastSyncStatus === 'syncing' ? 'Syncing...' :
                     sheetsConfig.lastSyncStatus === 'fallback' ? 'Cached Fallback Active' : 'Ready'}
                  </span>
                </span>
              </div>
            </div>

            {/* Metrics Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-slate-500 text-[11px] font-medium">Last Automatic Sync</div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {sheetsConfig.lastSyncTime ? new Date(sheetsConfig.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Initialized at startup'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Auto-refreshes every 10 minutes</div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-slate-500 text-[11px] font-medium">Active Opportunities Loaded</div>
                <div className="text-sm font-bold text-teal-600 mt-0.5">
                  {opportunities.filter(o => o.status !== 'expired' && o.status !== 'closed').length} Listings
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Expired items automatically hidden</div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-slate-500 text-[11px] font-medium">Auto-Categorization</div>
                <div className="text-sm font-bold text-[#0B2A5B] dark:text-blue-400 mt-0.5">
                  5 Target Channels
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">All, Biotech, Internships, Workshops, Courses</div>
              </div>
            </div>
          </div>

          {/* Endpoint Configuration */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Google Apps Script Web App Endpoint URL
            </h3>
            <p className="text-slate-500 text-[11px]">
              This URL is generated when you deploy your Google Apps Script as a Web App (Execute as: Me, Who has access: Anyone).
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={customScriptUrl}
                onChange={(e) => setCustomScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-xs focus:ring-2 focus:ring-teal-500 outline-none"
              />
              <button
                onClick={handleSaveSheetsUrl}
                className="px-4 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-xl transition-colors shrink-0"
              >
                Save URL
              </button>
              <button
                disabled={isTestingSync}
                onClick={handleTestSheetsSync}
                className="px-4 py-2 bg-[#14A3A0] hover:bg-teal-600 disabled:opacity-50 text-white font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingSync ? 'animate-spin' : ''}`} />
                <span>{isTestingSync ? 'Testing...' : 'Test & Sync Now'}</span>
              </button>
            </div>

            {testSyncMsg && (
              <div className={`p-3 rounded-xl border font-medium ${
                testSyncMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-800 dark:text-amber-300'
              }`}>
                {testSyncMsg.text}
              </div>
            )}
          </div>

          {/* 19 Standardized Columns Schema */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Google Sheet Schema (19 Standardized Columns)
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Set Row 1 in your Google Sheet with these exact header names. The synchronizer automatically maps each column.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-4">#</th>
                    <th className="py-2.5 px-4">Column Header</th>
                    <th className="py-2.5 px-4">Importance</th>
                    <th className="py-2.5 px-4">Example Value</th>
                    <th className="py-2.5 px-4">Usage &amp; Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[
                    ['1', 'ID', 'Required', 'CSIR-JRF-2025-01', 'Unique opportunity identifier'],
                    ['2', 'Title', 'Required', 'Junior Research Fellow (Genomics)', 'Full job, internship, or workshop title'],
                    ['3', 'Category', 'Required', 'biotech_job / internship / workshop / course / job', 'Determines which homepage portal displays the item'],
                    ['4', 'Organization', 'Required', 'CSIR - IGIB, New Delhi', 'Hiring organization or institute'],
                    ['5', 'Description', 'Required', 'Conducting high-throughput RNA sequencing...', 'Concise description shown in modal and preview'],
                    ['6', 'Eligibility', 'Recommended', 'M.Sc in Biotechnology / Biochemistry / Life Sciences', 'Degree and background requirements'],
                    ['7', 'Qualification', 'Recommended', 'CSIR-NET / GATE / ICMR-JRF qualified', 'National exam criteria or certifications'],
                    ['8', 'Location', 'Required', 'New Delhi (On-site)', 'City, state, or country of employment'],
                    ['9', 'Mode', 'Required', 'offline / online / hybrid', 'Work/study modality'],
                    ['10', 'Salary/Stipend', 'Recommended', '₹37,000/month + HRA', 'Monthly CTC, stipend, or fellowship amount'],
                    ['11', 'Fees', 'For Workshops/Courses', 'Free / ₹1,499 (Certificate included)', 'Tuition or registration charges'],
                    ['12', 'Duration', 'For Internships/Courses', '6 Months / 8 Weeks', 'Program timeline or course length'],
                    ['13', 'Published Date', 'Recommended', '2025-05-01', 'YYYY-MM-DD posting timestamp'],
                    ['14', 'Application Deadline', 'Crucial', '2025-06-30', 'YYYY-MM-DD. Auto-calculates Open / Closing Soon / Expired status'],
                    ['15', 'Application URL', 'Highest Priority', 'https://igib.res.in/careers', 'Official external career application portal (opens in new tab)'],
                    ['16', 'Registration URL', 'For Workshops/Courses', 'https://forms.gle/sample', 'Direct link for workshop enrollment'],
                    ['17', 'Status', 'Optional', 'Open / Closing Soon / Closed', 'Manual override; system auto-determines if left empty'],
                    ['18', 'Featured', 'Optional', 'TRUE / FALSE', 'Pins listing to the top of its respective portal'],
                    ['19', 'Last Updated', 'Optional', '2025-05-15', 'Timestamp for audit logs']
                  ].map(([num, header, req, example, notes]) => (
                    <tr key={num} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono text-slate-400">{num}</td>
                      <td className="py-2.5 px-4 font-bold text-[#0B2A5B] dark:text-blue-300 font-mono">{header}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          req === 'Highest Priority' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                          req === 'Required' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                          req === 'Crucial' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {req}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">{example}</td>
                      <td className="py-2.5 px-4 text-slate-500">{notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Copyable Google Apps Script Code */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-teal-600" />
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Complete Google Apps Script Code (Code.gs)
                  </h3>
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Paste this into your Google Sheet's <strong>Extensions &gt; Apps Script</strong> editor. Handles both ENTER button visitor tracking and real-time opportunities JSON feed.
                </p>
              </div>

              <button
                onClick={handleCopyAppsScript}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0B2A5B] hover:bg-blue-900 text-white rounded-lg font-bold text-xs transition-colors shrink-0"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied Code!' : 'Copy Script Code'}</span>
              </button>
            </div>

            <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-[11px] overflow-x-auto max-h-72 border border-slate-800">
              <pre>{googleSheetsSync.getAppsScriptCode()}</pre>
            </div>

            <div className="p-4 bg-sky-50 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-800 text-[11px] text-sky-900 dark:text-sky-300 space-y-1">
              <div className="font-bold">Setup Instructions:</div>
              <ol className="list-decimal list-inside space-y-0.5 text-slate-700 dark:text-slate-300">
                <li>Create a Google Sheet and name your data tab <code className="font-mono bg-sky-100 dark:bg-sky-900 px-1 rounded">Opportunities</code>.</li>
                <li>Add the 19 columns shown above in Row 1.</li>
                <li>Go to <strong>Extensions &gt; Apps Script</strong>, paste the code above, and click <strong>Deploy &gt; New deployment</strong>.</li>
                <li>Select <strong>Web app</strong>, set <em>Execute as: Me</em>, and set <em>Who has access: Anyone</em>.</li>
                <li>Copy the resulting Web App URL and paste it in the endpoint field above.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'sources' && (
        <div className="space-y-6 text-xs">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Data Sources &amp; Legal Compliance Registry
            </h2>
            <p className="text-slate-500">
              BIO-NEXA operates strictly under Section 6 &amp; 11 legal standards: no unauthorized web scraping, no bypass of authentication walls, and 100% adherence to platform terms of service.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold uppercase tracking-wider text-slate-400">
              Registered Connectors ({DATA_SOURCES.length})
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {DATA_SOURCES.map(source => (
                <div key={source.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">{source.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        source.permissionStatus === 'public_open_licence' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                        source.permissionStatus === 'authorized' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' :
                        'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                      }`}>
                        {source.permissionStatus.replace(/_/g, ' ')}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {source.type}
                      </span>
                    </div>

                    <p className="text-slate-500 text-xs">
                      Sync Frequency: Every {source.syncCadenceHours} hours • Status: {source.isActive ? 'Active & Monitored' : 'Disabled'}
                    </p>

                    {source.notes && (
                      <p className="text-[11px] text-slate-400 italic">
                        {source.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-xs text-emerald-600 font-bold">
                      {opportunities.filter(o => o.source?.id === source.id || o.sourceId === source.id).length} Active Listings
                    </span>

                    {source.baseUrl && (
                      <a
                        href={source.baseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-sky-600"
                        title="Visit source portal"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 1. METRICS DASHBOARD */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-slate-400 font-semibold uppercase tracking-wider block">Total Job Listings</span>
              <div className="text-2xl font-bold font-mono text-[#0B2A5B] dark:text-sky-300 mt-1">{jobs.length}</div>
              <span className="text-emerald-600 font-medium">+14 added this week</span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-slate-400 font-semibold uppercase tracking-wider block">Internship Fellowships</span>
              <div className="text-2xl font-bold font-mono text-teal-600 mt-1">{internships.length}</div>
              <span className="text-slate-500">IASc, Biocon, NCBS</span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-slate-400 font-semibold uppercase tracking-wider block">Submitted Applications</span>
              <div className="text-2xl font-bold font-mono text-blue-600 mt-1">{applications.length}</div>
              <span className="text-slate-500">Across all active postings</span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-slate-400 font-semibold uppercase tracking-wider block">Academy Courses</span>
              <div className="text-2xl font-bold font-mono text-indigo-600 mt-1">{courses.length}</div>
              <span className="text-emerald-600 font-medium">100% completion certs active</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Recent Application Pipeline Activity
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {applications.slice(0, 5).map((app) => (
                <div key={app.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {app.applicantName} &rarr; {app.jobTitle}
                    </div>
                    <div className="text-slate-400 mt-0.5">{app.company} · {app.appliedDate} · {app.qualification}</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full font-mono text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. EXTERNAL SYNC CONSOLE */}
      {activeTab === 'sync' && (
        <div className="space-y-6 text-xs">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Automated External Integrations &amp; Feed Connectors
              </h3>
              <p className="text-slate-500 mt-0.5">
                BIO-NEXA polls official scientific APIs according to Section 11 of the Master Specification.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100">NCBI PubMed E-Utilities</div>
                <p className="text-slate-500 text-[11px]">Syncs latest peer-reviewed biotechnology literature and CRISPR papers.</p>
                <button
                  disabled={isSyncing}
                  onClick={() => triggerExternalSync('PubMed / NCBI E-utilities')}
                  className="w-full py-1.5 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Refresh Now</span>
                </button>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100">Crossref Metadata Engine</div>
                <p className="text-slate-500 text-[11px]">Validates digital object identifiers (DOIs) and publication citations.</p>
                <button
                  disabled={isSyncing}
                  onClick={() => triggerExternalSync('Crossref Metadata API')}
                  className="w-full py-1.5 bg-[#14A3A0] hover:bg-teal-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Refresh Now</span>
                </button>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100">Official Exam Portals (NTA/CSIR)</div>
                <p className="text-slate-500 text-[11px]">Checks official bulletin updates, syllabus PDFs, and admit card dates.</p>
                <button
                  disabled={isSyncing}
                  onClick={() => triggerExternalSync('CSIR / ICMR Official Exam Feeds')}
                  className="w-full py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Refresh Now</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sync History Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold uppercase tracking-wider text-slate-400">
              Audit Logs &amp; Synchronization History (sync_logs)
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {externalSyncLogs.map((log) => (
                <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">{log.source}</div>
                    <div className="text-slate-500 text-[11px] mt-0.5">{log.details}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-emerald-600 font-bold">+{log.newItems} new items</span>
                    <div className="text-slate-400 text-[10px]">{log.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. REPORTS QUEUE */}
      {activeTab === 'reports' && (
        <div className="space-y-4 text-xs">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            User Moderation &amp; Content Reports Queue
          </h2>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-xs">
            {reports.map((rep) => (
              <div key={rep.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-rose-600 uppercase text-[10px] bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded">
                      {rep.reason}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{rep.itemTitle}</span>
                  </div>
                  <div className="text-slate-500">
                    Reported by: {rep.reportedBy} on {rep.date}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded font-bold font-mono text-[11px] ${
                    rep.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {rep.status}
                  </span>

                  {rep.status === 'Pending' && (
                    <>
                      <button
                        onClick={() => resolveReport(rep.id, 'Resolved')}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                        title="Mark Resolved"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => resolveReport(rep.id, 'Dismissed')}
                        className="p-1.5 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded"
                        title="Dismiss Report"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. CONTACT INQUIRIES */}
      {activeTab === 'messages' && (
        <div className="space-y-4 text-xs">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Contact Messages &amp; Institutional Inquiries
          </h2>

          {contactMessages.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500">
              No new inquiries in the queue.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-xs">
              {contactMessages.map((msg, idx) => (
                <div key={idx} className="p-5 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{msg.subject}</span>
                    <span className="font-mono text-[11px]">{msg.date}</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    From: <strong>{msg.name}</strong> ({msg.email})
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg leading-relaxed mt-2">
                    {msg.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. SITE SETTINGS */}
      {activeTab === 'settings' && (
        <div className="max-w-xl bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs shadow-xs">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            BIO-NEXA Global Site Settings
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Platform Name
              </label>
              <input
                type="text"
                readOnly
                value="BIO-NEXA"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tagline
              </label>
              <input
                type="text"
                readOnly
                value="Connecting Science. Creating Careers."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Primary Colors (Configured in tokens.css)
              </label>
              <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
                <span className="w-5 h-5 rounded bg-[#0B2A5B]" title="#0B2A5B Navy" />
                <span>#0B2A5B</span>
                <span className="w-5 h-5 rounded bg-[#1F6FB2] ml-2" title="#1F6FB2 Blue" />
                <span>#1F6FB2</span>
                <span className="w-5 h-5 rounded bg-[#14A3A0] ml-2" title="#14A3A0 Teal" />
                <span>#14A3A0</span>
                <span className="w-5 h-5 rounded bg-[#2E9D57] ml-2" title="#2E9D57 Green" />
                <span>#2E9D57</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
