import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StudentAuthPage } from '../student/StudentAuthPage';
import {
  studentApi,
  StudentSessionSummary,
} from '../../services/student/studentApiClient';
import {
  User,
  Briefcase,
  BookOpen,
  Award,
  Bookmark,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Printer,
  Shield,
  LogOut,
  Mail,
  AlertTriangle,
  Monitor,
  Trash2,
  KeyRound,
  Lock,
  RefreshCw,
} from 'lucide-react';

type DashboardTab =
  | 'applications'
  | 'courses'
  | 'certificates'
  | 'saved'
  | 'profile'
  | 'security';

export const StudentDashboard: React.FC = () => {
  const {
    studentUser,
    isStudentAuthenticated,
    studentAuthLoading,
    setStudentSessionUser,
    logoutStudent,
    updateStudentProfile,
    applications,
    enrolledCourseIds,
    completedLessonIds,
    courses,
    certificates,
    savedItemIds,
    jobs,
    internships,
    currentPath,
    navigate,
    addToast,
  } = useApp();

  const resolveInitialTab = (): DashboardTab => {
    try {
      const qIndex = currentPath.indexOf('?');
      if (qIndex !== -1) {
        const params = new URLSearchParams(currentPath.slice(qIndex + 1));
        const tab = params.get('tab');
        if (
          tab === 'applications' ||
          tab === 'courses' ||
          tab === 'certificates' ||
          tab === 'saved' ||
          tab === 'profile' ||
          tab === 'security'
        ) {
          return tab;
        }
      }
    } catch {
      // ignore query parsing errors
    }
    return 'applications';
  };

  const [activeTab, setActiveTab] = useState<DashboardTab>(resolveInitialTab);

  useEffect(() => {
    setActiveTab(resolveInitialTab());
  }, [currentPath]);

  // Profile Edit state synced with authenticated database studentUser
  const [fullName, setFullName] = useState('');
  const [degreeTitle, setDegreeTitle] = useState('');
  const [institution, setInstitution] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [location, setLocation] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [orcidId, setOrcidId] = useState('');
  const [bio, setBio] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Verification banner state
  const [verifyTokenInput, setVerifyTokenInput] = useState('');
  const [devVerifyToken, setDevVerifyToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('bionexa_dev_verify_token');
    } catch {
      return null;
    }
  });
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Active sessions state
  const [sessions, setSessions] = useState<StudentSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // Account deletion request state
  const [deleteMode, setDeleteMode] = useState<'request' | 'delete_now'>('request');
  const [deleteReason, setDeleteReason] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentUser) return;
    setFullName(studentUser.fullName || '');
    setDegreeTitle(studentUser.degreeTitle || '');
    setInstitution(studentUser.institution || '');
    setSpecialization(studentUser.specialization || '');
    setGraduationYear(studentUser.graduationYear || '');
    setLocation(studentUser.location || '');
    setSkillsText(Array.isArray(studentUser.skills) ? studentUser.skills.join(', ') : '');
    setLinkedinUrl(studentUser.linkedinUrl || '');
    setOrcidId(studentUser.orcidId || '');
    setBio(studentUser.bio || '');
    if (!studentUser.emailVerified) {
      try {
        const storedToken = sessionStorage.getItem('bionexa_dev_verify_token');
        if (storedToken) {
          setDevVerifyToken(storedToken);
        }
      } catch {
        // ignore storage restrictions
      }
    } else {
      setDevVerifyToken(null);
    }
  }, [studentUser]);

  const loadSessions = async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const res = await studentApi.listSessions();
      setSessions(res.sessions || []);
    } catch (err: any) {
      setSessionsError(err?.message || 'Unable to load active sessions.');
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (isStudentAuthenticated && activeTab === 'security') {
      loadSessions();
    }
  }, [isStudentAuthenticated, activeTab]);

  // Loading state while verifying HttpOnly session cookie
  if (studentAuthLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 animate-pulse space-y-4">
          <div className="h-6 w-56 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-80 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  // Require real database-backed student authentication (zero demo fallback)
  if (!isStudentAuthenticated || !studentUser) {
    return <StudentAuthPage initialMode="login" embeddedInDashboard />;
  }

  const studentApplications = applications.filter(
    (app) => app.applicantEmail.trim().toLowerCase() === studentUser.email.trim().toLowerCase()
  );
  const enrolledCoursesList = courses.filter((c) => enrolledCourseIds.includes(c.id));
  const savedJobs = jobs.filter((j) => savedItemIds.includes(j.id));
  const savedInternships = internships.filter((i) => savedItemIds.includes(i.id));

  const initials = studentUser.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'ST';

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSaving(true);
    try {
      await updateStudentProfile({
        fullName,
        degreeTitle,
        institution,
        specialization,
        graduationYear,
        location,
        skills: skillsText,
        linkedinUrl,
        orcidId,
        bio,
      });
    } catch (err: any) {
      setProfileError(err?.message || 'Unable to update student profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleResendVerification = async () => {
    setVerifyBusy(true);
    setVerifyError(null);
    try {
      const res = await studentApi.resendVerification();
      if (res.devVerificationToken) {
        setDevVerifyToken(res.devVerificationToken);
        setVerifyTokenInput(res.devVerificationToken);
        try {
          sessionStorage.setItem('bionexa_dev_verify_token', res.devVerificationToken);
        } catch {
          // ignore
        }
      }
      addToast(res.message || 'Verification token refreshed.', 'info');
    } catch (err: any) {
      setVerifyError(err?.message || 'Unable to resend verification email.');
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleVerifyEmailToken = async (tokenOverride?: string) => {
    const tokenToUse = (tokenOverride || verifyTokenInput).trim();
    if (!tokenToUse) {
      setVerifyError('Please enter your verification token.');
      return;
    }
    setVerifyBusy(true);
    setVerifyError(null);
    try {
      const res = await studentApi.verifyEmail(tokenToUse);
      if (res.student) {
        setStudentSessionUser(res.student);
      }
      setVerifyTokenInput('');
      setDevVerifyToken(null);
      try {
        sessionStorage.removeItem('bionexa_dev_verify_token');
      } catch {
        // ignore
      }
      addToast('Email address verified successfully!', 'success');
    } catch (err: any) {
      setVerifyError(err?.message || 'Verification token is invalid or expired.');
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword) {
      setPasswordError('Please fill in both your current password and new password.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New password confirmation does not match.');
      return;
    }

    setPasswordBusy(true);
    try {
      const res = await studentApi.changePassword(currentPassword, newPassword);
      setPasswordSuccess(res.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      addToast('Password changed successfully.', 'success');
      loadSessions();
    } catch (err: any) {
      setPasswordError(err?.message || 'Unable to update password.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleRevokeSession = async (jti: string) => {
    try {
      const res = await studentApi.revokeSession(jti);
      addToast(res.message || 'Session revoked.', 'info');
      if (res.revokedCurrent) {
        setStudentSessionUser(null);
        navigate('/student/login');
      } else {
        await loadSessions();
      }
    } catch (err: any) {
      addToast(err?.message || 'Unable to revoke session.', 'error');
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      const res = await studentApi.revokeOtherSessions();
      addToast(res.message, 'success');
      await loadSessions();
    } catch (err: any) {
      addToast(err?.message || 'Unable to revoke other sessions.', 'error');
    }
  };

  const handleDeletionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      const res = await studentApi.requestAccountDeletion({
        password: deletePassword,
        confirmation: deleteConfirmation,
        reason: deleteReason,
        mode: deleteMode,
      });
      setDeletePassword('');
      setDeleteConfirmation('');
      setDeleteReason('');

      if (res.deletedImmediately) {
        setStudentSessionUser(null);
        addToast(res.message || 'Your student account has been permanently deleted.', 'info');
        navigate('/');
      } else if (res.student) {
        setStudentSessionUser(res.student);
        addToast(res.message || 'Deletion request recorded.', 'warning');
      }
    } catch (err: any) {
      setDeleteError(err?.message || 'Unable to process account deletion request.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleCancelDeletion = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await studentApi.cancelAccountDeletion();
      setStudentSessionUser(res.student);
      addToast(res.message || 'Deletion request cancelled.', 'success');
    } catch (err: any) {
      setDeleteError(err?.message || 'Unable to cancel deletion request.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleSignOut = async () => {
    await logoutStudent();
    navigate('/student/login');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Pending Account Deletion Warning Banner */}
      {studentUser.accountStatus === 'deletion_pending' && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-rose-900 dark:text-rose-200">
                Account Deletion Request Pending
              </div>
              <p className="text-rose-700 dark:text-rose-300 mt-0.5">
                Requested on{' '}
                {studentUser.deletionRequestedAt
                  ? new Date(studentUser.deletionRequestedAt).toLocaleDateString()
                  : 'recently'}
                . You may cancel this request before final erasure.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={deleteBusy}
            onClick={handleCancelDeletion}
            className="px-4 py-2 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-xl font-bold hover:bg-rose-100 dark:hover:bg-rose-950 transition-colors shrink-0 cursor-pointer"
          >
            Cancel Deletion Request
          </button>
        </div>
      )}

      {/* Email Verification Prompt Banner */}
      {!studentUser.emailVerified && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/70 space-y-3 text-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-950 dark:text-amber-200">
                  Verify Your Email Address ({studentUser.email})
                </div>
                <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                  Confirm ownership of your email address to protect password recovery and account notices.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {devVerifyToken && (
                <button
                  type="button"
                  disabled={verifyBusy}
                  onClick={() => handleVerifyEmailToken(devVerifyToken)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Verify Email Now
                </button>
              )}
              <button
                type="button"
                disabled={verifyBusy}
                onClick={handleResendVerification}
                className="px-3.5 py-2 bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 font-bold rounded-xl hover:bg-amber-100/60 transition-colors cursor-pointer"
              >
                Resend Verification Token
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <input
              type="text"
              aria-label="Email verification token"
              value={verifyTokenInput}
              onChange={(e) => setVerifyTokenInput(e.target.value)}
              placeholder="Paste verification token here..."
              className="flex-1 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs"
            />
            <button
              type="button"
              disabled={verifyBusy || !verifyTokenInput.trim()}
              onClick={() => handleVerifyEmailToken()}
              className="px-4 py-2 bg-[#0B2A5B] hover:bg-blue-900 disabled:opacity-50 text-white font-bold rounded-xl transition-colors cursor-pointer"
            >
              Confirm Token
            </button>
          </div>
          {verifyError && (
            <div className="text-rose-600 dark:text-rose-400 font-semibold">{verifyError}</div>
          )}
        </div>
      )}

      {/* Profile Header Card (Preserving Existing Visual Layout) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#0B2A5B] to-[#14A3A0] text-white font-bold text-xl flex items-center justify-center border-2 border-teal-500/30 shrink-0 shadow-xs">
            {initials}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                {studentUser.fullName}
              </h1>
              <span className="text-[10px] uppercase font-bold text-teal-700 bg-teal-50 dark:bg-teal-950/60 dark:text-teal-300 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                Student / Scholar
              </span>
              {studentUser.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" /> Email Verified
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                  Verification Pending
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                <Lock className="w-2.5 h-2.5" /> Private Profile
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {studentUser.degreeTitle || 'Biotechnology Student'}
              {studentUser.institution ? (
                <>
                  {' '}
                  · <span className="text-slate-500">{studentUser.institution}</span>
                </>
              ) : null}
              {studentUser.specialization ? (
                <>
                  {' '}
                  · <span className="text-teal-700 dark:text-teal-400 font-medium">{studentUser.specialization}</span>
                </>
              ) : null}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {studentUser.email}
              {studentUser.location ? ` · ${studentUser.location}` : ''}
            </p>
          </div>
        </div>

        {/* Quick KPI stats + Sign Out */}
        <div className="flex flex-wrap items-center gap-5 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-6 text-center text-xs">
          <div>
            <div className="text-xl font-bold font-mono text-[#0B2A5B] dark:text-sky-300">
              {studentApplications.length}
            </div>
            <div className="text-slate-500 mt-0.5">Applications</div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-teal-600">
              {enrolledCoursesList.length}
            </div>
            <div className="text-slate-500 mt-0.5">Courses</div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-amber-600">
              {certificates.length}
            </div>
            <div className="text-slate-500 mt-0.5">Certificates</div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="ml-auto md:ml-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs">
        {(
          [
            ['applications', `My Applications (${studentApplications.length})`, Briefcase],
            ['courses', `Enrolled Courses (${enrolledCoursesList.length})`, BookOpen],
            ['certificates', `Verifiable Certificates (${certificates.length})`, Award],
            ['saved', `Saved Items (${savedJobs.length + savedInternships.length})`, Bookmark],
            ['profile', 'Edit Profile & Skills', User],
            ['security', 'Security, Sessions & Privacy', Shield],
          ] as const
        ).map(([tabKey, label, Icon]) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setActiveTab(tabKey)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${
              activeTab === tabKey
                ? 'bg-[#0B2A5B] text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: APPLICATIONS */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Active Application Tracking
          </h2>

          {studentApplications.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs space-y-3">
              <p>You haven&apos;t submitted any job or internship applications yet.</p>
              <button
                type="button"
                onClick={() => navigate('/jobs')}
                className="px-4 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-lg transition-colors cursor-pointer"
              >
                Explore Biotech Jobs &rarr;
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {studentApplications.map((app) => (
                <div key={app.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {app.jobTitle}
                    </div>
                    <div className="text-slate-500 mt-1">
                      Organization: <strong className="text-slate-700 dark:text-slate-300">{app.company}</strong> · Submitted: {app.appliedDate}
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mt-1 line-clamp-1 italic">
                      Cover note: &ldquo;{app.coverNote}&rdquo;
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        app.status === 'Shortlisted'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : app.status === 'Interview Scheduled'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : app.status === 'Rejected'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ENROLLED COURSES */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Academy Courses &amp; Progress
          </h2>

          {enrolledCoursesList.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs space-y-3">
              <p>You have not enrolled in any courses yet.</p>
              <button
                type="button"
                onClick={() => navigate('/courses')}
                className="px-4 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-lg transition-colors cursor-pointer"
              >
                Browse Biotechnology Courses &rarr;
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {enrolledCoursesList.map((course) => {
                const completedInThisCourse = course.lessons.filter((l) => completedLessonIds.includes(l.id)).length;
                const percent = course.lessons.length > 0 ? Math.round((completedInThisCourse / course.lessons.length) * 100) : 0;

                return (
                  <div
                    key={course.id}
                    className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs"
                  >
                    <div>
                      <span className="text-[11px] font-semibold text-teal-600 uppercase tracking-wider block">
                        {course.category}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {course.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Instructor: {course.instructor}</p>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                        <span>Curriculum Progress</span>
                        <span className="font-mono font-bold text-[#0B2A5B] dark:text-sky-300">{percent}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${percent}%` }} />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-400">{completedInThisCourse} of {course.lessons.length} lessons finished</span>
                      <button
                        type="button"
                        onClick={() => navigate(`/courses?id=${course.id}`)}
                        className="px-3.5 py-1.5 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Resume Learning &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CERTIFICATES */}
      {activeTab === 'certificates' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Issued Official Certificates
          </h2>

          {certificates.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs space-y-3">
              <p>No certificates issued for your account yet.</p>
              <button
                type="button"
                onClick={() => navigate('/verify-certificate')}
                className="px-4 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-lg transition-colors cursor-pointer"
              >
                Open Certificate Verification Registry &rarr;
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="bg-white dark:bg-slate-900 p-6 rounded-2xl border-2 border-emerald-500/40 space-y-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      <span>BIO-INEXA Academy Credential</span>
                    </div>
                    <span className="font-mono text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded border border-emerald-200 dark:border-emerald-800">
                      Score: {cert.score}%
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {cert.courseTitle}
                    </h3>
                    <div className="text-xs text-slate-500 mt-1">
                      Recipient: <strong className="text-slate-800 dark:text-slate-200">{cert.recipientName}</strong>
                    </div>
                    <div className="text-xs text-slate-500">Issued On: {cert.issueDate}</div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-400">
                    ID: <strong className="text-slate-900 dark:text-slate-100">{cert.certificateNumber}</strong>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => navigate(`/verify-certificate?id=${cert.certificateNumber}`)}
                      className="font-bold text-teal-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Check Public Registry</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg font-semibold cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SAVED ITEMS */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Bookmarked Opportunities
          </h2>

          {savedJobs.length === 0 && savedInternships.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs space-y-3">
              <p>You haven&apos;t bookmarked any jobs or internships yet.</p>
              <button
                type="button"
                onClick={() => navigate('/opportunities')}
                className="px-4 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-lg transition-colors cursor-pointer"
              >
                Discover Opportunities &rarr;
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedJobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="text-left p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 cursor-pointer text-xs space-y-1 transition-colors"
                >
                  <span className="font-semibold text-blue-600">{job.company}</span>
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{job.title}</div>
                  <div className="text-slate-500">{job.location} · {job.salary}</div>
                </button>
              ))}

              {savedInternships.map((intern) => (
                <button
                  key={intern.id}
                  type="button"
                  onClick={() => navigate(`/internships?id=${intern.id}`)}
                  className="text-left p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-teal-400 cursor-pointer text-xs space-y-1 transition-colors"
                >
                  <span className="font-semibold text-teal-600">{intern.organization}</span>
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{intern.title}</div>
                  <div className="text-slate-500">{intern.duration} · {intern.stipend}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PROFILE EDIT (DATABASE-BACKED) */}
      {activeTab === 'profile' && (
        <div className="max-w-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Update Profile &amp; Scientific Credentials
              </h2>
              <p className="text-slate-500 mt-0.5">
                Stored privately in the BIO-INEXA database. Never shared publicly with other students.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Account ID: {studentUser.id}
            </span>
          </div>

          {profileError && (
            <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-semibold">
              {profileError}
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-fullname" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  id="profile-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="profile-degree" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Degree / Title
                </label>
                <input
                  id="profile-degree"
                  type="text"
                  value={degreeTitle}
                  onChange={(e) => setDegreeTitle(e.target.value)}
                  placeholder="e.g., M.Sc Biotechnology"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="profile-institution" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  University / Research Institute
                </label>
                <input
                  id="profile-institution"
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g., CSIR-CCMB / Pune University"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="profile-specialization" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Specialization / Research Domain
                </label>
                <input
                  id="profile-specialization"
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g., Molecular Biology & Bioprocess"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="profile-gradyear" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Graduation Year
                </label>
                <input
                  id="profile-gradyear"
                  type="text"
                  maxLength={4}
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="2027"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="profile-location" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  City / Location
                </label>
                <input
                  id="profile-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Bengaluru, Karnataka"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="profile-linkedin" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  LinkedIn Profile URL (Optional)
                </label>
                <input
                  id="profile-linkedin"
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/in/your-profile"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="profile-orcid" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ORCID iD (Optional)
                </label>
                <input
                  id="profile-orcid"
                  type="text"
                  value={orcidId}
                  onChange={(e) => setOrcidId(e.target.value)}
                  placeholder="0000-0002-1825-0097"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="profile-skills" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Technical &amp; Lab Skills (comma-separated, up to 20)
              </label>
              <input
                id="profile-skills"
                type="text"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder="RT-qPCR, CRISPR sgRNA Design, Python for Bioinformatics, HPLC"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              {studentUser.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {studentUser.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[11px] font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="profile-bio" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Research Bio / Statement
              </label>
              <textarea
                id="profile-bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Briefly describe your laboratory experience, thesis topic, or target biotech career path."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={profileSaving}
                className="px-5 py-2.5 bg-[#0B2A5B] hover:bg-blue-900 disabled:opacity-60 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                {profileSaving ? 'Saving Profile...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 6: SECURITY, SESSIONS & PRIVACY */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          {/* Active Sessions Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-[#0B2A5B] dark:text-sky-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Active Sessions
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadSessions}
                  aria-label="Refresh active sessions"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} />
                </button>
                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={handleRevokeOtherSessions}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-700 text-slate-700 dark:text-slate-200 font-semibold transition-colors cursor-pointer"
                  >
                    Sign Out Other Devices
                  </button>
                )}
              </div>
            </div>

            <p className="text-slate-500">
              IP addresses are masked for privacy. You can revoke any active browser session immediately.
            </p>

            {sessionsError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
                {sessionsError}
              </div>
            )}

            {sessionsLoading ? (
              <div className="py-6 text-center text-slate-400">Loading active sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="py-6 text-center text-slate-400">No active sessions found.</div>
            ) : (
              <div className="space-y-2.5">
                {sessions.map((sess) => (
                  <div
                    key={sess.jti}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          {sess.userAgent.slice(0, 64) || 'Web Browser Session'}
                        </span>
                        {sess.isCurrent && (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold shrink-0">
                            Current Device
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        IP: {sess.ipAddressMasked} · Last active:{' '}
                        {new Date(sess.lastActiveAt).toLocaleString()}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRevokeSession(sess.jti)}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-semibold shrink-0 cursor-pointer"
                    >
                      {sess.isCurrent ? 'Sign Out' : 'Revoke'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Change Password Card */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-teal-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Change Account Password
              </h2>
            </div>

            {passwordError && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-semibold">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div role="status" className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 font-semibold">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label htmlFor="sec-current-pw" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Password
                </label>
                <input
                  id="sec-current-pw"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="sec-new-pw" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  id="sec-new-pw"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars, upper, lower, number, symbol"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="sec-confirm-pw" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  id="sec-confirm-pw"
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <button
                type="submit"
                disabled={passwordBusy}
                className="px-4 py-2.5 bg-[#0B2A5B] hover:bg-blue-900 disabled:opacity-60 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                {passwordBusy ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* Privacy & Account Deletion Request Card (Full Width) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-rose-200/80 dark:border-rose-900/60 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Privacy Controls &amp; Account Deletion Request (DPDP)
                </h2>
              </div>
              <span className="text-[11px] text-slate-500">
                Consent recorded: {new Date(studentUser.privacyConsentAt).toLocaleDateString()}
              </span>
            </div>

            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Your account follows data-minimization and private-by-default safeguards. Student records are never accessible to other users, and student accounts are strictly isolated from administrator endpoints. You may submit a cancellable deletion request or permanently erase your account immediately.
            </p>

            {deleteError && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-semibold">
                {deleteError}
              </div>
            )}

            {studentUser.accountStatus === 'deletion_pending' ? (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-rose-900 dark:text-rose-200">
                    Deletion Request Active
                  </div>
                  <p className="text-rose-700 dark:text-rose-300 mt-0.5">
                    {studentUser.deletionReason ? `Reason: ${studentUser.deletionReason}` : 'Your account is queued for erasure.'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={handleCancelDeletion}
                  className="px-4 py-2 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold rounded-xl hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  Cancel Pending Request
                </button>
              </div>
            ) : (
              <form onSubmit={handleDeletionSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3.5 rounded-xl border cursor-pointer transition-colors ${deleteMode === 'request' ? 'border-[#0B2A5B] bg-slate-50 dark:bg-slate-800' : 'border-slate-200 dark:border-slate-800'}`}>
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                      <input
                        type="radio"
                        name="deletionMode"
                        value="request"
                        checked={deleteMode === 'request'}
                        onChange={() => setDeleteMode('request')}
                      />
                      <span>Submit Deletion Request (Cancellable)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 pl-5">
                      Marks your account as deletion pending under DPDP controls. You can cancel anytime before processing.
                    </p>
                  </label>

                  <label className={`p-3.5 rounded-xl border cursor-pointer transition-colors ${deleteMode === 'delete_now' ? 'border-rose-600 bg-rose-50/50 dark:bg-rose-950/30' : 'border-slate-200 dark:border-slate-800'}`}>
                    <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                      <input
                        type="radio"
                        name="deletionMode"
                        value="delete_now"
                        checked={deleteMode === 'delete_now'}
                        onChange={() => setDeleteMode('delete_now')}
                      />
                      <span>Permanently Delete Account Now</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 pl-5">
                      Immediately erases your student account profile and revokes all active sessions. This cannot be undone.
                    </p>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="del-reason" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Reason (Optional)
                    </label>
                    <input
                      id="del-reason"
                      type="text"
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      placeholder="e.g., Completed studies"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="del-password" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Current Password <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="del-password"
                      type="password"
                      required
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="del-confirm" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Type <span className="font-mono text-rose-600">DELETE</span> to Confirm
                    </label>
                    <input
                      id="del-confirm"
                      type="text"
                      required
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder="DELETE"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={deleteBusy}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    {deleteBusy
                      ? 'Processing...'
                      : deleteMode === 'delete_now'
                      ? 'Permanently Delete My Account'
                      : 'Submit Account Deletion Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
