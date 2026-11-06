import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowRight, CheckCircle2, ShieldCheck, Mail } from 'lucide-react';

export const Footer: React.FC = () => {
  const { navigate, subscribeNewsletter } = useApp();
  const [emailInput, setEmailInput] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (subscribeNewsletter(emailInput)) {
      setSubscribed(true);
      setEmailInput('');
    }
  };

  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800">
          {/* Col 1 & 2: Brand Lockup & Newsletter */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/assets/img/logo.jpeg"
                alt="BIO-NEXA Logo"
                className="h-10 w-auto object-contain rounded bg-white p-0.5"
              />
              <div>
                <span className="text-xl font-bold tracking-tight text-white">BIO-NEXA</span>
                <p className="text-xs font-medium text-teal-400">
                  Connecting Science. Creating Careers.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              The premier ecosystem connecting students, researchers, and biotech enterprises across India and worldwide. Unifying jobs, research fellowships, CSIR/GATE test prep, verified courses, and PubMed discoveries under one rigorous scientific umbrella.
            </p>

            <div className="pt-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 block mb-2">
                Biotech Career & Research Dispatch
              </span>
              {subscribed ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>You are subscribed to weekly biotech alerts.</span>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex gap-2 max-w-md">
                  <div className="relative flex-1">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="scientist@university.edu"
                      className="w-full bg-slate-800 text-xs text-white placeholder-slate-500 pl-9 pr-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-teal-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-[#14A3A0] hover:bg-teal-600 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                  >
                    <span>Join</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Col 3: Opportunities */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-3">
              Careers & Fellowships
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => navigate('/jobs')}
                  className="hover:text-teal-400 transition-colors"
                >
                  Biotech Jobs (R&D / QC)
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/internships')}
                  className="hover:text-teal-400 transition-colors"
                >
                  Summer Research Fellowships
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/scholarships')}
                  className="hover:text-teal-400 transition-colors"
                >
                  DBT-JRF & PMRF Grants
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/dashboard-company')}
                  className="hover:text-teal-400 transition-colors"
                >
                  Post a Job / Internship
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/career-guidance')}
                  className="hover:text-teal-400 transition-colors"
                >
                  Biotech CV Builder & SOP
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Education & Exams */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-3">
              Education & Prep
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => navigate('/courses')}
                  className="hover:text-teal-400 transition-colors"
                >
                  Hands-on Biotech Courses
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/exams?slug=csir-net-life-sciences')}
                  className="hover:text-teal-400 transition-colors"
                >
                  CSIR NET Life Sciences
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/exams?slug=gate-biotechnology-bt')}
                  className="hover:text-teal-400 transition-colors"
                >
                  GATE Biotechnology (BT)
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/verify-certificate')}
                  className="flex items-center gap-1.5 text-teal-400 hover:text-teal-300 font-semibold"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verify Certificate</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Col 5: Research & Foundation */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-3">
              Science & Community
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => navigate('/research')}
                  className="hover:text-teal-400 transition-colors"
                >
                  PubMed & Crossref Hub
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/news')}
                  className="hover:text-teal-400 transition-colors"
                >
                  Biotech Science News
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/community')}
                  className="hover:text-teal-400 transition-colors"
                >
                  Protocol Discussion Forums
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/about')}
                  className="hover:text-teal-400 transition-colors"
                >
                  About BIO-NEXA Mission
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate('/contact')}
                  className="hover:text-teal-400 transition-colors"
                >
                  Contact & Support
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold text-slate-400">
              BIOTECHNOLOGY · INTERNSHIP · EDUCATION · CAREERS
            </span>
            <span className="hidden sm:inline">|</span>
            <span>&copy; {new Date().getFullYear()} BIO-NEXA. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/privacy')}
              className="hover:text-slate-300 transition-colors"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => navigate('/terms')}
              className="hover:text-slate-300 transition-colors"
            >
              Terms of Service
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem('bionexa_welcome_entered');
                window.location.search = '?welcome=1';
              }}
              className="hover:text-teal-400 transition-colors text-slate-400 flex items-center gap-1"
              title="Return to Welcome Landing Screen"
            >
              <span>Welcome Screen</span>
            </button>
            <button
              onClick={() => navigate('/admin')}
              className="hover:text-slate-300 transition-colors text-slate-600"
            >
              Staff Portal
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
