import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  AlertTriangle, 
  ArrowLeft, 
  Briefcase, 
  Home, 
  Search, 
  Compass, 
  BookOpen,
  GraduationCap
} from 'lucide-react';

interface NotFoundPageProps {
  title?: string;
  message?: string;
  requestedResource?: string;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  title = '404 - Page Not Found',
  message = "The scientific resource, job listing, or page you requested could not be found or may have been moved.",
  requestedResource
}) => {
  const { navigate, currentPath } = useApp();
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/opportunities?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/jobs');
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="max-w-2xl w-full text-center space-y-8 bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl">
        {/* Status Badge & Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 mx-auto shadow-inner">
          <AlertTriangle className="w-10 h-10" />
        </div>

        <div className="space-y-3">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
            HTTP Error 404 · Unresolved Destination
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed">
            {message}
          </p>
          {requestedResource && (
            <div className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300">
              Identifier: {requestedResource}
            </div>
          )}
        </div>

        {/* Search Bar for Quick Recovery */}
        <form onSubmit={handleSearch} className="max-w-md mx-auto flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search biotech jobs, CSIR labs, or topics..."
              className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold text-xs rounded-xl transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            Find
          </button>
        </form>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Briefcase className="w-4 h-4" />
            <span>Browse All Biotech Jobs</span>
          </button>

          <button
            onClick={() => navigate('/opportunities')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 font-semibold text-xs transition-colors cursor-pointer"
          >
            <Compass className="w-4 h-4 text-sky-500" />
            <span>Opportunities Hub</span>
          </button>

          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return to Homepage</span>
          </button>
        </div>

        {/* Quick Links Footer */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
          <span className="font-medium text-slate-400">Popular Sections:</span>
          <button onClick={() => navigate('/internships')} className="hover:text-sky-600 dark:hover:text-sky-400 hover:underline">
            Internships
          </button>
          <span>·</span>
          <button onClick={() => navigate('/courses')} className="hover:text-sky-600 dark:hover:text-sky-400 hover:underline">
            Academy Courses
          </button>
          <span>·</span>
          <button onClick={() => navigate('/exams')} className="hover:text-sky-600 dark:hover:text-sky-400 hover:underline">
            CSIR / GATE Exams
          </button>
          <span>·</span>
          <button onClick={() => navigate('/contact')} className="hover:text-sky-600 dark:hover:text-sky-400 hover:underline">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
};
