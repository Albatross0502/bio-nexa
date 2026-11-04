import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { SEED_RESEARCH } from '../../data/seedData';
import { ResearchPaper } from '../../types';
import {
  Search,
  FileText,
  ExternalLink,
  Copy,
  Check,
  Bookmark,
  Share2,
  BookOpen,
  Sparkles,
  Filter
} from 'lucide-react';

export const ResearchPage: React.FC = () => {
  const { isItemSaved, toggleSaveItem, addToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedDoi, setCopiedDoi] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q');
    const doiParam = params.get('doi');
    if (qParam) setSearchTerm(qParam);
    if (doiParam) {
      setSearchTerm(doiParam);
    }
  }, []);

  const filteredPapers = SEED_RESEARCH.filter((paper) => {
    const matchSearch =
      !searchTerm ||
      paper.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      paper.abstract.toLowerCase().includes(searchTerm.toLowerCase()) ||
      paper.authors.some((a) => a.toLowerCase().includes(searchTerm.toLowerCase())) ||
      paper.keywords.some((k) => k.toLowerCase().includes(searchTerm.toLowerCase())) ||
      paper.doi.toLowerCase().includes(searchTerm.toLowerCase());

    const matchCategory = selectedCategory === 'all' || paper.category === selectedCategory;

    return matchSearch && matchCategory;
  });

  const handleCopyCitation = (paper: ResearchPaper) => {
    const citation = `${paper.authors.join(', ')} (${paper.publishedDate.split('-')[0]}). ${paper.title}. ${paper.journal}. https://doi.org/${paper.doi}`;
    navigator.clipboard?.writeText(citation);
    setCopiedDoi(paper.doi);
    addToast('APA Citation copied to clipboard!', 'info');
    setTimeout(() => setCopiedDoi(null), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-600 mb-1">
          <Sparkles className="w-4 h-4" />
          <span>NCBI PubMed &amp; Crossref Grounded Repository</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Frontier Biotechnology Research &amp; Publications
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Explore breakthrough peer-reviewed literature in CRISPR engineering, self-amplifying mRNA vaccines, and agricultural synthetic biology.
        </p>
      </div>

      {/* Search & Category Tabs */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by gene, target molecule, author, DOI, or technique..."
              className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
            >
              <option value="all">All Research Fields</option>
              <option value="Gene Editing (CRISPR)">Gene Editing (CRISPR)</option>
              <option value="mRNA Vaccines">mRNA Vaccines</option>
              <option value="Plant Biotechnology">Plant Biotechnology</option>
              <option value="Synthetic Biology">Synthetic Biology</option>
            </select>
          </div>
        </div>
      </div>

      {/* Research Papers List */}
      <div className="space-y-4">
        <div className="text-xs text-slate-500 pb-1">
          Showing <strong className="text-slate-900 dark:text-slate-100 font-mono">{filteredPapers.length}</strong> peer-reviewed articles
        </div>

        {filteredPapers.map((paper) => (
          <article
            key={paper.id}
            className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            {/* Top row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sky-700 dark:text-sky-300">{paper.journal}</span>
                <span>·</span>
                <span className="text-slate-500">{paper.publishedDate}</span>
                {paper.openAccess && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-600 font-semibold">Open Access</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 text-slate-400">
                <span className="font-mono text-[11px]">PMID: {paper.pubmedId}</span>
                <span>·</span>
                <span className="font-mono text-[11px]">Citations: {paper.citationCount}</span>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
              <a
                href={paper.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-sky-600 transition-colors"
              >
                {paper.title}
              </a>
            </h2>

            {/* Authors */}
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Authors: <strong className="text-slate-800 dark:text-slate-200">{paper.authors.join(', ')}</strong>
            </p>

            {/* Abstract */}
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {paper.abstract}
            </p>

            {/* Keywords */}
            <div className="flex flex-wrap gap-1.5 text-xs text-slate-500">
              <span className="text-slate-400 font-medium">Keywords:</span>
              {paper.keywords.map((kw) => (
                <button
                  key={kw}
                  onClick={() => setSearchTerm(kw)}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                >
                  {kw}
                </button>
              ))}
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyCitation(paper)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
                >
                  {copiedDoi === paper.doi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>Cite Article (APA)</span>
                </button>

                <button
                  onClick={() => toggleSaveItem(paper.id, paper.title)}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    isItemSaved(paper.id)
                      ? 'bg-amber-50 text-amber-600 border-amber-200'
                      : 'text-slate-400 hover:text-slate-600 border-slate-200 dark:border-slate-700'
                  }`}
                  title="Bookmark Paper"
                >
                  <Bookmark className="w-4 h-4" fill={isItemSaved(paper.id) ? 'currentColor' : 'none'} />
                </button>
              </div>

              <a
                href={paper.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-semibold text-sky-600 hover:underline"
              >
                <span>Read Full Paper on {paper.journal.split(' ')[0]}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
