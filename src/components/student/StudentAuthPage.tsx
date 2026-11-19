import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
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
  Building2,
  BookOpen,
  Calendar,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { studentApi } from '../../services/student/studentApiClient';

export type StudentAuthMode = 'login' | 'register' | 'verify' | 'reset';

interface StudentAuthPageProps {
  initialMode?: StudentAuthMode;
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

export const StudentAuthPage: React.FC<StudentAuthPageProps> = ({
  initialMode = 'login',
  initialToken = '',
  embeddedInDashboard = false,
}) => {
  const {
    isStudentAuthenticated,
    setStudentSessionUser,
    refreshStudentSession,
    navigate,
    addToast,
  } = useApp();

  const [mode, setMode] = useState<StudentAuthMode>(initialMode);

  // Sync mode when route changes
  useEffect(() => {
    setMode(initialMode);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [initialMode]);

  // Shared UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [retryAfterSec, setRetryAfterSec] = useState<number | null>(null);

  // Sign In state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Registration state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regDegreeTitle, setRegDegreeTitle] = useState('');
  const [regInstitution, setRegInstitution] = useState('');
  const [regSpecialization, setRegSpecialization] = useState('');
  const [regGraduationYear, setRegGraduationYear] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);

  // Email Verification state
  const [verifyToken, setVerifyToken] = useState(initialToken);
  const [verifyCompleted, setVerifyCompleted] = useState(false);

  // Password Reset state
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>(initialToken ? 'confirm' : 'request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState(initialToken);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [devResetTokenPreview, setDevResetTokenPreview] = useState<string | null>(null);
  const [resetCompleted, setResetCompleted] = useState(false);

  // Auto-verify email if arriving at /student/verify-email?token=...
  useEffect(() => {
    if (initialMode === 'verify' && initialToken) {
      setVerifyToken(initialToken);
      let cancelled = false;
      const runAutoVerify = async () => {
        setIsLoading(true);
        setErrorMsg(null);
        try {
          const res = await studentApi.verifyEmail(initialToken);
          if (cancelled) return;
          if (res.student) {
            setStudentSessionUser(res.student);
          } else {
            await refreshStudentSession();
          }
          setVerifyCompleted(true);
          setSuccessMsg(res.message || 'Your email address has been verified.');
        } catch (err: any) {
          if (!cancelled) {
            setErrorMsg(err?.message || 'Unable to verify email token.');
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

  // If already logged in and visiting standalone login/register routes, offer quick link / redirect
  useEffect(() => {
    if (!embeddedInDashboard && isStudentAuthenticated && (mode === 'login' || mode === 'register')) {
      navigate('/dashboard-student');
    }
  }, [embeddedInDashboard, isStudentAuthenticated, mode]);

  const switchMode = (next: StudentAuthMode) => {
    setMode(next);
    setErrorMsg(null);
    setSuccessMsg(null);
    setRemainingAttempts(null);
    setRetryAfterSec(null);
    if (!embeddedInDashboard) {
      if (next === 'login') navigate('/student/login');
      else if (next === 'register') navigate('/student/register');
      else if (next === 'verify') navigate('/student/verify-email');
      else if (next === 'reset') navigate('/student/reset-password');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setRemainingAttempts(null);
    setRetryAfterSec(null);

    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await studentApi.login(loginEmail.trim(), loginPassword);
      setStudentSessionUser(res.student);
      addToast(`Welcome back, ${res.student.fullName}!`, 'success');
      navigate('/dashboard-student');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Sign in failed. Please check your credentials.');
      if (typeof err?.remainingAttempts === 'number') setRemainingAttempts(err.remainingAttempts);
      if (typeof err?.retryAfterSec === 'number') setRetryAfterSec(err.retryAfterSec);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (regFullName.trim().length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
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
      setErrorMsg('Please review and accept the Privacy Policy before creating your account.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await studentApi.register({
        fullName: regFullName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        degreeTitle: regDegreeTitle.trim(),
        institution: regInstitution.trim(),
        specialization: regSpecialization.trim(),
        graduationYear: regGraduationYear.trim(),
        privacyConsent: true,
      });

      if (res.devVerificationToken) {
        try {
          sessionStorage.setItem('bionexa_dev_verify_token', res.devVerificationToken);
        } catch {
          // ignore storage restrictions
        }
      }

      setStudentSessionUser(res.student);
      addToast('Student account created! Please verify your email address in your dashboard.', 'success');
      navigate('/dashboard-student');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to complete registration. Please check your entries.');
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
      setErrorMsg('Please paste your email verification token.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await studentApi.verifyEmail(verifyToken.trim());
      if (res.student) {
        setStudentSessionUser(res.student);
      } else {
        await refreshStudentSession();
      }
      setVerifyCompleted(true);
      setSuccessMsg(res.message || 'Email address verified successfully.');
      addToast('Email verified successfully!', 'success');
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
      setErrorMsg('Please enter the email address associated with your student account.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await studentApi.requestPasswordReset(resetEmail.trim());
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
      const res = await studentApi.confirmPasswordReset(resetToken.trim(), resetNewPassword);
      setResetCompleted(true);
      setSuccessMsg(res.message);
      addToast('Password reset complete. Please sign in with your new password.', 'success');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to reset password. Token may be invalid or expired.');
    } finally {
      setIsLoading(false);
    }
  };

  const headerTitle =
    mode === 'register'
      ? 'Create Student Account'
      : mode === 'verify'
      ? 'Verify Student Email'
      : mode === 'reset'
      ? 'Reset Student Password'
      : 'BIO-INEXA Student Portal';

  const headerSubtitle =
    mode === 'register'
      ? 'Register your private academic profile to track biotech applications, saved roles, and verified credentials.'
      : mode === 'verify'
      ? 'Confirm your email address to activate full student account protections.'
      : mode === 'reset'
      ? 'Securely reset your password and automatically sign out prior sessions.'
      : 'Sign in with your database-backed student account. Protected with Scrypt hashing and HttpOnly session cookies.';

  return (
    <div className="min-h-[78vh] flex items-center justify-center px-4 py-10">
      <div className={`w-full ${mode === 'register' ? 'max-w-xl' : 'max-w-md'} bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden`}>
        {/* Top Branded Header Banner (consistent with portal auth design) */}
        <div className="bg-gradient-to-r from-slate-950 via-[#0B2A5B] to-slate-950 p-6 text-white text-center relative overflow-hidden">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 mb-3 shadow-inner">
            {mode === 'reset' ? (
              <KeyRound className="w-7 h-7 text-teal-300" />
            ) : mode === 'verify' ? (
              <ShieldCheck className="w-7 h-7 text-teal-300" />
            ) : (
              <GraduationCap className="w-7 h-7 text-teal-300" />
            )}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">{headerTitle}</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto leading-relaxed">
            {headerSubtitle}
          </p>
        </div>

        {/* Mode Switch Tabs for Login / Register */}
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
              Sign In
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
              Create Account
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
                {remainingAttempts !== null && remainingAttempts > 0 && (
                  <div className="text-[11px] text-rose-600 dark:text-rose-400">
                    {remainingAttempts} attempt{remainingAttempts === 1 ? '' : 's'} remaining before temporary lockout.
                  </div>
                )}
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

          {/* VIEW 1: SIGN IN */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs" noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="student-login-email"
                  className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="student-login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="student@university.edu"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="student-login-password"
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
                    id="student-login-password"
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
                    <span>Sign In to Student Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>New to BIO-INEXA?</span>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="font-bold text-[#0B2A5B] dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Create a free student account &rarr;
                </button>
              </div>
            </form>
          )}

          {/* VIEW 2: REGISTER */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="student-reg-name"
                    className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="student-reg-name"
                      type="text"
                      required
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="e.g., Meera Krishnan"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="student-reg-email"
                    className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="student-reg-email"
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="name@institute.ac.in"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="student-reg-password"
                    className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="student-reg-password"
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
                    htmlFor="student-reg-confirm"
                    className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="student-reg-confirm"
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
                        <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${passed ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`} />
                        <span>{rule.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Optional Academic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="student-reg-degree"
                    className="block font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Degree / Program (Optional)
                  </label>
                  <div className="relative">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="student-reg-degree"
                      type="text"
                      value={regDegreeTitle}
                      onChange={(e) => setRegDegreeTitle(e.target.value)}
                      placeholder="e.g., M.Sc Biotechnology"
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="student-reg-institution"
                    className="block font-semibold text-slate-700 dark:text-slate-300"
                  >
                    University / Institute (Optional)
                  </label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="student-reg-institution"
                      type="text"
                      value={regInstitution}
                      onChange={(e) => setRegInstitution(e.target.value)}
                      placeholder="e.g., IISc Bengaluru"
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="student-reg-specialization"
                    className="block font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Specialization (Optional)
                  </label>
                  <div className="relative">
                    <Sparkles className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="student-reg-specialization"
                      type="text"
                      value={regSpecialization}
                      onChange={(e) => setRegSpecialization(e.target.value)}
                      placeholder="e.g., Genomics & CRISPR"
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="student-reg-gradyear"
                    className="block font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Graduation Year (Optional)
                  </label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="student-reg-gradyear"
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={regGraduationYear}
                      onChange={(e) => setRegGraduationYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="e.g., 2027"
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>
                </div>
              </div>

              {/* Privacy Consent Checkbox */}
              <div className="p-3.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-900/60">
                <label className="flex items-start gap-2.5 cursor-pointer text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  <input
                    id="student-reg-privacy"
                    type="checkbox"
                    checked={privacyConsent}
                    onChange={(e) => setPrivacyConsent(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-[#0B2A5B] focus:ring-[#0B2A5B]"
                  />
                  <span>
                    I accept the{' '}
                    <a
                      href="/privacy"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/privacy');
                      }}
                      className="font-bold text-[#0B2A5B] dark:text-sky-400 underline"
                    >
                      BIO-INEXA Privacy Policy
                    </a>
                    . I understand my student profile is stored privately by default, never exposed to other users, and I can request or execute account deletion anytime.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <span>Creating Student Account...</span>
                ) : (
                  <>
                    <span>Create Student Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* VIEW 3: EMAIL VERIFICATION */}
          {mode === 'verify' && (
            <div className="space-y-4 text-xs">
              {verifyCompleted ? (
                <div className="space-y-3 text-center py-2">
                  <p className="text-slate-600 dark:text-slate-400">
                    Your email verification is confirmed and saved to your student account.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(isStudentAuthenticated ? '/dashboard-student' : '/student/login')}
                    className="w-full py-3 px-4 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] text-white font-bold rounded-xl cursor-pointer"
                  >
                    {isStudentAuthenticated ? 'Go to Student Dashboard' : 'Continue to Sign In'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleVerifySubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="student-verify-token"
                      className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                    >
                      Verification Token
                    </label>
                    <input
                      id="student-verify-token"
                      type="text"
                      required
                      value={verifyToken}
                      onChange={(e) => setVerifyToken(e.target.value)}
                      placeholder="Paste verification token from your email"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? 'Verifying...' : 'Verify Email Address'}
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

          {/* VIEW 4: PASSWORD RESET */}
          {mode === 'reset' && (
            <div className="space-y-4 text-xs">
              {resetCompleted ? (
                <div className="space-y-3 text-center py-2">
                  <p className="text-slate-600 dark:text-slate-400">
                    Your password has been updated and all prior sessions were revoked.
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
                      htmlFor="student-reset-email"
                      className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                    >
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="student-reset-email"
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="student@university.edu"
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
                    className="w-full py-3 px-4 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 disabled:opacity-60 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? 'Generating Reset Link...' : 'Request Password Reset'}
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
                      htmlFor="student-reset-token"
                      className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                    >
                      Reset Token
                    </label>
                    <input
                      id="student-reset-token"
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
                      htmlFor="student-reset-new-password"
                      className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                    >
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="student-reset-new-password"
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
                      htmlFor="student-reset-confirm-password"
                      className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                    >
                      Confirm New Password
                    </label>
                    <input
                      id="student-reset-confirm-password"
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

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setResetStep('request')}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold cursor-pointer"
                    >
                      &larr; Request a new token
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-teal-600 dark:text-teal-400 font-semibold hover:underline cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Privacy & Security Assurance Footer */}
          <div className="pt-3 text-center text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800 leading-relaxed">
            Private student accounts are strictly isolated from administrator consoles. Passwords are stored using salted Scrypt hashes and sessions use HttpOnly cookies.
          </div>
        </div>
      </div>
    </div>
  );
};
