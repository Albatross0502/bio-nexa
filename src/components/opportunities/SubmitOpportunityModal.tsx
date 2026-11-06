import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Building2, 
  Briefcase, 
  GraduationCap, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle,
  Award
} from 'lucide-react';
import { OpportunityType, WorkMode } from '../../types/opportunity';
import { EDUCATIONAL_BRANCHES } from '../../config/branches';
import { opportunityStore } from '../../services/opportunities/opportunityStore';

interface SubmitOpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SubmitOpportunityModal: React.FC<SubmitOpportunityModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [type, setType] = useState<OpportunityType>('job');
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [location, setLocation] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode>('On-site');
  const [experience, setExperience] = useState('Freshers / 0-2 Years');
  const [qualification, setQualification] = useState('');
  const [selectedBranches, setSelectedBranches] = useState<string[]>(['biotech']);
  const [description, setDescription] = useState('');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [deadline, setDeadline] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  
  // Compensation
  const [hasDisclosedComp, setHasDisclosedComp] = useState(true);
  const [compAmount, setCompAmount] = useState('');
  const [compPeriod, setCompPeriod] = useState<'month' | 'year' | 'fixed'>('month');

  // Workshop specifics
  const [workshopMode, setWorkshopMode] = useState<'online' | 'offline' | 'hybrid'>('online');
  const [isFreeWorkshop, setIsFreeWorkshop] = useState(true);
  const [workshopFee, setWorkshopFee] = useState('');
  const [certificateProvided, setCertificateProvided] = useState(true);
  const [workshopDates, setWorkshopDates] = useState('');
  const [instructors, setInstructors] = useState('');

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBranchToggle = (branchId: string) => {
    setSelectedBranches(prev => 
      prev.includes(branchId) 
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !organization.trim() || !location.trim() || !applicationUrl.trim()) {
      setError('Please fill out all required fields marked with *');
      return;
    }

    if (selectedBranches.length === 0) {
      setError('Please select at least one eligible educational branch');
      return;
    }

    try {
      opportunityStore.submitOpportunity({
        title: title.trim(),
        organization: organization.trim(),
        type,
        location: location.trim(),
        workMode,
        experience: experience || undefined,
        qualification: qualification.trim() || undefined,
        branches: selectedBranches,
        description: description.trim() || 'No detailed description provided by organizer.',
        applicationUrl: applicationUrl.trim(),
        deadline: deadline || undefined,
        compensation: hasDisclosedComp && compAmount.trim() ? {
          amount: compAmount.trim(),
          currency: '₹',
          period: compPeriod,
          isDisclosed: true,
        } : {
          isDisclosed: false,
        },
        workshopDetails: type === 'workshop' ? {
          mode: workshopMode,
          registrationFee: isFreeWorkshop ? 'Free' : (workshopFee.trim() || 'Paid'),
          certificateProvided,
          dates: workshopDates.trim() || undefined,
          speakers: instructors.trim() ? instructors.split(',').map(s => s.trim()) : undefined,
        } : undefined,
        source: {
          id: 'direct-employer',
          name: 'Direct Employer / Organizer Submission',
          permissionStatus: 'direct_submission',
          type: 'direct_employer',
          originalUrl: applicationUrl.trim(),
        },
      });

      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit opportunity.');
    }
  };

  const handleReset = () => {
    setTitle('');
    setOrganization('');
    setLocation('');
    setDescription('');
    setApplicationUrl('');
    setCompAmount('');
    setSubmitted(false);
    setError(null);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Post an Opportunity / Workshop</h3>
            <p className="text-xs text-slate-500">Free submission. Goes to moderation queue for verification.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">Submission Received!</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Your opportunity has been successfully queued for BIO-NEXA verification. Once reviewed by our moderation team, it will appear in public listings.
            </p>
            <div className="pt-4">
              <button
                onClick={handleReset}
                className="px-6 py-2.5 text-xs font-bold text-white bg-linear-to-r from-sky-600 to-teal-600 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Type selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Opportunity Type *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['job', 'internship', 'workshop'] as OpportunityType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold capitalize transition-all border ${
                      type === t
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Title & Organization */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Title / Role / Topic *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Jr. Research Associate / CRISPR Workshop"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Organization / Institute *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="e.g. Biocon Biologics / IIT Bombay"
                    className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Location & Work Mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Location (City, State) *
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Bengaluru, Karnataka or All India"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Work / Delivery Mode
                </label>
                <select
                  value={workMode}
                  onChange={(e) => setWorkMode(e.target.value as WorkMode)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                >
                  <option value="onsite">On-Site (Laboratory / Office)</option>
                  <option value="remote">Remote (Work From Home)</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>

            {/* Experience & Qualification */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Experience Level
                </label>
                <select
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                >
                  <option value="Freshers / 0-2 Years">Freshers / 0-2 Years</option>
                  <option value="0-2 Years">0-2 Years</option>
                  <option value="2-5 Years">2-5 Years</option>
                  <option value="5+ Years">5+ Years</option>
                  <option value="Not Specified">Not Specified</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Degree / Qualification
                </label>
                <input
                  type="text"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  placeholder="e.g. B.Sc / M.Sc / B.Tech / M.Tech / PhD"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Workshop specific section */}
            {type === 'workshop' && (
              <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-800 space-y-4">
                <span className="text-xs font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  Workshop Configuration
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Delivery Format</label>
                    <select
                      value={workshopMode}
                      onChange={(e) => setWorkshopMode(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="online">Online / Webinar</option>
                      <option value="offline">Offline / Wet Lab</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Fee</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isFreeWorkshop}
                        onChange={(e) => setIsFreeWorkshop(e.target.checked)}
                        id="free-toggle"
                        className="rounded"
                      />
                      <label htmlFor="free-toggle" className="text-xs text-slate-700 dark:text-slate-300">Free</label>
                      {!isFreeWorkshop && (
                        <input
                          type="text"
                          value={workshopFee}
                          onChange={(e) => setWorkshopFee(e.target.value)}
                          placeholder="e.g. ₹999"
                          className="w-20 px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Certificate</label>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        checked={certificateProvided}
                        onChange={(e) => setCertificateProvided(e.target.checked)}
                        id="cert-toggle"
                        className="rounded"
                      />
                      <label htmlFor="cert-toggle" className="text-xs text-slate-700 dark:text-slate-300">Certificate Provided</label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Workshop Dates</label>
                    <input
                      type="text"
                      value={workshopDates}
                      onChange={(e) => setWorkshopDates(e.target.value)}
                      placeholder="e.g. 15th - 18th Dec 2025"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Instructors / Key Faculty</label>
                    <input
                      type="text"
                      value={instructors}
                      onChange={(e) => setInstructors(e.target.value)}
                      placeholder="e.g. Dr. A. Sharma (IISc)"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Compensation */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Compensation / Stipend
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!hasDisclosedComp}
                    onChange={(e) => setHasDisclosedComp(!e.target.checked)}
                    className="rounded"
                  />
                  <span>Mark as "Not Disclosed"</span>
                </label>
              </div>
              {hasDisclosedComp && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                    <input
                      type="text"
                      value={compAmount}
                      onChange={(e) => setCompAmount(e.target.value)}
                      placeholder="e.g. 25,000 - 35,000 or 4,50,000"
                      className="w-full pl-7 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <select
                    value={compPeriod}
                    onChange={(e) => setCompPeriod(e.target.value as any)}
                    className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="month">Per Month</option>
                    <option value="year">Per Annum (LPA)</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </div>
              )}
            </div>

            {/* Educational Branches selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Eligible Educational Branches * (Select all that apply)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 border border-slate-200 dark:border-slate-800 rounded-xl">
                {EDUCATIONAL_BRANCHES.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleBranchToggle(b.id)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                      selectedBranches.includes(b.id)
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Deadline & Official Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Application Deadline (Leave empty for "Not Specified")
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Official Application Link / Registration URL *
                </label>
                <input
                  type="url"
                  required
                  value={applicationUrl}
                  onChange={(e) => setApplicationUrl(e.target.value)}
                  placeholder="https://company.com/careers/job-123"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Description / Overview
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of the role, requirements or workshop agenda..."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {/* Contact Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contact Email (For verification questions, not shown publicly)
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="hr@organization.org"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-linear-to-r from-sky-600 to-teal-600 hover:from-sky-500 hover:to-teal-500 rounded-xl shadow-md"
              >
                <Send className="w-4 h-4" />
                Submit for Verification
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
