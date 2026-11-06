/**
 * BIO-NEXA External Job Search Fallback Generator
 * 
 * Generates pre-filtered, direct search URLs for major job portals (LinkedIn, Naukri, WorkIndia, Google Jobs)
 * respecting their terms of service without unpermitted web scraping.
 */

export interface ExternalSearchPortal {
  id: string;
  name: string;
  badgeColor: string;
  generateUrl: (keyword: string, location: string, branchName?: string) => string;
  description: string;
}

export const EXTERNAL_SEARCH_PORTALS: ExternalSearchPortal[] = [
  {
    id: 'linkedin',
    name: 'LinkedIn Jobs',
    badgeColor: '#0A66C2',
    description: 'Direct search on LinkedIn for verified life science and biotech company postings.',
    generateUrl: (keyword: string, location: string, branchName?: string) => {
      const queryParts = [branchName || 'Biotechnology', keyword].filter(Boolean);
      const query = encodeURIComponent(queryParts.join(' '));
      const loc = encodeURIComponent(location === 'all' || !location ? 'India' : location);
      return `https://www.linkedin.com/jobs/search/?keywords=${query}&location=${loc}&f_TPR=r2592000`;
    }
  },
  {
    id: 'naukri',
    name: 'Naukri.com',
    badgeColor: '#275DF5',
    description: 'Pre-filtered search across pharma, clinical research, QC/QA, and bio-manufacturing on Naukri.',
    generateUrl: (keyword: string, location: string, branchName?: string) => {
      const term = [branchName || 'biotechnology', keyword].filter(Boolean).join('-');
      const cleanTerm = term.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const cleanLoc = (location === 'all' || !location ? 'india' : location).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return `https://www.naukri.com/${cleanTerm}-jobs-in-${cleanLoc}`;
    }
  },
  {
    id: 'workindia',
    name: 'WorkIndia Entry Portal',
    badgeColor: '#FF6B00',
    description: 'Search entry-level lab technician, microbiology, and trainee vacancies across Indian cities.',
    generateUrl: (keyword: string, location: string, branchName?: string) => {
      const term = encodeURIComponent([branchName || 'Biotechnology', keyword].filter(Boolean).join(' '));
      const loc = encodeURIComponent(location === 'all' || !location ? 'India' : location);
      return `https://www.workindia.in/search-jobs/?q=${term}&loc=${loc}`;
    }
  },
  {
    id: 'google_jobs',
    name: 'Google Jobs Hub',
    badgeColor: '#4285F4',
    description: 'Aggregated Google Search indexing public research and industrial career pages.',
    generateUrl: (keyword: string, location: string, branchName?: string) => {
      const q = encodeURIComponent(`${branchName || 'Biotechnology'} ${keyword} jobs in ${location || 'India'}`.trim());
      return `https://www.google.com/search?q=${q}&ibp=htl;jobs`;
    }
  }
];

export function generateExternalSearchUrls(branchName?: string, location?: string) {
  const loc = location || 'India';
  const branch = branchName || 'Biotechnology';
  return {
    linkedin: EXTERNAL_SEARCH_PORTALS.find(p => p.id === 'linkedin')?.generateUrl('', loc, branch) || '',
    naukri: EXTERNAL_SEARCH_PORTALS.find(p => p.id === 'naukri')?.generateUrl('', loc, branch) || '',
    workindia: EXTERNAL_SEARCH_PORTALS.find(p => p.id === 'workindia')?.generateUrl('', loc, branch) || '',
    googleJobs: EXTERNAL_SEARCH_PORTALS.find(p => p.id === 'google_jobs')?.generateUrl('', loc, branch) || '',
  };
}
