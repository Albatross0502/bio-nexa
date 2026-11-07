/**
 * BIO-NEXA Google Jobs Search Integration Service
 * 
 * Generates properly encoded Google Jobs search queries and discovery URLs.
 * In accordance with legal and architectural guidelines:
 * - Directs users to Google Search's native jobs experience (`ibp=htl;jobs`)
 * - No scraping or unauthorized backend crawling
 * - No claims of private Google APIs or official partnership
 * - Empowers candidates to discover real vacancies and proceed to employers' official application pages
 */

export interface GoogleJobsSearchConfig {
  discipline: string;
  location?: string;
  additionalKeywords?: string;
  experienceLevel?: string;
  employmentType?: string;
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

export interface SearchSuggestion {
  id: string;
  label: string;
  discipline: GoogleJobsDiscipline;
  location: string;
  additionalKeywords?: string;
  description: string;
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
  'Remote / Work from Home',
  'United States / Global'
];

export const GOOGLE_JOBS_SUGGESTIONS: SearchSuggestion[] = [
  {
    id: 'sugg-1',
    label: 'Biotechnology R&D - Bengaluru',
    discipline: 'Biotechnology',
    location: 'Bengaluru',
    additionalKeywords: 'R&D scientist fermentation',
    description: 'Upstream bioprocessing, recombinant proteins, and biopharma R&D.'
  },
  {
    id: 'sugg-2',
    label: 'QC / QA Microbiologist - Hyderabad',
    discipline: 'Microbiology',
    location: 'Hyderabad',
    additionalKeywords: 'QC QA sterility testing cGMP',
    description: 'Sterility testing, microbial limits, and cleanroom environmental monitoring.'
  },
  {
    id: 'sugg-3',
    label: 'Molecular Biology Research Assistant',
    discipline: 'Molecular Biology',
    location: 'Delhi NCR',
    additionalKeywords: 'CSIR ICMR PCR cloning',
    description: 'PCR amplification, plasmid cloning, and diagnostic assay execution.'
  },
  {
    id: 'sugg-4',
    label: 'Bioinformatics & NGS Analyst',
    discipline: 'Bioinformatics',
    location: 'Remote',
    additionalKeywords: 'RNA-seq Python Nextflow',
    description: 'Next-generation sequencing pipelines, variant calling, and transcriptomics.'
  },
  {
    id: 'sugg-5',
    label: 'Clinical Research Associate (CRA)',
    discipline: 'Clinical Research',
    location: 'Pune',
    additionalKeywords: 'GCP trial monitoring CRO',
    description: 'Good Clinical Practice (GCP), trial monitoring, and regulatory auditing.'
  },
  {
    id: 'sugg-6',
    label: 'Pharmaceutical Formulation Scientist',
    discipline: 'Pharmaceutical Sciences',
    location: 'Ahmedabad',
    additionalKeywords: 'formulation R&D HPLC OSD',
    description: 'Oral solid dosage, injectable formulation, and stability testing.'
  },
  {
    id: 'sugg-7',
    label: 'Biotechnology Summer Internships',
    discipline: 'Biotechnology internships',
    location: 'India',
    additionalKeywords: 'intern trainee fresher 2026',
    description: 'Industrial and academic traineeships for final-year college students.'
  },
  {
    id: 'sugg-8',
    label: 'Research Assistant / JRF Vacancies',
    discipline: 'Research Assistant positions',
    location: 'India',
    additionalKeywords: 'DST DBT project fellow university',
    description: 'Sponsored institutional research grants and fellowship projects.'
  },
  {
    id: 'sugg-9',
    label: 'Genetics & CRISPR Research Positions',
    discipline: 'Genetics',
    location: 'Bengaluru',
    additionalKeywords: 'gene therapy cytogenetics CRISPR',
    description: 'Genetic screening, vector engineering, and mammalian cell genetics.'
  },
  {
    id: 'sugg-10',
    label: 'Biochemistry Analytical Chemist',
    discipline: 'Biochemistry',
    location: 'Mumbai',
    additionalKeywords: 'protein purification chromatography ELISA',
    description: 'Spectrophotometry, enzyme assays, and downstream bioseparations.'
  }
];

/**
 * Constructs a high-intent search query tailored for Google's job search algorithms.
 */
export function buildGoogleJobsQuery(config: GoogleJobsSearchConfig): string {
  const parts: string[] = [];

  // 1. Discipline or role
  const discipline = (config.discipline || 'Biotechnology').trim();
  
  // If the discipline already contains "internships" or "positions", adjust naturally
  if (discipline.toLowerCase().includes('internship')) {
    parts.push(discipline);
  } else if (discipline.toLowerCase().includes('position')) {
    parts.push(discipline);
  } else {
    parts.push(`${discipline} jobs`);
  }

  // 2. Additional keywords (e.g. CRISPR, Fresher, QC, etc.)
  if (config.additionalKeywords && config.additionalKeywords.trim()) {
    parts.push(config.additionalKeywords.trim());
  }

  // 3. Experience level or employment type if specified
  if (config.experienceLevel && config.experienceLevel !== 'all') {
    parts.push(config.experienceLevel);
  }
  if (config.employmentType && config.employmentType !== 'all') {
    parts.push(config.employmentType);
  }

  // 4. Location
  if (config.location && config.location.trim()) {
    const loc = config.location.trim();
    if (loc.toLowerCase() !== 'all') {
      parts.push(`in ${loc}`);
    }
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Builds the direct destination URL that opens Google Search in Jobs mode (`ibp=htl;jobs`).
 */
export function buildGoogleJobsUrl(queryOrConfig: string | GoogleJobsSearchConfig): string {
  const query = typeof queryOrConfig === 'string'
    ? queryOrConfig.trim()
    : buildGoogleJobsQuery(queryOrConfig);

  const encodedQuery = encodeURIComponent(query);
  // `ibp=htl;jobs` triggers Google's full-screen job discovery card on mobile and desktop
  return `https://www.google.com/search?q=${encodedQuery}&ibp=htl;jobs`;
}

/**
 * Helper to generate a standard Google web search fallback URL
 */
export function buildGoogleWebSearchUrl(queryOrConfig: string | GoogleJobsSearchConfig): string {
  const query = typeof queryOrConfig === 'string'
    ? queryOrConfig.trim()
    : buildGoogleJobsQuery(queryOrConfig);

  const encodedQuery = encodeURIComponent(query);
  return `https://www.google.com/search?q=${encodedQuery}`;
}
