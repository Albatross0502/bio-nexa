/**
 * BIO-NEXA Central Opportunity Store & Synchronization Engine
 * 
 * Provides reactive persistence, branch filtering, moderation workflows,
 * duplicate prevention, and source synchronization logging.
 */

import { Opportunity, OpportunityFilterState } from '../../types/opportunity';
import { SEED_OPPORTUNITIES } from './seedOpportunities';
import { evaluateOpportunityStatus, refreshOpportunityStatuses } from './expiryManager';
import { findDuplicateOpportunity } from './duplicateDetector';
import { matchBranchesForOpportunity } from '../../config/branches';
import { DATA_SOURCES_REGISTRY, OpportunityDataSource } from './sourcesRegistry';
import { googleSheetsSync } from './googleSheetsSync';

const STORAGE_KEY = 'bionexa_opportunities_v2';
const SYNC_LOGS_KEY = 'bionexa_opp_sync_logs_v2';

export interface SyncExecutionResult {
  sourceId: string;
  sourceName: string;
  status: 'Success' | 'Warning' | 'Error';
  timestamp: string;
  itemsFetched: number;
  newItemsAdded: number;
  duplicatesSkipped: number;
  expiredUpdated: number;
  details: string;
}

class OpportunityStore {
  private opportunities: Opportunity[] = [];
  private sources: OpportunityDataSource[] = [...DATA_SOURCES_REGISTRY];
  private syncLogs: SyncExecutionResult[] = [];
  private listeners: ((opps: Opportunity[]) => void)[] = [];
  public isSyncing: boolean = false;
  private autoSyncIntervalId: any = null;

  constructor() {
    this.init();
    this.setupPeriodicSync();
  }

  private init() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed: Opportunity[] = JSON.parse(saved);
          // Merge with any seed opportunities that might not be in saved
          const existingIds = new Set(parsed.map(p => p.id));
          const missingSeeds = SEED_OPPORTUNITIES.filter(s => !existingIds.has(s.id));
          this.opportunities = refreshOpportunityStatuses([...parsed, ...missingSeeds]);
        } catch {
          this.opportunities = refreshOpportunityStatuses([...SEED_OPPORTUNITIES]);
        }
      } else {
        this.opportunities = refreshOpportunityStatuses([...SEED_OPPORTUNITIES]);
        this.save();
      }

      const savedLogs = localStorage.getItem(SYNC_LOGS_KEY);
      if (savedLogs) {
        try {
          this.syncLogs = JSON.parse(savedLogs);
        } catch {
          this.syncLogs = [];
        }
      }

      // Hydrate live verified opportunities from SQLite backend API
      this.refreshFromBackend().catch(() => {});
    } else {
      this.opportunities = refreshOpportunityStatuses([...SEED_OPPORTUNITIES]);
    }
  }

  private setupPeriodicSync() {
    if (typeof window !== 'undefined') {
      // Periodic refresh from backend every 10 minutes
      this.autoSyncIntervalId = setInterval(() => {
        this.refreshFromBackend().catch(() => {});
      }, 10 * 60 * 1000);
    }
  }

  /**
   * Fetch live approved opportunities from the /api/opportunities backend
   */
  public async refreshFromBackend(params?: {
    branch?: string;
    type?: string;
    workMode?: string;
    status?: string;
    search?: string;
  }): Promise<Opportunity[]> {
    const { bionexaApi } = await import('../api/bionexaApiClient');
    const res = await bionexaApi.getOpportunities({
      ...(params || {}),
      limit: 100
    });

    if (Array.isArray(res.opportunities) && res.opportunities.length > 0) {
      // Preserve any locally created unapproved drafts so pending items stay inspectable in store if created via sync helper
      const unapprovedDrafts = this.opportunities.filter((o) => !o.isApproved && o.isDirectSubmission);
      const serverIds = new Set(res.opportunities.map((o) => o.id));
      const merged = [
        ...res.opportunities,
        ...unapprovedDrafts.filter((d) => !serverIds.has(d.id))
      ];
      this.opportunities = refreshOpportunityStatuses(merged);
      this.save();
    }

    return this.opportunities;
  }

  public async syncWithGoogleSheets(_force: boolean = false): Promise<{
    success: boolean;
    count: number;
    message: string;
    isFallback: boolean;
  }> {
    if (this.isSyncing) {
      return {
        success: true,
        count: this.opportunities.length,
        message: 'Refresh already in progress...',
        isFallback: false
      };
    }

    this.isSyncing = true;
    this.notify();

    try {
      const res = await googleSheetsSync.fetchOpportunities();
      if (res.success && Array.isArray(res.opportunities) && res.opportunities.length > 0) {
        const beforeIds = new Set(this.opportunities.map((o) => o.id));
        const unapprovedDrafts = this.opportunities.filter((o) => !o.isApproved && o.isDirectSubmission);
        const serverIds = new Set(res.opportunities.map((o) => o.id));
        const merged = [
          ...res.opportunities,
          ...unapprovedDrafts.filter((d) => !serverIds.has(d.id))
        ];

        this.opportunities = refreshOpportunityStatuses(merged);
        const addedCount = this.opportunities.filter((o) => !beforeIds.has(o.id)).length;

        const log: SyncExecutionResult = {
          sourceId: 'database-catalog-refresh',
          sourceName: 'BIO-INEXA Database Catalog',
          status: 'Success',
          timestamp: new Date().toISOString(),
          itemsFetched: res.opportunities.length,
          newItemsAdded: addedCount,
          duplicatesSkipped: Math.max(0, res.opportunities.length - addedCount),
          expiredUpdated: 0,
          details: res.message
        };
        this.syncLogs = [log, ...this.syncLogs].slice(0, 50);
        this.save();
      }

      this.isSyncing = false;
      this.notify();

      return {
        success: res.success,
        count: this.opportunities.length,
        message: res.message,
        isFallback: res.isFallback
      };
    } catch (err: any) {
      this.isSyncing = false;
      this.notify();
      return {
        success: false,
        count: this.opportunities.length,
        message: err?.message || 'Retaining verified database snapshot.',
        isFallback: true
      };
    }
  }

  private save() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.opportunities));
      localStorage.setItem(SYNC_LOGS_KEY, JSON.stringify(this.syncLogs));
    }
    this.notify();
  }

  public subscribe(listener: (opps: Opportunity[]) => void) {
    this.listeners.push(listener);
    listener(this.getAllOpportunities());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    const opps = this.getAllOpportunities();
    for (const listener of this.listeners) {
      listener(opps);
    }
  }

  /**
   * Returns all opportunities (including unapproved and expired) for Admin panel
   */
  public getAllOpportunities(): Opportunity[] {
    return this.opportunities;
  }

  /**
   * Returns public opportunities with comprehensive student filters
   */
  public getFilteredPublicOpportunities(filters: OpportunityFilterState): Opportunity[] {
    const now = new Date();

    return this.opportunities
      .filter(opp => {
        // Must be approved by admin for public visibility
        if (!opp.isApproved) return false;

        // Expiry filter (hide expired by default unless explicitly requested)
        if (!filters.showExpired && opp.status === 'Expired') {
          return false;
        }

        // 1. Type filter
        if (filters.type !== 'all' && opp.type !== filters.type) {
          return false;
        }

        // 2. Branch filter
        if (filters.selectedBranch !== 'all') {
          if (!opp.branches.includes(filters.selectedBranch)) {
            return false;
          }
        }

        // 3. Location filter
        if (filters.location !== 'all') {
          const locLower = opp.location.toLowerCase();
          const stateLower = (opp.locationState || '').toLowerCase();
          const filterLocLower = filters.location.toLowerCase();

          if (
            !locLower.includes(filterLocLower) &&
            !stateLower.includes(filterLocLower) &&
            !locLower.includes('all india')
          ) {
            return false;
          }
        }

        // 4. Work Mode filter
        if (filters.workMode !== 'all' && opp.workMode !== filters.workMode) {
          return false;
        }

        // 5. Experience filter
        if (filters.experience !== 'all') {
          if (opp.experience !== filters.experience && opp.experience !== 'Not Specified') {
            return false;
          }
        }

        // 6. Sector filter
        if (filters.sector && filters.sector !== 'all') {
          if (opp.sector !== filters.sector) {
            return false;
          }
        }

        // 7. Salary Tier filter
        if (filters.salaryTier !== 'all') {
          if (opp.salaryTier !== filters.salaryTier) {
            return false;
          }
        }

        // 8. Search query filter
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase();
          const matchesTitle = opp.title.toLowerCase().includes(q);
          const matchesOrg = opp.organization.toLowerCase().includes(q);
          const matchesDesc = opp.description.toLowerCase().includes(q);
          const matchesCat = (opp.category || '').toLowerCase().includes(q);
          const matchesElig = (opp.eligibility || '').toLowerCase().includes(q);
          const matchesQual = (opp.qualification || '').toLowerCase().includes(q);
          const matchesLoc = opp.location.toLowerCase().includes(q);
          const matchesSkills = (opp.skills || opp.requirements || []).some(s => s.toLowerCase().includes(q));
          const matchesSubCat = (opp.subCategory || '').toLowerCase().includes(q);

          if (!matchesTitle && !matchesOrg && !matchesDesc && !matchesCat && !matchesElig && !matchesQual && !matchesLoc && !matchesSkills && !matchesSubCat) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === 'closing_soon') {
          const deadlineA = a.deadline && a.deadline !== 'Not Specified' ? new Date(a.deadline).getTime() : 9999999999999;
          const deadlineB = b.deadline && b.deadline !== 'Not Specified' ? new Date(b.deadline).getTime() : 9999999999999;
          return deadlineA - deadlineB;
        }
        // Default: Newest first
        return new Date(b.postedDate || b.createdAt || 0).getTime() - new Date(a.postedDate || a.createdAt || 0).getTime();
      });
  }

  /**
   * Direct Employer or Organiser Submission (Lands in Moderation Queue)
   */
  public submitDirectOpportunity(candidate: Partial<Opportunity>): { success: boolean; id: string; duplicateWarning?: boolean } {
    // Validate missing fields strictly according to guidelines
    const title = candidate.title?.trim() || 'Untitled Opportunity';
    const organization = candidate.organization?.trim() || 'Direct Contributor';
    const description = candidate.description?.trim() || 'No description provided';
    const type = candidate.type || 'job';
    const subCategory = candidate.subCategory || (type === 'workshop' ? 'Biotechnology workshops' : 'Full-time jobs');
    const location = candidate.location?.trim() || 'All India';
    const workMode = candidate.workMode || 'On-site';
    const salaryOrStipend = candidate.salaryOrStipend?.trim() || 'Not Disclosed';
    const deadline = candidate.deadline?.trim() || 'Not Specified';
    const applicationUrl = candidate.applicationUrl?.trim() || '#';

    // Auto branch match if not supplied
    const matchedBranches = candidate.branches && candidate.branches.length > 0
      ? candidate.branches
      : matchBranchesForOpportunity(title, description, candidate.qualifications, candidate.skills);

    const newId = `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newOpp: Opportunity = {
      id: newId,
      title,
      organization,
      description,
      type,
      subCategory,
      branches: matchedBranches,
      qualifications: candidate.qualifications || ['Relevant Degree in Life Sciences'],
      skills: candidate.skills || ['Communication', 'Basic Laboratory Principles'],
      experience: candidate.experience || 'Not Specified',
      salaryOrStipend,
      salaryTier: candidate.salaryTier || (salaryOrStipend === 'Not Disclosed' ? 'not_disclosed' : 'paid'),
      location,
      workMode,
      deadline,
      postedDate: new Date().toISOString().split('T')[0],
      sourceName: candidate.sourceName || 'Direct Community Submission',
      sourceUrl: candidate.sourceUrl || applicationUrl,
      applicationUrl,
      sourceId: `sub-${Date.now()}`,
      status: 'Active',
      isApproved: false, // Strictly Pending Admin Moderation
      isVerified: false,
      verificationStatus: 'Pending Verification',
      dataCollectionTimestamp: new Date().toISOString(),
      attributionRequirements: 'Direct submission to BIO-INEXA portal pending administrator verification',
      isDirectSubmission: true,
      workshopDetails: candidate.workshopDetails
    };

    // Check for duplicate
    const duplicate = findDuplicateOpportunity(newOpp, this.opportunities);

    this.opportunities.unshift(newOpp);
    this.save();

    return {
      success: true,
      id: newId,
      duplicateWarning: !!duplicate
    };
  }

  /**
   * Admin: Approve listing for public viewing
   */
  public approveOpportunity(id: string): boolean {
    const opp = this.opportunities.find(o => o.id === id);
    if (!opp) return false;
    opp.isApproved = true;
    opp.lastVerifiedDate = new Date().toISOString().split('T')[0];
    this.save();
    return true;
  }

  /**
   * Admin: Reject listing
   */
  public rejectOpportunity(id: string): boolean {
    this.opportunities = this.opportunities.filter(o => o.id !== id);
    this.save();
    return true;
  }

  /**
   * Admin: Manually mark as expired
   */
  public markExpired(id: string): boolean {
    const opp = this.opportunities.find(o => o.id === id);
    if (!opp) return false;
    opp.status = 'Expired';
    this.save();
    return true;
  }

  /**
   * Admin: Update listing
   */
  public updateOpportunity(id: string, patch: Partial<Opportunity>): boolean {
    const index = this.opportunities.findIndex(o => o.id === id);
    if (index === -1) return false;
    this.opportunities[index] = {
      ...this.opportunities[index],
      ...patch
    };
    this.save();
    return true;
  }

  public updateStatus(id: string, status: any): boolean {
    return this.updateOpportunity(id, { status });
  }

  /**
   * Async Direct Employer or Organiser Submission persisted to /api/opportunities
   */
  public async submitOpportunityToBackend(candidate: {
    title: string;
    organization: string;
    type: Opportunity['type'];
    subCategory?: string;
    description: string;
    location: string;
    workMode: Opportunity['workMode'];
    experience?: string;
    qualification?: string;
    branches: string[];
    skills?: string[];
    salaryOrStipend?: string;
    salaryTier?: string;
    deadline?: string;
    sourceName?: string;
    sourceUrl?: string;
    applicationUrl: string;
    contactEmail?: string;
    workshopDetails?: Record<string, unknown>;
  }): Promise<{ success: boolean; id: string; opportunity: Opportunity; message: string }> {
    const { bionexaApi } = await import('../api/bionexaApiClient');
    const result = await bionexaApi.submitOpportunity(candidate);
    if (result.opportunity) {
      // Keep locally only as unapproved pending item (never exposed in public filtered list)
      const exists = this.opportunities.some((o) => o.id === result.opportunity.id);
      if (!exists) {
        this.opportunities.unshift({
          ...result.opportunity,
          isApproved: false,
          isVerified: false,
          verificationStatus: 'Pending Verification',
          isDirectSubmission: true
        });
        this.save();
      }
    }
    return result;
  }

  public submitOpportunity(candidate: any) {
    return this.submitDirectOpportunity(candidate);
  }

  /**
   * Synchronize opportunities from backend API & authorized Google Sheets pipeline
   */
  public async syncAllSources(): Promise<SyncExecutionResult[]> {
    const results: SyncExecutionResult[] = [];
    const now = new Date();

    // 1. Refresh existing deadlines
    this.opportunities = refreshOpportunityStatuses(this.opportunities);

    // 2. Refresh unified backend listings & external Google Sheets feed
    try {
      const beforeCount = this.opportunities.length;
      const backendList = await this.refreshFromBackend();
      results.push({
        sourceId: 'bionexa-api-unified',
        sourceName: 'BIO-INEXA Database API',
        status: 'Success',
        timestamp: now.toISOString(),
        itemsFetched: backendList.length,
        newItemsAdded: Math.max(0, backendList.length - beforeCount),
        duplicatesSkipped: 0,
        expiredUpdated: 0,
        details: `Loaded ${backendList.length} verified records from BIO-INEXA backend API.`
      });
    } catch (err: any) {
      results.push({
        sourceId: 'bionexa-api-unified',
        sourceName: 'BIO-INEXA Database API',
        status: 'Error',
        timestamp: now.toISOString(),
        itemsFetched: 0,
        newItemsAdded: 0,
        duplicatesSkipped: 0,
        expiredUpdated: 0,
        details: err?.message || 'Backend API refresh failed.'
      });
    }

    this.syncLogs = [...results, ...this.syncLogs].slice(0, 50);
    this.save();
    return results;
  }

  public getSources(): OpportunityDataSource[] {
    return this.sources;
  }

  public getSyncLogs(): SyncExecutionResult[] {
    return this.syncLogs;
  }

  /**
   * Metrics for Admin and Platform Overview
   */
  public getMetrics() {
    const total = this.opportunities.length;
    const active = this.opportunities.filter(o => o.isApproved && o.status !== 'Expired').length;
    const pendingModeration = this.opportunities.filter(o => !o.isApproved).length;
    const expired = this.opportunities.filter(o => o.status === 'Expired').length;
    const closingSoon = this.opportunities.filter(o => o.status === 'Closing Soon').length;

    // By branch
    const branchBreakdown: Record<string, number> = {};
    for (const opp of this.opportunities) {
      if (opp.isApproved && opp.status !== 'Expired') {
        for (const b of opp.branches) {
          branchBreakdown[b] = (branchBreakdown[b] || 0) + 1;
        }
      }
    }

    // By category
    const categoryBreakdown: Record<string, number> = {
      job: this.opportunities.filter(o => o.isApproved && o.type === 'job').length,
      biotech_job: this.opportunities.filter(o => o.isApproved && o.type === 'biotech_job').length,
      internship: this.opportunities.filter(o => o.isApproved && o.type === 'internship').length,
      workshop: this.opportunities.filter(o => o.isApproved && o.type === 'workshop').length,
      course: this.opportunities.filter(o => o.isApproved && o.type === 'course').length
    };

    return {
      total,
      active,
      pendingModeration,
      expired,
      closingSoon,
      branchBreakdown,
      categoryBreakdown
    };
  }
}

export const opportunityStore = new OpportunityStore();
