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
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  ShieldCheck,
  X
} from 'lucide-react';

export interface UnifiedWorkshop {
  id: string;
  title: string;
  name?: string;
  description: string;
  instructor: string;
  organizer?: string;
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
  capacity?: number;
  imageUrl?: string;
  featured?: boolean;
  skillsCovered?: string[];
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

  const title = workshop.title || workshop.name || 'Biotechnology Workshop';
  const organizer = workshop.organizer || workshop.instructor || 'BIO-NEXA Academy';
  const instructor = workshop.instructor || organizer;
  const destinationUrl = workshop.registrationUrl || workshop.registrationLink || '#';
  const venue = workshop.venue || workshop.location || 'Online / Remote';
  const time = workshop.time || '09:30 AM - 04:30 PM IST';
  const duration = workshop.duration || '2 Days Intensive';
  const deadline = workshop.registrationDeadline || '';
  const availability = workshop.availability || 'Open';
  const status = (workshop.status?.toLowerCase() as 'upcoming' | 'ongoing' | 'completed') || 'upcoming';
  const fees = workshop.fees || 'Free / Subsidized';

  // Format determination
  const format: 'Online' | 'Offline' | 'Hybrid' = 
    workshop.format || 
    (workshop.workMode === 'In-Person' || workshop.workMode === 'Offline' ? 'Offline' :
     workshop.workMode === 'Hybrid' ? 'Hybrid' : 'Online');

  // Check if deadline has passed
  const isExpired = React.useMemo(() => {
    if (status === 'completed' || availability.toLowerCase() === 'closed') return true;
    if (!deadline) return false;
    try {
      const d = new Date(deadline);
      d.setHours(23, 59, 59, 999);
      return d.getTime() < Date.now();
    } catch {
      return false;
    }
  }, [deadline, status, availability]);

  // Default biotech placeholder images based on format/topic
  const defaultImage = React.useMemo(() => {
    if (title.toLowerCase().includes('crispr') || title.toLowerCase().includes('gene')) {
      return 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80';
    }
    if (title.toLowerCase().includes('rna') || title.toLowerCase().includes('python') || title.toLowerCase().includes('bioinformatics')) {
      return 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=800&q=80';
    }
    if (title.toLowerCase().includes('bioprocess') || title.toLowerCase().includes('fermentation')) {
      return 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80';
    }
    if (title.toLowerCase().includes('flow cytometry') || title.toLowerCase().includes('cell')) {
      return 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80';
    }
    if (title.toLowerCase().includes('haccp') || title.toLowerCase().includes('gmp') || title.toLowerCase().includes('food')) {
      return 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80';
    }
    return 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80';
  }, [title]);

  const displayImage = imgError || !workshop.imageUrl ? defaultImage : workshop.imageUrl;

  const handleRegisterClick = (e: React.MouseEvent) => {
    if (isExpired) {
      e.preventDefault();
      return;
    }
    // External link security verification
    if (!destinationUrl || destinationUrl === '#' || !destinationUrl.startsWith('http')) {
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
                ) : format === 'Hybrid' ? (
                  <Globe className="w-3 h-3" />
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
                <span>{status}</span>
              </span>

              {workshop.featured && (
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
                className={`pointer-events-auto p-2 rounded-full backdrop-blur-md transition-colors ${
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

          {/* Bottom Overlay Info (Duration & Fees) */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
            <span className="flex items-center gap-1 font-semibold text-teal-200 drop-shadow-sm">
              <Clock className="w-3.5 h-3.5" />
              <span>{duration}</span>
            </span>
            <span className="font-mono font-bold bg-slate-900/80 px-2 py-0.5 rounded-lg text-emerald-300 drop-shadow-sm border border-emerald-400/30">
              {fees}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
              <User className="w-3.5 h-3.5 text-[#14A3A0] shrink-0" />
              <span className="truncate">{instructor}</span>
            </div>
            <h3
              onClick={() => onSelectDetails?.(workshop)}
              className="text-base font-bold text-slate-900 dark:text-slate-100 hover:text-[#1F6FB2] dark:hover:text-sky-400 transition-colors line-clamp-2 cursor-pointer"
            >
              {title}
            </h3>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
            {workshop.description}
          </p>

          {/* Key Facts Grid */}
          <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
            {/* Date & Time */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-semibold">{workshop.date}</span>
              </div>
              <div className="text-slate-500 font-mono text-[10px]">{time}</div>
            </div>

            {/* Venue or Meeting Information */}
            <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
              <span className="line-clamp-1" title={venue}>
                {venue}
              </span>
            </div>

            {/* Registration Deadline & Availability */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1 text-[11px]">
                <AlertCircle className={`w-3.5 h-3.5 ${isExpired ? 'text-rose-500' : 'text-amber-500'}`} />
                <span className="text-slate-500">Deadline:</span>
                <span className={`font-semibold ${isExpired ? 'text-rose-600 dark:text-rose-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                  {deadline || 'Open until batch filled'}
                </span>
              </div>

              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
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
              className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>Curriculum &amp; Info</span>
            </button>
          )}

          {isExpired ? (
            <button
              disabled
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold cursor-not-allowed text-center"
            >
              Registration Closed
            </button>
          ) : (
            <a
              href={destinationUrl}
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

        {/* Legal Disclaimer Micro-copy */}
        <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 justify-center">
          <ShieldCheck className="w-3 h-3 text-teal-500" />
          <span>Direct institutional link · No middleman fees</span>
        </div>
      </div>

      {/* Warning Modal for invalid or internal mock registration */}
      {showDirectWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-5 border border-amber-200 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between text-amber-600 font-bold">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>Notice on Registration Link</span>
              </span>
              <button onClick={() => setShowDirectWarning(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              The direct online form for &quot;{title}&quot; is currently being synchronized with the institutional organizer ({organizer}).
            </p>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowDirectWarning(false)}
                className="px-4 py-1.5 bg-[#0B2A5B] text-white rounded-lg font-bold"
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
