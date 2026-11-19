import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Search,
  Moon,
  Sun,
  Menu,
  X,
  ChevronDown,
  UserCheck,
  Shield,
  Building2,
  LogIn,
  UserPlus,
  LogOut,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    currentPath,
    navigate,
    setIsSearchOpen,
    studentUser,
    isStudentAuthenticated,
    logoutStudent,
    companyUser,
    isCompanyAuthenticated,
    logoutCompany,
    darkMode,
    toggleDarkMode,
  } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  const navLinks = [
    { label: 'Opportunities', path: '/opportunities' },
    { label: 'Jobs', path: '/jobs' },
    { label: 'Internships', path: '/internships' },
    { label: 'Workshops', path: '/workshops' },
    { label: 'Courses', path: '/courses' },
    { label: 'Exams', path: '/exams' },
    { label: 'Scholarships', path: '/scholarships' },
    { label: 'Research', path: '/research' },
    { label: 'Guidance', path: '/career-guidance' },
    { label: 'News', path: '/news' },
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
    setAccountDropdownOpen(false);
  };

  const handleSignOut = async () => {
    setAccountDropdownOpen(false);
    setMobileMenuOpen(false);
    await logoutStudent();
    navigate('/');
  };

  const handleCompanySignOut = async () => {
    setAccountDropdownOpen(false);
    setMobileMenuOpen(false);
    await logoutCompany();
    navigate('/');
  };

  const studentInitials = studentUser?.fullName
    ? studentUser.fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('')
    : 'ST';

  const companyInitials = companyUser?.organizationName
    ? companyUser.organizationName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('')
    : 'CO';

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 sm:gap-4 h-16">
          {/* Zone 1: Single Brand element */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('/');
            }}
            className="flex items-center gap-2 whitespace-nowrap shrink-0 group focus:outline-none"
            aria-label="BIO-INEXA Home"
          >
            <img
              src="/assets/aistudio/LOGO_2306a641.jpeg"
              alt="BIO-INEXA Official Logo"
              className="h-9 w-auto object-contain rounded-xs shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="flex flex-col">
              <span className="text-lg xl:text-xl font-bold tracking-tight text-[#0B2A5B] dark:text-sky-300">
                BIO-INEXA
              </span>
              <span className="text-[9px] uppercase tracking-wider font-semibold text-[#14A3A0] hidden 2xl:inline-block">
                Connecting Science · Creating Careers
              </span>
            </div>
          </a>

          {/* Zone 2: Single-line text navigation links */}
          <nav className="hidden lg:flex items-center gap-2.5 xl:gap-3.5 text-[13px] font-medium text-slate-700 dark:text-slate-300">
            {navLinks.map((item) => {
              const isActive = currentPath.startsWith(item.path);
              return (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(item.path);
                  }}
                  className={`relative py-1 whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'text-[#0B2A5B] dark:text-sky-400 font-semibold'
                      : 'hover:text-[#14A3A0] dark:hover:text-teal-300'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#14A3A0] rounded-full" />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Zone 3: Search, Theme & Authentic Account Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Search Trigger */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
              title="Global Search (Ctrl+K)"
              aria-label="Global Search"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden 2xl:inline-block text-[10px] font-mono bg-white dark:bg-slate-900 text-slate-400 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                ⌘K
              </kbd>
            </button>

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Student / Employer Account & Portal Access Menu */}
            <div className="relative">
              {isStudentAuthenticated && studentUser ? (
                <button
                  onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                  aria-label="Student account menu"
                  aria-expanded={accountDropdownOpen}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/50 rounded-lg border border-teal-200 dark:border-teal-800 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-md bg-[#0B2A5B] text-white text-[10px] font-bold flex items-center justify-center">
                    {studentInitials}
                  </span>
                  <span className="hidden md:inline max-w-[110px] truncate">{studentUser.fullName}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
              ) : isCompanyAuthenticated && companyUser ? (
                <button
                  onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                  aria-label="Employer account menu"
                  aria-expanded={accountDropdownOpen}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded-lg border border-sky-200 dark:border-sky-800 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-md bg-[#0B2A5B] text-white text-[10px] font-bold flex items-center justify-center">
                    {companyInitials}
                  </span>
                  <span className="hidden md:inline max-w-[120px] truncate">{companyUser.organizationName}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
              ) : (
                <button
                  onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                  aria-label="Account sign in and portals menu"
                  aria-expanded={accountDropdownOpen}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0B2A5B] hover:bg-blue-900 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-teal-300" />
                  <span className="hidden sm:inline">Sign In</span>
                  <ChevronDown className="w-3 h-3 text-sky-200" />
                </button>
              )}

              {accountDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                >
                  {isStudentAuthenticated && studentUser ? (
                    <>
                      <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 space-y-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {studentUser.fullName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{studentUser.email}</p>
                        <div className="pt-0.5">
                          {studentUser.emailVerified ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3" /> Email Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                              <AlertCircle className="w-3 h-3" /> Verification Pending
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="py-1">
                        <button
                          onClick={() => handleNavClick('/dashboard-student')}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <GraduationCap className="w-3.5 h-3.5 text-teal-600" />
                          <span>Student Dashboard</span>
                        </button>
                        <button
                          onClick={() => handleNavClick('/dashboard-student?tab=security')}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-[#0B2A5B] dark:text-sky-400" />
                          <span>Profile &amp; Account Security</span>
                        </button>
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-800 pt-1 mt-1">
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-left text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </>
                  ) : isCompanyAuthenticated && companyUser ? (
                    <>
                      <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 space-y-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {companyUser.organizationName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{companyUser.email}</p>
                        <div className="pt-0.5 flex flex-wrap gap-1">
                          {companyUser.verificationStatus === 'verified' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3" /> Verified Employer
                            </span>
                          ) : companyUser.verificationStatus === 'pending_review' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded">
                              <AlertCircle className="w-3 h-3" /> Under Review
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                              <AlertCircle className="w-3 h-3" /> Unverified Employer
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="py-1">
                        <button
                          onClick={() => handleNavClick('/dashboard-company')}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Building2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>Employer Dashboard</span>
                        </button>
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-800 pt-1 mt-1">
                        <button
                          onClick={handleCompanySignOut}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-left text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out Employer</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Student Account
                        </p>
                      </div>
                      <div className="py-1">
                        <button
                          onClick={() => handleNavClick('/student/login')}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-left text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <LogIn className="w-3.5 h-3.5 text-teal-600" />
                          <span>Student Sign In</span>
                        </button>
                        <button
                          onClick={() => handleNavClick('/student/register')}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5 text-[#0B2A5B] dark:text-sky-400" />
                          <span>Create Student Account</span>
                        </button>
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-800 pt-1 mt-1">
                        <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Employer &amp; Institutional Portals
                        </div>
                        <button
                          onClick={() => handleNavClick('/company/login')}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-left text-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Building2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>Employer Sign In</span>
                        </button>
                        <button
                          onClick={() => handleNavClick('/company/register')}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5 text-teal-600" />
                          <span>Register Organization</span>
                        </button>
                        <button
                          onClick={() => handleNavClick('/admin')}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Shield className="w-3.5 h-3.5 text-rose-600" />
                          <span>Admin Console</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Mobile menu hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              aria-label="Toggle mobile navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((item) => (
            <a
              key={item.path}
              href={item.path}
              onClick={(e) => {
                e.preventDefault();
                handleNavClick(item.path);
              }}
              className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                currentPath.startsWith(item.path)
                  ? 'bg-teal-50 dark:bg-slate-800 text-[#0B2A5B] dark:text-sky-300 font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {item.label}
            </a>
          ))}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mt-2 flex flex-col gap-1">
            {isStudentAuthenticated && studentUser ? (
              <>
                <button
                  onClick={() => handleNavClick('/dashboard-student')}
                  className="text-left px-3 py-2 text-xs font-semibold text-[#0B2A5B] dark:text-sky-300"
                >
                  Student Dashboard ({studentUser.fullName})
                </button>
                <button
                  onClick={handleSignOut}
                  className="text-left px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400"
                >
                  Sign Out
                </button>
              </>
            ) : isCompanyAuthenticated && companyUser ? (
              <>
                <button
                  onClick={() => handleNavClick('/dashboard-company')}
                  className="text-left px-3 py-2 text-xs font-semibold text-[#0B2A5B] dark:text-sky-300"
                >
                  Employer Portal ({companyUser.organizationName})
                </button>
                <button
                  onClick={handleCompanySignOut}
                  className="text-left px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400"
                >
                  Sign Out Employer
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleNavClick('/student/login')}
                  className="text-left px-3 py-2 text-xs font-semibold text-[#0B2A5B] dark:text-sky-300"
                >
                  Student Sign In
                </button>
                <button
                  onClick={() => handleNavClick('/student/register')}
                  className="text-left px-3 py-2 text-xs font-semibold text-teal-700 dark:text-teal-300"
                >
                  Create Student Account
                </button>
                <button
                  onClick={() => handleNavClick('/company/login')}
                  className="text-left px-3 py-2 text-xs font-semibold text-blue-700 dark:text-sky-300"
                >
                  Employer Sign In
                </button>
                <button
                  onClick={() => handleNavClick('/company/register')}
                  className="text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Register Organization
                </button>
              </>
            )}
            <button
              onClick={() => handleNavClick('/verify-certificate')}
              className="text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              Verify Certificate
            </button>
            <button
              onClick={() => handleNavClick('/about')}
              className="text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              About BIO-INEXA
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
