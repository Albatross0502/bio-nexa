import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Moon, Sun, Menu, X, ChevronDown, UserCheck, Shield, Building2 } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentPath, navigate, setIsSearchOpen, currentUser, switchRole, darkMode, toggleDarkMode } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

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
    { label: 'News', path: '/news' }
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const getRoleIcon = () => {
    if (currentUser.role === 'admin') return <Shield className="w-3.5 h-3.5 text-rose-500" />;
    if (currentUser.role === 'company') return <Building2 className="w-3.5 h-3.5 text-blue-500" />;
    return <UserCheck className="w-3.5 h-3.5 text-teal-500" />;
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single Brand element */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('/');
            }}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 group focus:outline-none"
            aria-label="BIO-NEXA Home"
          >
            <img
              src="/assets/img/logo.jpeg"
              alt="BIO-NEXA Official Logo"
              className="h-10 w-auto object-contain rounded-xs"
              onError={(e) => {
                // Fallback if image path differs
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-[#0B2A5B] dark:text-sky-300">
                BIO-NEXA
              </span>
              <span className="text-[9px] uppercase tracking-wider font-semibold text-[#14A3A0] hidden sm:inline-block">
                Connecting Science · Creating Careers
              </span>
            </div>
          </a>

          {/* Zone 2: Single-line text navigation links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-700 dark:text-slate-300">
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

          {/* Zone 3: 1 primary action & utility controls */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Search Trigger */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
              title="Global Search (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden md:inline-block text-[10px] font-mono bg-white dark:bg-slate-900 text-slate-400 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                ⌘K
              </kbd>
            </button>

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Active User / Role Switcher Menu */}
            <div className="relative">
              <button
                onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
              >
                {getRoleIcon()}
                <span className="hidden md:inline capitalize">{currentUser.role} View</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {roleDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                  onClick={() => setRoleDropdownOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {currentUser.name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                  </div>

                  <div className="py-1">
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Switch Role View
                    </div>
                    <button
                      onClick={() => switchRole('student')}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${
                        currentUser.role === 'student'
                          ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                      <span>Student / Scholar</span>
                    </button>
                    <button
                      onClick={() => switchRole('company')}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${
                        currentUser.role === 'company'
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Company Recruiter</span>
                    </button>
                    <button
                      onClick={() => switchRole('admin')}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left ${
                        currentUser.role === 'admin'
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5 text-rose-600" />
                      <span>Admin Control Panel</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-1 mt-1">
                    <button
                      onClick={() => {
                        if (currentUser.role === 'admin') navigate('/admin');
                        else if (currentUser.role === 'company') navigate('/dashboard-company');
                        else navigate('/dashboard-student');
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[#0B2A5B] dark:text-sky-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Go to Dashboard &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
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
              About BIO-NEXA
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
