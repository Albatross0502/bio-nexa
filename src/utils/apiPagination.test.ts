import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePaginationParams,
  paginateArray,
  isValidEmailAddress,
  isValidHttpUrlStrict,
} from './apiPagination';

test('parsePaginationParams parses valid page/limit and clamps safely', () => {
  const defaults = parsePaginationParams({});
  assert.deepEqual(defaults, {
    page: 1,
    limit: 50,
    offset: 0,
    hasExplicitPagination: false,
  });

  const explicit = parsePaginationParams({ page: '3', limit: '15' });
  assert.deepEqual(explicit, {
    page: 3,
    limit: 15,
    offset: 30,
    hasExplicitPagination: true,
  });

  const invalid = parsePaginationParams({ page: '-5', limit: '999' }, { defaultLimit: 25, maxLimit: 100 });
  assert.deepEqual(invalid, {
    page: 1,
    limit: 100,
    offset: 0,
    hasExplicitPagination: true,
  });
});

test('paginateArray slices pages and builds accurate metadata', () => {
  const data = ['a', 'b', 'c', 'd', 'e'];
  const p1 = paginateArray(data, 1, 2);
  assert.deepEqual(p1.items, ['a', 'b']);
  assert.deepEqual(p1.pagination, {
    page: 1,
    limit: 2,
    total: 5,
    totalPages: 3,
    hasNextPage: true,
    hasPrevPage: false,
  });

  const p3 = paginateArray(data, 3, 2);
  assert.deepEqual(p3.items, ['e']);
  assert.deepEqual(p3.pagination, {
    page: 3,
    limit: 2,
    total: 5,
    totalPages: 3,
    hasNextPage: false,
    hasPrevPage: true,
  });
});

test('isValidEmailAddress validates standard emails cleanly', () => {
  assert.equal(isValidEmailAddress('scientist@igib.res.in'), true);
  assert.equal(isValidEmailAddress('invalid-email'), false);
  assert.equal(isValidEmailAddress('a@b'), false);
  assert.equal(isValidEmailAddress(''), false);
});

test('isValidHttpUrlStrict accepts http/https and rejects javascript/relative URLs', () => {
  assert.equal(isValidHttpUrlStrict('https://www.biocon.com/careers'), true);
  assert.equal(isValidHttpUrlStrict('http://localhost:3000/test'), true);
  assert.equal(isValidHttpUrlStrict('javascript:alert(1)'), false);
  assert.equal(isValidHttpUrlStrict('/relative/path'), false);
  assert.equal(isValidHttpUrlStrict(''), false);
});
