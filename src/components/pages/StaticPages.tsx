import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  Mail,
  MapPin,
  Send,
  Sparkles,
  BookOpen,
  Award,
  Globe
} from 'lucide-react';

/* =========================================================================
   1. VERIFY CERTIFICATE PAGE
   ========================================================================= */
export const VerifyCertificatePage: React.FC = () => {
  const { certificates, addToast } = useApp();
  const [certInput, setCertInput] = useState('');
  const [searched, setSearched] = useState(false);
  const [matchedCert, setMatchedCert] = useState<any | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam) {
      setCertInput(idParam);
      const match = certificates.find(
        (c) => c.certificateNumber.toLowerCase() === idParam.toLowerCase()
      );
      setSearched(true);
      setMatchedCert(match || null);
    }
  }, [certificates]);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!certInput.trim()) return;

    const trimmed = certInput.trim().toUpperCase();
    const match = certificates.find(
      (c) => c.certificateNumber.toUpperCase() === trimmed
    );
    setSearched(true);
    setMatchedCert(match || null);
    if (match) {
      addToast(`Certificate #${match.certificateNumber} is authentic and verified!`, 'success');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-semibold uppercase tracking-wider border border-emerald-200 dark:border-emerald-800">
          <ShieldCheck className="w-4 h-4" />
          <span>Official Public Registry</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Verify BIO-NEXA Academy Credentials
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Enter any candidate&apos;s unique Certificate Number to verify their biotechnology examination score, course completion, and institutional authenticity.
        </p>

        {/* Verification Form */}
        <form onSubmit={handleVerify} className="pt-4 flex gap-2 max-w-md mx-auto">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              required
              value={certInput}
              onChange={(e) => setCertInput(e.target.value)}
              placeholder="e.g. BN-2026-CRISPR-9842"
              className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-500"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold text-xs rounded-xl transition-colors shrink-0 shadow-xs"
          >
            Verify Now
          </button>
        </form>
      </div>

      {/* Verification Result Card */}
      {searched && (
        <div className="pt-4">
          {matchedCert ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-emerald-500 p-8 shadow-lg max-w-2xl mx-auto space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Authentic &amp; Validated
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      BIO-NEXA Verified Credential
                    </h2>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded">
                    Score: {matchedCert.score}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Certificate Number:</span>
                  <strong className="font-mono text-slate-900 dark:text-slate-100 text-sm">
                    {matchedCert.certificateNumber}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Date of Issuance:</span>
                  <strong className="text-slate-900 dark:text-slate-100 text-sm">
                    {matchedCert.issueDate}
                  </strong>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block">Recipient Name:</span>
                  <strong className="text-slate-900 dark:text-slate-100 text-base">
                    {matchedCert.recipientName}
                  </strong>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block">Certified Competency:</span>
                  <strong className="text-[#0B2A5B] dark:text-sky-300 text-base">
                    {matchedCert.courseTitle}
                  </strong>
                </div>
                <div className="col-span-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg font-mono text-[11px] text-slate-500">
                  Verification Code: {matchedCert.verificationCode}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 text-center">
                This digital record confirms that the candidate passed the rigorous scientific evaluation adhering to national biotechnology education benchmarks.
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-300 dark:border-rose-800 p-8 text-center max-w-md mx-auto space-y-2">
              <XCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Certificate Not Found
              </h3>
              <p className="text-xs text-slate-500">
                No certificate was located matching &ldquo;{certInput}&rdquo;. Please verify the serial number or try a demo certificate (e.g. <strong className="font-mono">BN-2026-CRISPR-9842</strong>).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   2. ABOUT PAGE
   ========================================================================= */
export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8 text-slate-700 dark:text-slate-300">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          About BIO-NEXA
        </h1>
        <p className="text-sm text-teal-600 font-semibold mt-1">
          Connecting Science. Creating Careers.
        </p>
      </div>

      <div className="space-y-4 text-sm leading-relaxed">
        <p>
          <strong>BIO-NEXA</strong> is a premier, non-commercial digital platform built for students, research scholars, freshers, and life science professionals across India and worldwide.
        </p>
        <p>
          Bridging the critical gap between academic university education and real-world biopharmaceutical industrial requirements, BIO-NEXA unifies verified job vacancies, summer research fellowships, national competitive exam preparations (CSIR NET Life Sciences, GATE Biotechnology, DBT-BET), accredited course certifications, and PubMed literature discoveries into one coherent scientific umbrella.
        </p>

        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 pt-4">
          Core Pillars of BIO-NEXA
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
            <div className="font-bold text-[#0B2A5B] dark:text-sky-300 text-sm">1. Zero Cost &amp; Equal Access</div>
            <p>Every student and researcher accesses jobs, fellowships, and study materials without predatory paywalls.</p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
            <div className="font-bold text-[#0B2A5B] dark:text-sky-300 text-sm">2. Authentic Grounding</div>
            <p>Every opening and fellowship cites official government, university, or company portals. No fabricated or expired scrapings.</p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
            <div className="font-bold text-[#0B2A5B] dark:text-sky-300 text-sm">3. Rigorous Science</div>
            <p>Masterclasses and exam simulators are curated by recognized scientists and doctoral fellows with verified wet lab pedigrees.</p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
            <div className="font-bold text-[#0B2A5B] dark:text-sky-300 text-sm">4. Verifiable Registry</div>
            <p>Course completion credentials include cryptographic verification numbers that recruiters can validate in real-time.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   3. CONTACT PAGE
   ========================================================================= */
export const ContactPage: React.FC = () => {
  const { addContactMessage } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Institutional Partnership / Job Posting Query');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;
    addContactMessage({ name, email, subject, message });
    setName('');
    setEmail('');
    setMessage('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Contact BIO-NEXA Council
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Reach out for recruiter onboarding, institutional collaborations, or technical platform assistance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-5 space-y-4 text-xs text-slate-600 dark:text-slate-400">
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Headquarters &amp; Liaison Office
            </h3>
            <p className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>Bio-Nexa Innovation Center, Biotech City, Bengaluru, Karnataka 560100, India</span>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-teal-600 shrink-0" />
              <span>council@bio-nexa.org</span>
            </p>
          </div>

          <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-1">Response Commitment</h4>
            <p>Our scientific moderation team reviews inquiries within 24 operational hours.</p>
          </div>
        </div>

        <div className="md:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Your Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. / Ms. / Mr. Name"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="scientist@organization.org"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="Institutional Partnership / Job Posting Query">Recruiter Onboarding / Job Posting</option>
                <option value="Exam Preparation / Study Material Contributor">Exam Study Material Submission</option>
                <option value="Certificate Verification Inquiry">Certificate Verification Inquiry</option>
                <option value="Technical Support">Technical Platform Support</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Message Content *
              </label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Please describe your institutional requirements or inquiry..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Message</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   4. PRIVACY POLICY
   ========================================================================= */
export const PrivacyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 border-b pb-4">
        Privacy &amp; Data Protection Policy
      </h1>
      <p>
        Last Updated: November 2026. BIO-NEXA adheres strictly to the Digital Personal Data Protection (DPDP) Act of India and international standards.
      </p>
      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 pt-2">
        1. Information We Collect
      </h2>
      <p>
        When you create an account, upload a curriculum vitae, or submit an application, we store your contact details and academic qualifications purely for matchmaking with authorized recruiters. We do not sell or monetize candidate data.
      </p>
      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 pt-2">
        2. Account Deletion &amp; Data Portability
      </h2>
      <p>
        Users may request complete permanent deletion of their account and uploaded CV files at any time through the Student Dashboard settings or by emailing privacy@bio-nexa.org.
      </p>
    </div>
  );
};

/* =========================================================================
   5. TERMS OF SERVICE
   ========================================================================= */
export const TermsPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 border-b pb-4">
        Terms of Service &amp; Code of Scientific Conduct
      </h1>
      <p>
        By using BIO-NEXA, you agree to uphold rigorous scientific integrity, fair competition, and respectful peer interactions.
      </p>
      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 pt-2">
        1. Recruiter Guidelines
      </h2>
      <p>
        All posted job and internship vacancies must represent legitimate scientific openings with clear remuneration/stipend or educational credit. Misleading or fraudulent posts are immediately terminated.
      </p>
      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 pt-2">
        2. Academic Integrity
      </h2>
      <p>
        Certificates issued by BIO-NEXA represent individual mastery of course assessments. Cheating or sharing assessment keys violates certification conditions and invalidates credential serial numbers.
      </p>
    </div>
  );
};
