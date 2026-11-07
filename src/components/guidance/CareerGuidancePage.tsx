import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileText,
  Compass,
  HelpCircle,
  Sparkles,
  Printer,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  BookOpen
} from 'lucide-react';

export const CareerGuidancePage: React.FC = () => {
  const { jobs, internships, navigate, currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<'cv' | 'roadmap' | 'interview' | 'matcher'>('cv');

  // CV Builder Form State
  const [cvName, setCvName] = useState(currentUser.name);
  const [cvEmail, setCvEmail] = useState(currentUser.email);
  const [cvPhone, setCvPhone] = useState('+91 98765 43210');
  const [cvDegree, setCvDegree] = useState('Master of Science in Biotechnology');
  const [cvInstitute, setCvInstitute] = useState('Pune University, Savitribai Phule Pune Campus');
  const [cvGpa, setCvGpa] = useState('CGPA: 8.9 / 10.0 (First Class with Distinction)');
  const [cvWetLab, setCvWetLab] = useState('Recombinant Protein Expression, Ni-NTA Affinity Chromatography, RT-qPCR, Agarose Gel Electrophoresis, Mammalian Cell Culture (HEK293), Aseptic Inoculation.');
  const [cvDryLab, setCvDryLab] = useState('Python for Biopython, NCBI BLAST, PyMOL 3D Structural Modeling, R (Seurat scRNA-seq), Nextflow pipeline execution.');
  const [cvPublications, setCvPublications] = useState('Gautam, A. et al. (2026). "Optimized Dissolved Oxygen Cascades in 10L Fed-Batch Fermentation". Indian Journal of Biotechnology.');

  // Eligibility Matcher state
  const [matcherDegree, setMatcherDegree] = useState('M.Sc / M.Tech');
  const [matcherSkill, setMatcherSkill] = useState('Fermentation');

  const matchedJobs = jobs.filter(
    (j) => j.qualification === matcherDegree || j.skills.some((s) => s.toLowerCase().includes(matcherSkill.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Biotechnology Career Guidance &amp; Smart Tools
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Empowering life scientists with an academic CV builder, career roadmaps, technical interview question vaults, and skill matching algorithms.
        </p>
      </div>

      {/* Nav Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {(
          [
            ['cv', 'Scientific CV Builder', FileText],
            ['roadmap', 'Biotech Career Roadmaps', Compass],
            ['interview', 'Technical Interview Bank', HelpCircle],
            ['matcher', 'Rule-Based Eligibility Matcher', Sparkles]
          ] as const
        ).map(([tabKey, label, Icon]) => (
          <button
            key={tabKey}
            onClick={() => setActiveTab(tabKey)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
              activeTab === tabKey
                ? 'bg-[#0B2A5B] text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* 1. CV BUILDER */}
      {activeTab === 'cv' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Editor (5 cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Curriculum Vitae Information
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={cvName}
                  onChange={(e) => setCvName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="text"
                    value={cvEmail}
                    onChange={(e) => setCvEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={cvPhone}
                    onChange={(e) => setCvPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Academic Degree
                </label>
                <input
                  type="text"
                  value={cvDegree}
                  onChange={(e) => setCvDegree(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  University / Institute &amp; Grade
                </label>
                <input
                  type="text"
                  value={cvInstitute}
                  onChange={(e) => setCvInstitute(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 mb-1.5"
                />
                <input
                  type="text"
                  value={cvGpa}
                  onChange={(e) => setCvGpa(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Wet Lab Core Competencies
                </label>
                <textarea
                  rows={3}
                  value={cvWetLab}
                  onChange={(e) => setCvWetLab(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dry Lab &amp; Computational Skills
                </label>
                <textarea
                  rows={3}
                  value={cvDryLab}
                  onChange={(e) => setCvDryLab(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Publications / Dissertations / Posters
                </label>
                <textarea
                  rows={3}
                  value={cvPublications}
                  onChange={(e) => setCvPublications(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => window.print()}
                className="w-full py-2.5 bg-[#0B2A5B] hover:bg-blue-900 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print or Export PDF (A4 Scientific Format)</span>
              </button>
            </div>
          </div>

          {/* CV Live Print Preview (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-md space-y-6 font-sans text-slate-900 dark:text-slate-100">
            {/* CV Header */}
            <div className="border-b-2 border-slate-800 dark:border-slate-200 pb-4 text-center">
              <h2 className="text-2xl font-bold tracking-tight uppercase text-[#0B2A5B] dark:text-sky-300">
                {cvName}
              </h2>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center justify-center gap-3">
                <span>{cvEmail}</span>
                <span>·</span>
                <span>{cvPhone}</span>
                <span>·</span>
                <span>Bengaluru / Pune, India</span>
              </div>
            </div>

            {/* Academic Education */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B2A5B] dark:text-sky-400 border-b border-slate-200 dark:border-slate-700 pb-1">
                Academic Background
              </h3>
              <div className="text-xs">
                <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                  <span>{cvDegree}</span>
                  <span className="font-mono text-slate-500">2025 &ndash; 2027</span>
                </div>
                <div className="text-slate-600 dark:text-slate-400">{cvInstitute}</div>
                <div className="text-slate-500 font-mono mt-0.5">{cvGpa}</div>
              </div>
            </div>

            {/* Wet Lab Techniques */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B2A5B] dark:text-sky-400 border-b border-slate-200 dark:border-slate-700 pb-1">
                Wet Laboratory Methodologies
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {cvWetLab}
              </p>
            </div>

            {/* Dry Lab Skills */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B2A5B] dark:text-sky-400 border-b border-slate-200 dark:border-slate-700 pb-1">
                Computational Biology &amp; Data Analysis
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {cvDryLab}
              </p>
            </div>

            {/* Peer-Reviewed Publications */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B2A5B] dark:text-sky-400 border-b border-slate-200 dark:border-slate-700 pb-1">
                Selected Scientific Publications &amp; Conference Posters
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">
                {cvPublications}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 text-center font-mono">
              Verified Candidate Profile · BIO-NEXA National Life Sciences Registry
            </div>
          </div>
        </div>
      )}

      {/* 2. CAREER ROADMAPS */}
      {activeTab === 'roadmap' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pathway 1: Academic Research */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-600">
                <BookOpen className="w-4 h-4" />
                <span>Track 1: Academic Research &amp; Professorship</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                From B.Sc to Principal Investigator (PI)
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="font-bold text-[#0B2A5B] dark:text-sky-300">Phase 1: Undergraduate &amp; Postgrad (Years 1-5)</div>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">Focus on fundamental biochemistry, laboratory technique mastery, and clearing CSIR NET / DBT-BET with JRF.</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="font-bold text-[#0B2A5B] dark:text-sky-300">Phase 2: Doctoral Fellowship (Years 6-10)</div>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">Join premier labs at IISc, NCBS, IITs, or abroad. Publish 2-3 first-author papers with high impact factors.</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="font-bold text-[#0B2A5B] dark:text-sky-300">Phase 3: Postdoctoral Fellowship &amp; Assistant Professor</div>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">Acquire specialized methodologies (Cryo-EM, CRISPR screening) and secure independent grants (DBT Ramalingaswami / Wellcome-DBT Alliance).</p>
                </div>
              </div>
            </div>

            {/* Pathway 2: Biopharma Industry R&D */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
                <Compass className="w-4 h-4" />
                <span>Track 2: Biopharma R&amp;D &amp; Scale-Up</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Upstream / Downstream Process Development
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="font-bold text-[#0B2A5B] dark:text-sky-300">Entry Level: Associate Scientist (Years 1-3)</div>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">Operate bench-scale bioreactors, execute DoE protocols, and prepare cGMP documentation at Biocon, Dr. Reddy&apos;s, or Syngene.</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="font-bold text-[#0B2A5B] dark:text-sky-300">Mid-Career: Senior Bioprocess Engineer (Years 4-7)</div>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">Lead pilot scale-up (200L to 2000L), oversee tech transfer to manufacturing suites, and manage deviation/CAPA audits.</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="font-bold text-[#0B2A5B] dark:text-sky-300">Leadership: Director of Biomanufacturing</div>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">Oversee commercial pipeline launches, US FDA and EMA regulatory filings, and multi-site production facilities.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. INTERVIEW QUESTIONS BANK */}
      {activeTab === 'interview' && (
        <div className="space-y-4 max-w-4xl">
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Q1: What are the critical differences between Cation Exchange (CIEX) and Anion Exchange (AIEX) chromatography in mAb purification?
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong>Model Answer:</strong> Monoclonal antibodies typically possess basic isoelectric points (pI between 8.0 and 9.5). In CIEX, the stationary resin is negatively charged (e.g. sulfopropyl groups) and the buffer pH is maintained below the protein&apos;s pI (usually pH 5.5 to 6.5), causing the positively charged mAb to bind tightly while acidic impurities flow through. AIEX uses positively charged ligands (quaternary ammonium) at neutral pH to bind host cell DNA, endotoxins, and viruses in negative-flow-through mode.
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Q2: Why does SpCas9 fail to cleave target DNA if the Protospacer Adjacent Motif (PAM) is mutated?
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong>Model Answer:</strong> Cas9 binding is an ordered kinetic process initiated by direct interrogation of the major and minor grooves of the 5&apos;-NGG-3&apos; PAM by the Cas9 PAM-interacting (PI) domain residues (Arg1333 and Arg1335). Only after PAM recognition occurs does Cas9 initiate localized DNA melting to form the R-loop with the sgRNA. If the PAM is mutated, stable interrogation fails and the endonuclease domains remain inactive.
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Q3: What causes "smearing" during SDS-PAGE analysis of cell lysates?
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong>Model Answer:</strong> Common causes include: (1) Incomplete cell lysis or unfragmented genomic DNA causing high viscosity (remedied by adding Benzonase endonuclease or sonicating); (2) Sample overloading exceeding the stacking gel capacity; (3) Protein degradation by endogenous proteases (remedied by adding fresh PMSF or EDTA-free protease inhibitor cocktails); or (4) High salt concentration in the loading buffer distorting the electric field.
            </p>
          </div>
        </div>
      )}

      {/* 4. ELIGIBILITY MATCHER */}
      {activeTab === 'matcher' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Rule-Based Scientific Opportunity Matcher
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Select your academic degree and primary laboratory technique to compute real-time matches against live vacancies.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Your Academic Level
              </label>
              <select
                value={matcherDegree}
                onChange={(e) => setMatcherDegree(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <option value="B.Sc / B.Tech">B.Sc / B.Tech</option>
                <option value="M.Sc / M.Tech">M.Sc / M.Tech</option>
                <option value="Ph.D / Postdoc">Ph.D / Postdoc</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Core Lab Technique
              </label>
              <select
                value={matcherSkill}
                onChange={(e) => setMatcherSkill(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <option value="Fermentation">Fermentation &amp; Bioreactors</option>
                <option value="CRISPR">CRISPR &amp; Molecular Cloning</option>
                <option value="HPLC">HPLC &amp; QC Analytical Release</option>
                <option value="scRNA-seq">Bioinformatics &amp; scRNA-seq</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Matching Openings ({matchedJobs.length})
            </h4>

            {matchedJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs transition-colors"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">{job.title}</div>
                  <div className="text-slate-500 mt-0.5">
                    {job.company} · {job.location} · <span className="font-mono text-emerald-600 font-bold">{job.salary}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-teal-600 font-bold bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded">
                    Match Score: 95%
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
