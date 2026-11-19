import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Globe,
  Building,
  User,
  ExternalLink,
  Bookmark,
  AlertCircle,
  Sparkles,
  Info,
  ShieldCheck,
  Users,
  Tag,
  X
} from 'lucide-react';
import {
  getDefaultWorkshopImageForTitle,
  isWorkshopRegistrationClosed,
  normalizeWorkshopFormat,
  normalizeWorkshopStatus,
  validateWorkshopRegistrationUrl,
  type WorkshopApprovalStatus
} from '../../services/workshops/workshopHelpers';

export interface UnifiedWorkshop {
  id: string;
  title: string;
  name?: string;
  description: string;
  instructor: string;
  organizer?: string;
  category?: string;
  date: string;
  time?: string;
  duration?: string;
  format?: 'Online' | 'Offline' | 'Hybrid';
  workMode?: string;
  venue: string;
  location?: string;
  registrationDeadline?: string;
  registrationUrl: string;
  registrationLink?: string;
  availability?: string;
  status?: 'upcoming' | 'ongoing' | 'completed' | string;
  fees?: string;
  capacity?: number | null;
  imageUrl?: string;
  featured?: boolean;
  skillsCovered?: string[];
  approvalStatus?: WorkshopApprovalStatus;
  isApproved?: boolean;
  isExpired?: boolean;
}

interface WorkshopCardProps {
  workshop: UnifiedWorkshop;
  onSelectDetails?: (workshop: UnifiedWorkshop) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (id: string, title: string) => void;
}

export const WorkshopCard: React.FC<WorkshopCardProps> = ({
  workshop,
  onSelectDetails,
  isBookmarked = false,
  onToggleBookmark
}) => {
  const [showDirectWarning, setShowDirectWarning] = useState(false);
  const [imgError, setImgError] = useState(false);

  const title = workshop.title || workshop.name || '';
  const organizer = (workshop.organizer || '').trim();
  const instructor = (workshop.instructor || '').trim();
  const displayHost = organizer || instructor;
  const destinationUrl = workshop.registrationUrl || workshop.registrationLink || '';
  const urlCheck = validateWorkshopRegistrationUrl(destinationUrl);
  const venue = (workshop.venue || workshop.location || '').trim();
  const time = (workshop.time || '').trim();
  const duration = (workshop.duration || '').trim();
  const deadline = (workshop.registrationDeadline || '').trim();
  const availability = (workshop.availability || 'Open').trim();
  const fees = (workshop.fees || '').trim();
  const format = normalizeWorkshopFormat(workshop.format || workshop.workMode);
  const isExpired = isWorkshopRegistrationClosed(workshop);
  const status = isExpired ? 'completed' : normalizeWorkshopStatus(workshop.status);
  const capacity = typeof workshop.capacity === 'number' && workshop.capacity > 0 ? workshop.capacity : null;

  const displayImage =
    imgError || !workshop.imageUrl ? getDefaultWorkshopImageForTitle(title) : workshop.imageUrl;

  const handleRegisterClick = (e: React.MouseEvent) => {
    if (isExpired) {
      e.preventDefault();
      return;
    }
    if (!urlCheck.valid) {
      e.preventDefault();
      setShowDirectWarning(true);
    }
  };

  return (
    <article className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-[#14A3A0]/60 dark:hover:border-[#14A3A0]/60 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden relative">
      {/* Top Media & Badges */}
      <div>
        <div className="relative h-48 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          <img
            src={displayImage}
            alt={title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

          {/* Badges Overlay */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Format Badge */}
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-md shadow-xs ${
                  format === 'Offline'
                    ? 'bg-emerald-600/90 text-white'
                    : format === 'Hybrid'
                    ? 'bg-purple-600/90 text-white'
                    : 'bg-blue-600/90 text-white'
                }`}
              >
                {format === 'Offline' ? (
                  <Building className="w-3 h-3" />
                ) : (
                  <Globe className="w-3 h-3" />
                )}
                <span>{format} Workshop</span>
              </span>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-xs ${
                  status === 'ongoing'
                    ? 'bg-teal-500/90 text-white'
                    : status === 'completed'
                    ? 'bg-slate-700/90 text-slate-200'
                    : 'bg-sky-500/90 text-white'
                }`}
              >
                {status === 'ongoing' && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                <span>{isExpired ? 'Expired' : status}</span>
              </span>

              {workshop.featured && !isExpired && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/90 text-white backdrop-blur-md shadow-xs">
                  <Sparkles className="w-3 h-3" />
                  <span>Featured</span>
                </span>
              )}
            </div>

            {/* Bookmark button */}
            {onToggleBookmark && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBookmark(workshop.id, title);
                }}
                aria-label={isBookmarked ? `Remove bookmark for ${title}` : `Bookmark ${title}`}
                className={`pointer-events-auto p-2 rounded-full backdrop-blur-md transition-colors cursor-pointer ${
                  isBookmarked
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'bg-slate-900/60 hover:bg-slate-900/80 text-white hover:text-rose-400'
                }`}
                title={isBookmarked ? 'Remove bookmark' : 'Bookmark workshop'}
              >
                <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>

          {/* Bottom Overlay Info (Duration & Fees — shown only when saved) */}
          {(duration || fees) && (
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 text-xs text-white">
              {duration ? (
                <span className="flex items-center gap-1 font-semibold text-teal-200 drop-shadow-sm">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{duration}</span>
                </span>
              ) : (
                <span />
              )}
              {fees && (
                <span className="font-mono font-bold bg-slate-900/80 px-2 py-0.5 rounded-lg text-emerald-300 drop-shadow-sm border border-emerald-400/30 truncate max-w-[65%]">
                  {fees}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-3.5">
          <div>
            {workshop.category && (
              <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#0B2A5B] dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 px-2 py-0.5 rounded-md mb-1.5">
                <Tag className="w-2.5 h-2.5" />
                <span>{workshop.category}</span>
              </div>
            )}

            {displayHost && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
                <User className="w-3.5 h-3.5 text-[#14A3A0] shrink-0" />
                <span className="truncate">{displayHost}</span>
              </div>
            )}

            {onSelectDetails ? (
              <button
                type="button"
                onClick={() => onSelectDetails(workshop)}
                className="text-left text-base font-bold text-slate-900 dark:text-slate-100 hover:text-[#1F6FB2] dark:hover:text-sky-400 transition-colors line-clamp-2 cursor-pointer"
              >
                {title}
              </button>
            ) : (
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                {title}
              </h3>
            )}
          </div>

          {workshop.description && (
            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
              {workshop.description}
            </p>
          )}

          {/* Key Facts Grid */}
          <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
            {/* Date & Time */}
            {(workshop.date || time) && (
              <div className="flex items-center justify-between gap-2">
                {workshop.date && (
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold">{workshop.date}</span>
                  </div>
                )}
                {time && <div className="text-slate-500 font-mono text-[10px] truncate">{time}</div>}
              </div>
            )}

            {/* Venue or Meeting Information */}
            {venue && (
              <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                <span className="line-clamp-1" title={venue}>
                  {venue}
                </span>
              </div>
            )}

            {/* Capacity (shown ONLY when saved) */}
            {capacity !== null && (
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <Users className="w-3.5 h-3.5 text-[#14A3A0] shrink-0" />
                <span>
                  Capacity: <strong className="text-slate-800 dark:text-slate-200 font-mono">{capacity} seats</strong>
                </span>
              </div>
            )}

            {/* Registration Deadline & Availability */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1 text-[11px]">
                <AlertCircle className={`w-3.5 h-3.5 ${isExpired ? 'text-rose-500' : 'text-amber-500'}`} />
                <span className="text-slate-500">Deadline:</span>
                <span className={`font-semibold ${isExpired ? 'text-rose-600 dark:text-rose-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                  {deadline || 'See organizer portal'}
                </span>
              </div>

              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                  isExpired || availability.toLowerCase() === 'closed'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    : availability.toLowerCase().includes('fast') || availability.toLowerCase().includes('waitlist')
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                }`}
              >
                {isExpired ? 'Closed' : availability}
              </span>
            </div>
          </div>

          {/* Skills Covered Tags */}
          {workshop.skillsCovered && workshop.skillsCovered.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {workshop.skillsCovered.slice(0, 3).map((skill) => (
                <span
                  key={skill}
                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-5 pt-0 mt-2 space-y-2">
        <div className="flex items-center gap-2">
          {onSelectDetails && (
            <button
              type="button"
              onClick={() => onSelectDetails(workshop)}
              className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>Curriculum &amp; Info</span>
            </button>
          )}

          {isExpired ? (
            <button
              type="button"
              disabled
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold cursor-not-allowed text-center"
            >
              Registration Closed
            </button>
          ) : !urlCheck.valid ? (
            <button
              type="button"
              onClick={() => setShowDirectWarning(true)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 text-xs font-bold text-center cursor-pointer hover:bg-amber-200 transition-colors"
            >
              Link Unavailable
            </button>
          ) : (
            <a
              href={urlCheck.normalizedUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleRegisterClick}
              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#0B2A5B] to-[#1F6FB2] hover:from-blue-900 hover:to-blue-700 text-white text-xs font-bold transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-1.5"
            >
              <span>Register Now</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Official destination note */}
        <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 justify-center">
          <ShieldCheck className="w-3 h-3 text-teal-500 shrink-0" />
          <span className="truncate">
            {urlCheck.valid && urlCheck.domain
              ? `Official portal: ${urlCheck.domain}`
              : 'Direct registration on organizer portal'}
          </span>
        </div>
      </div>

      {/* Notice Modal if registration URL is invalid/missing */}
      {showDirectWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-5 border border-amber-200 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between text-amber-600 font-bold">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>Registration URL Unavailable</span>
              </span>
              <button
                type="button"
                aria-label="Close notice"
                onClick={() => setShowDirectWarning(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              A verified external registration URL is not currently available for &quot;{title}&quot;
              {displayHost ? ` (${displayHost})` : ''}. BIO-INEXA does not simulate workshop registrations.
            </p>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDirectWarning(false)}
                className="px-4 py-1.5 bg-[#0B2A5B] text-white rounded-lg font-bold cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
