import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOOGLE_JOBS_DISCIPLINES,
  GOOGLE_JOBS_SUGGESTIONS,
  GOOGLE_JOBS_CATEGORY_TRACKS,
  OFFICIAL_EMPLOYER_CAREER_PORTALS,
  QUICK_LOCATION_HUBS,
  buildGoogleJobsQuery,
  buildGoogleJobsUrl,
  buildGoogleWebSearchUrl,
  buildEmployerGoogleJobsUrl,
  validateSearchDestinationUrl
} from './googleJobsSearch.js';
import { generateExternalSearchUrls } from '../opportunities/externalSearchGenerator.js';

test('GOOGLE_JOBS_DISCIPLINES contains all 10 required life science fields', () => {
  const expected = [
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
  ];

  for (const item of expected) {
    assert.ok(
      GOOGLE_JOBS_DISCIPLINES.includes(item as any),
      `Missing required discipline: ${item}`
    );
  }
  assert.equal(GOOGLE_JOBS_DISCIPLINES.length, 10);
});

test('buildGoogleJobsQuery constructs clean natural language queries across core and specialized tracks', () => {
  // 1. Basic discipline + location (backward compatibility preserved)
  assert.equal(
    buildGoogleJobsQuery({ discipline: 'Microbiology', location: 'Hyderabad' }),
    'Microbiology jobs in Hyderabad'
  );

  // 2. Discipline + location + keywords
  assert.equal(
    buildGoogleJobsQuery({
      discipline: 'Biotechnology',
      location: 'Bengaluru',
      additionalKeywords: 'fermentation upstream'
    }),
    'Biotechnology jobs fermentation upstream in Bengaluru'
  );

  // 3. Biotechnology internships
  assert.equal(
    buildGoogleJobsQuery({
      discipline: 'Biotechnology internships',
      location: 'Pune',
      additionalKeywords: 'summer 2026'
    }),
    'Biotechnology internships summer 2026 in Pune'
  );

  // 4. Research Assistant positions
  assert.equal(
    buildGoogleJobsQuery({
      discipline: 'Research Assistant positions',
      location: 'Delhi NCR',
      additionalKeywords: 'CSIR IGIB'
    }),
    'Research Assistant positions CSIR IGIB in Delhi NCR'
  );

  // 5. Fresher Biotechnology search
  assert.equal(
    buildGoogleJobsQuery({
      discipline: 'Biotechnology',
      experienceLevel: 'Fresher entry level',
      employmentType: 'Full-time',
      location: 'India'
    }),
    'Biotechnology jobs Fresher entry level Full-time in India'
  );

  // 6. Remote job search without awkward "in Remote"
  assert.equal(
    buildGoogleJobsQuery({
      discipline: 'Bioinformatics',
      location: 'Remote',
      additionalKeywords: 'NGS Python'
    }),
    'Bioinformatics jobs NGS Python remote'
  );

  // 7. Remote toggle combined with country/region scope
  assert.equal(
    buildGoogleJobsQuery({
      discipline: 'Clinical Research',
      location: 'India',
      additionalKeywords: 'pharmacovigilance',
      remoteOnly: true
    }),
    'Clinical Research jobs pharmacovigilance remote in India'
  );
});

test('Phase 10: buildGoogleJobsUrl & buildGoogleWebSearchUrl strictly encode special biotech characters', () => {
  const url = buildGoogleJobsUrl({
    discipline: 'Pharmaceutical Sciences',
    location: 'Ahmedabad / Vadodara',
    additionalKeywords: 'R&D QC/QA HPLC + cGMP #1'
  });

  assert.ok(url.startsWith('https://www.google.com/search?q='));
  assert.ok(url.endsWith('&ibp=htl;jobs'));
  // Ensure special characters like &, /, +, # are percent-encoded in q parameter
  const rawQueryPart = url.slice('https://www.google.com/search?q='.length, -'&ibp=htl;jobs'.length);
  assert.ok(!rawQueryPart.includes('&'), 'Raw & inside query must be encoded as %26');
  assert.ok(!rawQueryPart.includes('#'), 'Raw # inside query must be encoded as %23');
  assert.ok(!rawQueryPart.includes('+'), 'Raw + inside query must be encoded as %2B');

  const check = validateSearchDestinationUrl(url);
  assert.equal(check.valid, true);
  assert.equal(
    check.decodedQuery,
    'Pharmaceutical Sciences jobs R&D QC/QA HPLC + cGMP #1 in Ahmedabad / Vadodara'
  );

  const webUrl = buildGoogleWebSearchUrl('Molecular Biology PCR & qPCR in Delhi NCR');
  const webCheck = validateSearchDestinationUrl(webUrl);
  assert.equal(webCheck.valid, true);
  assert.equal(webCheck.decodedQuery, 'Molecular Biology PCR & qPCR in Delhi NCR');
});

test('Phase 10: all required biotech search categories are represented in tracks & suggestions with valid URLs', () => {
  const requiredCategories = [
    'biotechnology',
    'internships',
    'fresher',
    'research-assistant',
    'pharmaceutical',
    'clinical-research',
    'molecular-biology',
    'bioinformatics',
    'remote'
  ];

  const trackIds = new Set(GOOGLE_JOBS_CATEGORY_TRACKS.map((t) => t.id));
  const suggestionCategories = new Set(GOOGLE_JOBS_SUGGESTIONS.map((s) => s.category));

  for (const cat of requiredCategories) {
    assert.ok(trackIds.has(cat as any), `Missing category track: ${cat}`);
    assert.ok(suggestionCategories.has(cat as any), `Missing suggestion for category: ${cat}`);
  }

  assert.ok(QUICK_LOCATION_HUBS.includes('Bengaluru'));
  assert.ok(QUICK_LOCATION_HUBS.includes('Remote'));

  // Validate every single generated track preset URL
  for (const track of GOOGLE_JOBS_CATEGORY_TRACKS) {
    if (!track.preset) continue;
    const url = buildGoogleJobsUrl(track.preset);
    const check = validateSearchDestinationUrl(url);
    assert.equal(check.valid, true, `Invalid track URL for ${track.id}: ${check.error}`);
    assert.ok(url.includes('&ibp=htl;jobs'));
  }

  // Validate every single suggestion generates a valid, accurately decoded URL
  assert.ok(GOOGLE_JOBS_SUGGESTIONS.length >= 12);
  for (const s of GOOGLE_JOBS_SUGGESTIONS) {
    assert.ok(s.id && s.label && s.location && s.description);
    assert.ok(GOOGLE_JOBS_DISCIPLINES.includes(s.discipline));

    const expectedQuery = buildGoogleJobsQuery({
      discipline: s.discipline,
      location: s.location,
      additionalKeywords: s.additionalKeywords,
      experienceLevel: s.experienceLevel,
      employmentType: s.employmentType,
      remoteOnly: s.remoteOnly
    });
    const url = buildGoogleJobsUrl(expectedQuery);
    const check = validateSearchDestinationUrl(url);
    assert.equal(check.valid, true, `Invalid suggestion URL for ${s.id}: ${check.error}`);
    assert.equal(check.decodedQuery, expectedQuery);
  }
});

test('Phase 10: all official employer career portal destinations & employer Google Jobs URLs are valid HTTPS links', () => {
  assert.ok(OFFICIAL_EMPLOYER_CAREER_PORTALS.length >= 12);

  const sectors = new Set(OFFICIAL_EMPLOYER_CAREER_PORTALS.map((p) => p.sector));
  assert.ok(sectors.has('Biopharma & Biotech'));
  assert.ok(sectors.has('Pharmaceutical'));
  assert.ok(sectors.has('Clinical Research & Genomics'));
  assert.ok(sectors.has('National Research Institutes'));

  for (const portal of OFFICIAL_EMPLOYER_CAREER_PORTALS) {
    assert.ok(portal.id && portal.name && portal.headquarters && portal.focusAreas.length > 0);
    const officialCheck = validateSearchDestinationUrl(portal.careersUrl);
    assert.equal(
      officialCheck.valid,
      true,
      `Invalid official employer careers URL for ${portal.name}: ${officialCheck.error}`
    );

    const employerSearchUrl = buildEmployerGoogleJobsUrl(portal, 'Biotechnology', 'India');
    const searchCheck = validateSearchDestinationUrl(employerSearchUrl);
    assert.equal(searchCheck.valid, true, `Invalid employer Google search URL for ${portal.name}`);
    assert.ok(
      searchCheck.decodedQuery?.includes(portal.employerSearchKeyword),
      `Employer query should include ${portal.employerSearchKeyword}`
    );
  }
});

test('Phase 10: externalSearchGenerator builds properly encoded Google Jobs URLs with no double spaces', () => {
  const urls = generateExternalSearchUrls('Molecular Biology', 'Bengaluru');
  const check = validateSearchDestinationUrl(urls.googleJobs);
  assert.equal(check.valid, true);
  assert.equal(check.decodedQuery, 'Molecular Biology jobs in Bengaluru');
  assert.ok(!check.decodedQuery?.includes('  '));
});
