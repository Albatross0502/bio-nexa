export type Role = 'student' | 'company' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  title?: string;
  institution?: string;
  skills?: string[];
  bio?: string;
  cvUrl?: string;
}

export type JobVerificationStatus = 
  | 'Pending Verification'
  | 'Verified'
  | 'Rejected'
  | 'Expired'
  | 'Link Unavailable';

export interface Job {
  id: string;
  slug: string;
  title: string;
  company: string;
  employer?: string;
  companyLogo?: string;
  location: string;
  type: 'Full-time' | 'Contract' | 'Project-based';
  sector: 'Private Biopharma' | 'Government / Autonomous' | 'Academic Research' | 'Diagnostics & CRO';
  experienceLevel: 'Fresher (0-1 yr)' | 'Mid-level (2-5 yrs)' | 'Senior (5+ yrs)';
  qualification: 'B.Sc / B.Tech' | 'M.Sc / M.Tech' | 'Ph.D / Postdoc';
  salary: string;
  postedDate: string;
  deadline: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  benefits?: string[];
  source: {
    name: string;
    url: string;
    isExternal: boolean;
  };
  applicationUrl?: string;
  originalJobUrl?: string;
  publicationDate?: string;
  expiryDate?: string;
  lastVerificationDate?: string;
  verificationStatus?: JobVerificationStatus;
  verificationNotes?: string;
  isVerified?: boolean;
  featured?: boolean;
}

export interface Internship {
  id: string;
  slug: string;
  title: string;
  organization: string;
  location: string;
  mode: 'On-site Lab' | 'Hybrid' | 'Remote / Dry Lab';
  stipend: string;
  duration: string;
  deadline: string;
  category: 'Summer Fellowship' | 'Industrial R&D' | 'Academic Dissertation' | 'Clinical Research';
  eligibility: string;
  description: string;
  learningOutcomes: string[];
  skillsRequired: string[];
  source: {
    name: string;
    url: string;
    isExternal: boolean;
  };
  applicationUrl?: string;
  featured?: boolean;
}

export interface CourseLesson {
  id: string;
  title: string;
  duration: string;
  videoUrl?: string;
  summary: string;
  notesMarkdown?: string;
}

export interface CourseQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  instructor: string;
  instructorTitle: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  lessonsCount: number;
  rating: number;
  studentsCount: number;
  category: 'Molecular Biology & CRISPR' | 'Bioprocess & Fermentation' | 'Bioinformatics & NGS' | 'Pharma QC/QA' | 'Cell Culture';
  overview: string;
  syllabus: string[];
  lessons: CourseLesson[];
  quiz: CourseQuizQuestion[];
  featured?: boolean;
}

export interface ExamResource {
  id: string;
  title: string;
  year?: string;
  fileSize: string;
  type: 'Syllabus PDF' | 'Question Paper (PYQ)' | 'Answer Key' | 'Study Notes';
  downloadUrl?: string;
}

export interface ExamMockQuestion {
  id: string;
  section: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  subject: string;
}

export interface Exam {
  id: string;
  slug: string;
  shortName: string;
  fullName: string;
  conductingBody: string;
  frequency: string;
  upcomingDate: string;
  applicationPeriod: string;
  eligibility: string;
  patternOverview: string;
  sections: {
    name: string;
    marks: number;
    description: string;
  }[];
  keyTopics: string[];
  resources: ExamResource[];
  mockQuestions: ExamMockQuestion[];
}

export interface Scholarship {
  id: string;
  slug: string;
  title: string;
  provider: string;
  amount: string;
  coverage: string;
  deadline: string;
  scope: 'National (India)' | 'International (USA/EU)' | 'University Specific';
  level: 'M.Sc' | 'Ph.D / Fellowship' | 'Postdoctoral';
  eligibility: string[];
  benefits: string[];
  documentsRequired: string[];
  applicationUrl: string;
  featured?: boolean;
}

export interface ResearchPaper {
  id: string;
  doi: string;
  pubmedId?: string;
  title: string;
  authors: string[];
  journal: string;
  publishedDate: string;
  category: 'Synthetic Biology' | 'Gene Editing (CRISPR)' | 'mRNA Vaccines' | 'Plant Biotechnology' | 'Cancer Immunotherapy';
  abstract: string;
  keywords: string[];
  citationCount: number;
  openAccess: boolean;
  externalUrl: string;
}

export interface DiscussionReply {
  id: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
  upvotes: number;
}

export interface DiscussionTopic {
  id: string;
  title: string;
  authorName: string;
  authorRole: string;
  category: 'Wet Lab Protocols' | 'Exam Strategy' | 'Career Decisions' | 'Bioinformatics Code' | 'Scholarship Tips';
  content: string;
  createdAt: string;
  upvotes: number;
  replies: DiscussionReply[];
}

export interface Mentor {
  id: string;
  name: string;
  designation: string;
  organization: string;
  specialty: string[];
  experience: string;
  availableSlots: string;
  bio: string;
}

export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  category: 'Genomics' | 'Biopharma' | 'Agri-Biotech' | 'Clinical Trials' | 'Policy & Funding';
  publishedDate: string;
  readTime: string;
  summary: string;
  content: string;
  featured?: boolean;
}

export interface Certificate {
  id: string;
  certificateNumber: string;
  recipientName: string;
  courseTitle: string;
  issueDate: string;
  score: number;
  verificationCode: string;
}

export interface JobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  applicantName: string;
  applicantEmail: string;
  phone: string;
  qualification: string;
  experienceYears: string;
  coverNote: string;
  appliedDate: string;
  status: 'Under Review' | 'Shortlisted' | 'Interview Scheduled' | 'Rejected';
}

export interface ExternalSyncLog {
  id: string;
  source: string;
  timestamp: string;
  itemsFetched: number;
  newItems: number;
  status: 'Success' | 'Warning' | 'Error';
  details: string;
}

export interface ReportItem {
  id: string;
  itemType: 'Job' | 'Internship' | 'Discussion';
  itemTitle: string;
  reportedBy: string;
  reason: 'Expired' | 'Incorrect Information' | 'Spam' | 'Broken Link';
  date: string;
  status: 'Pending' | 'Resolved' | 'Dismissed';
}
