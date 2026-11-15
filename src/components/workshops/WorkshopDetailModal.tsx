import React, { useState } from 'react';
import {
  Building,
  Calendar,
  Clock,
  ExternalLink,
  Globe,
  Sparkles,
  User,
  X,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import type { UnifiedWorkshop } from './WorkshopCard';
import {
  getDefaultWorkshopImageForTitle,
  isValidWorkshopRegistrationUrl,
  isWorkshopRegistrationClosed,
  normalizeWorkshopFormat,
  normalizeWorkshopStatus
} from '../../services/workshops/workshopHelpers';

interface WorkshopDetailModalProps {
  workshop: UnifiedWorkshop | null;
  onClose: () => void;
}

export const WorkshopDetailModal: React.FC<WorkshopDetailModalProps> = ({ workshop, onClose }) => {
  const [imgError, setImgError] = useState(false);

  if (!workshop) return null;

  const title = workshop.title || workshop.name || 'Biotechnology Workshop';
  const format = normalizeWorkshopFormat(workshop.format || workshop.workMode);
  const status = normalizeWorkshopStatus(workshop.status);
  const isClosed = isWorkshopRegistrationClosed(workshop);
  const destinationUrl = workshop.registrationUrl || workshop.registrationLink || '';
  const hasValidUrl = isValidWorkshopRegistrationUrl(destinationUrl);
  const displayImage =
    imgError || !workshop.imageUrl ? getDefaultWorkshopImageForTitle(title) : workshop.imageUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workshop-modal-title"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col text-xs">
        {/* Banner Image */}
        <div className="relative h-44 sm:h-52 w-full bg-slate-100 dark:bg-slate-800 shrink-0">
          <img
            src={displayImage}
            alt={title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Close workshop details"
            className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute bottom-3 left-5 right-5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                format === 'Offline'
                  ? 'bg-emerald-600/90 text-white'
                  : format === 'Hybrid'
                  ? 'bg-purple-600/90 text-white'
                  : 'bg-blue-600/90 text-white'
              }`}
            >
              {format === 'Offline' ? <Building className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
              <span>{format} Workshop</span>
            </span>

            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                status === 'ongoing'
                  ? 'bg-teal-500/90 text-white'
                  : status === 'completed'
                  ? 'bg-slate-700/90 text-slate-200'
                  : 'bg-sky-500/90 text-white'
              }`}
            >
              <span>{status}</span>
            </span>

            {workshop.featured && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/90 text-white">
                <Sparkles className="w-3 h-3" />
                <span>Featured</span>
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 sm:p-7 space-y-5 overflow-y-auto">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 block mb-1">
              {workshop.organizer || workshop.instructor || 'BIO-NEXA Academy'}
            </span>
            <h2 id="workshop-modal-title" className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-snug">
              {title}
            </h2>
          </div>

          {/* Key Highlights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Date</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">{workshop.date}</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Session Time</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                {workshop.time || '09:30 AM - 04:30 PM IST'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Duration</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                {workshop.duration || '2 Days'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Registration Fee</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {workshop.fees || 'Free'}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Curriculum &amp; Program Scope</h4>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
              {workshop.description}
            </p>
          </div>

          {/* Instructor & Venue */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#14A3A0]" />
                <span>Lead Instructor / Faculty</span>
              </h4>
              <p className="text-slate-600 dark:text-slate-300 text-xs">
                {workshop.instructor || workshop.organizer}
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-rose-500" />
                <span>Venue &amp; Meeting Logistics</span>
              </h4>
              <p className="text-slate-600 dark:text-slate-300 text-xs">
                {workshop.venue || workshop.location}
              </p>
            </div>
          </div>

          {/* Skills Covered */}
          {workshop.skillsCovered && workshop.skillsCovered.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Hands-on Competencies Taught</h4>
              <div className="flex flex-wrap gap-1.5">
                {workshop.skillsCovered.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Registration Deadline & Availability Notice */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-900 dark:text-amber-200 flex flex-wrap items-center gap-2">
                <span>Registration Deadline: {workshop.registrationDeadline || 'Open until batch filled'}</span>
                <span className="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/80 text-[10px] text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                  {isClosed ? 'Closed' : workshop.availability || 'Open'}
                </span>
              </div>
              <div className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Registrations are handled directly by the hosting institution. No intermediary fees.</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold cursor-pointer"
            >
              Close
            </button>
            {isClosed ? (
              <button
                type="button"
                disabled
                className="px-6 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold rounded-xl cursor-not-allowed"
              >
                Registration Closed
              </button>
            ) : !hasValidUrl ? (
              <button
                type="button"
                disabled
                className="px-6 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold rounded-xl cursor-not-allowed"
              >
                Registration Link Pending
              </button>
            ) : (
              <a
                href={destinationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2.5 bg-gradient-to-r from-[#0B2A5B] to-[#1F6FB2] hover:from-blue-900 hover:to-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                <span>Go to Official Registration Portal</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
