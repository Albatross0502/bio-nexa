export type AdminExportDataset =
  | 'jobs'
  | 'internships'
  | 'workshops'
  | 'courses'
  | 'submissions'
  | 'reports'
  | 'audit_logs'
  | 'all';

export interface AdminDashboardStats {
  totalJobs: number;
  activeJobs: number;
  pendingJobs: number;
  verifiedJobs: number;
  rejectedJobs: number;
  expiredJobs: number;
  brokenUrlJobs: number;
  totalInternships: number;
  activeInternships: number;
  pendingInternships: number;
  verifiedInternships: number;
  rejectedInternships: number;
  totalWorkshops: number;
  upcomingWorkshops: number;
  totalCourses: number;
  availableCourses: number;
  totalSubmissions: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  totalComplianceRequests: number;
  openComplianceRequests: number;
  jobReportsCount: number;
  openJobReportsCount: number;
  contactMessagesCount: number;
  syncRunsCount: number;
  backupsCount: number;
  auditLogsCount: number;
  announcementsCount: number;
}

export const ADMIN_EXPORT_DATASETS: readonly AdminExportDataset[] = [
  'jobs',
  'internships',
  'workshops',
  'courses',
  'submissions',
  'reports',
  'audit_logs',
  'all',
];

export const ADMIN_EXPORT_DATASET_PERMISSIONS: Record<AdminExportDataset, readonly string[]> = {
  jobs: ['dashboard:read'],
  internships: ['dashboard:read'],
  workshops: ['dashboard:read'],
  courses: ['dashboard:read'],
  submissions: ['opportunities:moderate'],
  reports: ['compliance:manage'],
  audit_logs: ['audit:read'],
  all: ['dashboard:read', 'opportunities:moderate', 'compliance:manage', 'audit:read'],
};

export function isValidExportDataset(value: string): value is AdminExportDataset {
  return (ADMIN_EXPORT_DATASETS as readonly string[]).includes(value);
}

export function hasExportDatasetPermission(
  userPermissions: readonly string[] | undefined,
  dataset: AdminExportDataset
): boolean {
  if (!Array.isArray(userPermissions) || userPermissions.length === 0) return false;
  const required = ADMIN_EXPORT_DATASET_PERMISSIONS[dataset];
  return required.every((perm) => userPermissions.includes(perm));
}

export function getAllowedExportDatasets(
  userPermissions: readonly string[] | undefined
): AdminExportDataset[] {
  return ADMIN_EXPORT_DATASETS.filter((ds) => hasExportDatasetPermission(userPermissions, ds));
}

export interface StatsComputationInput {
  jobs: Array<{
    isActive?: boolean;
    isApproved?: boolean;
    verificationStatus?: string;
    expiryDate?: string;
  }>;
  internships: Array<{
    isActive?: boolean;
    isApproved?: boolean;
    verificationStatus?: string;
  }>;
  workshops: Array<{
    status?: string;
  }>;
  courses: Array<{
    status?: string;
  }>;
  submissions: Array<{
    isApproved?: boolean;
    status?: string;
  }>;
  complianceRequests: Array<{
    requestType?: string;
    status?: string;
  }>;
  contactMessagesCount: number;
  syncRunsCount: number;
  backupsCount: number;
  auditLogsCount: number;
  announcementsCount: number;
}

export function computeAdminDashboardStats(input: StatsComputationInput): AdminDashboardStats {
  const jobs = input.jobs || [];
  const internships = input.internships || [];
  const workshops = input.workshops || [];
  const courses = input.courses || [];
  const submissions = input.submissions || [];
  const complianceRequests = input.complianceRequests || [];

  const activeJobs = jobs.filter(
    (j) =>
      j.isActive !== false &&
      j.isApproved !== false &&
      j.verificationStatus !== 'Expired' &&
      j.verificationStatus !== 'Rejected'
  ).length;
  const pendingJobs = jobs.filter(
    (j) => j.isApproved === false || j.verificationStatus === 'Pending Verification'
  ).length;
  const verifiedJobs = jobs.filter((j) => j.verificationStatus === 'Verified').length;
  const rejectedJobs = jobs.filter((j) => j.verificationStatus === 'Rejected').length;
  const expiredJobs = jobs.filter(
    (j) => j.verificationStatus === 'Expired' || (j.isActive === false && j.verificationStatus !== 'Rejected')
  ).length;
  const brokenUrlJobs = jobs.filter((j) => j.verificationStatus === 'Link Unavailable').length;

  const activeInternships = internships.filter(
    (i) =>
      i.isActive !== false &&
      i.isApproved !== false &&
      i.verificationStatus !== 'Expired' &&
      i.verificationStatus !== 'Rejected'
  ).length;
  const pendingInternships = internships.filter(
    (i) => i.isApproved === false || i.verificationStatus === 'Pending Verification'
  ).length;
  const verifiedInternships = internships.filter((i) => i.verificationStatus === 'Verified').length;
  const rejectedInternships = internships.filter((i) => i.verificationStatus === 'Rejected').length;

  const upcomingWorkshops = workshops.filter(
    (w) => (w.status || '').toLowerCase() === 'upcoming' || (w.status || '').toLowerCase() === 'ongoing'
  ).length;

  const availableCourses = courses.filter(
    (c) => (c.status || '').toLowerCase() === 'available' || !c.status
  ).length;

  const pendingSubmissions = submissions.filter(
    (s) => !s.isApproved && s.status !== 'Rejected'
  ).length;
  const approvedSubmissions = submissions.filter((s) => Boolean(s.isApproved)).length;
  const rejectedSubmissions = submissions.filter((s) => s.status === 'Rejected').length;

  const openStatuses = new Set(['Pending', 'In Review']);
  const openComplianceRequests = complianceRequests.filter((r) => openStatuses.has(r.status || 'Pending')).length;
  const jobReports = complianceRequests.filter((r) => r.requestType === 'job_report');
  const openJobReportsCount = jobReports.filter((r) => openStatuses.has(r.status || 'Pending')).length;

  return {
    totalJobs: jobs.length,
    activeJobs,
    pendingJobs,
    verifiedJobs,
    rejectedJobs,
    expiredJobs,
    brokenUrlJobs,
    totalInternships: internships.length,
    activeInternships,
    pendingInternships,
    verifiedInternships,
    rejectedInternships,
    totalWorkshops: workshops.length,
    upcomingWorkshops,
    totalCourses: courses.length,
    availableCourses,
    totalSubmissions: submissions.length,
    pendingSubmissions,
    approvedSubmissions,
    rejectedSubmissions,
    totalComplianceRequests: complianceRequests.length,
    openComplianceRequests,
    jobReportsCount: jobReports.length,
    openJobReportsCount,
    contactMessagesCount: input.contactMessagesCount || 0,
    syncRunsCount: input.syncRunsCount || 0,
    backupsCount: input.backupsCount || 0,
    auditLogsCount: input.auditLogsCount || 0,
    announcementsCount: input.announcementsCount || 0,
  };
}

/**
 * Neutralizes spreadsheet CSV formula injection (=, +, -, @, tab, CR) and quotes RFC 4180 cells safely.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str: string;
  if (Array.isArray(value)) {
    str = value.map((item) => String(item ?? '')).join('; ');
  } else if (typeof value === 'object') {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }

  // Normalize line breaks inside cells
  str = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Guard against spreadsheet formula injection even if preceded by spaces
  if (/^[\s\t]*[=+\-@]/.test(str) || str.startsWith('\t')) {
    str = `'${str}`;
  }

  if (/[",\n\t]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface CsvColumn {
  key: string;
  header: string;
}

export function formatRecordsAsCsv(
  columns: readonly CsvColumn[],
  rows: ReadonlyArray<Record<string, unknown>>
): string {
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(row[c.key])).join(',')
  );
  return [headerLine, ...dataLines].join('\r\n');
}
