import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ExternalLink,
  ShieldCheck,
  Check,
  FileCheck,
  Search,
  Filter,
  CheckCheck,
  Link as LinkIcon,
  Server,
  Globe,
  Radio,
  Building,
  Tag,
  ArrowRight
} from 'lucide-react';
import { adminApi, AdminJob } from '../../services/admin/adminApiClient';
import { useApp } from '../../context/AppContext';

interface AutomatedJobsPanelProps {
  jobs: AdminJob[];
  onRefreshAll: () => Promise<void>;
  onApproveJob: (id: string) => Promise<void>;
}

export const TARGET_CATEGORIES = [
  { id: 'biotech', name: 'Biotechnology Jobs', keywords: ['biotech', 'bioprocess', 'upstream', 'downstream', 'fermentation', 'cell culture'] },
  { id: 'microbio', name: 'Microbiology Jobs', keywords: ['microbiology', 'microbiologist', 'sterility', 'endotoxin', 'bioburden', 'fungal'] },
  { id: 'research', name: 'Research Jobs', keywords: ['research', 'scientist', 'investigator', 'postdoc', 'genomics', 'project assistant'] },
  { id: 'pharma', name: 'Pharmaceutical Jobs', keywords: ['pharma', 'formulation', 'medicinal', 'drug discovery', 'api', 'biopharma'] },
  { id: 'clinical', name: 'Clinical Research Jobs', keywords: ['clinical', 'cra', 'crc', 'clinical trial', 'gcp', 'regulatory affairs'] },
  { id: 'bioinfo', name: 'Bioinformatics Jobs', keywords: ['bioinformatics', 'computational biology', 'next-generation sequencing', 'ngs', 'python', 'biostatistics'] },
  { id: 'lab', name: 'Laboratory Jobs', keywords: ['laboratory', 'lab technician', 'molecular', 'pcr', 'elisa', 'hplc'] },
  { id: 'qc', name: 'Quality Control Jobs', keywords: ['qc', 'quality control', 'assay', 'analytical', 'stability testing'] },
  { id: 'qa', name: 'Quality Assurance Jobs', keywords: ['qa', 'quality assurance', 'cgmp', '21 cfr', 'capa', 'audit trail'] },
  { id: 'internship', name: 'Biotechnology Internships', keywords: ['intern', 'internship', 'trainee', 'summer fellow'] },
  { id: 'fellowship', name: 'Research Fellowships', keywords: ['fellowship', 'fellow', 'jrf', 'srf', 'dbt-jrf', 'csir-jrf', 'serb'] }
];

export const AutomatedJobsPanel: React.FC<AutomatedJobsPanelProps> = ({
  jobs,
  onRefreshAll,
  onApproveJob
}) => {
  const { addToast } = useApp();

  const [syncStatus, setSyncStatus] = useState<any | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuditingUrls, setIsAuditingUrls] = useState(false);
  const [isScanningExpiry, setIsScanningExpiry] = useState(false);
  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [brokenUrls, setBrokenUrls] = useState<any[]>([]);
  const [selectedSubTab, setSelectedSubTab] = useState<'overview' | 'pending' | 'sources' | 'categories' | 'urls'>('overview');
  const [searchFilter, setSearchFilter] = useState('');

  // Load sync status & last run report
  const loadStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const data = await adminApi.getAutomatedSyncStatus();
      setSyncStatus(data);
      if (data.lastReport?.brokenUrls) {
        setBrokenUrls(data.lastReport.brokenUrls);
      }
    } catch (err: any) {
      console.error('Failed to load automated sync status:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // 1. Trigger Full Automated Ingestion
  const handleRunSync = async () => {
    setIsSyncing(true);
    try {
      const res = await adminApi.runAutomatedSync();
      addToast(res.message, 'success');
      await onRefreshAll();
      await loadStatus();
    } catch (err: any) {
      addToast(err.message || 'Automated ingestion failed.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // 2. Audit Application URLs for HTTP 404s
  const handleAuditUrls = async () => {
    setIsAuditingUrls(true);
    try {
      const res = await adminApi.checkApplicationUrls(35);
      setBrokenUrls(res.broken || []);
      if (res.brokenCount > 0) {
        addToast(`URL Audit: Flagged ${res.brokenCount} unreachable link(s).`, 'warning');
      } else {
        addToast('All audited application URLs are active and reachable!', 'success');
      }
      await onRefreshAll();
    } catch (err: any) {
      addToast(err.message || 'URL audit error.', 'error');
    } finally {
      setIsAuditingUrls(false);
    }
  };

  // 3. Scan Expiration Deadlines
  const handleScanExpiry = async () => {
    setIsScanningExpiry(true);
    try {
      const res = await adminApi.scanExpiredListings();
      addToast(res.message, 'info');
      await onRefreshAll();
    } catch (err: any) {
      addToast(err.message || 'Expiry scan error.', 'error');
    } finally {
      setIsScanningExpiry(false);
    }
  };

  // 4. Batch Approve All Pending Listings
  const handleBatchApprove = async () => {
    const pending = jobs.filter((j) => !j.isApproved);
    if (pending.length === 0) {
      addToast('No pending vacancies awaiting approval.', 'info');
      return;
    }

    setIsApprovingAll(true);
    let count = 0;
    try {
      for (const j of pending) {
        await adminApi.updateJobStatus(j.id, { isApproved: true });
        count++;
      }
      addToast(`Approved & published ${count} job listings to public portal!`, 'success');
      await onRefreshAll();
    } catch (err: any) {
      addToast(err.message || 'Batch approval encountered an error.', 'error');
    } finally {
      setIsApprovingAll(false);
    }
  };

  // Metrics computation
  const pendingJobs = jobs.filter((j) => !j.isApproved);
  const activeVerifiedJobs = jobs.filter((j) => j.isApproved && !j.isExpired);
  const expiredJobs = jobs.filter((j) => j.isExpired);
  const lastReport = syncStatus?.lastReport;

  // Compute category counts
  const categoryCounts = TARGET_CATEGORIES.map((cat) => {
    const matchingJobs = jobs.filter((job) => {
      const text = `${job.title} ${job.description} ${job.sector} ${job.qualification} ${(job.skills || []).join(' ')}`.toLowerCase();
      return cat.keywords.some((kw) => text.includes(kw));
    });
    return {
      ...cat,
      totalCount: matchingJobs.length,
      pendingCount: matchingJobs.filter((j) => !j.isApproved).length
    };
  });

  return (
    <div className="space-y-6 text-xs">
      {/* Top Automated Banner */}
      <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-[#0B2A5B] p-6 rounded-2xl text-white shadow-sm border border-teal-800/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-teal-300 font-bold tracking-wider uppercase text-[10px]">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>Automated Ingestion &amp; Feed Moderation Pipeline</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Automated Job Listing Management
            </h2>
            <p className="text-slate-300 text-xs max-w-2xl leading-relaxed">
              Maintains an authorized, 100% terms-of-service compliant feed pipeline from verified biotechnology sources, handles intelligent deduplication, checks application link reachability, and monitors vacancy deadlines.
            </p>
          </div>

          {/* Quick Execution Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRunSync}
              disabled={isSyncing}
              className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
              title="Query authorized feeds and import eligible vacancies (set to Pending Review by default)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Ingesting Feeds...' : 'Run Automated Sync Now'}</span>
            </button>

            <button
              onClick={handleAuditUrls}
              disabled={isAuditingUrls}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl border border-white/15 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Test application links for 404 errors"
            >
              <LinkIcon className={`w-3.5 h-3.5 ${isAuditingUrls ? 'animate-pulse' : ''}`} />
              <span>{isAuditingUrls ? 'Probing URLs...' : 'Audit Links (404 Probe)'}</span>
            </button>

            <button
              onClick={handleScanExpiry}
              disabled={isScanningExpiry}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl border border-white/15 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Scan and mark past-deadline listings as Expired"
            >
              <Clock className={`w-3.5 h-3.5 ${isScanningExpiry ? 'animate-pulse' : ''}`} />
              <span>{isScanningExpiry ? 'Scanning...' : 'Scan Deadlines'}</span>
            </button>
          </div>
        </div>

        {/* Real-time Status Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10">
          <div className="p-3 bg-black/20 rounded-xl border border-white/5">
            <div className="text-slate-400 text-[10px]">Last Sync Run</div>
            <div className="font-bold text-teal-300 font-mono mt-0.5 truncate">
              {lastReport?.timestamp ? new Date(lastReport.timestamp).toLocaleString() : 'Ready (Scheduled: every 6h)'}
            </div>
          </div>
          <div className="p-3 bg-black/20 rounded-xl border border-white/5">
            <div className="text-slate-400 text-[10px]">Awaiting Moderation</div>
            <div className="font-bold text-amber-400 mt-0.5">
              {pendingJobs.length} Pending Approval
            </div>
          </div>
          <div className="p-3 bg-black/20 rounded-xl border border-white/5">
            <div className="text-slate-400 text-[10px]">Active Published Jobs</div>
            <div className="font-bold text-emerald-400 mt-0.5">
              {activeVerifiedJobs.length} Live on Portal
            </div>
          </div>
          <div className="p-3 bg-black/20 rounded-xl border border-white/5">
            <div className="text-slate-400 text-[10px]">Compliance &amp; Sources</div>
            <div className="font-bold text-sky-300 mt-0.5 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span>5 Authorized Feeds</span>
            </div>
          </div>
        </div>
      </div>

      {/* Internal Subtabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            ['overview', 'Sync Health & Summary', Radio],
            ['pending', `Moderation Queue (${pendingJobs.length})`, Clock],
            ['sources', 'Authorized Sources (5)', Layers],
            ['categories', '11 Target Categories', Tag],
            ['urls', `URL Health & 404s (${brokenUrls.length})`, LinkIcon]
          ].map(([key, label, Icon]: any) => (
            <button
              key={key}
              onClick={() => setSelectedSubTab(key)}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedSubTab === key
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {selectedSubTab === 'pending' && pendingJobs.length > 0 && (
          <button
            onClick={handleBatchApprove}
            disabled={isApprovingAll}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCheck className={`w-3.5 h-3.5 ${isApprovingAll ? 'animate-spin' : ''}`} />
            <span>{isApprovingAll ? 'Publishing...' : `Approve All ${pendingJobs.length} Pending`}</span>
          </button>
        )}
      </div>

      {/* SUBTAB 1: OVERVIEW & SYNC HEALTH */}
      {selectedSubTab === 'overview' && (
        <div className="space-y-4">
          {/* Key Rule Callout */}
          <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-xs">Section 6 &amp; 11 Architectural Guarantee</div>
              <p className="text-[11px] leading-relaxed text-teal-800 dark:text-teal-300">
                • <strong>Never automatically mark imported jobs as verified:</strong> In compliance with BIO-NEXA governance, all newly ingested external opportunities enter the database with <code>isApproved: false</code> and <code>verificationStatus: &apos;Pending Review&apos;</code>. They only become visible to the public once reviewed or batch-approved.<br />
                • <strong>No unauthorized scraping:</strong> Feeds use legitimate public scientific gazettes, authorized employer career endpoints, or licensed developer APIs.<br />
                • <strong>Graceful degradation:</strong> If an external partner endpoint is temporarily unreachable, valid existing listings are retained in the database while an incident is logged below.
              </p>
            </div>
          </div>

          {/* Last Run Statistics Grid */}
          {lastReport ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ActivityLogIcon />
                  <span>Last Automated Ingestion Cycle Report</span>
                </h3>
                <span className="font-mono text-[11px] text-slate-400">
                  Completed at {new Date(lastReport.timestamp).toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                  <div className="text-slate-400 text-[10px]">Sources Queried</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {lastReport.sourcesSuccessful} / {lastReport.sourcesAttempted} OK
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl">
                  <div className="text-emerald-700 dark:text-emerald-400 text-[10px]">New Vacancies Ingested</div>
                  <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">
                    +{lastReport.newImportedCount} (Pending Review)
                  </div>
                </div>
                <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-xl">
                  <div className="text-sky-700 dark:text-sky-400 text-[10px]">Duplicates Prevented</div>
                  <div className="text-sm font-bold text-sky-800 dark:text-sky-300 mt-0.5">
                    {lastReport.duplicatesSkippedCount} filtered
                  </div>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
                  <div className="text-rose-700 dark:text-rose-400 text-[10px]">Expired Listings Flagged</div>
                  <div className="text-sm font-bold text-rose-800 dark:text-rose-300 mt-0.5">
                    {lastReport.expiredMarkedCount} expired
                  </div>
                </div>
              </div>

              {lastReport.errors && lastReport.errors.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>External Feed Incident Log ({lastReport.errors.length})</span>
                  </div>
                  <p className="text-[11px]">
                    The following sources were temporarily unresponsive. Existing vacancies remain safe and active in the local relational database:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] font-mono mt-1">
                    {lastReport.errors.map((err: any, idx: number) => (
                      <li key={idx}>
                        <strong>{err.sourceName}:</strong> {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 space-y-2">
              <Clock className="w-8 h-8 mx-auto text-teal-600 animate-pulse" />
              <div className="font-bold text-slate-700 dark:text-slate-300">Automated Ingestion Ready</div>
              <p className="text-[11px] max-w-md mx-auto">
                No manual ingestion cycle has been executed yet in this session. Background sync runs automatically every 6 hours, or click &ldquo;Run Automated Sync Now&rdquo; above to query sources immediately.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: MODERATION QUEUE (PENDING REVIEW) */}
      {selectedSubTab === 'pending' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="font-bold">
                {pendingJobs.length} Vacancies Ingested Awaiting Administrator Approval
              </span>
            </div>
            {pendingJobs.length > 0 && (
              <button
                onClick={handleBatchApprove}
                disabled={isApprovingAll}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Publish All to Public Portal</span>
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            {pendingJobs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <div className="font-bold text-slate-700 dark:text-slate-200">Moderation Queue Clear</div>
                <p className="text-[11px]">All ingested vacancies have been reviewed and published.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingJobs.map((job) => (
                  <div key={job.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                          Pending Review
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          Source: {job.sourceName || 'Authorized Feed'}
                        </span>
                        <span className="text-[10px] text-slate-400">ID: {job.id}</span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {job.title}
                      </div>
                      <div className="text-teal-600 font-semibold text-[11px]">
                        {job.company} · {job.location} ({job.type})
                      </div>
                      <p className="text-slate-500 line-clamp-2 text-[11px] leading-relaxed">
                        {job.description}
                      </p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {(job.skills || []).slice(0, 4).map((s, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px]">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                      {job.applicationUrl && (
                        <a
                          href={job.applicationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-teal-600 flex items-center gap-1 text-[11px]"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Test Link</span>
                        </a>
                      )}
                      <button
                        onClick={() => onApproveJob(job.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve &amp; Publish</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: AUTHORIZED SOURCES REGISTRY */}
      {selectedSubTab === 'sources' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Authorized External Feeds &amp; Public Data Providers
            </h3>
            <p className="text-slate-500 text-[11px]">
              BIO-NEXA connects exclusively with authorized, non-restricted data endpoints and legitimate scientific gazettes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(syncStatus?.sources || []).map((source: any) => (
              <div
                key={source.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs hover:border-teal-500/50 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
                      {source.category}
                    </span>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-1">
                      {source.name}
                    </h4>
                    <div className="text-[11px] text-slate-500">{source.provider}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Compliant</span>
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 font-mono text-[10px] text-slate-600 dark:text-slate-400 break-all">
                  Endpoint: {source.endpointUrl}
                </div>

                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  {source.notes}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
                  <span>Rate Limit: {source.rateLimit}</span>
                  <a
                    href={source.endpointUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 hover:text-teal-700 font-bold flex items-center gap-1"
                  >
                    <span>View Gazette</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 4: 11 TARGET BIOTECHNOLOGY CATEGORIES */}
      {selectedSubTab === 'categories' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Standardized 11 Biotechnology Categories
            </h3>
            <p className="text-slate-500 text-[11px]">
              Every ingested and submitted opportunity is automatically tagged and normalized into one of these 11 specialized life-sciences domains:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categoryCounts.map((cat) => (
              <div
                key={cat.id}
                className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                    {cat.name}
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#0B2A5B]/10 text-[#0B2A5B] dark:text-sky-300">
                    {cat.totalCount} vacancies
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {cat.keywords.slice(0, 3).map((kw, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] text-slate-500 font-mono">
                      #{kw}
                    </span>
                  ))}
                </div>
                {cat.pendingCount > 0 && (
                  <div className="text-[10px] text-amber-600 font-semibold pt-1">
                    {cat.pendingCount} awaiting approval in this category
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 5: URL HEALTH & BROKEN APPLICATION LINKS */}
      {selectedSubTab === 'urls' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Application URL Health &amp; Reachability Probe
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Automatically detects expired career portal links and HTTP 404/410 errors so visitors never reach dead ends.
              </p>
            </div>
            <button
              onClick={handleAuditUrls}
              disabled={isAuditingUrls}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAuditingUrls ? 'animate-spin' : ''}`} />
              <span>{isAuditingUrls ? 'Probing Links...' : 'Probe All Application Links'}</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            {brokenUrls.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <div className="font-bold text-slate-700 dark:text-slate-200">Zero Broken URLs Detected</div>
                <p className="text-[11px]">All active job application links are responding with valid HTTP 2xx/3xx codes.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {brokenUrls.map((b, idx) => (
                  <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-rose-50/50 dark:bg-rose-950/20">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 uppercase">
                          {b.error || 'HTTP 404 Broken'}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">{b.title}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">{b.employer}</div>
                      <div className="font-mono text-[10px] text-rose-600 break-all">{b.url}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-amber-700 font-semibold bg-amber-100 px-2 py-1 rounded">
                        Flagged in Database
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function ActivityLogIcon() {
  return (
    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping" />
  );
}
