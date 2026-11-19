/**
 * BIO-INEXA Google Jobs Search Integration Service (Phase 10)
 *
 * Constructs properly encoded Google Search Jobs URLs (`ibp=htl;jobs`) and curates
 * official biotechnology, pharmaceutical, clinical research, and national institute
 * career portal destinations.
 *
 * Governance & Transparency:
 * - Google does not provide a public Jobs Search API; this module strictly generates
 *   transparent external search links to Google Search's native jobs interface.
 * - Zero scraping, zero unauthorized crawling, and zero automatic importing of Google
 *   search results into the BIO-INEXA database.
 * - Empowers life science candidates to discover real vacancies and apply directly on
 *   official employer career portals.
 */

export interface GoogleJobsSearchConfig {
  discipline: string;
  location?: string;
  additionalKeywords?: string;
  experienceLevel?: string;
  employmentType?: string;
  remoteOnly?: boolean;
  employerName?: string;
}

export const GOOGLE_JOBS_DISCIPLINES = [
  'Biotechnology',
  'Microbiology',
  'Molecular Biology',
  'Biochemistry',
  'Genetics',
  'Bioinformatics',
  'Pharmaceutical Sciences',
  'Clinical Research',
  'Biotechnology internships',
  'Research Assistant positions'
] as const;

export type GoogleJobsDiscipline = typeof GOOGLE_JOBS_DISCIPLINES[number];

export type GoogleJobsSearchCategory =
  | 'all'
  | 'biotechnology'
  | 'internships'
  | 'fresher'
  | 'research-assistant'
  | 'pharmaceutical'
  | 'clinical-research'
  | 'molecular-biology'
  | 'bioinformatics'
  | 'remote';

export interface SearchSuggestion {
  id: string;
  label: string;
  category: Exclude<GoogleJobsSearchCategory, 'all'>;
  discipline: GoogleJobsDiscipline;
  location: string;
  additionalKeywords?: string;
  experienceLevel?: string;
  employmentType?: string;
  remoteOnly?: boolean;
  description: string;
}

export interface GoogleJobsCategoryTrack {
  id: GoogleJobsSearchCategory;
  label: string;
  shortLabel: string;
  preset?: GoogleJobsSearchConfig;
}

export type EmployerPortalSector =
  | 'Biopharma & Biotech'
  | 'Pharmaceutical'
  | 'Clinical Research & Genomics'
  | 'National Research Institutes';

export interface OfficialEmployerPortal {
  id: string;
  name: string;
  sector: EmployerPortalSector;
  headquarters: string;
  focusAreas: string[];
  careersUrl: string;
  employerSearchKeyword: string;
}

export const POPULAR_BIOTECH_LOCATIONS = [
  'Bengaluru, Karnataka',
  'Hyderabad, Telangana',
  'Pune, Maharashtra',
  'Delhi NCR',
  'Mumbai, Maharashtra',
  'Ahmedabad / Vadodara, Gujarat',
  'Chennai, Tamil Nadu',
  'Kolkata, West Bengal',
  'Chandigarh / Mohali',
  'India',
  'Remote / Work from Home',
  'United States / Global'
] as const;

export const QUICK_LOCATION_HUBS = [
  'Bengaluru',
  'Hyderabad',
  'Pune',
  'Delhi NCR',
  'Mumbai',
  'Ahmedabad',
  'Chennai',
  'India',
  'Remote'
] as const;

export const GOOGLE_JOBS_CATEGORY_TRACKS: GoogleJobsCategoryTrack[] = [
  { id: 'all', label: 'All Life Sciences', shortLabel: 'All' },
  {
    id: 'biotechnology',
    label: 'Biotechnology',
    shortLabel: 'Biotech',
    preset: {
      discipline: 'Biotechnology',
      location: 'Bengaluru',
      additionalKeywords: 'R&D bioprocess upstream downstream'
    }
  },
  {
    id: 'internships',
    label: 'Internships',
    shortLabel: 'Internships',
    preset: {
      discipline: 'Biotechnology internships',
      location: 'India',
      additionalKeywords: 'summer trainee lab student',
      employmentType: 'Internship'
    }
  },
  {
    id: 'fresher',
    label: 'Fresher Jobs',
    shortLabel: 'Fresher',
    preset: {
      discipline: 'Biotechnology',
      location: 'India',
      additionalKeywords: 'BSc MSc BTech graduate trainee',
      experienceLevel: 'Fresher entry level'
    }
  },
  {
    id: 'research-assistant',
    label: 'Research Assistant',
    shortLabel: 'Research Asst',
    preset: {
      discipline: 'Research Assistant positions',
      location: 'India',
      additionalKeywords: 'JRF project fellow CSIR DBT ICMR'
    }
  },
  {
    id: 'pharmaceutical',
    label: 'Pharmaceutical',
    shortLabel: 'Pharma',
    preset: {
      discipline: 'Pharmaceutical Sciences',
      location: 'Hyderabad',
      additionalKeywords: 'formulation QA QC HPLC regulatory affairs'
    }
  },
  {
    id: 'clinical-research',
    label: 'Clinical Research',
    shortLabel: 'Clinical',
    preset: {
      discipline: 'Clinical Research',
      location: 'Pune',
      additionalKeywords: 'CRA CRC clinical trials GCP pharmacovigilance'
    }
  },
  {
    id: 'molecular-biology',
    label: 'Molecular Biology',
    shortLabel: 'Molecular Bio',
    preset: {
      discipline: 'Molecular Biology',
      location: 'Delhi NCR',
      additionalKeywords: 'PCR qPCR cloning CRISPR cell culture'
    }
  },
  {
    id: 'bioinformatics',
    label: 'Bioinformatics',
    shortLabel: 'Bioinformatics',
    preset: {
      discipline: 'Bioinformatics',
      location: 'Bengaluru',
      additionalKeywords: 'NGS RNA-seq Python R computational biology'
    }
  },
  {
    id: 'remote',
    label: 'Remote Jobs',
    shortLabel: 'Remote',
    preset: {
      discipline: 'Bioinformatics',
      location: 'India',
      additionalKeywords: 'clinical data management medical writing genomics',
      remoteOnly: true
    }
  }
];

export const GOOGLE_JOBS_SUGGESTIONS: SearchSuggestion[] = [
  {
    id: 'sugg-1',
    category: 'biotechnology',
    label: 'Biotechnology R&D & Bioprocess - Bengaluru',
    discipline: 'Biotechnology',
    location: 'Bengaluru',
    additionalKeywords: 'R&D scientist upstream fermentation biologics',
    description: 'Upstream bioprocessing, recombinant proteins, mammalian cell culture, and biopharma R&D.'
  },
  {
    id: 'sugg-2',
    category: 'fresher',
    label: 'Biotechnology Fresher & Graduate Trainee - India',
    discipline: 'Biotechnology',
    location: 'India',
    additionalKeywords: 'BSc MSc BTech trainee lab analyst',
    experienceLevel: 'Fresher entry level',
    employmentType: 'Full-time',
    description: 'Entry-level graduate biotech roles across QC labs, biomanufacturing, and R&D startups.'
  },
  {
    id: 'sugg-3',
    category: 'internships',
    label: 'Biotechnology & Life Sciences Internships - India',
    discipline: 'Biotechnology internships',
    location: 'India',
    additionalKeywords: 'summer intern industrial trainee laboratory',
    employmentType: 'Internship',
    description: 'Academic and industrial wet-lab or computational traineeships for undergraduate and M.Sc students.'
  },
  {
    id: 'sugg-4',
    category: 'research-assistant',
    label: 'Research Assistant / JRF & Project Fellow',
    discipline: 'Research Assistant positions',
    location: 'India',
    additionalKeywords: 'CSIR DBT ICMR DST JRF project associate',
    experienceLevel: 'Junior Project Fellow',
    description: 'Funded institutional research fellowships at CSIR, IIT, IISc, AIIMS, and central universities.'
  },
  {
    id: 'sugg-5',
    category: 'pharmaceutical',
    label: 'Pharmaceutical Formulation, QA & QC - Hyderabad',
    discipline: 'Pharmaceutical Sciences',
    location: 'Hyderabad',
    additionalKeywords: 'formulation R&D HPLC QA QC cGMP',
    description: 'Oral solid dosage, sterile injectables, analytical development, and cGMP quality assurance.'
  },
  {
    id: 'sugg-6',
    category: 'clinical-research',
    label: 'Clinical Research Associate (CRA) & Pharmacovigilance',
    discipline: 'Clinical Research',
    location: 'Pune',
    additionalKeywords: 'CRA CRC GCP clinical trials CRO',
    description: 'Good Clinical Practice (GCP), site monitoring, clinical data management, and drug safety.'
  },
  {
    id: 'sugg-7',
    category: 'molecular-biology',
    label: 'Molecular Biology Scientist & PCR Diagnostics',
    discipline: 'Molecular Biology',
    location: 'Delhi NCR',
    additionalKeywords: 'PCR qPCR cloning CRISPR Western blot',
    description: 'Molecular diagnostics, plasmid engineering, gene editing assays, and assay validation.'
  },
  {
    id: 'sugg-8',
    category: 'bioinformatics',
    label: 'Bioinformatics & NGS Pipeline Engineer',
    discipline: 'Bioinformatics',
    location: 'Bengaluru',
    additionalKeywords: 'NGS RNA-seq Python R Nextflow genomics',
    description: 'Next-generation sequencing pipelines, variant calling, transcriptomics, and computational biology.'
  },
  {
    id: 'sugg-9',
    category: 'remote',
    label: 'Remote Bioinformatics & Clinical Data Roles',
    discipline: 'Bioinformatics',
    location: 'India',
    additionalKeywords: 'genomics clinical data medical writing',
    remoteOnly: true,
    description: 'Work-from-home computational biology, biostatistics, pharmacovigilance, and scientific writing roles.'
  },
  {
    id: 'sugg-10',
    category: 'remote',
    label: 'Remote Clinical Research & Regulatory Affairs',
    discipline: 'Clinical Research',
    location: 'India',
    additionalKeywords: 'pharmacovigilance regulatory affairs clinical data',
    remoteOnly: true,
    description: 'Distributed CRO roles in clinical trial documentation, safety reporting, and regulatory submissions.'
  },
  {
    id: 'sugg-11',
    category: 'pharmaceutical',
    label: 'QC / QA Microbiologist - Biopharma Cleanroom',
    discipline: 'Microbiology',
    location: 'Hyderabad',
    additionalKeywords: 'QC QA sterility testing endotoxin cGMP',
    description: 'Sterility testing, microbial limit assays, and Grade A/B cleanroom environmental monitoring.'
  },
  {
    id: 'sugg-12',
    category: 'molecular-biology',
    label: 'Genetics & CRISPR Gene Therapy Positions',
    discipline: 'Genetics',
    location: 'Bengaluru',
    additionalKeywords: 'gene therapy cytogenetics CRISPR AAV',
    description: 'Genetic screening, viral vector engineering, and mammalian cell genetics laboratories.'
  },
  {
    id: 'sugg-13',
    category: 'biotechnology',
    label: 'Biochemistry & Protein Purification Analyst',
    discipline: 'Biochemistry',
    location: 'Mumbai',
    additionalKeywords: 'protein purification chromatography ELISA AKTA',
    description: 'Downstream bioseparations, enzyme kinetics, ELISA, and biophysical characterization.'
  },
  {
    id: 'sugg-14',
    category: 'internships',
    label: 'Remote Bioinformatics & Computational Biology Internship',
    discipline: 'Biotechnology internships',
    location: 'India',
    additionalKeywords: 'bioinformatics NGS Python molecular docking',
    employmentType: 'Internship',
    remoteOnly: true,
    description: 'Remote dry-lab internships focused on sequence analysis, docking, and transcriptomics.'
  }
];

export const OFFICIAL_EMPLOYER_CAREER_PORTALS: OfficialEmployerPortal[] = [
  {
    id: 'emp-biocon',
    name: 'Biocon Biologics',
    sector: 'Biopharma & Biotech',
    headquarters: 'Bengaluru, Karnataka',
    focusAreas: ['Biosimilars', 'Upstream/Downstream Bioprocess', 'QA/QC', 'Regulatory'],
    careersUrl: 'https://www.biocon.com/careers/',
    employerSearchKeyword: 'Biocon Biologics'
  },
  {
    id: 'emp-syngene',
    name: 'Syngene International',
    sector: 'Biopharma & Biotech',
    headquarters: 'Bengaluru, Karnataka',
    focusAreas: ['Discovery Biology', 'Biologics', 'Molecular Biology', 'Bioinformatics'],
    careersUrl: 'https://www.syngeneintl.com/careers/',
    employerSearchKeyword: 'Syngene International'
  },
  {
    id: 'emp-sii',
    name: 'Serum Institute of India',
    sector: 'Biopharma & Biotech',
    headquarters: 'Pune, Maharashtra',
    focusAreas: ['Vaccines', 'Microbiology QC', 'Fermentation', 'Sterile Manufacturing'],
    careersUrl: 'https://www.seruminstitute.com/careers.php',
    employerSearchKeyword: 'Serum Institute of India'
  },
  {
    id: 'emp-bharat-biotech',
    name: 'Bharat Biotech',
    sector: 'Biopharma & Biotech',
    headquarters: 'Hyderabad, Telangana',
    focusAreas: ['Vaccine R&D', 'Virology', 'Immunology', 'Bioprocessing'],
    careersUrl: 'https://www.bharatbiotech.com/careers.html',
    employerSearchKeyword: 'Bharat Biotech'
  },
  {
    id: 'emp-drreddys',
    name: "Dr. Reddy's Laboratories",
    sector: 'Pharmaceutical',
    headquarters: 'Hyderabad, Telangana',
    focusAreas: ['Biologics', 'Formulation R&D', 'Analytical HPLC', 'Quality Assurance'],
    careersUrl: 'https://careers.drreddys.com/',
    employerSearchKeyword: "Dr Reddy's Laboratories"
  },
  {
    id: 'emp-cipla',
    name: 'Cipla Limited',
    sector: 'Pharmaceutical',
    headquarters: 'Mumbai, Maharashtra',
    focusAreas: ['Pharma R&D', 'Microbiology', 'Regulatory Affairs', 'Quality Control'],
    careersUrl: 'https://www.cipla.com/careers',
    employerSearchKeyword: 'Cipla'
  },
  {
    id: 'emp-sunpharma',
    name: 'Sun Pharmaceutical Industries',
    sector: 'Pharmaceutical',
    headquarters: 'Mumbai / Vadodara',
    focusAreas: ['Pharmaceutical Sciences', 'Clinical Development', 'QA/QC', 'Pharmacovigilance'],
    careersUrl: 'https://sunpharma.com/careers/',
    employerSearchKeyword: 'Sun Pharma'
  },
  {
    id: 'emp-iqvia',
    name: 'IQVIA India',
    sector: 'Clinical Research & Genomics',
    headquarters: 'Bengaluru / Mumbai / Remote',
    focusAreas: ['Clinical Research (CRA)', 'Clinical Data Management', 'Biostatistics', 'Drug Safety'],
    careersUrl: 'https://jobs.iqvia.com/',
    employerSearchKeyword: 'IQVIA'
  },
  {
    id: 'emp-parexel',
    name: 'Parexel',
    sector: 'Clinical Research & Genomics',
    headquarters: 'Hyderabad / Bengaluru / Remote',
    focusAreas: ['Clinical Trials', 'Regulatory Consulting', 'Medical Writing', 'Pharmacovigilance'],
    careersUrl: 'https://jobs.parexel.com/',
    employerSearchKeyword: 'Parexel'
  },
  {
    id: 'emp-strand',
    name: 'Strand Life Sciences',
    sector: 'Clinical Research & Genomics',
    headquarters: 'Bengaluru, Karnataka',
    focusAreas: ['Clinical Genomics', 'Bioinformatics', 'NGS Pipelines', 'Molecular Diagnostics'],
    careersUrl: 'https://strandls.com/careers/',
    employerSearchKeyword: 'Strand Life Sciences'
  },
  {
    id: 'emp-csir',
    name: 'CSIR India (National Labs)',
    sector: 'National Research Institutes',
    headquarters: 'Pan-India (IGIB, CCMB, IMTECH, CDRI)',
    focusAreas: ['JRF / SRF', 'Project Associate', 'Molecular Biology', 'Genomics'],
    careersUrl: 'https://www.csir.res.in/career-opportunities/recruitment',
    employerSearchKeyword: 'CSIR'
  },
  {
    id: 'emp-dbt',
    name: 'Department of Biotechnology (DBT India)',
    sector: 'National Research Institutes',
    headquarters: 'New Delhi / Autonomous Institutes',
    focusAreas: ['DBT Fellowships', 'Research Assistant', 'Translational Biotech', 'Internships'],
    careersUrl: 'https://dbtindia.gov.in/whats-new/vacancies',
    employerSearchKeyword: 'DBT India'
  },
  {
    id: 'emp-icmr',
    name: 'ICMR Recruitment Portal',
    sector: 'National Research Institutes',
    headquarters: 'New Delhi / Pan-India',
    focusAreas: ['Biomedical Research', 'Clinical Epidemiology', 'Microbiology', 'Project Technical'],
    careersUrl: 'https://www.icmr.gov.in/careers',
    employerSearchKeyword: 'ICMR'
  },
  {
    id: 'emp-iisc',
    name: 'IISc Bengaluru — Biological Sciences',
    sector: 'National Research Institutes',
    headquarters: 'Bengaluru, Karnataka',
    focusAreas: ['Research Associate', 'Project Assistant', 'Biochemistry', 'Molecular Biophysics'],
    careersUrl: 'https://iisc.ac.in/positions-open/',
    employerSearchKeyword: 'IISc Bengaluru'
  },
  {
    id: 'emp-ncbs',
    name: 'NCBS-TIFR Bengaluru',
    sector: 'National Research Institutes',
    headquarters: 'Bengaluru, Karnataka',
    focusAreas: ['Cell Biology', 'Neurobiology', 'Computational Biology', 'Lab Internships'],
    careersUrl: 'https://www.ncbs.res.in/jobportal/',
    employerSearchKeyword: 'NCBS TIFR'
  }
];

function sanitizeQueryFragment(value?: string): string {
  if (!value) return '';
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRemoteLocationText(location: string): boolean {
  const lower = location.toLowerCase();
  return (
    lower === 'remote' ||
    lower === 'work from home' ||
    lower === 'wfh' ||
    lower.startsWith('remote /') ||
    lower.startsWith('remote -')
  );
}

/**
 * Constructs a clean, high-intent natural language search query tailored for Google Jobs discovery.
 */
export function buildGoogleJobsQuery(config: GoogleJobsSearchConfig): string {
  const parts: string[] = [];

  // 1. Discipline or specialized role track
  const discipline = sanitizeQueryFragment(config.discipline) || 'Biotechnology';
  const lowerDiscipline = discipline.toLowerCase();

  if (
    lowerDiscipline.includes('internship') ||
    lowerDiscipline.includes('position') ||
    lowerDiscipline.includes('jobs') ||
    lowerDiscipline.includes('fellowship')
  ) {
    parts.push(discipline);
  } else {
    parts.push(`${discipline} jobs`);
  }

  // 2. Employer scope (if targeting a specific official employer)
  const employerName = sanitizeQueryFragment(config.employerName);
  if (employerName) {
    parts.push(employerName);
  }

  // 3. Additional lab/role keywords (e.g. CRISPR, Fresher, HPLC, NGS, CSIR)
  const additionalKeywords = sanitizeQueryFragment(config.additionalKeywords);
  if (additionalKeywords) {
    parts.push(additionalKeywords);
  }

  // 4. Experience level and employment type (avoid duplicate tokens)
  const existingTextLower = () => parts.join(' ').toLowerCase();

  const exp = sanitizeQueryFragment(config.experienceLevel);
  if (exp && exp.toLowerCase() !== 'all' && !existingTextLower().includes(exp.toLowerCase())) {
    parts.push(exp);
  }

  const empType = sanitizeQueryFragment(config.employmentType);
  if (empType && empType.toLowerCase() !== 'all' && !existingTextLower().includes(empType.toLowerCase())) {
    parts.push(empType);
  }

  // 5. Location & Remote handling
  const rawLocation = sanitizeQueryFragment(config.location);
  const locationIsRemote = rawLocation ? isRemoteLocationText(rawLocation) : false;
  const wantsRemote = Boolean(config.remoteOnly) || locationIsRemote;

  if (wantsRemote && !existingTextLower().includes('remote')) {
    parts.push('remote');
  }

  if (rawLocation && rawLocation.toLowerCase() !== 'all' && !locationIsRemote) {
    parts.push(`in ${rawLocation}`);
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Builds a strictly encoded destination URL opening Google Search in Jobs mode (`ibp=htl;jobs`).
 * Note: This is an external Google Search redirect link, not a Google Jobs API call.
 */
export function buildGoogleJobsUrl(queryOrConfig: string | GoogleJobsSearchConfig): string {
  const query =
    typeof queryOrConfig === 'string'
      ? sanitizeQueryFragment(queryOrConfig) || 'Biotechnology jobs'
      : buildGoogleJobsQuery(queryOrConfig);

  const encodedQuery = encodeURIComponent(query);
  // `ibp=htl;jobs` opens Google Search's native job discovery interface on desktop & mobile
  return `https://www.google.com/search?q=${encodedQuery}&ibp=htl;jobs`;
}

/**
 * Builds a strictly encoded standard Google web search fallback URL.
 */
export function buildGoogleWebSearchUrl(queryOrConfig: string | GoogleJobsSearchConfig): string {
  const query =
    typeof queryOrConfig === 'string'
      ? sanitizeQueryFragment(queryOrConfig) || 'Biotechnology jobs'
      : buildGoogleJobsQuery(queryOrConfig);

  const encodedQuery = encodeURIComponent(query);
  return `https://www.google.com/search?q=${encodedQuery}`;
}

/**
 * Builds an employer-targeted Google Jobs discovery URL for an official biotech/pharma organization.
 */
export function buildEmployerGoogleJobsUrl(
  portal: Pick<OfficialEmployerPortal, 'employerSearchKeyword' | 'name'>,
  discipline: string = 'Biotechnology',
  location: string = 'India'
): string {
  return buildGoogleJobsUrl({
    discipline,
    employerName: portal.employerSearchKeyword || portal.name,
    location
  });
}

/**
 * Validates that a generated external search or career portal URL is safe, HTTPS, and properly encoded.
 */
export function validateSearchDestinationUrl(url: string): {
  valid: boolean;
  hostname?: string;
  decodedQuery?: string;
  error?: string;
} {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Destination URL must use https://' };
    }
    if (!parsed.hostname) {
      return { valid: false, error: 'Destination URL is missing a hostname' };
    }
    if (parsed.hostname === 'www.google.com' && parsed.pathname === '/search') {
      const q = parsed.searchParams.get('q');
      if (!q || !q.trim()) {
        return { valid: false, error: 'Google search URL is missing query parameter q' };
      }
      return { valid: true, hostname: parsed.hostname, decodedQuery: q };
    }
    return { valid: true, hostname: parsed.hostname };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Malformed URL' };
  }
}
