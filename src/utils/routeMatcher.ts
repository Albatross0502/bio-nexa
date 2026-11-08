/**
 * Route Matcher Utility for BIO-NEXA Single Page Application
 * Parses window.location paths into structured route definitions and parameters.
 */

export interface ParsedRoute {
  route: string;
  pathname: string;
  params: Record<string, string>;
  queryParams: Record<string, string>;
}

export function parseRoute(rawPath: string): ParsedRoute {
  let pathOnly = rawPath || '/';
  let queryString = '';

  const qIndex = pathOnly.indexOf('?');
  if (qIndex !== -1) {
    queryString = pathOnly.slice(qIndex + 1);
    pathOnly = pathOnly.slice(0, qIndex);
  }

  // Parse query parameters
  const queryParams: Record<string, string> = {};
  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });
  }

  // Clean and normalize pathname
  let pathname = pathOnly.trim();
  if (!pathname.startsWith('/')) {
    pathname = '/' + pathname;
  }
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.replace(/\/+$/, '');
  }

  const params: Record<string, string> = {};

  // If query parameter specifies ?id=... on listing routes
  if (queryParams.id && (pathname === '/jobs' || pathname === '/job' || pathname === '/biotech-jobs' || pathname === '/opportunity' || pathname === '/opportunities')) {
    params.id = queryParams.id;
    return {
      route: 'job-detail',
      pathname,
      params,
      queryParams
    };
  }

  // Root home page
  if (pathname === '/' || pathname === '') {
    return {
      route: 'home',
      pathname: '/',
      params,
      queryParams
    };
  }

  const segments = pathname.split('/').filter(Boolean);

  // Direct detail pages with ID: e.g. /jobs/:id, /job/:id, /biotech-jobs/:id, /opportunities/:id
  if (segments.length === 2) {
    const [prefix, id] = segments;
    if (prefix === 'jobs' || prefix === 'job' || prefix === 'biotech-jobs' || prefix === 'opportunities' || prefix === 'opportunity') {
      params.id = id;
      return {
        route: 'job-detail',
        pathname,
        params,
        queryParams
      };
    }
  }

  // Single segment top-level routes
  if (segments.length === 1) {
    const segment = segments[0];

    switch (segment) {
      case 'job':
      case 'jobs':
        return { route: 'jobs', pathname, params, queryParams };
      case 'biotech-jobs':
        return { route: 'biotech-jobs', pathname, params, queryParams };
      case 'opportunity':
      case 'opportunities':
        return { route: 'opportunities', pathname, params, queryParams };
      case 'workshops':
      case 'workshop':
        return { route: 'workshops', pathname, params, queryParams };
      case 'internships':
      case 'internship':
        return { route: 'internships', pathname, params, queryParams };
      case 'courses':
      case 'course':
        return { route: 'courses', pathname, params, queryParams };
      case 'exams':
      case 'exam':
        return { route: 'exams', pathname, params, queryParams };
      case 'scholarships':
      case 'scholarship':
        return { route: 'scholarships', pathname, params, queryParams };
      case 'research':
        return { route: 'research', pathname, params, queryParams };
      case 'career-guidance':
      case 'guidance':
        return { route: 'career-guidance', pathname, params, queryParams };
      case 'community':
        return { route: 'community', pathname, params, queryParams };
      case 'news':
        return { route: 'news', pathname, params, queryParams };
      case 'dashboard-student':
        return { route: 'dashboard-student', pathname, params, queryParams };
      case 'dashboard-company':
        return { route: 'dashboard-company', pathname, params, queryParams };
      case 'admin':
        return { route: 'admin', pathname, params, queryParams };
      case 'verify-certificate':
        return { route: 'verify-certificate', pathname, params, queryParams };
      case 'about':
        return { route: 'about', pathname, params, queryParams };
      case 'contact':
        return { route: 'contact', pathname, params, queryParams };
      case 'privacy':
        return { route: 'privacy', pathname, params, queryParams };
      case 'terms':
        return { route: 'terms', pathname, params, queryParams };
      default:
        return { route: 'not-found', pathname, params, queryParams };
    }
  }

  return {
    route: 'not-found',
    pathname,
    params,
    queryParams
  };
}
