import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  User,
  Briefcase,
  GraduationCap,
  BookOpen,
  Award,
  Bookmark,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Printer
} from 'lucide-react';

export const StudentDashboard: React.FC = () => {
  const {
    currentUser,
    updateUserProfile,
    applications,
    enrolledCourseIds,
    completedLessonIds,
    courses,
    certificates,
    savedItemIds,
    jobs,
    internships,
    navigate
  } = useApp();

  const [activeTab, setActiveTab] = useState<'applications' | 'courses' | 'certificates' | 'saved' | 'profile'>('applications');

  // Profile Edit state
  const [name, setName] = useState(currentUser.name);
  const [title, setTitle] = useState(currentUser.title || '');
  const [institution, setInstitution] = useState(currentUser.institution || '');
  const [bio, setBio] = useState(currentUser.bio || '');

  const enrolledCoursesList = courses.filter((c) => enrolledCourseIds.includes(c.id));
  const savedJobs = jobs.filter((j) => savedItemIds.includes(j.id));
  const savedInternships = internships.filter((i) => savedItemIds.includes(i.id));

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({ name, title, institution, bio });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Profile Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <img
            src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80'}
            alt={currentUser.name}
            className="w-16 h-16 rounded-xl object-cover border-2 border-teal-500/30"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                {currentUser.name}
              </h1>
              <span className="text-[10px] uppercase font-bold text-teal-700 bg-teal-50 dark:bg-teal-950/60 dark:text-teal-300 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                Student / Scholar
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {currentUser.title} · <span className="text-slate-500">{currentUser.institution}</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{currentUser.email}</p>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-6 text-center text-xs">
          <div>
            <div className="text-xl font-bold font-mono text-[#0B2A5B] dark:text-sky-300">
              {applications.length}
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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs">
        {(
          [
            ['applications', `My Applications (${applications.length})`, Briefcase],
            ['courses', `Enrolled Courses (${enrolledCoursesList.length})`, BookOpen],
            ['certificates', `Verifiable Certificates (${certificates.length})`, Award],
            ['saved', `Saved Items (${savedJobs.length + savedInternships.length})`, Bookmark],
            ['profile', 'Edit Profile & Skills', User]
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

      {/* TAB 1: APPLICATIONS */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Active Application Tracking
          </h2>

          {applications.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
              You haven&apos;t submitted any job or internship applications yet.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {applications.map((app) => (
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {enrolledCoursesList.map((course) => {
              const completedInThisCourse = course.lessons.filter((l) => completedLessonIds.includes(l.id)).length;
              const percent = Math.round((completedInThisCourse / course.lessons.length) * 100);

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

                  {/* Progress bar */}
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
                      onClick={() => navigate(`/courses?id=${course.id}`)}
                      className="px-3.5 py-1.5 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-lg transition-colors"
                    >
                      Resume Learning &rarr;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: CERTIFICATES */}
      {activeTab === 'certificates' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Issued Official Certificates
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="bg-white dark:bg-slate-900 p-6 rounded-2xl border-2 border-emerald-500/40 space-y-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <span>BIO-NEXA Academy Credential</span>
                  </div>
                  <span className="font-mono text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded border border-emerald-200 dark:border-emerald-800">
                    Score: {cert.score}%
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {cert.courseTitle}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1">Recipient: <strong className="text-slate-800 dark:text-slate-200">{cert.recipientName}</strong></div>
                  <div className="text-xs text-slate-500">Issued On: {cert.issueDate}</div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-400">
                  ID: <strong className="text-slate-900 dark:text-slate-100">{cert.certificateNumber}</strong>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs">
                  <button
                    onClick={() => navigate(`/verify-certificate?id=${cert.certificateNumber}`)}
                    className="font-bold text-teal-600 hover:underline flex items-center gap-1"
                  >
                    <span>Check Public Registry</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg font-semibold"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: SAVED ITEMS */}
      {activeTab === 'saved' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Bookmarked Opportunities
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => navigate(`/jobs?id=${job.id}`)}
                className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 cursor-pointer text-xs space-y-1 transition-colors"
              >
                <span className="font-semibold text-blue-600">{job.company}</span>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{job.title}</div>
                <div className="text-slate-500">{job.location} · {job.salary}</div>
              </div>
            ))}

            {savedInternships.map((intern) => (
              <div
                key={intern.id}
                onClick={() => navigate(`/internships?id=${intern.id}`)}
                className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-teal-400 cursor-pointer text-xs space-y-1 transition-colors"
              >
                <span className="font-semibold text-teal-600">{intern.organization}</span>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{intern.title}</div>
                <div className="text-slate-500">{intern.duration} · {intern.stipend}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: PROFILE EDIT */}
      {activeTab === 'profile' && (
        <div className="max-w-2xl bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Update Profile &amp; Scientific Credentials
          </h2>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Current Degree / Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                University / Research Institute
              </label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Research Bio / Statement
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
