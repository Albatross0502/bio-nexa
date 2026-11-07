import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOOGLE_JOBS_DISCIPLINES,
  GOOGLE_JOBS_SUGGESTIONS,
  buildGoogleJobsQuery,
  buildGoogleJobsUrl,
  buildGoogleWebSearchUrl
} from './googleJobsSearch.js';

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

test('buildGoogleJobsQuery constructs clean natural language queries', () => {
  // 1. Basic discipline + location
  const q1 = buildGoogleJobsQuery({
    discipline: 'Microbiology',
    location: 'Hyderabad'
  });
  assert.equal(q1, 'Microbiology jobs in Hyderabad');

  // 2. Discipline + location + keywords
  const q2 = buildGoogleJobsQuery({
    discipline: 'Biotechnology',
    location: 'Bengaluru',
    additionalKeywords: 'fermentation upstream'
  });
  assert.equal(q2, 'Biotechnology jobs fermentation upstream in Bengaluru');

  // 3. Biotechnology internships
  const q3 = buildGoogleJobsQuery({
    discipline: 'Biotechnology internships',
    location: 'Pune',
    additionalKeywords: 'summer 2026'
  });
  assert.equal(q3, 'Biotechnology internships summer 2026 in Pune');

  // 4. Research Assistant positions
  const q4 = buildGoogleJobsQuery({
    discipline: 'Research Assistant positions',
    location: 'Delhi NCR',
    additionalKeywords: 'CSIR IGIB'
  });
  assert.equal(q4, 'Research Assistant positions CSIR IGIB in Delhi NCR');
});

test('buildGoogleJobsUrl produces correct Google Jobs search URL with ibp=htl;jobs', () => {
  const url = buildGoogleJobsUrl({
    discipline: 'Bioinformatics',
    location: 'Bengaluru',
    additionalKeywords: 'NGS Python'
  });

  assert.ok(url.startsWith('https://www.google.com/search?q='));
  assert.ok(url.includes('ibp=htl%3Bjobs') || url.includes('ibp=htl;jobs'));
  assert.ok(url.includes(encodeURIComponent('Bioinformatics jobs NGS Python in Bengaluru')));
});

test('GOOGLE_JOBS_SUGGESTIONS has valid suggestions matching disciplines', () => {
  assert.ok(GOOGLE_JOBS_SUGGESTIONS.length >= 8);
  for (const s of GOOGLE_JOBS_SUGGESTIONS) {
    assert.ok(s.id);
    assert.ok(s.label);
    assert.ok(s.location);
    assert.ok(GOOGLE_JOBS_DISCIPLINES.includes(s.discipline));
  }
});
