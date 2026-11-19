import React, { useEffect, useState } from 'react';
import {
  Building2,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  KeyRound,
  Globe,
  MapPin,
  FileBadge,
  Briefcase,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { companyApi } from '../../services/company/companyApiClient';

export type CompanyAuthMode = 'login' | 'register' | 'verify' | 'reset';

interface CompanyAuthPageProps {
  initialMode?: CompanyAuthMode;
  initialToken?: string;
  embeddedInDashboard?: boolean;
}

const PASSWORD_CHECKS = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number (0-9)', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character (!@#$%)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const ORGANIZATION_TYPES = [
  'Private Biopharma',
  'Biotech Startup',
  'Academic / Research Institute',
  'Government / Autonomous',
  'Diagnostics & CRO',
  'Agritech / Industrial Biotech',
  'Non-Profit / Foundation',
];

export const CompanyAuthPage: React.FC<CompanyAuthPageProps> = ({
  initialMode = 'login',
  initialToken = '',
  embeddedInDashboard = false,
}) => {
  const {
    isCompanyAuthenticated,
    setCompanySessionUser,
    refreshCompanySession,
    navigate,
    addToast,
  } = useApp();

  const [mode, setMode] = useState<CompanyAuthMode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [initialMode]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [retryAfterSec, setRetryAfterSec] = useState<number | null>(null);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Registration state
  const [contactName, setContactName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [organizationName, setOrganizationName] = useState('');
  const [organizationType, setOrganizationType] = useState('Private Biopharma');
  const [officialWebsite, setOfficialWebsite] = useState('');
  const [headquartersLocation, setHeadquartersLocation] = useState('');
  const [registrationIdentifier, setRegistrationIdentifier] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);

  // Verify email state
  const [verifyToken, setVerifyToken] = useState(initialToken);
  const [verifyCompleted, setVerifyCompleted] = useState(false);

  // Reset password state
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>(initialToken ? 'confirm' : 'request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState(initialToken);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [devResetTokenPreview, setDevResetTokenPreview] = useState<string | null>(null);
  const [resetCompleted, setResetCompleted] = useState(false);

  useEffect(() => {
    if (initialMode === 'verify' && initialToken) {
      setVerifyToken(initialToken);
      let cancelled = false;
      const runAutoVerify = async () => {
        setIsLoading(true);
        setErrorMsg(null);
        try {
          const res = await companyApi.verifyEmail(initialToken);
          if (cancelled) return;
          if (res.company) {
            setCompanySessionUser(res.company);
          } else {
            await refreshCompanySession();
          }
          setVerifyCompleted(true);
          setSuccessMsg(res.message || 'Your company work email has been verified.');
        } catch (err: any) {
          if (!cancelled) {
            setErrorMsg(err?.message || 'Unable to verify work email token.');
          }
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      };
      runAutoVerify();
      return () => {
        cancelled = true;
      };
    }
  }, [initialMode, initialToken]);

  useEffect(() => {
    if (initialMode === 'reset' && initialToken) {
      setResetToken(initialToken);
      setResetStep('confirm');
    }
  }, [initialMode, initialToken]);

  useEffect(() => {
    if (!embeddedInDashboard && isCompanyAuthenticated && (mode === 'login' || mode === 'register')) {
      navigate('/dashboard-company');
    }
  }, [embeddedInDashboard, isCompanyAuthenticated, mode]);

  const switchMode = (next: CompanyAuthMode) => {
    setMode(next);
    setErrorMsg(null);
    setSuccessMsg(null);
    setRetryAfterSec(null);
    if (!embeddedInDashboard) {
      if (next === 'login') navigate('/company/login');
      else if (next === 'register') navigate('/company/register');
      else if (next === 'verify') navigate('/company/verify-email');
      else if (next === 'reset') navigate('/company/reset-password');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setRetryAfterSec(null);

    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('Please enter both your work email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await companyApi.login(loginEmail.trim(), loginPassword);
      setCompanySessionUser(res.company);
      addToast(`Signed in to ${res.company.organizationName}.`, 'success');
      navigate('/dashboard-company');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Sign in failed. Please verify your employer credentials.');
      if (typeof err?.retryAfterSec === 'number') setRetryAfterSec(err.retryAfterSec);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (contactName.trim().length < 2) {
      setErrorMsg('Please enter the authorized representative full name (at least 2 characters).');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMsg('Please enter a valid organization work email address.');
      return;
    }
    if (organizationName.trim().length < 2) {
      setErrorMsg('Please enter your official organization name.');
      return;
    }
    if (!/^https?:\/\/[^/\s]+\.[^/\s]+/i.test(officialWebsite.trim())) {
      setErrorMsg('Please enter a valid official organization website URL (https://...).');
      return;
    }
    if (headquartersLocation.trim().length < 2) {
      setErrorMsg('Please enter your organization headquarters city/location.');
      return;
    }
    const failedCheck = PASSWORD_CHECKS.find((c) => !c.test(regPassword));
    if (failedCheck) {
      setErrorMsg(`Password requirement not met: ${failedCheck.label}.`);
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Password confirmation does not match.');
      return;
    }
    if (!privacyConsent) {
      setErrorMsg('You must accept the BIO-INEXA Employer Terms and Privacy Policy to register.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await companyApi.register({
        contactName: contactName.trim(),
        contactTitle: contactTitle.trim(),
        email: regEmail.trim(),
        password: regPassword,
        organizationName: organizationName.trim(),
        organizationType,
        officialWebsite: officialWebsite.trim(),
        headquartersLocation: headquartersLocation.trim(),
        registrationIdentifier: registrationIdentifier.trim(),
        privacyConsentAccepted: true,
      });

      if (res.devVerificationToken) {
        try {
          sessionStorage.setItem('bionexa_dev_company_verify_token', res.devVerificationToken);
        } catch {
          // ignore storage restrictions
        }
      }

      setCompanySessionUser(res.company);
      addToast(
        'Organization registered as Unverified Employer. Please verify your work email and submit verification credentials.',
        'success'
      );
      navigate('/dashboard-company');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to register organization account.');
      if (typeof err?.retryAfterSec === 'number') setRetryAfterSec(err.retryAfterSec);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!verifyToken.trim()) {
      setErrorMsg('Please paste your company email verification token.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await companyApi.verifyEmail(verifyToken.trim());
      if (res.company) {
        setCompanySessionUser(res.company);
      } else {
        await refreshCompanySession();
      }
      setVerifyCompleted(true);
      setSuccessMsg(res.message || 'Company work email verified.');
      addToast('Company work email verified successfully!', 'success');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Verification token is invalid or expired.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setDevResetTokenPreview(null);

    if (!resetEmail.trim() || !resetEmail.includes('@')) {
      setErrorMsg('Please enter the work email address associated with your employer account.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await companyApi.requestPasswordReset(resetEmail.trim());
      setSuccessMsg(res.message);
      if (res.devResetToken) {
        setDevResetTokenPreview(res.devResetToken);
        setResetToken(res.devResetToken);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to process password reset request.');
      if (typeof err?.retryAfterSec === 'number') setRetryAfterSec(err.retryAfterSec);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!resetToken.trim()) {
      setErrorMsg('Please enter the password reset token.');
      return;
    }
    const failedCheck = PASSWORD_CHECKS.find((c) => !c.test(resetNewPassword));
    if (failedCheck) {
      setErrorMsg(`Password requirement not met: ${failedCheck.label}.`);
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setErrorMsg('New password confirmation does not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await companyApi.confirmPasswordReset(resetToken.trim(), resetNewPassword);
      setResetCompleted(true);
      setSuccessMsg(res.message);
      addToast('Employer password updated. Please sign in with your new password.', 'success');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to reset password. Token may be invalid or expired.');
    } finally {
      setIsLoading(false);
    }
  };

  const headerTitle =
    mode === 'register'
      ? 'Register Employer Organization'
      : mode === 'verify'
      ? 'Verify Work Email'
      : mode === 'reset'
      ? 'Reset Employer Password'
      : 'BIO-INEXA Employer Portal';

  const headerSubtitle =
    mode === 'register'
      ? 'Create an authenticated organization account to submit life sciences openings, manage application destinations, and complete employer identity verification.'
      : mode === 'verify'
      ? 'Verify your organization email address to unlock job submissions and employer identity verification.'
      : mode === 'reset'
      ? 'Securely reset your employer account password and revoke all prior active sessions.'
      : 'Sign in with your organization account to manage biotechnology openings, verification status, and audit logs.';

  return (
    <div className="min-h-[78vh] flex items-center justify-center px-4 py-10">
      <div
        className={`w-full ${
          mode === 'register' ? 'max-w-2xl' : 'max-w-md'
        } bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden`}
      >
        {/* Top Branded Header Banner */}
        <div className="bg-gradient-to-r from-slate-950 via-[#0B2A5B] to-slate-950 p-6 text-white text-center relative overflow-hidden">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 mb-3 shadow-inner">
            {mode === 'reset' ? (
              <KeyRound className="w-7 h-7 text-teal-300" />
            ) : mode === 'verify' ? (
              <ShieldCheck className="w-7 h-7 text-teal-300" />
            ) : (
              <Building2 className="w-7 h-7 text-teal-300" />
            )}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">{headerTitle}</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto leading-relaxed">
            {headerSubtitle}
          </p>
        </div>

        {/* Mode Switch Tabs */}
        {(mode === 'login' || mode === 'register') && (
          <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-800 text-[#0B2A5B] dark:text-sky-300 shadow-xs border border-slate-200 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Employer Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-800 text-[#0B2A5B] dark:text-sky-300 shadow-xs border border-slate-200 dark:border-slate-700'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Register Organization
            </button>
          </div>
        )}

        <div className="p-6 sm:p-8 space-y-5">
          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5"
            >
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="space-y-0.5 flex-1">
                <div className="font-bold">{errorMsg}</div>
                {retryAfterSec !== null && retryAfterSec > 0 && (
                  <div className="text-[11px] font-mono text-rose-700 dark:text-rose-300">
                    Rate limit active. Retry in {retryAfterSec}s.
                  </div>
                )}
              </div>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* LOGIN VIEW */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs" noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="company-login-email"
                  className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="company-login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="careers@organization.org"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="company-login-password"
                    className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="company-login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                  />
                  <button
                    type="button"
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || (retryAfterSec !== null && retryAfterSec > 0)}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <span>Signing In...</span>
                ) : (
                  <>
                    <span>Sign In to Employer Portal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>New hiring organization?</span>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="font-bold text-[#0B2A5B] dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Register Organization &rarr;
                </button>
              </div>
            </form>
          )}

          {/* REGISTER VIEW */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs" noValidate>
              {/* Honest Employer Verification Notice */}
              <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/70 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Employer Verification Policy:</strong> Registering creates an{' '}
                  <strong>Unverified Employer</strong> account. Opportunities submitted prior to administrator identity approval are held in Pending Review and cannot be published as Verified listings.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="company-reg-orgname"
                    className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Organization Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="company-reg-orgname"
                      type="text"
                      required
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="e.g., HelixGen Diagnostics Pvt Ltd"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="company-reg-orgtype"
                    className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Organization Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="company-reg-orgtype"
                    value={organizationType}
                    onChange={(e) => setOrganizationType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                  >
                    {ORGANIZATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="company-reg-website"
                    className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Official Website <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="company-reg-website"
                      type="url"
                      required
                      value={officialWebsite}
                      onChange={(e) => setOfficialWebsite(e.target.value)}
                      placeholder="https://organization.in"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="company-reg-hq"
                    className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Headquarters Location <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="company-reg-hq"
                      type="text"
                      required
                      value={headquartersLocation}
                      onChange={(e) => setHeadquartersLocation(e.target.value)}
                      placeholder="e.g., Bengaluru, Karnataka"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="company-reg-contact"
                    className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Representative Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="company-reg-contact"
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="e.g., Dr. Kavita Rao"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="company-reg-title"
                    className="block font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Role / Designation (Optional)
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="company-reg-title"
                      type="text"
                      value={contactTitle}
                      onChange={(e) => setContactTitle(e.target.value)}
                      placeholder="e.g., Talent Acquisition Lead"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="company-reg-email"
                    className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Official Work Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="company-reg-email"
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="hr@organization.in"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="company-reg-cin"
                    className="block font-semibold text-slate-700 dark:text-slate-300"
                  >
                    CIN / GSTIN / Institutional ID (Optional)
                  </label>
                  <div className="relative">
                    <FileBadge className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="company-reg-cin"
                      type="text"
                      value={registrationIdentifier}
                      onChange={(e) => setRegistrationIdentifier(e.target.value)}
                      placeholder="e.g., CIN U73100KA2021PTC..."
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="company-reg-password"
                    className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="company-reg-password"
                      type={showRegPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Strong password"
                      className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                    <button
                      type="button"
                      aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="company-reg-confirm"
                    className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="company-reg-confirm"
                      type={showRegPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>
                </div>
              </div>

              {/* Password Strength Checklist */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Password Security Requirements
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                  {PASSWORD_CHECKS.map((rule) => {
                    const passed = rule.test(regPassword);
                    return (
                      <div
                        key={rule.label}
                        className={`flex items-center gap-1.5 ${
                          passed ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'
                        }`}
                      >
                        <CheckCircle2
                          className={`w-3.5 h-3.5 shrink-0 ${
                            passed ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                        <span>{rule.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Privacy & Terms Consent */}
              <div className="p-3.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-900/60">
                <label className="flex items-start gap-2.5 cursor-pointer text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  <input
                    id="company-reg-privacy"
                    type="checkbox"
                    checked={privacyConsent}
                    onChange={(e) => setPrivacyConsent(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-[#0B2A5B] focus:ring-[#0B2A5B]"
                  />
                  <span>
                    I represent this organization and accept the{' '}
                    <a
                      href="/terms"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/terms');
                      }}
                      className="font-bold text-[#0B2A5B] dark:text-sky-400 underline"
                    >
                      Employer Terms
                    </a>{' '}
                    and{' '}
                    <a
                      href="/privacy"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/privacy');
                      }}
                      className="font-bold text-[#0B2A5B] dark:text-sky-400 underline"
                    >
                      Privacy Policy
                    </a>
                    . I understand employer identity must be reviewed and approved by BIO-INEXA administrators before listings receive Verified Employer status.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <span>Registering Organization...</span>
                ) : (
                  <>
                    <span>Register Organization Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* VERIFY EMAIL VIEW */}
          {mode === 'verify' && (
            <div className="space-y-4 text-xs">
              {verifyCompleted ? (
                <div className="space-y-3 text-center py-2">
                  <p className="text-slate-600 dark:text-slate-400">
                    Your work email address has been verified. You may now submit openings and request employer verification in your dashboard.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(isCompanyAuthenticated ? '/dashboard-company' : '/company/login')}
                    className="w-full py-3 px-4 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] text-white font-bold rounded-xl cursor-pointer"
                  >
                    {isCompanyAuthenticated ? 'Go to Employer Dashboard' : 'Continue to Employer Sign In'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleVerifySubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="company-verify-token"
                      className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                    >
                      Work Email Verification Token
                    </label>
                    <input
                      id="company-verify-token"
                      type="text"
                      required
                      value={verifyToken}
                      onChange={(e) => setVerifyToken(e.target.value)}
                      placeholder="Paste verification token"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] text-white font-bold rounded-xl cursor-pointer"
                  >
                    {isLoading ? 'Verifying...' : 'Verify Work Email'}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="w-full py-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </form>
              )}
            </div>
          )}

          {/* RESET PASSWORD VIEW */}
          {mode === 'reset' && (
            <div className="space-y-4 text-xs">
              {resetCompleted ? (
                <div className="space-y-3 text-center py-2">
                  <p className="text-slate-600 dark:text-slate-400">
                    Your employer password has been updated and all prior sessions were signed out.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setResetCompleted(false);
                      switchMode('login');
                    }}
                    className="w-full py-3 px-4 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] text-white font-bold rounded-xl cursor-pointer"
                  >
                    Sign In with New Password
                  </button>
                </div>
              ) : resetStep === 'request' ? (
                <form onSubmit={handleResetRequestSubmit} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="company-reset-email"
                      className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                    >
                      Registered Work Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="company-reset-email"
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="hr@organization.in"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                      />
                    </div>
                  </div>

                  {devResetTokenPreview && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 space-y-2">
                      <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Development Preview Reset Token Issued</span>
                      </div>
                      <p className="text-[11px] font-mono break-all text-amber-800 dark:text-amber-200 bg-white/70 dark:bg-slate-900/60 p-2 rounded border border-amber-200/70 dark:border-amber-800">
                        {devResetTokenPreview}
                      </p>
                      <button
                        type="button"
                        onClick={() => setResetStep('confirm')}
                        className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg cursor-pointer"
                      >
                        Proceed to Set New Password &rarr;
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 disabled:opacity-60 text-white font-bold rounded-xl cursor-pointer"
                  >
                    {isLoading ? 'Generating Reset Token...' : 'Request Password Reset'}
                  </button>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setResetStep('confirm')}
                      className="text-teal-600 dark:text-teal-400 font-semibold hover:underline cursor-pointer"
                    >
                      Already have a reset token?
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetConfirmSubmit} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="company-reset-token"
                      className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                    >
                      Reset Token
                    </label>
                    <input
                      id="company-reset-token"
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Paste reset token"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="company-reset-new-password"
                      className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                    >
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="company-reset-new-password"
                        type={showResetPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="Enter strong new password"
                        className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                      />
                      <button
                        type="button"
                        aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="company-reset-confirm-password"
                      className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                    >
                      Confirm New Password
                    </label>
                    <input
                      id="company-reset-confirm-password"
                      type={showResetPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] text-white font-bold rounded-xl cursor-pointer"
                  >
                    {isLoading ? 'Updating Password...' : 'Confirm Password Reset'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setResetStep('request')}
                    className="w-full py-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold cursor-pointer"
                  >
                    &larr; Request a new reset token
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Footer Security Disclosure */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              Role-Isolated Employer Auth
            </span>
            <button
              type="button"
              onClick={() => navigate('/student/login')}
              className="text-[#0B2A5B] dark:text-sky-400 font-semibold hover:underline cursor-pointer"
            >
              Student Portal &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
