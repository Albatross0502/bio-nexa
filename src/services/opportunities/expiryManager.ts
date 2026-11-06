/**
 * BIO-NEXA Opportunity Expiry Manager
 * 
 * Rules:
 * 1. Respect original application deadline.
 * 2. If deadline < today, status becomes 'Expired'.
 * 3. If deadline is within 5 days, status becomes 'Closing Soon'.
 * 4. Missing deadline ('Not Specified') does NOT mean expired; stays 'Active'.
 * 5. Expired opportunities are hidden from public listing by default.
 */

import { Opportunity, OpportunityStatus } from '../../types/opportunity';

/**
 * Evaluates the real-time status of an opportunity based on its deadline and source state.
 */
export function evaluateOpportunityStatus(
  opp: { deadline?: string; expiryDate?: string; status: OpportunityStatus },
  referenceDate: Date = new Date()
): OpportunityStatus {
  // If explicitly flagged as source error/unavailable, maintain it
  if (opp.status === 'Source Unavailable' || opp.status === 'Verification Needed') {
    return opp.status;
  }

  const deadlineStr = opp.deadline || opp.expiryDate;

  // Rule 4: If deadline is unavailable or "Not Specified", do not fabricate expiry
  if (!deadlineStr || deadlineStr.toLowerCase().includes('not specified')) {
    return 'Active';
  }

  // Parse YYYY-MM-DD
  const deadlineDate = new Date(deadlineStr);
  if (isNaN(deadlineDate.getTime())) {
    return 'Active';
  }

  // Normalize reference date to beginning of day
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  // Set deadline to end of its day (23:59:59)
  const deadlineEndOfDay = new Date(deadlineDate);
  deadlineEndOfDay.setHours(23, 59, 59, 999);

  // Rule 2: Past deadline
  if (deadlineEndOfDay.getTime() < today.getTime()) {
    return 'Expired';
  }

  // Rule 3: Closing soon (within 5 days)
  const fiveDaysInMs = 5 * 24 * 60 * 60 * 1000;
  if (deadlineEndOfDay.getTime() - today.getTime() <= fiveDaysInMs) {
    return 'Closing Soon';
  }

  return 'Active';
}

export function getDaysUntilDeadline(deadline?: string): number | null {
  if (!deadline || deadline.toLowerCase().includes('not specified')) return null;
  const target = new Date(deadline);
  if (isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function calculateOpportunityStatus(
  deadline?: string,
  currentStatus: OpportunityStatus = 'Active',
  referenceDate: Date = new Date()
): OpportunityStatus {
  return evaluateOpportunityStatus(
    { deadline, status: currentStatus },
    referenceDate
  );
}

/**
 * Batch updates statuses across all opportunities in repository
 */
export function refreshOpportunityStatuses(opportunities: Opportunity[]): Opportunity[] {
  const now = new Date();
  return opportunities.map(opp => {
    const newStatus = evaluateOpportunityStatus(opp, now);
    if (newStatus !== opp.status) {
      return { ...opp, status: newStatus };
    }
    return opp;
  });
}
