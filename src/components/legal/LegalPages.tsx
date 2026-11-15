import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Building2,
  CheckCircle2,
  Cookie,
  ExternalLink,
  FileWarning,
  Flag,
  Gavel,
  Globe,
  Lock,
  Mail,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  COOKIE_AND_STORAGE_INVENTORY,
  LEGAL_COUNSEL_REVIEW_CHECKLIST,
  OPERATIONAL_FACT_SHEET,
  POLICY_SECTIONS,
  clearBioNexaLocalData,
  readPrivacyConsent,
  savePrivacyConsent,
  type ComplianceRequestType,
  type PolicySectionId
} from '../../services/legal/legalCompliance';

interface LegalCompliancePageProps {
  initialSection: PolicySectionId;
}

interface InlineComplianceFormProps {
  requestType: ComplianceRequestType;
  heading: string;
  description: string;
  subCategories: string[];
  targetLabel?: string;
  targetPlaceholder?: string;
  requireTarget?: boolean;
  submitButtonLabel: string;
  consentLabel: string;
}

const InlineComplianceForm: React.FC<InlineComplianceFormProps> = ({
  requestType,
  heading,
  description,
  subCategories,
  targetLabel = 'Listing Title, Page Route, or URL',
  targetPlaceholder = 'e.g. https://bio-nexa.netlify.app/jobs/job-1 or Organization Name',
  requireTarget = false,
  submitButtonLabel,
  consentLabel
}) => {
  const { addToast } = useApp();
  const [subCategory, setSubCategory] = useState(subCategories[0] || '');
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [targetTitleOrUrl, setTargetTitleOrUrl] = useState('');
  const [details, setDetails] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  useEffect(() => {
    setSubCategory(subCategories[0] || '');
    setErrorMsg(null);
    setSubmittedRef(null);
  }, [requestType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmittedRef(null);

    if (!consentAccepted) {
      setErrorMsg('Please confirm the consent & accuracy checkbox before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/compliance/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType,
          subCategory,
          requesterName,
          requesterEmail,
          organization,
          targetTitleOrUrl,
          details,
          consentAccepted
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Submission failed.');
      }

      setSubmittedRef(data.referenceId);
      setDetails('');
      setTargetTitleOrUrl('');
      setConsentAccepted(false);
      addToast(`Compliance ticket ${data.referenceId} logged cleanly.`, 'success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to submit request. Please check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-5 sm:p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{heading}</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{description}</p>
      </div>

      {submittedRef && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Request Recorded in Compliance Queue</div>
            <p className="mt-0.5">
              Tracking Reference: <strong className="font-mono">{submittedRef}</strong>. Please retain this reference ID for follow-up correspondence.
            </p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor={`${requestType}-name`} className="block font-semibold text-slate-700 dark:text-slate-300">
              Full Name *
            </label>
            <input
              id={`${requestType}-name`}
              type="text"
              required
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`${requestType}-email`} className="block font-semibold text-slate-700 dark:text-slate-300">
              Contact Email *
            </label>
            <input
              id={`${requestType}-email`}
              type="email"
              required
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              placeholder="you@domain.org"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor={`${requestType}-category`} className="block font-semibold text-slate-700 dark:text-slate-300">
              Request Category *
            </label>
            <select
              id={`${requestType}-category`}
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {subCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor={`${requestType}-org`} className="block font-semibold text-slate-700 dark:text-slate-300">
              Organization / Affiliation (Optional)
            </label>
            <input
              id={`${requestType}-org`}
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="University, Company, or Self"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor={`${requestType}-target`} className="block font-semibold text-slate-700 dark:text-slate-300">
            {targetLabel} {requireTarget ? '*' : '(Optional)'}
          </label>
          <input
            id={`${requestType}-target`}
            type="text"
            required={requireTarget}
            value={targetTitleOrUrl}
            onChange={(e) => setTargetTitleOrUrl(e.target.value)}
            placeholder={targetPlaceholder}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={`${requestType}-details`} className="block font-semibold text-slate-700 dark:text-slate-300">
            Specific Details &amp; Requested Action *
          </label>
          <textarea
            id={`${requestType}-details`}
            rows={3}
            required
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Describe the data record, listing inaccuracy, fee demand, or removal/correction requirement..."
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(e) => setConsentAccepted(e.target.checked)}
            className="mt-0.5 accent-[#0B2A5B] cursor-pointer"
          />
          <span className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            {consentLabel}
          </span>
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-[#0B2A5B] hover:bg-blue-900 disabled:opacity-60 text-white font-bold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Submitting...' : submitButtonLabel}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export const LegalCompliancePage: React.FC<LegalCompliancePageProps> = ({ initialSection }) => {
  const { navigate, addToast } = useApp();
  const [activeSection, setActiveSection] = useState<PolicySectionId>(initialSection);
  const [consentState, setConsentState] = useState(() => readPrivacyConsent());
  const [showAuditMatrix, setShowAuditMatrix] = useState(false);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const handleSelectSection = (item: (typeof POLICY_SECTIONS)[number]) => {
    setActiveSection(item.id);
    navigate(item.route);
  };

  const handleUpdateTelemetryConsent = (allow: boolean) => {
    const next = savePrivacyConsent(allow);
    setConsentState(next);
    addToast(
      allow
        ? 'Updated: Full functionality & optional session count enabled.'
        : 'Updated: Essential Only mode enabled (Google Apps Script session telemetry disabled).',
      'info'
    );
  };

  const handleClearBrowserData = () => {
    const count = clearBioNexaLocalData();
    setConsentState(null);
    addToast(`Cleared ${count} local BIO-NEXA browser storage keys from this device.`, 'success');
  };

  const currentMeta = POLICY_SECTIONS.find((s) => s.id === activeSection) || POLICY_SECTIONS[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      {/* Top Compliance Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-[#0B2A5B] dark:text-sky-300 text-[11px] font-bold uppercase tracking-wider">
            <Scale className="w-3.5 h-3.5 text-[#14A3A0]" />
            <span>India Legal Compliance, DPDP &amp; Platform Transparency</span>
          </div>

          <span className="text-[11px] font-mono text-slate-500">
            Policy Baseline: November 2026 (Draft for Indian Counsel Sign-off)
          </span>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            {currentMeta.code}. {currentMeta.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            {currentMeta.summary}
          </p>
        </div>

        {/* Mandatory Pre-Publication Indian Counsel Review Banner */}
        <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-xs text-amber-950 dark:text-amber-200 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Pre-Publication Legal Review &amp; Placeholder Notice</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAuditMatrix((prev) => !prev)}
              className="px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 text-amber-900 dark:text-amber-100 font-bold text-[11px] transition-colors self-start sm:self-auto cursor-pointer"
            >
              {showAuditMatrix ? 'Hide Codebase Fact Audit & Counsel Checklist' : 'View Codebase Fact Audit & Counsel Checklist'}
            </button>
          </div>
          <p className="leading-relaxed text-[11px]">
            These policies accurately reflect BIO-NEXA&apos;s live technical operations without invented corporate registration numbers, physical office addresses, certifications, or fake affiliations. Bracketed placeholders (e.g., <strong>[Verified Indian Legal Entity Name]</strong>, <strong>[Physical Correspondence Address]</strong>, <strong>[Appointed Grievance Officer]</strong>) <strong>must be completed and reviewed by a qualified Indian legal professional</strong> before public commercial launch in India.
          </p>
        </div>

        {/* Expandable Codebase Operational Audit & Counsel Checklist */}
        {showAuditMatrix && (
          <div className="pt-2 space-y-5 border-t border-slate-200 dark:border-slate-800">
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Operational Architecture Audit (How BIO-NEXA Actually Operates)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {OPERATIONAL_FACT_SHEET.map((fact) => (
                  <div
                    key={fact.question}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-[#0B2A5B] dark:text-sky-300">{fact.question}</span>
                      {fact.requiresLegalReview && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[9px] font-bold uppercase shrink-0">
                          Counsel Review
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed">
                      <strong>Observed Reality:</strong> {fact.finding}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                      <strong>Statutory Note:</strong> {fact.legalImplication}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Items Flagged for Qualified Indian Legal Counsel Review
              </h2>
              <div className="space-y-2">
                {LEGAL_COUNSEL_REVIEW_CHECKLIST.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{item.area}</div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">{item.actionRequired}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 font-mono text-[10px] font-bold shrink-0 self-start sm:self-center">
                      {item.statusLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Split Navigation + Active Policy Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar Policy Index (A–H) */}
        <nav
          aria-label="Legal and Policy Documents A to H"
          className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-1.5 lg:sticky lg:top-24"
        >
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Policy Directory (A–H)
          </div>
          {POLICY_SECTIONS.map((sec) => {
            const active = sec.id === activeSection;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => handleSelectSection(sec)}
                aria-current={active ? 'page' : undefined}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs transition-all flex items-start gap-2.5 cursor-pointer ${
                  active
                    ? 'bg-[#0B2A5B] text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5 ${
                    active
                      ? 'bg-teal-400 text-slate-950'
                      : 'bg-slate-100 dark:bg-slate-800 text-[#0B2A5B] dark:text-sky-300'
                  }`}
                >
                  {sec.code}
                </span>
                <div>
                  <div className="font-bold leading-snug">{sec.shortTitle}</div>
                  <div className={`text-[10px] mt-0.5 line-clamp-1 ${active ? 'text-sky-100' : 'text-slate-400'}`}>
                    {sec.route}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Active Policy Content Pane */}
        <article className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {/* ============================================================== */}
          {/* A. PRIVACY POLICY                                              */}
          {/* ============================================================== */}
          {activeSection === 'privacy' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  A. Privacy Policy (aligned with India&apos;s DPDP Act, 2023 &amp; IT Rules)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Applies to all visitors accessing BIO-NEXA from India or worldwide.
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  1. Data Fiduciary Identity &amp; Operational Scope
                </h3>
                <p>
                  BIO-NEXA is currently operated as an independent life-sciences opportunity discovery and educational information portal (<span className="font-mono text-xs">council@bio-nexa.org</span>). Unlike commercial recruitment portals, <strong>BIO-NEXA does not require public visitors to create server-side accounts or upload CVs to our servers</strong> in order to search jobs, internships, workshops, courses, or research articles.
                </p>
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
                  <strong>[Legal Counsel Placeholder — Required Before Commercial Launch]:</strong> Exact legal Data Fiduciary entity name (Individual / Partnership / LLP / Company / Section 8 Trust) and verified registered Indian physical address must be populated here by counsel.
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  2. What Personal Information Is Collected &amp; Purpose of Processing
                </h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>Voluntary Job / Opportunity Submissions:</strong> When an employer, faculty member, or coordinator submits a vacancy for moderation (<code className="text-xs">/api/jobs/submit</code>), we store the job title, employer name, location, description, application URL, and submission metadata strictly to review authorization and publish verified listings.
                  </li>
                  <li>
                    <strong>Candidate Listing Reports, DPDP Requests &amp; Takedowns:</strong> When you report a suspicious job (<code className="text-xs">/api/jobs/:id/report</code>) or submit a DPDP privacy, grievance, or content removal request (<code className="text-xs">/api/compliance/request</code>), we collect your name, email address, optional organization, target URL, and issue description solely to investigate, verify, remove inaccurate content, and respond to you.
                  </li>
                  <li>
                    <strong>Device-Local Browser Storage (Student / Company Demo State, Bookmarks &amp; Theme):</strong> Dashboard profile edits, saved bookmarks, locally simulated applications, Academy quiz progress, discussion drafts, contact notes, and newsletter input in the current architecture remain strictly inside your own browser&apos;s <code className="text-xs">localStorage</code> / <code className="text-xs">sessionStorage</code>—they are not transmitted to BIO-NEXA backend servers.
                  </li>
                  <li>
                    <strong>Optional Welcome Telemetry Ping:</strong> Clicking <strong>ENTER</strong> on the Welcome Landing Screen sends one session-level HTTP GET ping to a configured Google Apps Script endpoint for aggregate entry counting, <em>only if</em> you have not selected <strong>Essential Only</strong> or enabled browser Do-Not-Track.
                  </li>
                  <li>
                    <strong>Administrator Access Security:</strong> Only authorized platform administrators logging into <code className="text-xs">/admin</code> receive an essential <code className="text-xs">HttpOnly</code> session cookie (<code className="text-xs">bionexa_admin_session</code>) alongside temporary in-memory IP login rate limiting to prevent brute-force attacks.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  3. Where Information Is Stored &amp; External Service Recipients
                </h3>
                <p>
                  Server-submitted records (job moderation entries, listing reports, and compliance/grievance tickets) are stored in our relational SQLite database (<code className="text-xs">db/bionexa.db</code>) with point-in-time administrative backups. Personal preferences reside locally on your device. External domains that may receive browser requests include:
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Google Apps Script / Google Sheets:</strong> Optional welcome-entry ping and public sheet synchronization (opt-out available in Cookies &amp; Tracking).</li>
                  <li><strong>Google Fonts &amp; YouTube:</strong> Web typography assets across pages and embedded YouTube protocol lessons on <code className="text-xs">/courses</code>.</li>
                  <li><strong>External Application &amp; Course Portals:</strong> Clicking external &ldquo;Apply Now&rdquo; or &ldquo;Register&rdquo; buttons redirects you off BIO-NEXA to independent employers, government agencies (DBT, CSIR, SWAYAM, NPTEL, EMBL-EBI), or licensed job partners (e.g., Adzuna).</li>
                </ul>
                <p>
                  <strong>Zero Sale or Brokerage of Personal Data:</strong> BIO-NEXA never sells, rents, or trades user personal data to data brokers, spam marketers, or unauthorized recruiters.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  4. Lawful Basis, Consent &amp; Your DPDP Rights (India)
                </h3>
                <p>
                  Under the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong>, we process submitted personal data based on your explicit affirmative consent (Section 6) and legitimate statutory/compliance obligations (such as fraud takedown and security rate limiting). As a Data Principal, you have the right to:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Right to Access (Sec. 11):</strong> Request a summary of personal data held by BIO-NEXA servers about you.</li>
                  <li><strong>Right to Correction &amp; Erasure (Sec. 12):</strong> Request correction of inaccurate details or deletion of grievance/report records, plus instant self-service wiping of browser-local data under <button type="button" onClick={() => handleSelectSection(POLICY_SECTIONS[4])} className="text-[#0B2A5B] dark:text-sky-300 font-bold underline cursor-pointer">Cookies &amp; Tracking</button>.</li>
                  <li><strong>Right to Withdraw Consent (Sec. 6(4)):</strong> Switch to <strong>Essential Only</strong> at any time with effect as easy as giving consent.</li>
                  <li><strong>Right of Grievance Redressal &amp; Nomination (Sec. 13–14):</strong> Submit a formal complaint via Section F (<button type="button" onClick={() => handleSelectSection(POLICY_SECTIONS[5])} className="text-[#0B2A5B] dark:text-sky-300 font-bold underline cursor-pointer">Grievance &amp; Contact</button>), before escalating to the Data Protection Board of India once operationalized.</li>
                </ul>
                <p className="text-xs text-slate-500">
                  <strong>Minors Notice (Sec. 9, DPDP Act):</strong> Individuals under 18 years of age should not submit personal details through compliance or job-submission forms without verifiable parent/guardian consent.
                </p>
              </section>
            </div>
          )}

          {/* ============================================================== */}
          {/* B. TERMS AND CONDITIONS                                        */}
          {/* ============================================================== */}
          {activeSection === 'terms' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  B. Terms and Conditions of Use
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Governing platform access, intermediary status under the Information Technology Act, 2000, and intellectual property compliance.
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  1. Role of BIO-NEXA (Informational Publisher &amp; Aggregator Only)
                </h3>
                <p>
                  BIO-NEXA acts strictly as an <strong>informational biotechnology aggregator, educational directory, and digital publisher</strong>. BIO-NEXA is <strong>not</strong> a licensed recruitment agency, staffing intermediary, placement consultant, employment exchange, university, or statutory accreditation authority. Publishing a job, internship, fellowship, workshop, or course listing does not establish an employment, agency, fiduciary, or institutional partnership between BIO-NEXA and the listed employer or applicant.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  2. Educational Modules &amp; No Invented Accreditations
                </h3>
                <p>
                  Interactive quizzes, protocols, and browser-generated completion IDs within BIO-NEXA Academy represent informal self-assessment progress on this website and do <strong>not</strong> constitute UGC/AICTE/DBT university degrees, government diplomas, or accredited laboratory licenses. External courses listed in our Courses Directory are governed solely by the respective provider&apos;s own enrollment and credentialing terms.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  3. Employer Submissions &amp; Prohibited Listings
                </h3>
                <p>
                  Anyone submitting opportunities to BIO-NEXA represents and warrants that: (a) they are legally authorized by the hiring organization or organizer to publish the opening, (b) the vacancy is genuine and currently open, (c) the listing does not charge illegal application, security, or training fees from job seekers, and (d) the text and link do not infringe third-party copyrights, trademarks, or Indian law (including IT Rules, 2021 Rule 3(1)(b)).
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  4. Respect for Third-Party Trademarks &amp; Copyrights
                </h3>
                <p>
                  Institutional names (e.g., CSIR, DBT, Biocon, EMBL-EBI, SWAYAM, NPTEL, NCBI) and domain references appear strictly for nominative identification and factual source attribution of publicly available opportunities under India&apos;s <strong>Trade Marks Act, 1999</strong> and fair-dealing principles of the <strong>Copyright Act, 1957</strong>. Rights holders may request immediate modification or removal at any time via Section H (<button type="button" onClick={() => handleSelectSection(POLICY_SECTIONS[7])} className="text-[#0B2A5B] dark:text-sky-300 font-bold underline cursor-pointer">Content Removal Policy</button>).
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  5. Limitation of Liability &amp; Indian Governing Law
                </h3>
                <p>
                  Information is provided &ldquo;as available&rdquo; for educational convenience. BIO-NEXA makes no guarantee of interview selection, hiring outcome, stipend disbursement, or uninterrupted availability of external websites. These Terms are governed by the laws of the Republic of India.
                </p>
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
                  <strong>[Legal Counsel Placeholder]:</strong> Exclusive territorial court jurisdiction (e.g., Courts at [City, State, India]) must be specified by legal counsel to match the operator&apos;s registered place of business.
                </div>
              </section>
            </div>
          )}

          {/* ============================================================== */}
          {/* C. JOB LISTING DISCLAIMER                                      */}
          {/* ============================================================== */}
          {activeSection === 'job-disclaimer' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  C. Job Listing &amp; &ldquo;Verified Status&rdquo; Disclaimer
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Preventing misleading employment guarantees and clarifying what moderation checks cover.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 space-y-2 text-xs">
                <div className="font-bold text-[#0B2A5B] dark:text-sky-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#14A3A0]" />
                  <span>What &ldquo;Verified Listing&rdquo; Means — And Does Not Mean</span>
                </div>
                <p>
                  When a vacancy shows a <strong>Verified</strong> badge on BIO-NEXA, it means a platform moderator checked at the recorded verification date that: (1) the destination URL resolved to a recognizable institutional, corporate, or government domain, and (2) the summary matched the cited source notification. It is <strong>NOT</strong> an official government certification, background check of employer solvency, guarantee of job availability, or endorsement of working conditions.
                </p>
              </div>

              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>No Employment Guarantees:</strong> BIO-NEXA cannot guarantee interviews, shortlisting, stipends, or placement outcomes. Final eligibility, deadlines, reservation/relaxation rules, and selection criteria are controlled solely by the hiring institution.
                </li>
                <li>
                  <strong>Third-Party Sources:</strong> Listings originate from public scientific gazettes (DBT, CSIR, FSSAI, AIIMS, ICAR), institutional sheets, licensed developer APIs (Adzuna when enabled), and moderated employer submissions. Always confirm the full official advertisement PDF/portal before applying.
                </li>
                <li>
                  <strong>Zero-Fee Anti-Fraud Warning:</strong> Neither BIO-NEXA nor legitimate biotech employers charge candidates registration deposits, offer-letter fees, laptop charges, or recruitment commissions. Report any fee demand immediately using Section G.
                </li>
                <li>
                  <strong>Browser-Local Application Notes:</strong> Any &ldquo;Quick Apply&rdquo; or status tracker entries in the local Student/Company demo view remain inside your device browser only—they do <strong>not</strong> transmit applications to third-party HR systems unless you complete your application on the employer&apos;s official external portal.
                </li>
              </ul>
            </div>
          )}

          {/* ============================================================== */}
          {/* D. EXTERNAL LINKS DISCLAIMER                                   */}
          {/* ============================================================== */}
          {activeSection === 'external-links' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  D. External Links &amp; Payment Independence Disclaimer
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Covering outbound links across Jobs, Internships, Workshops, Courses, Exams, Scholarships, and Research Publications.
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-[#14A3A0]" />
                  <span>Leaving BIO-NEXA Domains</span>
                </h3>
                <p>
                  BIO-NEXA provides direct outbound links to official university career pages, government recruitment websites, biotechnology companies, scientific DOI resolvers (<code className="text-xs">doi.org</code>), course hosts (e.g., SWAYAM, NPTEL, EMBL-EBI, Biocon Academy, NCBI), workshop organizers, and external job search portals (e.g., LinkedIn, Naukri, Google Jobs, WorkIndia). Once you leave BIO-NEXA, our Terms and Privacy Policy no longer apply; you are subject to the destination website&apos;s own terms, security practices, and cookie policies.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#14A3A0]" />
                  <span>Workshops &amp; Courses Payment Independence</span>
                </h3>
                <p>
                  <strong>BIO-NEXA does not collect, hold, process, or intermediate any financial payments</strong> on this website. Displayed workshop or course fees (such as cohort fees, conference registration charges, or optional exam fees) are informational summaries sourced from the provider portal and are subject to change without notice. Any financial transaction occurs strictly between you and the external course or workshop organizer on their authorized registration gateway.
                </p>
              </section>

              <p className="text-xs text-slate-500">
                Found a broken external link, redirect hijack, or mismatched fee schedule? Report it via Section G (<button type="button" onClick={() => handleSelectSection(POLICY_SECTIONS[6])} className="text-[#0B2A5B] dark:text-sky-300 font-bold underline cursor-pointer">Report a Listing</button>) or Section H (<button type="button" onClick={() => handleSelectSection(POLICY_SECTIONS[7])} className="text-[#0B2A5B] dark:text-sky-300 font-bold underline cursor-pointer">Content Removal &amp; Correction</button>).
              </p>
            </div>
          )}

          {/* ============================================================== */}
          {/* E. COOKIE AND TRACKING NOTICE                                  */}
          {/* ============================================================== */}
          {activeSection === 'cookies' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  E. Cookie, Browser Storage &amp; Tracking Notice
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Transparent technical inventory of cookies, localStorage, sessionStorage, and third-party network calls.
                </p>
              </div>

              {/* Live Preference Controls */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                      <Cookie className="w-4 h-4 text-[#14A3A0]" />
                      <span>Your Privacy &amp; Session Telemetry Control</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Current status:{' '}
                      <strong className="font-mono text-[#0B2A5B] dark:text-sky-300">
                        {consentState === null
                          ? 'Not Yet Explicitly Chosen (Default Respects Browser DNT)'
                          : consentState.optionalTelemetry
                          ? 'Accept All (Optional Session Entry Ping Allowed)'
                          : 'Essential Only (Optional Session Entry Ping Blocked)'}
                      </strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateTelemetryConsent(false)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        consentState?.optionalTelemetry === false
                          ? 'bg-[#0B2A5B] text-white border-[#0B2A5B]'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Use Essential Only
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateTelemetryConsent(true)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        consentState?.optionalTelemetry === true
                          ? 'bg-[#14A3A0] text-white border-[#14A3A0]'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Allow Optional Entry Ping
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    Want to erase saved bookmarks, dashboard simulation notes, and stored preferences on this browser?
                  </span>
                  <button
                    type="button"
                    onClick={handleClearBrowserData}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold cursor-pointer self-start sm:self-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear My Local Browser Data</span>
                  </button>
                </div>
              </div>

              {/* Exact Inventory Table */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Actual Storage &amp; Network Calls Audited in BIO-NEXA
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <tr>
                        <th className="p-3 font-bold">Identifier / Service</th>
                        <th className="p-3 font-bold">Type</th>
                        <th className="p-3 font-bold">Purpose</th>
                        <th className="p-3 font-bold">Retention</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {COOKIE_AND_STORAGE_INVENTORY.map((row) => (
                        <tr key={row.name} className="align-top">
                          <td className="p-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                            {row.name}
                            <span className="block font-sans text-[10px] font-bold text-teal-600 dark:text-teal-400 mt-0.5">
                              {row.category}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-400">{row.mechanism}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-300">{row.purpose}</td>
                          <td className="p-3 text-slate-500 whitespace-nowrap">{row.retention}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* F. CONTACT AND GRIEVANCE INFORMATION                           */}
          {/* ============================================================== */}
          {activeSection === 'grievance' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  F. Contact, Data Protection &amp; Grievance Redressal Information
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Published pursuant to India&apos;s DPDP Act, 2023 (Section 13) and IT (Intermediary Guidelines) Rules, 2021 (Rule 3(2)).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#14A3A0]" />
                    <span>Platform Contact Channel</span>
                  </div>
                  <p className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-[#14A3A0]" />
                    <span>General Liaison: <strong>council@bio-nexa.org</strong></span>
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Registered Legal Entity &amp; Indian Postal Address: <span className="font-mono text-amber-700 dark:text-amber-300">[TO BE INSERTED UPON ENTITY REGISTRATION &amp; COUNSEL REVIEW]</span>
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
                  <div className="font-bold text-amber-950 dark:text-amber-200 flex items-center gap-2">
                    <Gavel className="w-4 h-4 text-amber-600" />
                    <span>Designated Grievance Officer (Counsel Setup Pending)</span>
                  </div>
                  <p className="text-amber-900 dark:text-amber-200">
                    Name / Designation: <span className="font-mono">[APPOINTED OFFICER NAME — PENDING LAUNCH APPOINTMENT]</span>
                  </p>
                  <p className="text-amber-900 dark:text-amber-200">
                    Operational Intake: Use the encrypted tracking form below or email <strong>council@bio-nexa.org</strong>. Target acknowledgement within <strong>24 hours</strong> and resolution within <strong>15 days</strong> under IT Rules, 2021.
                  </p>
                </div>
              </div>

              <InlineComplianceForm
                requestType="privacy_request"
                heading="Submit a DPDP Privacy Request or Grievance"
                description="Exercise your rights to data access, correction, erasure, consent withdrawal, or file a statutory grievance."
                subCategories={[
                  'DPDP Right to Access Personal Data (Sec. 11)',
                  'DPDP Right to Correction or Erasure (Sec. 12)',
                  'DPDP Consent Withdrawal / Telemetry Opt-Out (Sec. 6)',
                  'IT Rules 2021 Intermediary Grievance Complaint',
                  'Data Protection Board Escalation Notice'
                ]}
                targetLabel="Related Account Email, Submission ID, or URL"
                targetPlaceholder="e.g. email used when reporting a job or submitting a listing"
                requireTarget={false}
                submitButtonLabel="Submit Privacy / Grievance Request"
                consentLabel="I consent to BIO-NEXA processing the details entered in this form solely to verify my identity (where needed) and resolve my privacy request or grievance under Indian law."
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* G. JOB REPORTING POLICY                                        */}
          {/* ============================================================== */}
          {activeSection === 'report-job' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  G. Job, Workshop &amp; Course Reporting Policy
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Helping candidates and researchers flag suspicious, expired, misleading, or unauthorized opportunities immediately.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-1">
                  <div className="font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Zero-Tolerance Fraud Triggers</span>
                  </div>
                  <p className="text-rose-800 dark:text-rose-300">
                    Any job listing requesting cash deposits, &ldquo;interview processing charges,&rdquo; Aadhaar/bank OTPs, or redirecting to unofficial WhatsApp/Telegram collection numbers is immediately suspended upon verification.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Flag className="w-4 h-4 text-[#14A3A0]" />
                    <span>Moderation Turnaround</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">
                    You can click <strong>Report Listing</strong> directly on any job detail page, or submit the centralized report form below. High-severity fraud reports are queued for priority moderator review within <strong>24 hours</strong>.
                  </p>
                </div>
              </div>

              <InlineComplianceForm
                requestType="job_report"
                heading="Report a Suspicious, Expired, or Inaccurate Listing"
                description="All reports are stored in BIO-NEXA's moderation database with a tracking reference for audit."
                subCategories={[
                  'Demanded Application Fee / Fraudulent Recruiter',
                  'Suspicious or Unofficial Redirect URL',
                  'Broken / 404 Destination Link',
                  'Expired Deadline Still Shown Active',
                  'Misleading Qualification, Salary, or Fee Claim'
                ]}
                targetLabel="Listing Title & BIO-NEXA or External URL *"
                targetPlaceholder="e.g. Research Associate at XYZ Labs — https://..."
                requireTarget={true}
                submitButtonLabel="Submit Listing Report"
                consentLabel="I confirm this listing report is submitted in good faith based on direct observation, and I consent to BIO-NEXA storing this report to investigate and suspend non-compliant listings."
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* H. CONTENT REMOVAL AND CORRECTION POLICY                       */}
          {/* ============================================================== */}
          {activeSection === 'content-removal' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  H. Content Removal, Correction &amp; Takedown Policy
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Notice-and-takedown procedure for employers, academic institutions, copyright owners, and trademark holders under IT Rules, 2021.
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileWarning className="w-4 h-4 text-[#14A3A0]" />
                  <span>No Unauthorized Publications Pledge</span>
                </h3>
                <p>
                  BIO-NEXA respects third-party intellectual property and employer hiring autonomy. Public job/course feeds require verified official source URLs or direct institutional authorization. If your organization identifies an unauthorized job vacancy, an outdated stipend/deadline, an unapproved logo/trademark usage, or copyright material requiring removal or correction, notify us below.
                </p>
              </section>

              <ul className="list-disc pl-5 space-y-1.5 text-xs">
                <li><strong>Unauthorized Employer Listing:</strong> Verified company HR representatives may request immediate unpublishing within 24 hours.</li>
                <li><strong>Trademark or Copyright Notice (Trade Marks Act, 1999 / Copyright Act, 1957):</strong> Provide exact URLs and proof of authority; verified takedowns are processed under IT Rules, 2021 timelines (including 24-hour/36-hour statutory windows where applicable).</li>
                <li><strong>Data &amp; Syllabus Corrections:</strong> Training institutes and universities may submit updated official registration links, fees, or closing dates for immediate database updates.</li>
              </ul>

              <InlineComplianceForm
                requestType="content_removal"
                heading="Request Content Takedown, Unpublishing, or Official Correction"
                description="For authorized employer representatives, course/workshop organizers, universities, and IP rights holders."
                subCategories={[
                  'Remove Unauthorized Job / Internship Listing',
                  'Trademark / Brand Attribution Removal or Update',
                  'Copyright Takedown Notice (Indian Copyright Act)',
                  'Correct Course / Workshop Dates, Fees, or Registration Link',
                  'Update or Remove Institutional Attribution'
                ]}
                targetLabel="Exact BIO-NEXA Page URL or Listing Title *"
                targetPlaceholder="e.g. /courses or /jobs/job-1"
                requireTarget={true}
                submitButtonLabel="Submit Takedown / Correction Notice"
                consentLabel="I declare that I am the rights holder or an authorized representative of the affected institution, that the statements in this notice are accurate, and I consent to processing this request for legal compliance."
              />
            </div>
          )}
        </article>
      </div>
    </div>
  );
};
