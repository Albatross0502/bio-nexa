/**
 * Standard Opportunity Data Model for BIO-NEXA Portal
 * 
 * Supports Jobs, Biotechnology Jobs, Internships, and Workshops
 * with complete legal attribution and educational branch indexing.
 */

export type OpportunityType = 'job' | 'biotech_job' | 'internship' | 'workshop' | 'course';

export type OpportunityStatus =
  | 'Open'
  | 'Closing Soon'
  | 'Expired'
  | 'Closed'
  | 'Active'
  | 'Verification Needed'
  | 'Source Unavailable'
  | 'active'
  | 'closing_soon'
  | 'expired'
  | 'closed'
  | 'open'
  | 'verification_needed'
  | 'source_unavailable';

export type WorkMode = 'On-site' | 'Remote' | 'Hybrid' | 'onsite' | 'remote' | 'hybrid' | 'Online' | 'Offline' | 'online' | 'offline';

export type ExperienceLevel =
  | 'Fresher'
  | '0–1 year'
  | '1–3 years'
  | 'Experienced (3+ yrs)'
  | 'Not Specified';

export type SalaryTier =
  | 'unpaid'
  | 'paid'
  | 'below_10k'
  | '10k_to_20k'
  | '20k_to_40k'
  | 'above_40k'
  | 'not_disclosed';

export interface WorkshopDetails {
  dates?: string;
  duration?: string;
  mode: 'Online' | 'Offline' | 'Hybrid' | 'online' | 'offline' | 'hybrid';
  fees?: string; // e.g. "Free", "₹499", or "Not Disclosed"
  registrationFee?: string;
  certificateAvailable?: boolean;
  certificateProvided?: boolean;
  registrationUrl?: string;
  contactEmail?: string;
  speakerOrTrainer?: string;
  speakers?: string[];
}

export interface CourseDetails {
  provider?: string;
  duration?: string;
  lessonsCount?: number;
  fees?: string;
  certificateAvailable?: boolean;
  certificateType?: string;
  enrollmentUrl?: string;
  syllabus?: string[];
  level?: string;
  rating?: number;
}

export interface Opportunity {
  id: string;
  title: string;
  category?: string; // Google Sheets Category string e.g. "Biotechnology", "Internship", "Workshop", "Course", "Government Job"
  organization: string;
  organizationLogo?: string;
  description: string;
  type: OpportunityType;
  subCategory?: string; // Specific subcategory (e.g. "Research Associate", "Paid internship", "Webinar")
  branches: string[]; // Educational branch IDs (e.g. ['biotechnology', 'microbiology'])
  eligibility?: string; // e.g. "B.Sc / M.Sc Life Sciences"
  qualification?: string;
  qualifications?: string[];
  skills?: string[];
  requirements?: string[];
  responsibilities?: string[];
  experience?: ExperienceLevel | string;
  salaryOrStipend?: string; // Never fabricate: display "Not Disclosed" if absent
  compensation?: {
    amount?: string;
    currency?: string;
    period?: 'month' | 'year' | 'fixed' | string;
    isDisclosed?: boolean;
  };
  salaryTier?: SalaryTier;
  salaryPeriod?: 'monthly' | 'annual' | 'stipend' | 'lump_sum';
  currency?: string; // 'INR', 'USD', etc.
  fees?: string; // e.g. "Free", "₹499"
  duration?: string; // e.g. "3 Months", "2 Days", "6 Weeks"
  location: string; // e.g. "Jaipur, Rajasthan", "Bengaluru, Karnataka", "All India"
  locationState?: string;
  workMode: WorkMode;
  mode?: string; // Google Sheets mode
  deadline?: string; // ISO format "YYYY-MM-DD" or "Not Specified"
  applicationDeadline?: string;
  postedDate?: string; // ISO format "YYYY-MM-DD"
  publishedDate?: string;
  createdAt?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceId?: string;
  source?: {
    id: string;
    name: string;
    permissionStatus?: string;
    type?: string;
    originalUrl?: string;
  };
  applicationUrl: string; // Canonical destination URL
  registrationUrl?: string;
  sourceLastUpdated?: string;
  lastUpdated?: string;
  lastVerifiedDate?: string;
  expiryDate?: string;
  status: OpportunityStatus;
  isApproved: boolean; // Moderation flag: only true appears publicly
  isVerified?: boolean;
  isExternal?: boolean;
  dataCollectionTimestamp?: string;
  attributionRequirements?: string;
  isDirectSubmission?: boolean;
  duplicateOf?: string;
  workshopDetails?: WorkshopDetails;
  courseDetails?: CourseDetails;
  featured?: boolean;
  sector?: 'Government' | 'Private' | 'Academic' | 'Autonomous' | string;
}

export interface OpportunityFilterState {
  type: 'all' | OpportunityType;
  selectedBranch: string; // 'all' or branch id
  searchQuery: string;
  location: string; // 'all', 'jaipur', 'rajasthan', 'delhi', 'mumbai', 'bengaluru', etc.
  workMode: 'all' | WorkMode | string;
  experience: 'all' | string;
  salaryTier: 'all' | SalaryTier;
  sector?: 'all' | 'Government' | 'Private';
  sortBy: 'newest' | 'closing_soon' | 'salary_high';
  showExpired: boolean;
}
