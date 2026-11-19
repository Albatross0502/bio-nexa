import test from 'node:test';
import assert from 'node:assert/strict';
import {
  googleSheetsSync,
  parseCsvToSheetMatrix,
  parseSheetValuesToRows,
  validateSpreadsheetHeaders,
} from './googleSheetsSync';

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
  assert.equal(opp?.isApproved, false);
  assert.equal(opp?.isVerified, false);
  assert.equal(opp?.verificationStatus, 'Pending Verification');
  assert.equal(opp?.lastVerifiedDate, undefined);
});

test('Google Sheets Sync: getAppsScriptCode generates valid runnable Apps Script', () => {
  const code = googleSheetsSync.getAppsScriptCode();
  assert.ok(code.includes('function doGet(e)'));
  assert.ok(code.includes('action === "getOpportunities"'));
  assert.ok(code.includes('Visitor_Log'));
  assert.ok(code.includes('SpreadsheetApp.getActiveSpreadsheet()'));
});

test('Phase 09: validateSpreadsheetHeaders validates required columns and flexible aliases', () => {
  const validStandard = validateSpreadsheetHeaders([
    'ID',
    'Title',
    'Organization',
    'Location',
    'Application URL',
    'Custom Extra Header',
  ]);
  assert.equal(validStandard.valid, true);
  assert.equal(validStandard.missingRequired.length, 0);
  assert.equal(validStandard.matchedColumns.title, 'Title');
  assert.equal(validStandard.matchedColumns.organization, 'Organization');
  assert.equal(validStandard.matchedColumns.applicationUrl, 'Application URL');
  assert.ok(validStandard.detectedHeaders.includes('Custom Extra Header'));

  const validAliases = validateSpreadsheetHeaders(['Job Title', 'Company', 'Registration URL']);
  assert.equal(validAliases.valid, true);

  const missingUrl = validateSpreadsheetHeaders(['Title', 'Organization', 'Location']);
  assert.equal(missingUrl.valid, false);
  assert.equal(missingUrl.missingRequired.includes('Application URL (or Registration URL)'), true);
});

test('Phase 09: parseSheetValuesToRows & parseCsvToSheetMatrix convert matrix/CSV cleanly', () => {
  const csv = [
    'Title,Organization,"Location",Application URL,Salary/Stipend',
    '"Research Associate, CRISPR","CSIR-IGIB","New Delhi, India",https://www.igib.res.in/careers/ra-1,"₹42,000 ""consolidated"""',
    '',
  ].join('\n');

  const matrix = parseCsvToSheetMatrix(csv);
  assert.equal(matrix.length, 2);
  const { headers, rows } = parseSheetValuesToRows(matrix);
  assert.deepEqual(headers, ['Title', 'Organization', 'Location', 'Application URL', 'Salary/Stipend']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Title, 'Research Associate, CRISPR');
  assert.equal(rows[0].Organization, 'CSIR-IGIB');
  assert.equal(rows[0]['Salary/Stipend'], '₹42,000 "consolidated"');
});

test('Phase 09: client googleSheetsSync never holds server credentials and reads from backend API', async () => {
  assert.equal(googleSheetsSync.getConfig().scriptUrl, '');

  const prevFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = (async (input: any) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        success: true,
        opportunities: [{ id: 'db-job-1', title: 'Verified DB Role', isApproved: true }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as unknown as typeof fetch;

  try {
    const result = await googleSheetsSync.fetchOpportunities();
    assert.equal(requestedUrl, '/api/opportunities?limit=100');
    assert.equal(result.success, true);
    assert.equal(result.opportunities.length, 1);
    assert.equal(result.opportunities[0].id, 'db-job-1');
  } finally {
    globalThis.fetch = prevFetch;
  }
});
