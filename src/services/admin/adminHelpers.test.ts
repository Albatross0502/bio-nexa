import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAdminDashboardStats,
  escapeCsvCell,
  formatRecordsAsCsv,
  getAllowedExportDatasets,
  hasExportDatasetPermission,
} from './adminHelpers';
import { getPermissionsForRole } from './adminAuthService';

test('computeAdminDashboardStats accurately totals live database entities', () => {
  const stats = computeAdminDashboardStats({
    jobs: [
      { isActive: true, isApproved: true, verificationStatus: 'Verified' },
      { isActive: true, isApproved: false, verificationStatus: 'Pending Verification' },
      { isActive: false, isApproved: false, verificationStatus: 'Rejected' },
      { isActive: false, isApproved: true, verificationStatus: 'Expired' },
      { isActive: true, isApproved: true, verificationStatus: 'Link Unavailable' },
    ],
    internships: [
      { isActive: true, isApproved: true, verificationStatus: 'Verified' },
      { isActive: true, isApproved: false, verificationStatus: 'Pending Verification' },
      { isActive: false, isApproved: false, verificationStatus: 'Rejected' },
    ],
    workshops: [
      { status: 'upcoming' },
      { status: 'completed' },
    ],
    courses: [
      { status: 'available' },
      { status: 'archived' },
    ],
    submissions: [
      { isApproved: false, status: 'Pending Verification' },
      { isApproved: true, status: 'Active' },
      { isApproved: false, status: 'Rejected' },
    ],
    complianceRequests: [
      { requestType: 'job_report', status: 'Pending' },
      { requestType: 'job_report', status: 'Resolved' },
      { requestType: 'privacy_request', status: 'In Review' },
    ],
    contactMessagesCount: 4,
    syncRunsCount: 7,
    backupsCount: 2,
    auditLogsCount: 15,
    announcementsCount: 3,
  });

  assert.equal(stats.totalJobs, 5);
  assert.equal(stats.activeJobs, 2);
  assert.equal(stats.pendingJobs, 2);
  assert.equal(stats.verifiedJobs, 1);
  assert.equal(stats.rejectedJobs, 1);
  assert.equal(stats.expiredJobs, 1);
  assert.equal(stats.brokenUrlJobs, 1);

  assert.equal(stats.totalInternships, 3);
  assert.equal(stats.activeInternships, 1);
  assert.equal(stats.pendingInternships, 2);
  assert.equal(stats.verifiedInternships, 1);
  assert.equal(stats.rejectedInternships, 1);

  assert.equal(stats.totalWorkshops, 2);
  assert.equal(stats.upcomingWorkshops, 1);
  assert.equal(stats.totalCourses, 2);
  assert.equal(stats.availableCourses, 1);

  assert.equal(stats.totalSubmissions, 3);
  assert.equal(stats.pendingSubmissions, 1);
  assert.equal(stats.approvedSubmissions, 1);
  assert.equal(stats.rejectedSubmissions, 1);

  assert.equal(stats.totalComplianceRequests, 3);
  assert.equal(stats.openComplianceRequests, 2);
  assert.equal(stats.jobReportsCount, 2);
  assert.equal(stats.openJobReportsCount, 1);
  assert.equal(stats.contactMessagesCount, 4);
  assert.equal(stats.syncRunsCount, 7);
  assert.equal(stats.backupsCount, 2);
  assert.equal(stats.auditLogsCount, 15);
  assert.equal(stats.announcementsCount, 3);
});

test('hasExportDatasetPermission and getAllowedExportDatasets enforce RBAC by role', () => {
  const editorPerms = getPermissionsForRole('editor');
  assert.equal(hasExportDatasetPermission(editorPerms, 'jobs'), true);
  assert.equal(hasExportDatasetPermission(editorPerms, 'internships'), true);
  assert.equal(hasExportDatasetPermission(editorPerms, 'reports'), false);
  assert.equal(hasExportDatasetPermission(editorPerms, 'audit_logs'), false);
  assert.equal(hasExportDatasetPermission(editorPerms, 'all'), false);

  const superAdminPerms = getPermissionsForRole('super_admin');
  assert.deepEqual(getAllowedExportDatasets(superAdminPerms), [
    'jobs',
    'internships',
    'workshops',
    'courses',
    'submissions',
    'reports',
    'audit_logs',
    'all',
  ]);
});

test('escapeCsvCell and formatRecordsAsCsv neutralize formula injection and quote commas/newlines', () => {
  assert.equal(escapeCsvCell('=CMD("calc")'), `"'=CMD(""calc"")"`);
  assert.equal(escapeCsvCell('+1+2'), `'+1+2`);
  assert.equal(escapeCsvCell('-100'), `'-100`);
  assert.equal(escapeCsvCell('@SUM(A1:A2)'), `'@SUM(A1:A2)`);
  assert.equal(escapeCsvCell('  =HYPERLINK("http://evil")'), `"'  =HYPERLINK(""http://evil"")"`);
  assert.equal(escapeCsvCell('Biocon, Bengaluru'), '"Biocon, Bengaluru"');
  assert.equal(escapeCsvCell(['CRISPR', 'HPLC']), 'CRISPR; HPLC');

  const csv = formatRecordsAsCsv(
    [
      { key: 'id', header: 'ID' },
      { key: 'title', header: 'Title' },
    ],
    [
      { id: 'job-1', title: 'CRISPR Specialist, Senior' },
      { id: 'job-2', title: '=MALICIOUS()' },
    ]
  );

  const lines = csv.split('\r\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], 'ID,Title');
  assert.equal(lines[1], 'job-1,"CRISPR Specialist, Senior"');
  assert.equal(lines[2], `job-2,'=MALICIOUS()`);
});
