import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { SEED_NEWS } from '../../data/seedData';
import { NewsArticle } from '../../types';
import {
  Calendar,
  Clock,
  ExternalLink,
  Share2,
  Bookmark,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export const NewsPage: React.FC = () => {
  const { isItemSaved, toggleSaveItem, addToast } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(SEED_NEWS[0]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slugParam = params.get('slug');
    if (slugParam) {
      const match = SEED_NEWS.find((n) => n.slug === slugParam);
      if (match) setActiveArticle(match);
    }
  }, []);

  const filteredNews = SEED_NEWS.filter(
    (n) => selectedCategory === 'all' || n.category === selectedCategory
  );

  const handleShare = (article: NewsArticle) => {
    const url = `${window.location.origin}/news?slug=${article.slug}`;
    navigator.clipboard?.writeText(url);
    addToast('Article link copied to clipboard!', 'info');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Biotechnology Intelligence &amp; Science News
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Stay updated on clinical trials, regulatory approvals, agricultural CRISPR breakthroughs, and national biotechnology policies.
        </p>
      </div>

      {/* Category selector */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {['all', 'Biopharma', 'Agri-Biotech', 'Clinical Trials', 'Genomics', 'Policy & Funding'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-[#0B2A5B] text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            {cat === 'all' ? 'All Coverage' : cat}
          </button>
        ))}
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Article Reader (7 cols) */}
        <div className="lg:col-span-7">
          {activeArticle && (
            <article className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-teal-600">{activeArticle.category}</span>
                <div className="flex items-center gap-3">
                  <span>{activeArticle.publishedDate}</span>
                  <span>·</span>
                  <span>{activeArticle.readTime}</span>
                </div>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {activeArticle.title}
              </h2>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                {activeArticle.summary}
              </div>

              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-4">
                <p>{activeArticle.content}</p>
                <p>
                  As biotechnology innovation accelerates across Southeast Asia and India, centralized platforms like BIO-NEXA ensure researchers, trainees, and industrial stakeholders maintain immediate visibility into regulatory developments and intellectual property disclosures.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="text-slate-500">
                  Primary Source: <strong className="text-slate-800 dark:text-slate-200">{activeArticle.sourceName}</strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleSaveItem(activeArticle.id, activeArticle.title)}
                    className={`p-2 rounded-lg border ${
                      isItemSaved(activeArticle.id)
                        ? 'bg-amber-50 text-amber-600 border-amber-200'
                        : 'text-slate-400 hover:text-slate-600 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Bookmark className="w-4 h-4" fill={isItemSaved(activeArticle.id) ? 'currentColor' : 'none'} />
                  </button>

                  <button
                    onClick={() => handleShare(activeArticle)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  <a
                    href={activeArticle.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-semibold text-[#0B2A5B] dark:text-sky-300 hover:underline ml-2"
                  >
                    <span>View Press Bureau</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </article>
          )}
        </div>

        {/* Sidebar News Feed (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-1">
            Latest Bulletins
          </div>

          {filteredNews.map((news) => {
            const isSelected = activeArticle?.id === news.id;
            return (
              <div
                key={news.id}
                onClick={() => setActiveArticle(news)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#0B2A5B] bg-blue-50/40 dark:bg-slate-800 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{news.category}</span>
                  <span>{news.readTime}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {news.title}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                  {news.summary}
                </p>
                <div className="text-[10px] text-slate-400 mt-2">
                  {news.sourceName} · {news.publishedDate}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
