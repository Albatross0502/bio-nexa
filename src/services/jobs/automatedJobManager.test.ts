import test from 'node:test';
import assert from 'node:assert/strict';
import { AutomatedJobManager } from './automatedJobManager.js';
import { BionexaDatabase } from '../../db/bionexaDatabase.js';

test('AutomatedJobManager classifies jobs into 11 target categories', () => {
  const manager = new AutomatedJobManager();

  assert.equal(manager.categorizeJob('Senior Microbiologist - Endotoxin Testing'), 'Microbiology Jobs');
  assert.equal(manager.categorizeJob('QC Associate - HPLC & Analytical Release'), 'Quality Control Jobs');
  assert.equal(manager.categorizeJob('Quality Assurance Executive - 21 CFR Part 11'), 'Quality Assurance Jobs');
  assert.equal(manager.categorizeJob('Bioinformatics Analyst - Single-Cell RNA-Seq'), 'Bioinformatics Jobs');
  assert.equal(manager.categorizeJob('Clinical Research Coordinator - Phase III Trial'), 'Clinical Research Jobs');
  assert.equal(manager.categorizeJob('Formulation R&D Executive - Oral Solid Dosage'), 'Pharmaceutical Jobs');
  assert.equal(manager.categorizeJob('CSIR-JRF Junior Research Fellowship in Life Sciences'), 'Research Fellowships');
  assert.equal(manager.categorizeJob('Summer Research Intern - Plant Biotechnology'), 'Biotechnology Internships');
  assert.equal(manager.categorizeJob('Medical Laboratory Technologist - Histopathology'), 'Laboratory Jobs');
  assert.equal(manager.categorizeJob('Principal Research Scientist - CRISPR Editing'), 'Research Jobs');
  assert.equal(manager.categorizeJob('Bioprocess Engineer - Upstream Cell Culture'), 'Biotechnology Jobs');
});

test('AutomatedJobManager normalizes URLs and text for duplicate detection', () => {
  const manager = new AutomatedJobManager();

  const url1 = 'https://www.biocon.com/careers/job-1/?utm_source=adzuna&ref=linkedin';
  const url2 = 'https://www.biocon.com/careers/job-1/';
  assert.equal(manager.normalizeUrl(url1), manager.normalizeUrl(url2));

  const text1 = 'Senior Bioprocess Scientist — Upstream Fermentation!';
  const text2 = 'senior bioprocess scientist upstream fermentation';
  assert.equal(manager.normalizeText(text1), manager.normalizeText(text2));
});

test('AutomatedJobManager detects duplicate vacancies accurately', () => {
  const manager = new AutomatedJobManager();
  const existingJobs: any[] = [
    {
      id: 'job-existing-1',
      title: 'Senior Bioprocess Scientist',
      employer: 'Biocon Biologics',
      applicationUrl: 'https://www.biocon.com/careers/job-1'
    }
  ];

  // Identical URL duplicate
  const candidate1 = {
    title: 'Bioprocess Scientist Post',
    employer: 'Biocon Biologics',
    applicationUrl: 'https://www.biocon.com/careers/job-1?utm_medium=feed',
    description: '',
    location: '',
    qualification: '',
    skills: [],
    employmentType: '',
    salary: '',
    source: '',
    publicationDate: '',
    expiryDate: '',
    sector: ''
  };
  assert.equal(manager.isDuplicate(candidate1, existingJobs), true);

  // Identical Title & Employer duplicate
  const candidate2 = {
    title: 'Senior Bioprocess Scientist',
    employer: 'Biocon Biologics',
    applicationUrl: 'https://www.biocon.com/different-url',
    description: '',
    location: '',
    qualification: '',
    skills: [],
    employmentType: '',
    salary: '',
    source: '',
    publicationDate: '',
    expiryDate: '',
    sector: ''
  };
  assert.equal(manager.isDuplicate(candidate2, existingJobs), true);

  // Distinct vacancy
  const candidate3 = {
    title: 'QC Associate - HPLC',
    employer: 'Serum Institute',
    applicationUrl: 'https://www.seruminstitute.com/careers/qc-1',
    description: '',
    location: '',
    qualification: '',
    skills: [],
    employmentType: '',
    salary: '',
    source: '',
    publicationDate: '',
    expiryDate: '',
    sector: ''
  };
  assert.equal(manager.isDuplicate(candidate3, existingJobs), false);
});

test('AutomatedJobManager accurately marks expired dates', () => {
  const manager = new AutomatedJobManager();
  const today = new Date('2026-11-07T12:00:00Z');

  assert.equal(manager.isExpired('2026-10-31', today), true); // Past deadline
  assert.equal(manager.isExpired('2026-12-15', today), false); // Future deadline
  assert.equal(manager.isExpired('Not Specified', today), false); // Undefined deadline remains active
});
