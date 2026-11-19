import React, { useEffect, useState } from 'react';
import {
  Building2,
  ShieldCheck,
  ShieldAlert,
  Clock,
  RefreshCw,
  ExternalLink,
  Ban,
  RotateCcw,
  CheckCircle2,
  XCircle,
  History,
  Mail,
} from 'lucide-react';
import {
  adminApi,
  AdminCompanyAccount,
  AdminCompanyAuditLogEntry,
} from '../../services/admin/adminApiClient';
import { useApp } from '../../context/AppContext';

export const AdminCompaniesPanel: React.FC = () => {
  const { addToast } = useApp();
  const [companies, setCompanies] = useState<AdminCompanyAccount[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    verified: 0,
    pendingReview: 0,
    unverified: 0,
    rejected: 0,
    suspended: 0,
  });
  const [auditLogs, setAuditLogs] = useState<AdminCompanyAuditLogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending_review' | 'verified' | 'unverified' | 'suspended'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [compRes, logRes] = await Promise.all([
        adminApi.getCompanies(),
        adminApi.getCompanyAuditLogs(),
      ]);
      setCompanies(compRes.companies || []);
      if (compRes.summary) setSummary(compRes.summary);
      setAuditLogs(logRes.logs || []);
    } catch (err: any) {
      addToast(err?.message || 'Unable to load registered employers.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVerifyDecision = async (
    company: AdminCompanyAccount,
    decision: 'verified' | 'rejected' | 'unverified'
  ) => {
    const notes = (reasonDrafts[company.id] || '').trim();
    if (decision === 'rejected' && notes.length < 5) {
      addToast('Please enter a brief rejection reason (min 5 characters) in the notes box.', 'warning');
      return;
    }
    setBusyId(company.id);
    try {
      const res = await adminApi.verifyCompany(company.id, decision, notes);
      addToast(res.message, 'success');
      setReasonDrafts((prev) => ({ ...prev, [company.id]: '' }));
      await loadData();
    } catch (err: any) {
      addToast(err?.message || 'Unable to update employer verification.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleSuspend = async (company: AdminCompanyAccount) => {
    const reason = (reasonDrafts[company.id] || '').trim();
    if (reason.length < 5) {
      addToast('Please provide a suspension reason (at least 5 characters) before suspending.', 'warning');
      return;
    }
    setBusyId(company.id);
    try {
      const res = await adminApi.suspendCompany(company.id, reason);
      addToast(res.message, 'info');
      setReasonDrafts((prev) => ({ ...prev, [company.id]: '' }));
      await loadData();
    } catch (err: any) {
      addToast(err?.message || 'Unable to suspend employer account.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleReinstate = async (company: AdminCompanyAccount) => {
    setBusyId(company.id);
    try {
      const res = await adminApi.reinstateCompany(company.id, (reasonDrafts[company.id] || '').trim());
      addToast(res.message, 'success');
      setReasonDrafts((prev) => ({ ...prev, [company.id]: '' }));
      await loadData();
    } catch (err: any) {
      addToast(err?.message || 'Unable to reinstate employer account.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const filteredCompanies = companies.filter((c) => {
    if (filter === 'suspended') return c.accountStatus === 'suspended';
    if (filter === 'all') return true;
    return c.verificationStatus === filter;
  });

  return (
    <div className="space-y-6 text-xs">
      {/* KPI Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Employers', value: summary.total, color: 'text-[#0B2A5B] dark:text-sky-300' },
          { label: 'Pending Review', value: summary.pendingReview, color: 'text-sky-600' },
          { label: 'Verified', value: summary.verified, color: 'text-emerald-600' },
          { label: 'Unverified', value: summary.unverified, color: 'text-amber-600' },
          { label: 'Rejected', value: summary.rejected, color: 'text-rose-600' },
          { label: 'Suspended', value: summary.suspended, color: 'text-rose-700' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs"
          >
            <div className={`text-xl font-bold font-mono ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', `All (${summary.total})`],
              ['pending_review', `Pending Review (${summary.pendingReview})`],
              ['verified', `Verified (${summary.verified})`],
              ['unverified', `Unverified (${summary.unverified})`],
              ['suspended', `Suspended (${summary.suspended})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                filter === key
                  ? 'bg-[#0B2A5B] text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={loadData}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Employer Directory */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#0B2A5B] dark:text-sky-400" />
          <span>Registered Employer Accounts &amp; Identity Verification Queue</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading registered employers...</div>
        ) : filteredCompanies.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No registered employer accounts match this filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredCompanies.map((comp) => (
              <div key={comp.id} className="p-5 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {comp.organizationName}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                        {comp.organizationType}
                      </span>
                      {comp.verificationStatus === 'verified' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <ShieldCheck className="w-3 h-3" /> Verified Employer
                        </span>
                      ) : comp.verificationStatus === 'pending_review' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                          <Clock className="w-3 h-3" /> Pending Review
                        </span>
                      ) : comp.verificationStatus === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          <ShieldAlert className="w-3 h-3" /> Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Unverified
                        </span>
                      )}

                      {comp.accountStatus === 'suspended' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white">
                          <Ban className="w-3 h-3" /> Suspended
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        <Mail className="w-3 h-3" />
                        {comp.emailVerified ? 'Email Verified' : 'Email Unverified'}
                      </span>
                    </div>

                    <div className="text-slate-600 dark:text-slate-300">
                      Representative: <strong>{comp.contactName}</strong>
                      {comp.contactTitle ? ` (${comp.contactTitle})` : ''} · {comp.email} · {comp.headquartersLocation}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      {comp.officialWebsite && (
                        <a
                          href={comp.officialWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#0B2A5B] dark:text-sky-400 font-semibold hover:underline"
                        >
                          <span>{comp.officialWebsite}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {comp.registrationIdentifier && (
                        <span>
                          Registry ID: <strong className="font-mono">{comp.registrationIdentifier}</strong>
                        </span>
                      )}
                      <span>Submitted Jobs: <strong>{comp.jobCount}</strong></span>
                    </div>

                    {(comp.verificationEvidenceUrl || comp.verificationNotes) && (
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 text-[11px] space-y-1">
                        {comp.verificationEvidenceUrl && (
                          <div>
                            Evidence URL:{' '}
                            <a
                              href={comp.verificationEvidenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-teal-700 dark:text-teal-400 underline"
                            >
                              {comp.verificationEvidenceUrl}
                            </a>
                          </div>
                        )}
                        {comp.verificationNotes && (
                          <div className="text-slate-600 dark:text-slate-300">
                            Verification Notes: {comp.verificationNotes}
                          </div>
                        )}
                      </div>
                    )}

                    {comp.accountStatus === 'suspended' && comp.suspensionReason && (
                      <div className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold">
                        Suspension Reason: {comp.suspensionReason}
                      </div>
                    )}
                  </div>

                  {/* Admin Action Controls */}
                  <div className="w-full lg:w-80 space-y-2 shrink-0">
                    <input
                      type="text"
                      value={reasonDrafts[comp.id] || ''}
                      onChange={(e) =>
                        setReasonDrafts((prev) => ({ ...prev, [comp.id]: e.target.value }))
                      }
                      placeholder="Admin notes / rejection or suspension reason..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {comp.verificationStatus !== 'verified' && (
                        <button
                          type="button"
                          disabled={busyId === comp.id}
                          onClick={() => handleVerifyDecision(comp, 'verified')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve Employer</span>
                        </button>
                      )}
                      {comp.verificationStatus !== 'rejected' && (
                        <button
                          type="button"
                          disabled={busyId === comp.id}
                          onClick={() => handleVerifyDecision(comp, 'rejected')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      )}
                      {comp.accountStatus === 'active' ? (
                        <button
                          type="button"
                          disabled={busyId === comp.id}
                          onClick={() => handleSuspend(comp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Suspend</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === comp.id}
                          onClick={() => handleReinstate(comp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reinstate</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Employer Audit Log Feed */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-teal-600" />
          <span>Employer Security &amp; Governance Audit Logs ({auditLogs.length})</span>
        </div>
        {auditLogs.length === 0 ? (
          <div className="text-slate-400">No employer audit entries recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase">
                  <th className="py-2 pr-3">Timestamp</th>
                  <th className="py-2 pr-3">Organization</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Actor</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.slice(0, 50).map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 font-semibold text-slate-700 dark:text-slate-300">
                      {log.organizationName || log.companyId}
                    </td>
                    <td className="py-2 pr-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {log.action}
                    </td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">
                      {log.actorType}: {log.actorEmail}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold ${
                          log.status === 'success'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2 text-slate-600 dark:text-slate-300">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
