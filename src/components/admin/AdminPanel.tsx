import React, { useState } from 'react';
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
  Settings
} from 'lucide-react';

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

  const [activeTab, setActiveTab] = useState<'metrics' | 'sync' | 'reports' | 'messages' | 'settings'>('metrics');

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
