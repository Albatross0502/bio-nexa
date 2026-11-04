import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { SEED_SCHOLARSHIPS } from '../../data/seedData';
import { Scholarship } from '../../types';
import {
  Award,
  Search,
  Bookmark,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileCheck,
  Building2,
  Clock
} from 'lucide-react';

export const ScholarshipsPage: React.FC = () => {
  const { isItemSaved, toggleSaveItem, addToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedScope, setSelectedScope] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedScholarship, setSelectedScholarship] = useState<Scholarship | null>(SEED_SCHOLARSHIPS[0]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam) {
      const match = SEED_SCHOLARSHIPS.find((s) => s.id === idParam);
      if (match) setSelectedScholarship(match);
    }
  }, []);

  const filteredScholarships = SEED_SCHOLARSHIPS.filter((s) => {
    const matchSearch =
      !searchTerm ||
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.provider.toLowerCase().includes(searchTerm.toLowerCase());

    const matchScope = selectedScope === 'all' || s.scope === selectedScope;
    const matchLevel = selectedLevel === 'all' || s.level === selectedLevel;

    return matchSearch && matchScope && matchLevel;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Biotechnology Scholarships &amp; Doctoral Grants
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Government, autonomous, and international fellowship directories for M.Sc, Ph.D, and Postdoctoral life scientists.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search fellowships (e.g. DBT JRF, PMRF, INSPIRE, Fulbright)..."
              className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="all">All Jurisdictions</option>
              <option value="National (India)">National (India)</option>
              <option value="International (USA/EU)">International (USA/EU)</option>
            </select>

            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="all">All Academic Levels</option>
              <option value="M.Sc">M.Sc Students</option>
              <option value="Ph.D / Fellowship">Ph.D / JRF Fellowships</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Listing cards */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs text-slate-500 pb-1">
            Found <strong className="text-slate-900 dark:text-slate-100 font-mono">{filteredScholarships.length}</strong> grant schemes
          </div>

          {filteredScholarships.map((sch) => {
            const isSelected = selectedScholarship?.id === sch.id;
            return (
              <div
                key={sch.id}
                onClick={() => setSelectedScholarship(sch)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/40 dark:bg-slate-800/90 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      {sch.scope} · {sch.level}
                    </span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 leading-snug">
                      {sch.title}
                    </h2>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSaveItem(sch.id, sch.title);
                    }}
                    className={`p-1.5 rounded-lg border ${
                      isItemSaved(sch.id)
                        ? 'bg-amber-50 text-amber-600 border-amber-200'
                        : 'text-slate-400 hover:text-slate-600 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Bookmark className="w-4 h-4" fill={isItemSaved(sch.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>

                <div className="text-xs font-mono font-bold text-emerald-600 mt-2">
                  {sch.amount}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
                  <span>Provider: {sch.provider.split(',')[0]}</span>
                  <span>Deadline: <strong className="text-slate-700 dark:text-slate-300">{sch.deadline}</strong></span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed Scheme View */}
        <div className="lg:col-span-7 sticky top-20">
          {selectedScholarship ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-xs">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
                    <Award className="w-4 h-4" />
                    <span>{selectedScholarship.scope}</span>
                    <span>·</span>
                    <span>{selectedScholarship.level}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {selectedScholarship.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Granted by: {selectedScholarship.provider}</p>
                </div>

                <a
                  href={selectedScholarship.applicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-[#14A3A0] hover:bg-teal-600 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <span>Official Application</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Award Breakdown Banner */}
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Stipend &amp; Contingency Grant
                </span>
                <div className="text-lg font-mono font-bold text-emerald-900 dark:text-emerald-200">
                  {selectedScholarship.amount}
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  {selectedScholarship.coverage}
                </p>
              </div>

              {/* Deadline & Scope */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Next Upcoming Application Deadline: <strong className="text-slate-900 dark:text-slate-100 font-mono">{selectedScholarship.deadline}</strong></span>
              </div>

              {/* Eligibility Checklist */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Eligibility Criteria &amp; Rank Requirements
                </h3>
                <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  {selectedScholarship.eligibility.map((el, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{el}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Key Benefits */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Fellowship Privileges &amp; Tenability
                </h3>
                <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  {selectedScholarship.benefits.map((b, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-teal-600 font-bold">&bull;</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Required Documents */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Documentation Checklist for Submission
                </h3>
                <div className="space-y-1.5 text-xs">
                  {selectedScholarship.documentsRequired.map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                      <FileCheck className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{doc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400">
              <Award className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Select a fellowship from the listing to examine award quotas and submission portals.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
