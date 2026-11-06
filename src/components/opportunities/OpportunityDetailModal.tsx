import React from 'react';
import { 
  X, 
  Building2, 
  MapPin, 
  Briefcase, 
  Calendar, 
  Clock, 
  ExternalLink, 
  Share2, 
  CheckCircle2, 
  AlertTriangle,
  GraduationCap,
  Sparkles,
  Award,
  Video,
  ShieldCheck,
  Info,
  BookOpen
} from 'lucide-react';
import { Opportunity } from '../../types/opportunity';
import { EDUCATIONAL_BRANCHES } from '../../config/branches';
import { getDaysUntilDeadline } from '../../services/opportunities/expiryManager';

interface OpportunityDetailModalProps {
  opportunity: Opportunity | null;
  onClose: () => void;
  onBookmarkToggle?: (id: string) => void;
  isBookmarked?: boolean;
}

export const OpportunityDetailModal: React.FC<OpportunityDetailModalProps> = ({
  opportunity,
  onClose,
  onBookmarkToggle,
  isBookmarked = false,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!opportunity) return null;

  const daysLeft = getDaysUntilDeadline(opportunity.deadline);
  const isClosingSoon = opportunity.status === 'closing_soon' || opportunity.status === 'Closing Soon' || (daysLeft !== null && daysLeft <= 5 && daysLeft >= 0);
  const isExpired = opportunity.status === 'expired' || opportunity.status === 'Expired' || (daysLeft !== null && daysLeft < 0);

  const compensationDisplay = (() => {
    if (opportunity.salaryOrStipend && opportunity.salaryOrStipend !== 'Not Disclosed') {
      return opportunity.salaryOrStipend;
    }
    if (!opportunity.compensation) return 'Not Disclosed';
    const { amount, currency = '₹', period = 'month', isDisclosed } = opportunity.compensation;
    if (!isDisclosed || !amount || amount === '0') return 'Not Disclosed';
    return `${currency}${amount}${period ? ` / ${period}` : ''}`;
  })();

  const deadlineDisplay = (() => {
    if (!opportunity.deadline) return 'Not Specified';
    try {
      const d = new Date(opportunity.deadline);
      if (isNaN(d.getTime())) return opportunity.deadline;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return opportunity.deadline;
    }
  })();

  const handleCopyLink = () => {
    const url = opportunity.applicationUrl || window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              {opportunity.type}
            </span>
            {opportunity.isVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 fill-emerald-100 dark:fill-emerald-950" />
                Verified Source
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Copy link"
            >
              <Share2 className="w-4 h-4" />
            </button>
            {copied && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Copied!</span>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 space-y-6">
          {/* Duplicate Notice */}
          {opportunity.duplicateOf && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Note: A similar vacancy was detected across multiple sources. Redundant listings are de-duplicated.</span>
            </div>
          )}

          {/* Title & Organization */}
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
              {opportunity.title}
            </h2>
            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 mt-2 text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-1.5 font-semibold text-base">
                <Building2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>{opportunity.organization}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                <MapPin className="w-4 h-4" />
                <span>{opportunity.location} ({opportunity.workMode})</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Compensation</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                {compensationDisplay}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Experience</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1 mt-0.5">
                <Briefcase className="w-3.5 h-3.5 text-sky-500" />
                {opportunity.experience || 'Not Specified'}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Deadline</span>
              <span className={`text-sm font-bold flex items-center gap-1 mt-0.5 ${
                isExpired ? 'text-red-600 dark:text-red-400' : isClosingSoon ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
              }`}>
                <Calendar className="w-3.5 h-3.5" />
                {deadlineDisplay}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Status</span>
              <span className="text-sm font-bold capitalize text-slate-900 dark:text-white flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-teal-500" />
                {opportunity.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Workshop Details (if applicable) */}
          {opportunity.type === 'workshop' && opportunity.workshopDetails && (
            <div className="p-5 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 rounded-2xl space-y-3">
              <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300 flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-600" />
                Workshop & Hands-On Training Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-purple-100 dark:border-purple-900/50">
                  <span className="text-slate-400 block font-medium">Delivery Mode</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-1 capitalize">
                    <Video className="w-3.5 h-3.5 text-purple-500" />
                    {opportunity.workshopDetails.mode}
                  </span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-purple-100 dark:border-purple-900/50">
                  <span className="text-slate-400 block font-medium">Registration Fee</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block mt-1">
                    {opportunity.workshopDetails.registrationFee || opportunity.workshopDetails.fees || 'Free / Subsidized'}
                  </span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-purple-100 dark:border-purple-900/50">
                  <span className="text-slate-400 block font-medium">Certificate Provided</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {(opportunity.workshopDetails.certificateProvided ?? opportunity.workshopDetails.certificateAvailable) ? 'Yes (Verified)' : 'Attendance Certificate'}
                  </span>
                </div>
              </div>

              {(opportunity.workshopDetails.speakers || opportunity.workshopDetails.speakerOrTrainer) && (
                <div className="text-xs text-slate-600 dark:text-slate-400 pt-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Instructors / Faculty: </span>
                  {opportunity.workshopDetails.speakers ? opportunity.workshopDetails.speakers.join(', ') : opportunity.workshopDetails.speakerOrTrainer}
                </div>
              )}
            </div>
          )}

          {/* Eligible Branches & Qualifications */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-sky-600" />
              Eligible Branches & Degrees
            </h4>
            <div className="flex flex-wrap gap-2">
              {opportunity.branches.map(bId => {
                const b = EDUCATIONAL_BRANCHES.find(item => item.id === bId);
                return (
                  <span
                    key={bId}
                    className="text-xs font-semibold px-3 py-1 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                  >
                    {b?.name || bId}
                  </span>
                );
              })}
            </div>
            {(opportunity.qualification || (opportunity.qualifications && opportunity.qualifications.length > 0)) && (
              <p className="text-xs text-slate-600 dark:text-slate-400 pt-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Minimum Degree Requirement: </span>
                {opportunity.qualification || opportunity.qualifications?.join(', ')}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Role Overview</h4>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {opportunity.description}
            </p>
          </div>

          {/* Responsibilities */}
          {opportunity.responsibilities && opportunity.responsibilities.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Key Responsibilities</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 dark:text-slate-300">
                {opportunity.responsibilities.map((resp: string, i: number) => (
                  <li key={i}>{resp}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Requirements & Skills */}
          {((opportunity.requirements && opportunity.requirements.length > 0) || (opportunity.skills && opportunity.skills.length > 0)) && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Skills & Requirements</h4>
              <div className="flex flex-wrap gap-2">
                {(opportunity.requirements || opportunity.skills || []).map((req: string, i: number) => (
                  <span
                    key={i}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    {req}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Course Details (if type is course) */}
          {opportunity.type === 'course' && (
            <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200 text-sm">
                <BookOpen className="w-4 h-4 text-amber-600" />
                <span>Course & Certification Specifications</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Course Provider:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{opportunity.courseDetails?.provider || opportunity.organization}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Duration / Modules:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{opportunity.courseDetails?.duration || opportunity.duration || 'Self-paced'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Certification:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Verifiable Digital Certificate</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tuition / Fee:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{opportunity.courseDetails?.fees || opportunity.fees || 'Free'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Difficulty Level:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{opportunity.courseDetails?.level || 'All Levels'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Rating Benchmark:</span>
                  <span className="font-semibold text-amber-600">★ {opportunity.courseDetails?.rating || 4.9}</span>
                </div>
              </div>
            </div>
          )}

          {/* Source Attribution & Legal Disclaimer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                <Info className="w-3.5 h-3.5 text-sky-500" />
                <span>Source Attribution & Legal Transparency</span>
              </div>
              <span className="text-slate-500 font-mono text-[11px]">ID: {opportunity.id}</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Aggregated from legitimate public portal: <span className="font-semibold text-slate-800 dark:text-slate-200">{opportunity.source?.name || opportunity.sourceName || 'Official Source'}</span>. BIO-NEXA never charges candidates for applying or viewing opportunities.
            </p>
            {(opportunity.source?.originalUrl || opportunity.sourceUrl) && (
              <a
                href={opportunity.source?.originalUrl || opportunity.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline pt-1"
              >
                <span>View original notification / gazette listing</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Modal Footer CTA */}
        <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {onBookmarkToggle && (
            <button
              onClick={() => onBookmarkToggle(opportunity.id)}
              className="text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {isBookmarked ? 'Bookmarked ★' : 'Save for Later'}
            </button>
          )}

          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Close
            </button>
            {opportunity.applicationUrl ? (
              <a
                href={opportunity.applicationUrl}
                target={opportunity.applicationUrl.startsWith('/') ? '_self' : '_blank'}
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#0B2A5B] to-[#14A3A0] hover:from-blue-900 hover:to-teal-700 rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                <span>
                  {opportunity.type === 'workshop' 
                    ? 'Register for Workshop' 
                    : opportunity.type === 'course' 
                      ? 'Enroll in Course' 
                      : 'Apply on Official Portal'}
                </span>
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <a
                href={`mailto:contact@bio-nexa.org?subject=Application%20Inquiry%20-%20${encodeURIComponent(opportunity.title)}`}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-xl shadow-md transition-all"
              >
                <span>Contact Organizer to Apply</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
