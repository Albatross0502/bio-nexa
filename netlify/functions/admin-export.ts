/**
 * Netlify Function: admin-export
 * Route:
 * - GET /api/admin/export?dataset=jobs|internships|workshops|courses|submissions|reports|audit_logs|all&format=csv|json
 */

import {
  ADMIN_EXPORT_DATASETS,
  AdminExportDataset,
  formatRecordsAsCsv,
  hasExportDatasetPermission,
  isValidExportDataset,
} from '../../src/services/admin/adminHelpers';
import {
  buildResponseHeaders,
  errorResponse,
  handleCorsPreflight,
  methodNotAllowedResponse,
  NetlifyEvent,
  NetlifyResponse,
} from './_shared/http';
import { requireServerlessAdminAuthAsync } from './_shared/serverlessAuth';
import {
  SERVERLESS_COURSES,
  SERVERLESS_INTERNSHIPS,
  SERVERLESS_JOBS,
  SERVERLESS_WORKSHOPS,
} from './_shared/serverlessCatalog';
import { getSupabaseRepository } from './_shared/supabaseDb';

const ALLOWED_METHODS = ['GET'];

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const preflight = handleCorsPreflight(event, ALLOWED_METHODS);
  if (preflight) return preflight;

  if ((event.httpMethod || '').toUpperCase() !== 'GET') {
    return methodNotAllowedResponse(event, ALLOWED_METHODS);
  }

  const auth = await requireServerlessAdminAuthAsync(event, ALLOWED_METHODS, {
    requiredPermission: 'dashboard:read',
  });
  if (auth.authorized === false) return auth.response;

  const params = event.queryStringParameters || {};
  const datasetRaw = (params.dataset || 'jobs').trim().toLowerCase();
  const formatRaw = (params.format || 'csv').trim().toLowerCase();

  if (!isValidExportDataset(datasetRaw)) {
    return errorResponse(
      event,
      400,
      'Validation Error',
      `Allowed datasets: ${ADMIN_EXPORT_DATASETS.join(', ')}`,
      { code: 'INVALID_EXPORT_DATASET', allowedMethods: ALLOWED_METHODS }
    );
  }

  if (formatRaw !== 'csv' && formatRaw !== 'json') {
    return errorResponse(event, 400, 'Validation Error', 'Export format must be csv or json.', {
      code: 'INVALID_EXPORT_FORMAT',
      allowedMethods: ALLOWED_METHODS,
    });
  }

  if (!hasExportDatasetPermission(auth.user.permissions || [], datasetRaw)) {
    return errorResponse(
      event,
      403,
      'Forbidden',
      `You do not have authorization to export '${datasetRaw}'.`,
      { code: 'INSUFFICIENT_PERMISSIONS', allowedMethods: ALLOWED_METHODS }
    );
  }

  const repo = getSupabaseRepository();
  const dataset: AdminExportDataset = datasetRaw;
  const dateStamp = new Date().toISOString().split('T')[0];

  const loadDataset = async (ds: Exclude<AdminExportDataset, 'all'>) => {
    switch (ds) {
      case 'jobs': {
        const list = repo ? await repo.getAllJobsAdmin() : SERVERLESS_JOBS;
        const rows = list.map((j: any) => ({
          id: j.id,
          title: j.title,
          employer: j.employer,
          sector: j.sector,
          location: j.location,
          employmentType: j.employmentType,
          salary: j.salary,
          verificationStatus: j.verificationStatus,
          isApproved: j.isApproved ? 'Yes' : 'No',
          isActive: j.isActive ? 'Active' : 'Inactive',
          expiryDate: j.expiryDate,
          applicationUrl: j.applicationUrl,
          source: j.source,
          updatedAt: j.updatedAt,
        }));
        return {
          rows,
          columns: [
            { key: 'id', header: 'ID' },
            { key: 'title', header: 'Title' },
            { key: 'employer', header: 'Employer' },
            { key: 'sector', header: 'Sector' },
            { key: 'location', header: 'Location' },
            { key: 'employmentType', header: 'Type' },
            { key: 'salary', header: 'Compensation' },
            { key: 'verificationStatus', header: 'Verification Status' },
            { key: 'isApproved', header: 'Approved' },
            { key: 'isActive', header: 'Active' },
            { key: 'expiryDate', header: 'Deadline' },
            { key: 'applicationUrl', header: 'Application URL' },
            { key: 'source', header: 'Source' },
            { key: 'updatedAt', header: 'Updated At' },
          ],
        };
      }
      case 'internships': {
        const list = repo ? await repo.getAllInternshipsAdmin() : SERVERLESS_INTERNSHIPS;
        const rows = list.map((i: any) => ({
          id: i.id,
          title: i.title,
          organization: i.organization,
          category: i.category,
          location: i.location,
          workMode: i.workMode || i.mode,
          stipend: i.stipend,
          duration: i.duration,
          deadline: i.deadline,
          verificationStatus: i.verificationStatus,
          isApproved: i.isApproved ? 'Yes' : 'No',
          applicationUrl: i.applicationUrl,
          updatedAt: i.updatedAt,
        }));
        return {
          rows,
          columns: [
            { key: 'id', header: 'ID' },
            { key: 'title', header: 'Title' },
            { key: 'organization', header: 'Organization' },
            { key: 'category', header: 'Category' },
            { key: 'location', header: 'Location' },
            { key: 'workMode', header: 'Mode' },
            { key: 'stipend', header: 'Stipend' },
            { key: 'duration', header: 'Duration' },
            { key: 'deadline', header: 'Deadline' },
            { key: 'verificationStatus', header: 'Verification Status' },
            { key: 'isApproved', header: 'Approved' },
            { key: 'applicationUrl', header: 'Application URL' },
            { key: 'updatedAt', header: 'Updated At' },
          ],
        };
      }
      case 'workshops': {
        const list = repo ? await repo.getWorkshops() : SERVERLESS_WORKSHOPS;
        const rows = list.map((w: any) => ({
          id: w.id,
          name: w.name || w.title,
          instructor: w.instructor || w.organizer,
          date: w.date || w.startDate,
          format: w.format || w.workMode,
          venue: w.venue || w.location,
          fees: w.fees,
          status: w.status,
          availability: w.availability,
          registrationDeadline: w.registrationDeadline,
          registrationLink: w.registrationLink || w.registrationUrl,
        }));
        return {
          rows,
          columns: [
            { key: 'id', header: 'ID' },
            { key: 'name', header: 'Title' },
            { key: 'instructor', header: 'Organizer' },
            { key: 'date', header: 'Date' },
            { key: 'format', header: 'Format' },
            { key: 'venue', header: 'Venue' },
            { key: 'fees', header: 'Fees' },
            { key: 'status', header: 'Status' },
            { key: 'availability', header: 'Availability' },
            { key: 'registrationDeadline', header: 'Deadline' },
            { key: 'registrationLink', header: 'Registration URL' },
          ],
        };
      }
      case 'courses': {
        const list = repo ? await repo.getCourses() : SERVERLESS_COURSES;
        const rows = list.map((c: any) => ({
          id: c.id,
          name: c.name || c.title,
          provider: c.provider,
          category: c.category,
          deliveryMode: c.deliveryMode,
          duration: c.duration,
          level: c.level,
          fees: c.fees,
          status: c.status,
          registrationLink: c.registrationLink || c.registrationUrl,
        }));
        return {
          rows,
          columns: [
            { key: 'id', header: 'ID' },
            { key: 'name', header: 'Course Title' },
            { key: 'provider', header: 'Provider' },
            { key: 'category', header: 'Category' },
            { key: 'deliveryMode', header: 'Delivery Mode' },
            { key: 'duration', header: 'Duration' },
            { key: 'level', header: 'Level' },
            { key: 'fees', header: 'Fees' },
            { key: 'status', header: 'Status' },
            { key: 'registrationLink', header: 'Registration URL' },
          ],
        };
      }
      case 'submissions': {
        const list = repo ? await repo.getSubmittedOpportunities({ onlyApproved: false }) : [];
        const rows = list.map((s: any) => ({
          id: s.id,
          title: s.title,
          organization: s.organization,
          type: s.type,
          location: s.location,
          workMode: s.workMode,
          status: s.status,
          isApproved: s.isApproved ? 'Yes' : 'No',
          deadline: s.deadline,
          contactEmail: s.contactEmail,
          applicationUrl: s.applicationUrl,
          createdAt: s.createdAt,
        }));
        return {
          rows,
          columns: [
            { key: 'id', header: 'ID' },
            { key: 'title', header: 'Title' },
            { key: 'organization', header: 'Organization' },
            { key: 'type', header: 'Type' },
            { key: 'location', header: 'Location' },
            { key: 'workMode', header: 'Work Mode' },
            { key: 'status', header: 'Moderation Status' },
            { key: 'isApproved', header: 'Approved' },
            { key: 'deadline', header: 'Deadline' },
            { key: 'contactEmail', header: 'Contact Email' },
            { key: 'applicationUrl', header: 'Application URL' },
            { key: 'createdAt', header: 'Submitted At' },
          ],
        };
      }
      case 'reports': {
        const list = repo ? await repo.getComplianceRequests() : [];
        const rows = list.map((r: any) => ({
          referenceId: r.referenceId,
          requestType: r.requestType,
          subCategory: r.subCategory,
          requesterName: r.requesterName,
          requesterEmail: r.requesterEmail,
          targetTitleOrUrl: r.targetTitleOrUrl,
          status: r.status,
          resolutionNotes: r.resolutionNotes,
          createdAt: r.createdAt,
        }));
        return {
          rows,
          columns: [
            { key: 'referenceId', header: 'Reference ID' },
            { key: 'requestType', header: 'Type' },
            { key: 'subCategory', header: 'Category' },
            { key: 'requesterName', header: 'Requester' },
            { key: 'requesterEmail', header: 'Email' },
            { key: 'targetTitleOrUrl', header: 'Target Listing / URL' },
            { key: 'status', header: 'Status' },
            { key: 'resolutionNotes', header: 'Resolution Notes' },
            { key: 'createdAt', header: 'Submitted At' },
          ],
        };
      }
      case 'audit_logs': {
        const list = repo ? await repo.getAdminAuditLogs(500) : [];
        const rows = list.map((a: any) => ({
          id: a.id,
          actorUsername: a.actorUsername,
          action: a.action,
          entityType: a.entityType,
          entityId: a.entityId,
          ipAddress: a.ipAddress,
          details: JSON.stringify(a.details || {}),
          createdAt: a.createdAt,
        }));
        return {
          rows,
          columns: [
            { key: 'id', header: 'Log ID' },
            { key: 'actorUsername', header: 'Administrator' },
            { key: 'action', header: 'Action' },
            { key: 'entityType', header: 'Entity Type' },
            { key: 'entityId', header: 'Entity ID' },
            { key: 'ipAddress', header: 'IP Address' },
            { key: 'details', header: 'Details' },
            { key: 'createdAt', header: 'Timestamp' },
          ],
        };
      }
    }
  };

  if (dataset === 'all') {
    const [jobs, internships, workshops, courses, submissions, reports, auditLogs] =
      await Promise.all([
        loadDataset('jobs'),
        loadDataset('internships'),
        loadDataset('workshops'),
        loadDataset('courses'),
        loadDataset('submissions'),
        loadDataset('reports'),
        loadDataset('audit_logs'),
      ]);

    const snapshot = {
      exportedAt: new Date().toISOString(),
      exportedBy: auth.user.username,
      jobs: jobs.rows,
      internships: internships.rows,
      workshops: workshops.rows,
      courses: courses.rows,
      submissions: submissions.rows,
      reports: reports.rows,
      auditLogs: auditLogs.rows,
    };

    if (repo) {
      await repo
        .recordAdminAuditLog({
          adminUserId: auth.user.id,
          actorUsername: auth.user.username,
          action: 'ADMIN_RECORDS_EXPORTED',
          entityType: 'export',
          entityId: 'all',
          details: { format: 'json' },
        })
        .catch(() => {});
    }

    return {
      statusCode: 200,
      headers: buildResponseHeaders(event, ALLOWED_METHODS, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="bio-inexa-export-all-${dateStamp}.json"`,
      }),
      body: JSON.stringify(snapshot, null, 2),
    };
  }

  const { rows, columns } = await loadDataset(dataset);
  if (repo) {
    await repo
      .recordAdminAuditLog({
        adminUserId: auth.user.id,
        actorUsername: auth.user.username,
        action: 'ADMIN_RECORDS_EXPORTED',
        entityType: 'export',
        entityId: dataset,
        details: { format: formatRaw, count: rows.length },
      })
      .catch(() => {});
  }

  if (formatRaw === 'json') {
    return {
      statusCode: 200,
      headers: buildResponseHeaders(event, ALLOWED_METHODS, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="bio-inexa-${dataset}-${dateStamp}.json"`,
      }),
      body: JSON.stringify(
        { dataset, count: rows.length, exportedAt: new Date().toISOString(), records: rows },
        null,
        2
      ),
    };
  }

  const csvContent = formatRecordsAsCsv(columns, rows);
  return {
    statusCode: 200,
    headers: buildResponseHeaders(event, ALLOWED_METHODS, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bio-inexa-${dataset}-${dateStamp}.csv"`,
    }),
    body: csvContent,
  };
};
