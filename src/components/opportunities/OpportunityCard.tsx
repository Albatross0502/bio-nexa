import React from 'react';
import { 
  Building2, 
  MapPin, 
  Briefcase, 
  Calendar, 
  Clock, 
  ExternalLink, 
  Bookmark, 
  BookmarkCheck, 
  CheckCircle2, 
  AlertTriangle,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Send,
  BookOpen,
  Award,
  Layers
} from 'lucide-react';
import { Opportunity } from '../../types/opportunity';
import { EDUCATIONAL_BRANCHES } from '../../config/branches';
import { getDaysUntilDeadline } from '../../services/opportunities/expiryManager';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onSelect: (opportunity: Opportunity) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (id: string) => void;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
  opportunity,
  onSelect,
  isBookmarked = false,
  onToggleBookmark,
}) => {
  const daysLeft = getDaysUntilDeadline(opportunity.deadline || opportunity.applicationDeadline);
  const isClosingSoon = 
    opportunity.status === 'closing_soon' || 
    opportunity.status === 'Closing Soon' || 
    (daysLeft !== null && daysLeft <= 5 && daysLeft >= 0);
  const isExpired = 
    opportunity.status === 'expired' || 
    opportunity.status === 'Expired' || 
    (daysLeft !== null && daysLeft < 0);
  const isClosed = 
    opportunity.status === 'closed' || 
    opportunity.status === 'Closed';

  // Compensation display with failsafe default
  const compensationDisplay = React.useMemo(() => {
    if (opportunity.salaryOrStipend && opportunity.salaryOrStipend !== 'Not Disclosed') {
      return opportunity.salaryOrStipend;
    }
    if (opportunity.fees && opportunity.fees !== 'Not Disclosed') {
      return `Fee: ${opportunity.fees}`;
    }
    if (!opportunity.compensation) return 'Not Disclosed';
    const { amount, currency = '₹', period = 'month', isDisclosed } = opportunity.compensation;
    if (!isDisclosed || !amount || amount === '0') return 'Not Disclosed';
    return `${currency}${amount}${period ? ` / ${period}` : ''}`;
  }, [opportunity.salaryOrStipend, opportunity.fees, opportunity.compensation]);

  // Deadline display with failsafe default
  const deadlineDisplay = React.useMemo(() => {
    const raw = opportunity.deadline || opportunity.applicationDeadline;
    if (!raw || raw === 'Not Specified') return 'Not Specified';
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return raw;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return raw;
    }
  }, [opportunity.deadline, opportunity.applicationDeadline]);

  // Branch names mapping
  const branchList = React.useMemo(() => {
    if (!opportunity.branches || opportunity.branches.length === 0) return ['Biotechnology'];
    return opportunity.branches.map(bId => {
      const branch = EDUCATIONAL_BRANCHES.find(b => b.id === bId);
      return branch ? branch.name : bId;
    });
  }, [opportunity.branches]);

  const typeConfig: Record<string, { label: string; bg: string; text: string; border: string; actionLabel: string }> = {
    job: { 
      label: 'Job', 
      bg: 'bg-emerald-50 dark:bg-emerald-950/40', 
      text: 'text-emerald-700 dark:text-emerald-300', 
      border: 'border-emerald-200 dark:border-emerald-800',
      actionLabel: 'Apply Now'
    },
    biotech_job: { 
      label: 'Biotech Job', 
      bg: 'bg-teal-50 dark:bg-teal-950/40', 
      text: 'text-teal-700 dark:text-teal-300', 
      border: 'border-teal-200 dark:border-teal-800',
      actionLabel: 'Apply Now'
    },
    internship: { 
      label: 'Internship', 
      bg: 'bg-sky-50 dark:bg-sky-950/40', 
      text: 'text-sky-700 dark:text-sky-300', 
      border: 'border-sky-200 dark:border-sky-800',
      actionLabel: 'Apply Now'
    },
    workshop: { 
      label: 'Workshop', 
      bg: 'bg-purple-50 dark:bg-purple-950/40', 
      text: 'text-purple-700 dark:text-purple-300', 
      border: 'border-purple-200 dark:border-purple-800',
      actionLabel: 'Register Now'
    },
    course: { 
      label: 'Course', 
      bg: 'bg-amber-50 dark:bg-amber-950/40', 
      text: 'text-amber-700 dark:text-amber-300', 
      border: 'border-amber-200 dark:border-amber-800',
      actionLabel: 'Enroll Now'
    }
  };

  const currentType = typeConfig[opportunity.type] || typeConfig.job;

  // Primary destination URL
  const actionUrl = 
    opportunity.applicationUrl || 
    opportunity.registrationUrl || 
    opportunity.workshopDetails?.registrationUrl || 
    opportunity.courseDetails?.enrollmentUrl || 
    '';

  const isExternalUrl = actionUrl.startsWith('http://') || actionUrl.startsWith('https://');

  return (
    <div 
      className={`group relative bg-white dark:bg-slate-900 border rounded-2xl p-5 md:p-6 transition-all duration-200 hover:shadow-xl hover:border-sky-400 dark:hover:border-sky-600 flex flex-col justify-between ${
        isExpired || isClosed
          ? 'opacity-75 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50' 
          : isClosingSoon 
            ? 'border-amber-300 dark:border-amber-800/80 shadow-xs' 
            : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div>
        {/* Top Header: Category, Status, Sector & Bookmark */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${currentType.bg} ${currentType.text} ${currentType.border}`}>
              {currentType.label}
            </span>

            {opportunity.sector && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {opportunity.sector}
              </span>
            )}

            {isExpired ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                <AlertTriangle className="w-3 h-3" />
                Expired
              </span>
            ) : isClosed ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                Closed
              </span>
            ) : isClosingSoon ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Clock className="w-3 h-3 animate-pulse" />
                {daysLeft !== null && daysLeft >= 0 ? `${daysLeft}d left` : 'Closing Soon'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3" />
                Open
              </span>
            )}
          </div>

          {onToggleBookmark && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark(opportunity.id);
              }}
              className="text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark this opportunity'}
              aria-label="Bookmark"
            >
              {isBookmarked ? (
                <BookmarkCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              ) : (
                <Bookmark className="w-5 h-5" />
              )}
            </button>
          )}
        </div>

        {/* Title & Organization */}
        <div className="mb-3">
          <h3 
            onClick={() => onSelect(opportunity)}
            className="text-base sm:text-lg font-bold text-slate-900 dark:text-white line-clamp-2 cursor-pointer hover:text-sky-600 dark:hover:text-sky-400 transition-colors leading-snug"
          >
            {opportunity.title}
          </h3>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B2A5B] dark:text-sky-400 mt-1">
            <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span className="line-clamp-1">{opportunity.organization}</span>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 mb-3 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{opportunity.location} ({opportunity.workMode || opportunity.mode || 'On-site'})</span>
          </div>

          <div className="flex items-center gap-1.5 truncate">
            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate font-semibold text-emerald-600 dark:text-emerald-400">
              {compensationDisplay}
            </span>
          </div>

          <div className="flex items-center gap-1.5 truncate col-span-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              Deadline: <strong className={isClosingSoon ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}>{deadlineDisplay}</strong>
            </span>
          </div>
        </div>

        {/* Description snippet */}
        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-3 leading-relaxed">
          {opportunity.description}
        </p>

        {/* Qualification / Degrees */}
        {(opportunity.eligibility || opportunity.qualification || (opportunity.qualifications && opportunity.qualifications.length > 0)) && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mb-3 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
            <GraduationCap className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <span className="truncate font-medium">
              {opportunity.eligibility || opportunity.qualification || opportunity.qualifications?.join(', ')}
            </span>
          </div>
        )}

        {/* Branch Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          {branchList.slice(0, 3).map((branchName, idx) => (
            <span
              key={idx}
              className="text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              {branchName}
            </span>
          ))}
          {branchList.length > 3 && (
            <span className="text-[10px] sm:text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
              +{branchList.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Footer Actions: View Details and Functional Action Button */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
          via <span className="font-medium text-slate-600 dark:text-slate-400">{opportunity.source?.name || opportunity.sourceName || 'Verified Portal'}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          {/* Always functional View Details button */}
          <button
            onClick={() => onSelect(opportunity)}
            className="flex-1 sm:flex-none text-center text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            View Details
          </button>

          {/* Functional Primary Action Button */}
          {isExpired || isClosed ? (
            <button
              disabled
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-800 px-4 py-2 rounded-xl cursor-not-allowed border border-slate-300 dark:border-slate-700"
            >
              <span>{isExpired ? 'Expired' : 'Closed'}</span>
            </button>
          ) : !actionUrl || actionUrl === '#' || actionUrl.startsWith('javascript:') ? (
            <button
              disabled
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-800 px-4 py-2 rounded-xl cursor-not-allowed border border-slate-300 dark:border-slate-700"
            >
              <span>Link Unavailable</span>
            </button>
          ) : isExternalUrl ? (
            <a
              href={actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <span>{currentType.actionLabel}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <a
              href={actionUrl}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <span>{currentType.actionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
