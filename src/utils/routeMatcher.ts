export interface ParsedRoute {
  route: 
    | 'home'
    | 'jobs'
    | 'job-detail'
    | 'biotech-jobs'
    | 'opportunities'
    | 'opportunity-detail'
    | 'workshops'
    | 'internships'
    | 'courses'
    | 'exams'
    | 'scholarships'
    | 'research'
    | 'career-guidance'
    | 'community'
    | 'news'
    | 'dashboard-student'
    | 'dashboard-company'
    | 'admin'
    | 'verify-certificate'
    | 'about'
    | 'contact'
    | 'privacy'
    | 'terms'
    | 'not-found';
  params: {
    id?: string;
    slug?: string;
    query?: string;
  };
  pathname: string;
  search: string;
}

export function parseRoute(currentPath: string): ParsedRoute {
  if (!currentPath) {
    return { route: 'home', params: {}, pathname: '/', search: '' };
  }

  // Separate pathname and search params
  const [rawPath, rawSearch] = currentPath.split('?');
  const pathname = (rawPath === '/' ? '/' : rawPath.replace(/\/+$/, '')).trim() || '/';
  const search = rawSearch || '';
  const searchParams = new URLSearchParams(search);

  const queryId = searchParams.get('id') || undefined;
  const querySlug = searchParams.get('slug') || undefined;
  const queryQ = searchParams.get('q') || undefined;

  // 1. Root / Home
  if (pathname === '/') {
    return { route: 'home', params: { query: queryQ }, pathname, search };
  }

  // 2. Job Detail & Jobs List Routes
  // Matches: /jobs/job-1, /job/job-1, /jobs?id=job-1, /job?id=job-1
  if (pathname === '/jobs' || pathname === '/job') {
    if (queryId) {
      return { route: 'job-detail', params: { id: queryId, query: queryQ }, pathname, search };
    }
    return { route: 'jobs', params: { query: queryQ }, pathname, search };
  }

  const jobsPrefixMatch = pathname.match(/^\/(?:jobs|job)\/([^/]+)$/i);
  if (jobsPrefixMatch) {
    const paramId = decodeURIComponent(jobsPrefixMatch[1]);
    return { route: 'job-detail', params: { id: paramId, query: queryQ }, pathname, search };
  }

  // 3. Biotech Jobs
  if (pathname === '/biotech-jobs') {
    if (queryId) {
      return { route: 'job-detail', params: { id: queryId, query: queryQ }, pathname, search };
    }
    return { route: 'biotech-jobs', params: { query: queryQ }, pathname, search };
  }
  const biotechJobsMatch = pathname.match(/^\/biotech-jobs\/([^/]+)$/i);
  if (biotechJobsMatch) {
    const paramId = decodeURIComponent(biotechJobsMatch[1]);
    return { route: 'job-detail', params: { id: paramId, query: queryQ }, pathname, search };
  }

  // 4. Opportunities
  if (pathname === '/opportunities' || pathname === '/opportunity') {
    if (queryId) {
      return { route: 'opportunity-detail', params: { id: queryId, query: queryQ }, pathname, search };
    }
    return { route: 'opportunities', params: { query: queryQ }, pathname, search };
  }
  const oppPrefixMatch = pathname.match(/^\/(?:opportunities|opportunity)\/([^/]+)$/i);
  if (oppPrefixMatch) {
    const paramId = decodeURIComponent(oppPrefixMatch[1]);
    return { route: 'opportunity-detail', params: { id: paramId, query: queryQ }, pathname, search };
  }

  // 5. Workshops
  if (pathname === '/workshops' || pathname === '/workshop') {
    return { route: 'workshops', params: { id: queryId, query: queryQ }, pathname, search };
  }

  // 6. Internships
  if (pathname === '/internships' || pathname === '/internship') {
    if (queryId) {
      return { route: 'job-detail', params: { id: queryId, query: queryQ }, pathname, search };
    }
    return { route: 'internships', params: { query: queryQ }, pathname, search };
  }
  const internPrefixMatch = pathname.match(/^\/(?:internships|internship)\/([^/]+)$/i);
  if (internPrefixMatch) {
    const paramId = decodeURIComponent(internPrefixMatch[1]);
    return { route: 'job-detail', params: { id: paramId, query: queryQ }, pathname, search };
  }

  // 7. Core Static & Feature Pages
  if (pathname === '/courses') return { route: 'courses', params: { id: queryId, query: queryQ }, pathname, search };
  if (pathname === '/exams') return { route: 'exams', params: { slug: querySlug, query: queryQ }, pathname, search };
  if (pathname === '/scholarships') return { route: 'scholarships', params: { query: queryQ }, pathname, search };
  if (pathname === '/research') return { route: 'research', params: { query: queryQ }, pathname, search };
  if (pathname === '/career-guidance') return { route: 'career-guidance', params: { query: queryQ }, pathname, search };
  if (pathname === '/community') return { route: 'community', params: { query: queryQ }, pathname, search };
  if (pathname === '/news') return { route: 'news', params: { query: queryQ }, pathname, search };
  if (pathname === '/dashboard-student' || pathname === '/dashboard/student') return { route: 'dashboard-student', params: {}, pathname, search };
  if (pathname === '/dashboard-company' || pathname === '/dashboard/company') return { route: 'dashboard-company', params: {}, pathname, search };
  if (pathname === '/admin') return { route: 'admin', params: {}, pathname, search };
  if (pathname === '/verify-certificate') return { route: 'verify-certificate', params: { id: queryId }, pathname, search };
  if (pathname === '/about') return { route: 'about', params: {}, pathname, search };
  if (pathname === '/contact') return { route: 'contact', params: {}, pathname, search };
  if (pathname === '/privacy') return { route: 'privacy', params: {}, pathname, search };
  if (pathname === '/terms') return { route: 'terms', params: {}, pathname, search };

  // 8. Catch-all: Route Not Found (404)
  return {
    route: 'not-found',
    params: {},
    pathname,
    search
  };
}
