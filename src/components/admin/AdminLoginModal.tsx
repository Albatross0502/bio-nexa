import React, { useState } from 'react';
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  ShieldAlert
} from 'lucide-react';
import { adminApi, AdminUser } from '../../services/admin/adminApiClient';

interface AdminLoginModalProps {
  onSuccess: (user: AdminUser) => void;
  onCancel?: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ onSuccess, onCancel }) => {
  const [username, setUsername] = useState('admin@bionexa.org');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [retryAfterSec, setRetryAfterSec] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await adminApi.login(username.trim(), password);
      onSuccess(response.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
      if (err.remainingAttempts !== undefined) {
        setRemainingAttempts(err.remainingAttempts);
      }
      if (err.retryAfterSec !== undefined) {
        setRetryAfterSec(err.retryAfterSec);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-slate-950 via-[#0B2A5B] to-slate-950 p-6 text-white text-center relative overflow-hidden">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 mb-3 shadow-inner">
            <Shield className="w-7 h-7 text-teal-300" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            BIO-NEXA Operations Portal
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
            Restricted administrative area. Server-side session verification required.
          </p>
        </div>

        {/* Login Form Body */}
        <div className="p-6 sm:p-8 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="space-y-0.5 flex-1">
                <div className="font-bold">{errorMsg}</div>
                {remainingAttempts !== null && remainingAttempts > 0 && (
                  <div className="text-[11px] text-rose-600 dark:text-rose-400">
                    {remainingAttempts} attempt{remainingAttempts === 1 ? '' : 's'} remaining before temporary account lockout.
                  </div>
                )}
                {retryAfterSec && retryAfterSec > 0 && (
                  <div className="text-[11px] font-mono text-rose-700 dark:text-rose-300">
                    Rate limit triggered. Retry in {retryAfterSec}s.
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Username / Email */}
            <div className="space-y-1.5">
              <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Administrator Username / Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin@bionexa.org"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Master Password
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Server Scrypt Protected</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password..."
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0B2A5B]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Security Notice Box */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                <KeyRound className="w-3.5 h-3.5 text-teal-600" />
                <span>Default Access Note:</span>
              </div>
              <p>
                Default master username is <code className="font-mono text-slate-800 dark:text-slate-200 font-bold">admin@bionexa.org</code>. Password configured via server environment.
              </p>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={isLoading || (retryAfterSec !== null && retryAfterSec > 0)}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <span>Authenticating Session...</span>
              ) : (
                <>
                  <span>Sign In to Admin Console</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full py-2 text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Return to Public Website
              </button>
            )}
          </form>

          {/* Legal / Access Logging Disclosure */}
          <div className="pt-2 text-center text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
            Protected under Section 6 &amp; 11 Access Control Standards. All logins are audited with rate-limiting abuse protection.
          </div>
        </div>
      </div>
    </div>
  );
};
