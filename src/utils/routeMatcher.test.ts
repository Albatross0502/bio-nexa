import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from './routeMatcher';

test('parseRoute matches home correctly', () => {
  assert.equal(parseRoute('/').route, 'home');
  assert.equal(parseRoute('').route, 'home');
});

test('parseRoute matches jobs listing', () => {
  assert.equal(parseRoute('/jobs').route, 'jobs');
  assert.equal(parseRoute('/jobs/').route, 'jobs');
  assert.equal(parseRoute('/job').route, 'jobs');
});

test('parseRoute matches direct job detail URLs', () => {
  const r1 = parseRoute('/jobs/job-1');
  assert.equal(r1.route, 'job-detail');
  assert.equal(r1.params.id, 'job-1');

  const r2 = parseRoute('/jobs/opp-bio-1');
  assert.equal(r2.route, 'job-detail');
  assert.equal(r2.params.id, 'opp-bio-1');

  const r3 = parseRoute('/job/job-2');
  assert.equal(r3.route, 'job-detail');
  assert.equal(r3.params.id, 'job-2');

  const r4 = parseRoute('/jobs?id=job-3');
  assert.equal(r4.route, 'job-detail');
  assert.equal(r4.params.id, 'job-3');

  const r5 = parseRoute('/biotech-jobs/opp-bio-2');
  assert.equal(r5.route, 'job-detail');
  assert.equal(r5.params.id, 'opp-bio-2');
});

test('parseRoute matches standard app routes', () => {
  assert.equal(parseRoute('/opportunities').route, 'opportunities');
  assert.equal(parseRoute('/workshops').route, 'workshops');
  assert.equal(parseRoute('/internships').route, 'internships');
  assert.equal(parseRoute('/courses').route, 'courses');
  assert.equal(parseRoute('/exams').route, 'exams');
  assert.equal(parseRoute('/admin').route, 'admin');
  assert.equal(parseRoute('/about').route, 'about');
});

test('parseRoute flags unknown URLs as not-found', () => {
  assert.equal(parseRoute('/non-existent-page').route, 'not-found');
  assert.equal(parseRoute('/foo/bar/baz').route, 'not-found');
  assert.equal(parseRoute('/invalid-route-123').route, 'not-found');
});
