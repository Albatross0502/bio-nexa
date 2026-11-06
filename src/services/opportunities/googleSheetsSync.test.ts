import test from 'node:test';
import assert from 'node:assert/strict';
import { googleSheetsSync } from './googleSheetsSync';

test('Google Sheets Sync: determineOpportunityType categorizes correctly', () => {
  // Courses
  assert.equal(
    googleSheetsSync.determineOpportunityType('Courses', 'Biomanufacturing Certification Masterclass', 'Comprehensive 8-week curriculum with accredited certificate'),
    'course'
  );
  
  // Workshops
  assert.equal(
    googleSheetsSync.determineOpportunityType('Workshops', 'CRISPR Gene Editing Hands-on Training', 'Intensive 3-day practical bootcamp with lab wet session'),
    'workshop'
  );

  // Internships
  assert.equal(
    googleSheetsSync.determineOpportunityType('Internships', 'Summer Research Fellowship 2025', 'Fully funded summer trainee position at national institute'),
    'internship'
  );

  // Biotech Jobs
  assert.equal(
    googleSheetsSync.determineOpportunityType('Jobs', 'Bioprocess Fermentation Scientist', 'Upstream bioprocessing, bioreactor operations and microbial fermentation'),
    'biotech_job'
  );

  // General Jobs
  assert.equal(
    googleSheetsSync.determineOpportunityType('Jobs', 'Head of Regulatory Documentation', 'Corporate compliance and GMP documentation manager'),
    'job'
  );
});

test('Google Sheets Sync: calculateStatus computes active, closing soon, and expired', () => {
  // Past deadline -> expired
  const pastDeadline = '2020-01-01';
  assert.equal(googleSheetsSync.calculateStatus(pastDeadline), 'Expired');

  // Explicit status override
  assert.equal(googleSheetsSync.calculateStatus('2030-01-01', 'Closed'), 'Closed');
  assert.equal(googleSheetsSync.calculateStatus('2030-01-01', 'Expired'), 'Expired');

  // Far future deadline -> Open
  const future = new Date();
  future.setDate(future.getDate() + 45);
  const futureStr = future.toISOString().split('T')[0];
  assert.equal(googleSheetsSync.calculateStatus(futureStr), 'Open');

  // Near future deadline (<= 3 days) -> Closing Soon
  const nearFuture = new Date();
  nearFuture.setDate(nearFuture.getDate() + 2);
  const nearFutureStr = nearFuture.toISOString().split('T')[0];
  assert.equal(googleSheetsSync.calculateStatus(nearFutureStr), 'Closing Soon');
});

test('Google Sheets Sync: parseRowToOpportunity parses 19 standardized columns accurately', () => {
  const rawRow = {
    'ID': 'SHEET-TEST-001',
    'Title': 'Quality Control Microbiologist',
    'Category': 'biotech_job',
    'Organization': 'Serum Institute of India',
    'Description': 'Lead QC testing for commercial vaccine batches according to WHO GMP guidelines.',
    'Eligibility': 'M.Sc in Microbiology / Biotechnology',
    'Qualification': 'Minimum 2 years QC lab experience with aseptic validation',
    'Location': 'Pune, Maharashtra',
    'Mode': 'offline',
    'Salary/Stipend': '₹5.5 - 7.5 LPA',
    'Fees': 'Nil',
    'Duration': 'Full-time Permanent',
    'Published Date': '2025-05-01',
    'Application Deadline': '2025-07-31',
    'Application URL': 'https://www.seruminstitute.com/careers.php',
    'Registration URL': '',
    'Status': 'Open',
    'Featured': 'TRUE',
    'Last Updated': '2025-05-02'
  };

  const opp = googleSheetsSync.parseRowToOpportunity(rawRow, 0);
  assert.ok(opp !== null, 'Opportunity should be successfully parsed');
  assert.equal(opp?.id, 'SHEET-TEST-001');
  assert.equal(opp?.title, 'Quality Control Microbiologist');
  assert.equal(opp?.organization, 'Serum Institute of India');
  assert.equal(opp?.type, 'biotech_job');
  assert.equal(opp?.workMode, 'On-site');
  assert.equal(opp?.applicationUrl, 'https://www.seruminstitute.com/careers.php');
  assert.equal(opp?.isExternal, true);
  assert.equal(opp?.featured, true);
  assert.equal(opp?.salaryOrStipend, '₹5.5 - 7.5 LPA');
  assert.ok(opp?.branches.includes('microbiology'));
});

test('Google Sheets Sync: getAppsScriptCode generates valid runnable Apps Script', () => {
  const code = googleSheetsSync.getAppsScriptCode();
  assert.ok(code.includes('function doGet(e)'));
  assert.ok(code.includes('action === "getOpportunities"'));
  assert.ok(code.includes('Visitor_Log'));
  assert.ok(code.includes('SpreadsheetApp.getActiveSpreadsheet()'));
});
