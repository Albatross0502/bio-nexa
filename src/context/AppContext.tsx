import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  Job,
  Internship,
  Course,
  Certificate,
  DiscussionTopic,
  JobApplication,
  ExternalSyncLog,
  ReportItem
} from '../types';
import {
  SEED_JOBS,
  SEED_INTERNSHIPS,
  SEED_COURSES,
  SEED_DISCUSSIONS,
  SEED_SYNC_LOGS,
  SEED_REPORTS
} from '../data/seedData';
import { bionexaApi } from '../services/api/bionexaApiClient';
import {
  studentApi,
  StudentProfile,
  StudentProfileUpdatePayload
} from '../services/student/studentApiClient';
import {
  companyApi,
  CompanyProfile,
  CompanyProfileUpdatePayload
} from '../services/company/companyApiClient';
import { opportunityStore } from '../services/opportunities/opportunityStore';
import { googleSheetsSync } from '../services/opportunities/googleSheetsSync';

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface ContactResult {
  ok: boolean;
  referenceId?: string;
  error?: string;
}

interface AppContextType {
  currentUser: User;
  studentUser: StudentProfile | null;
  isStudentAuthenticated: boolean;
  studentAuthLoading: boolean;
  refreshStudentSession: () => Promise<void>;
  setStudentSessionUser: (student: StudentProfile | null) => void;
  logoutStudent: () => Promise<void>;
  updateStudentProfile: (payload: StudentProfileUpdatePayload) => Promise<StudentProfile>;
  companyUser: CompanyProfile | null;
  isCompanyAuthenticated: boolean;
  companyAuthLoading: boolean;
  refreshCompanySession: () => Promise<void>;
  setCompanySessionUser: (company: CompanyProfile | null) => void;
  logoutCompany: () => Promise<void>;
  updateCompanyProfile: (payload: CompanyProfileUpdatePayload) => Promise<CompanyProfile>;
  switchRole: (role: 'student' | 'company' | 'admin') => void;
  updateUserProfile: (profile: Partial<User>) => Promise<void>;
  currentPath: string;
  navigate: (path: string) => void;
  savedItemIds: string[];
  toggleSaveItem: (id: string, title?: string) => void;
  isItemSaved: (id: string) => boolean;
  jobs: Job[];
  addJob: (job: Omit<Job, 'id' | 'slug' | 'postedDate'>) => Promise<void>;
  deleteJob: (id: string) => void;
  internships: Internship[];
  addInternship: (internship: Omit<Internship, 'id' | 'slug'>) => void;
  deleteInternship: (id: string) => void;
  courses: Course[];
  applications: JobApplication[];
  applyToJob: (application: Omit<JobApplication, 'id' | 'appliedDate' | 'status'>) => Promise<void>;
  updateApplicationStatus: (id: string, status: JobApplication['status']) => Promise<void>;
  enrolledCourseIds: string[];
  enrollInCourse: (courseId: string) => void;
  completedLessonIds: string[];
  markLessonComplete: (lessonId: string) => void;
  certificates: Certificate[];
  awardCertificate: (course: Course, score: number) => Promise<Certificate>;
  discussions: DiscussionTopic[];
  addDiscussion: (topic: Omit<DiscussionTopic, 'id' | 'createdAt' | 'upvotes' | 'replies'>) => Promise<void>;
  addDiscussionReply: (topicId: string, replyContent: string) => Promise<void>;
  upvoteDiscussion: (topicId: string) => Promise<void>;
  externalSyncLogs: ExternalSyncLog[];
  triggerExternalSync: (sourceName: string) => Promise<void>;
  isSyncing: boolean;
  reports: ReportItem[];
  addReport: (itemType: ReportItem['itemType'], itemTitle: string, reason: ReportItem['reason']) => void;
  resolveReport: (id: string, newStatus: ReportItem['status']) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  toasts: ToastMessage[];
  addToast: (text: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  contactMessages: { name: string; email: string; subject: string; message: string; date: string }[];
  addContactMessage: (msg: { name: string; email: string; subject: string; message: string }) => Promise<ContactResult>;
  newsletterEmails: string[];
  subscribeNewsletter: (email: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const GUEST_USER: User = {
  id: 'guest',
  name: '',
  email: '',
  role: 'guest',
  title: '',
  institution: '',
  skills: [],
  bio: ''
};

function mapStudentToUser(student: StudentProfile): User {
  return {
    id: student.id,
    name: student.fullName,
    email: student.email,
    role: 'student',
    title: student.degreeTitle || 'Biotechnology Student',
    institution: student.institution || '',
    specialization: student.specialization || '',
    graduationYear: student.graduationYear || '',
    location: student.location || '',
    skills: Array.isArray(student.skills) ? student.skills : [],
    bio: student.bio || '',
    linkedinUrl: student.linkedinUrl || '',
    orcidId: student.orcidId || '',
    emailVerified: Boolean(student.emailVerified),
  };
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Navigation state synced with window.location
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window === 'undefined') return '/';
    return (window.location.pathname + window.location.search) || '/';
  });

  // Real database-backed Student & Company Authentication state (HttpOnly cookie sessions)
  const [studentUser, setStudentUser] = useState<StudentProfile | null>(null);
  const [studentAuthLoading, setStudentAuthLoading] = useState<boolean>(true);
  const [companyUser, setCompanyUser] = useState<CompanyProfile | null>(null);
  const [companyAuthLoading, setCompanyAuthLoading] = useState<boolean>(true);
  const currentUser: User = studentUser
    ? mapStudentToUser(studentUser)
    : companyUser
    ? {
        id: companyUser.id,
        name: companyUser.contactName,
        email: companyUser.email,
        role: 'company',
        title: companyUser.contactTitle || 'Employer Representative',
        institution: companyUser.organizationName,
        location: companyUser.headquartersLocation,
        skills: [],
        bio: companyUser.description,
        emailVerified: companyUser.emailVerified,
      }
    : GUEST_USER;
  const isStudentAuthenticated = Boolean(studentUser);
  const isCompanyAuthenticated = Boolean(companyUser);

  // Bookmarks (clean initial state — no hardcoded demo items)
  const [savedItemIds, setSavedItemIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bionexa_saved_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Jobs state
  const [jobs, setJobs] = useState<Job[]>(() => {
    try {
      const saved = localStorage.getItem('bionexa_jobs');
      return saved ? JSON.parse(saved) : SEED_JOBS;
    } catch {
      return SEED_JOBS;
    }
  });

  // Internships state
  const [internships, setInternships] = useState<Internship[]>(() => {
    try {
      const saved = localStorage.getItem('bionexa_internships');
      return saved ? JSON.parse(saved) : SEED_INTERNSHIPS;
    } catch {
      return SEED_INTERNSHIPS;
    }
  });

  // Courses state
  const [courses] = useState<Course[]>(() => {
    try {
      const saved = localStorage.getItem('bionexa_courses');
      return saved ? JSON.parse(saved) : SEED_COURSES;
    } catch {
      return SEED_COURSES;
    }
  });

  // Applications state (clean initial state — no hardcoded demo Aarav Gautam applications)
  const [applications, setApplications] = useState<JobApplication[]>(() => {
    try {
      const saved = localStorage.getItem('bionexa_applications');
      const parsed: JobApplication[] = saved ? JSON.parse(saved) : [];
      return parsed.filter((app) => app.id !== 'app-initial-1');
    } catch {
      return [];
    }
  });

  // Course Enrollments & Progress (clean initial state)
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bionexa_enrolled_courses');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bionexa_completed_lessons');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Certificates (clean initial state — only real earned certificates)
  const [certificates, setCertificates] = useState<Certificate[]>(() => {
    try {
      const saved = localStorage.getItem('bionexa_certificates');
      const parsed: Certificate[] = saved ? JSON.parse(saved) : [];
      return parsed.filter((c) => c.recipientName !== 'Aarav Gautam');
    } catch {
      return [];
    }
  });

  // Discussions
  const [discussions, setDiscussions] = useState<DiscussionTopic[]>(() => {
    const saved = localStorage.getItem('bionexa_discussions');
    return saved ? JSON.parse(saved) : SEED_DISCUSSIONS;
  });

  // External Sync
  const [externalSyncLogs, setExternalSyncLogs] = useState<ExternalSyncLog[]>(() => {
    const saved = localStorage.getItem('bionexa_sync_logs');
    return saved ? JSON.parse(saved) : SEED_SYNC_LOGS;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Reports
  const [reports, setReports] = useState<ReportItem[]>(() => {
    const saved = localStorage.getItem('bionexa_reports');
    return saved ? JSON.parse(saved) : SEED_REPORTS;
  });

  // Contact messages & Newsletter
  const [contactMessages, setContactMessages] = useState<any[]>(() => {
    const saved = localStorage.getItem('bionexa_contact_msgs');
    return saved ? JSON.parse(saved) : [];
  });

  const [newsletterEmails, setNewsletterEmails] = useState<string[]>(() => {
    const saved = localStorage.getItem('bionexa_newsletter');
    return saved ? JSON.parse(saved) : ['researcher@iisc.ac.in'];
  });

  // UI state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('bionexa_dark_mode') === 'true';
  });

  // Keep dark mode synced with document element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('bionexa_dark_mode', String(darkMode));
  }, [darkMode]);

  // Remove legacy demo user key and hydrate real student & company sessions from server cookies
  const refreshStudentSession = async () => {
    try {
      const res = await studentApi.getSession();
      setStudentUser(res.authenticated && res.student ? res.student : null);
    } catch {
      setStudentUser(null);
    } finally {
      setStudentAuthLoading(false);
    }
  };

  const refreshCompanySession = async () => {
    try {
      const res = await companyApi.getSession();
      setCompanyUser(res.authenticated && res.company ? res.company : null);
    } catch {
      setCompanyUser(null);
    } finally {
      setCompanyAuthLoading(false);
    }
  };

  useEffect(() => {
    try {
      localStorage.removeItem('bionexa_user');
    } catch {
      // Ignore storage access restrictions
    }
    refreshStudentSession();
    refreshCompanySession();
  }, []);

  useEffect(() => {
    localStorage.setItem('bionexa_saved_ids', JSON.stringify(savedItemIds));
  }, [savedItemIds]);

  useEffect(() => {
    localStorage.setItem('bionexa_jobs', JSON.stringify(jobs));
  }, [jobs]);

  useEffect(() => {
    localStorage.setItem('bionexa_internships', JSON.stringify(internships));
  }, [internships]);

  useEffect(() => {
    localStorage.setItem('bionexa_applications', JSON.stringify(applications));
  }, [applications]);

  useEffect(() => {
    localStorage.setItem('bionexa_enrolled_courses', JSON.stringify(enrolledCourseIds));
  }, [enrolledCourseIds]);

  useEffect(() => {
    localStorage.setItem('bionexa_completed_lessons', JSON.stringify(completedLessonIds));
  }, [completedLessonIds]);

  useEffect(() => {
    localStorage.setItem('bionexa_certificates', JSON.stringify(certificates));
  }, [certificates]);

  useEffect(() => {
    localStorage.setItem('bionexa_discussions', JSON.stringify(discussions));
  }, [discussions]);

  useEffect(() => {
    localStorage.setItem('bionexa_sync_logs', JSON.stringify(externalSyncLogs));
  }, [externalSyncLogs]);

  useEffect(() => {
    localStorage.setItem('bionexa_reports', JSON.stringify(reports));
  }, [reports]);

  useEffect(() => {
    localStorage.setItem('bionexa_contact_msgs', JSON.stringify(contactMessages));
  }, [contactMessages]);

  useEffect(() => {
    localStorage.setItem('bionexa_newsletter', JSON.stringify(newsletterEmails));
  }, [newsletterEmails]);

  // Hydrate jobs, applications, and discussions from SQLite backend on mount
  useEffect(() => {
    let isMounted = true;
    const hydrateFromBackend = async () => {
      try {
        const dbJobs = await bionexaApi.getJobs({ limit: 100 });
        if (isMounted && Array.isArray(dbJobs) && dbJobs.length > 0) {
          const mappedJobs: Job[] = dbJobs.map((j: any) => ({
            id: j.id,
            slug: j.id,
            title: j.title,
            company: j.employer || j.company,
            employer: j.employer || j.company,
            location: j.location,
            type: j.employmentType || j.type || 'Full-time',
            sector: j.sector || 'Private Biopharma',
            experienceLevel: 'Mid-level (2-5 yrs)',
            qualification: j.qualification || 'M.Sc / M.Tech',
            salary: j.salary,
            postedDate: j.publicationDate || '2026-11-01',
            deadline: j.expiryDate || '2026-12-31',
            publicationDate: j.publicationDate || '2026-11-01',
            expiryDate: j.expiryDate || '2026-12-31',
            lastVerificationDate: j.lastVerificationDate || '',
            verificationStatus: j.verificationStatus || 'Pending Verification',
            verificationNotes: j.verificationNotes,
            isVerified: j.verificationStatus === 'Verified',
            description: j.description,
            responsibilities: j.responsibilities || [],
            requirements: j.requirements || [],
            skills: j.skills || [],
            source: {
              name: j.source || 'BIO-INEXA Portal',
              url: j.originalJobUrl || j.applicationUrl,
              isExternal: true
            },
            originalJobUrl: j.originalJobUrl || j.applicationUrl,
            applicationUrl: j.applicationUrl,
            featured: Boolean(j.featured)
          }));
          setJobs(mappedJobs);
        }
      } catch (err) {
        console.warn('API /api/jobs sync note: using cached state.', err);
      }

      try {
        const dbInternships = await bionexaApi.getInternships({ limit: 100 });
        if (isMounted && Array.isArray(dbInternships)) {
          const mappedInternships: Internship[] = dbInternships.map((i: any) => {
            const rawMode = String(i.mode || i.workMode || 'On-site Lab');
            const mode: Internship['mode'] = rawMode.toLowerCase().includes('remote') || rawMode.toLowerCase().includes('dry')
              ? 'Remote / Dry Lab'
              : rawMode.toLowerCase().includes('hybrid')
              ? 'Hybrid'
              : 'On-site Lab';
            const validCategories: Internship['category'][] = [
              'Summer Fellowship',
              'Industrial R&D',
              'Academic Dissertation',
              'Clinical Research'
            ];
            const category = validCategories.includes(i.category)
              ? (i.category as Internship['category'])
              : 'Industrial R&D';
            return {
              id: i.id,
              slug: i.slug || i.id,
              title: i.title,
              organization: i.organization,
              location: i.location,
              mode,
              stipend: i.stipend,
              duration: i.duration,
              deadline: i.deadline || '',
              category,
              eligibility: i.eligibility,
              description: i.description,
              learningOutcomes: Array.isArray(i.learningOutcomes) ? i.learningOutcomes : [],
              skillsRequired: Array.isArray(i.skillsRequired) ? i.skillsRequired : [],
              source: i.source || {
                name: i.sourceName || 'Verified Partner Program',
                url: i.sourceUrl || i.applicationUrl,
                isExternal: true
              },
              applicationUrl: i.applicationUrl,
              featured: Boolean(i.featured),
              verificationStatus: i.verificationStatus,
              verificationNotes: i.verificationNotes,
              lastVerificationDate: i.lastVerificationDate,
              isVerified: Boolean(i.isVerified),
              isApproved: i.isApproved !== false,
              isActive: i.isActive !== false,
              isExpired: Boolean(i.isExpired),
              compensationType: i.compensationType
            };
          });
          setInternships(mappedInternships);
        }
      } catch (err) {
        console.warn('API /api/internships sync note: using cached state.', err);
      }

      try {
        const dbApps = await bionexaApi.getApplications();
        if (isMounted && Array.isArray(dbApps) && dbApps.length > 0) {
          setApplications(dbApps);
        }
      } catch (err) {
        console.warn('API /api/applications sync note:', err);
      }

      try {
        const dbDiscussions = await bionexaApi.getDiscussions();
        if (isMounted && Array.isArray(dbDiscussions) && dbDiscussions.length > 0) {
          setDiscussions(dbDiscussions);
        }
      } catch (err) {
        console.warn('API /api/discussions sync note:', err);
      }
    };

    hydrateFromBackend();
    return () => {
      isMounted = false;
    };
  }, []);

  // Listen to browser Back and Forward events
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath((window.location.pathname + window.location.search) || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    const currentFull = window.location.pathname + window.location.search;
    if (currentFull !== path) {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const addToast = (text: string, type: ToastMessage['type'] = 'success') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const setStudentSessionUser = (student: StudentProfile | null) => {
    setStudentUser(student);
    setStudentAuthLoading(false);
  };

  const logoutStudent = async () => {
    try {
      await studentApi.logout();
    } catch {
      // Clear local session state even if network call fails
    } finally {
      setStudentUser(null);
      addToast('Signed out of your student account.', 'info');
    }
  };

  const updateStudentProfile = async (payload: StudentProfileUpdatePayload): Promise<StudentProfile> => {
    const res = await studentApi.updateProfile(payload);
    setStudentUser(res.student);
    addToast(res.message || 'Student profile updated successfully.', 'success');
    return res.student;
  };

  const setCompanySessionUser = (company: CompanyProfile | null) => {
    setCompanyUser(company);
    setCompanyAuthLoading(false);
  };

  const logoutCompany = async () => {
    try {
      await companyApi.logout();
    } catch {
      // Clear local session state even if network call fails
    } finally {
      setCompanyUser(null);
      addToast('Signed out of your employer account.', 'info');
    }
  };

  const updateCompanyProfile = async (payload: CompanyProfileUpdatePayload): Promise<CompanyProfile> => {
    const res = await companyApi.updateProfile(payload);
    setCompanyUser(res.company);
    addToast(res.message || 'Organization profile updated successfully.', 'success');
    return res.company;
  };

  // Navigate to the corresponding portal without injecting any demonstration user account
  const switchRole = (role: 'student' | 'company' | 'admin') => {
    if (role === 'admin') {
      navigate('/admin');
    } else if (role === 'company') {
      navigate(companyUser ? '/dashboard-company' : '/company/login');
    } else {
      navigate(studentUser ? '/dashboard-student' : '/student/login');
    }
  };

  const updateUserProfile = async (profile: Partial<User>) => {
    if (!studentUser) {
      addToast('Please sign in to your student account to update your profile.', 'warning');
      return;
    }
    await updateStudentProfile({
      fullName: profile.name,
      degreeTitle: profile.title,
      institution: profile.institution,
      specialization: profile.specialization,
      graduationYear: profile.graduationYear,
      location: profile.location,
      skills: profile.skills,
      bio: profile.bio,
      linkedinUrl: profile.linkedinUrl,
      orcidId: profile.orcidId,
    });
  };

  const toggleSaveItem = (id: string, title?: string) => {
    setSavedItemIds((prev) => {
      const exists = prev.includes(id);
      if (exists) {
        addToast(title ? `Removed "${title}" from saved items` : 'Item removed from saved list', 'info');
        return prev.filter((item) => item !== id);
      } else {
        addToast(title ? `Saved "${title}" to your dashboard` : 'Item saved successfully', 'success');
        return [...prev, id];
      }
    });
  };

  const isItemSaved = (id: string) => savedItemIds.includes(id);

  const addJob = async (newJobData: Omit<Job, 'id' | 'slug' | 'postedDate'>) => {
    const candidateUrl =
      newJobData.applicationUrl ||
      (newJobData.source?.url && /^https?:\/\//i.test(newJobData.source.url)
        ? newJobData.source.url
        : `${window.location.origin}/jobs`);

    try {
      const submitted = await bionexaApi.submitJob({
        title: newJobData.title,
        company: newJobData.company,
        applicationUrl: candidateUrl,
        description: newJobData.description,
        location: newJobData.location,
        qualification: newJobData.qualification,
        skills: newJobData.skills,
        employmentType: newJobData.type,
        salary: newJobData.salary,
        deadline: newJobData.deadline,
        sector: newJobData.sector,
        responsibilities: newJobData.responsibilities,
        requirements: newJobData.requirements
      });

      const slug = newJobData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const job: Job = {
        ...newJobData,
        id: submitted.jobId || `job-${Date.now()}`,
        slug,
        applicationUrl: candidateUrl,
        verificationStatus: 'Pending Verification',
        isVerified: false,
        lastVerificationDate: '',
        postedDate: new Date().toISOString().split('T')[0]
      };
      setJobs((prev) => [job, ...prev]);
      addToast(submitted.message || `Job opening "${job.title}" submitted for verification.`, 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to submit job listing.', 'error');
      throw err;
    }
  };

  const deleteJob = (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    addToast('Job listing removed', 'info');
  };

  const addInternship = (newInternData: Omit<Internship, 'id' | 'slug'>) => {
    const slug = newInternData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const intern: Internship = {
      ...newInternData,
      id: 'intern-' + Date.now(),
      slug
    };
    setInternships((prev) => [intern, ...prev]);
    addToast(`Internship "${intern.title}" successfully posted!`, 'success');
  };

  const deleteInternship = (id: string) => {
    setInternships((prev) => prev.filter((i) => i.id !== id));
    addToast('Internship listing removed', 'info');
  };

  const applyToJob = async (appData: Omit<JobApplication, 'id' | 'appliedDate' | 'status'>) => {
    try {
      const saved = await bionexaApi.createApplication(appData);
      setApplications((prev) => [saved, ...prev]);
      addToast(`Application for "${appData.jobTitle}" submitted successfully!`, 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to submit application.', 'error');
      throw err;
    }
  };

  const updateApplicationStatus = async (id: string, status: JobApplication['status']) => {
    try {
      const updated = await bionexaApi.updateApplicationStatus(id, status);
      setApplications((prev) => prev.map((app) => (app.id === id ? updated : app)));
      addToast(`Applicant status updated to: ${status}`, 'info');
    } catch (err: any) {
      addToast(err?.message || 'Failed to update application status.', 'error');
      throw err;
    }
  };

  const enrollInCourse = (courseId: string) => {
    if (!enrolledCourseIds.includes(courseId)) {
      setEnrolledCourseIds((prev) => [...prev, courseId]);
      addToast('Enrolled in course successfully! Welcome to the class.', 'success');
    }
  };

  const markLessonComplete = (lessonId: string) => {
    if (!completedLessonIds.includes(lessonId)) {
      setCompletedLessonIds((prev) => [...prev, lessonId]);
      addToast('Lesson marked as completed! Keep going.', 'info');
    }
  };

  const awardCertificate = async (course: Course, score: number): Promise<Certificate> => {
    try {
      const issued = await bionexaApi.issueCertificate({
        recipientName: currentUser.name || 'BIO-INEXA Learner',
        courseTitle: course.title,
        score
      });
      setCertificates((prev) => [issued, ...prev.filter((c) => c.certificateNumber !== issued.certificateNumber)]);
      addToast(`Congratulations! Certificate #${issued.certificateNumber} verified & saved.`, 'success');
      return issued;
    } catch (err: any) {
      addToast(err?.message || 'Unable to record academy certificate.', 'error');
      throw err;
    }
  };

  const addDiscussion = async (topicData: Omit<DiscussionTopic, 'id' | 'createdAt' | 'upvotes' | 'replies'>) => {
    try {
      const created = await bionexaApi.createDiscussion(topicData);
      setDiscussions((prev) => [created, ...prev]);
      addToast('Discussion thread created successfully', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to publish discussion thread.', 'error');
      throw err;
    }
  };

  const addDiscussionReply = async (topicId: string, replyContent: string) => {
    try {
      const reply = await bionexaApi.addDiscussionReply(topicId, {
        authorName: currentUser.name || 'BIO-INEXA Researcher',
        authorRole: currentUser.title || 'Community Member',
        content: replyContent
      });
      setDiscussions((prev) =>
        prev.map((t) => (t.id === topicId ? { ...t, replies: [...t.replies, reply] } : t))
      );
      addToast('Reply posted to discussion', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to post reply.', 'error');
      throw err;
    }
  };

  const upvoteDiscussion = async (topicId: string) => {
    try {
      const updated = await bionexaApi.upvoteDiscussion(topicId);
      setDiscussions((prev) =>
        prev.map((t) => (t.id === topicId ? { ...t, upvotes: updated.upvotes } : t))
      );
    } catch (err: any) {
      addToast(err?.message || 'Failed to upvote discussion.', 'error');
    }
  };

  const triggerExternalSync = async (sourceName: string) => {
    setIsSyncing(true);
    addToast(`Synchronizing ${sourceName} from backend feeds...`, 'info');
    try {
      const beforeIds = new Set(opportunityStore.getAllOpportunities().map((o) => o.id));
      const backendOpps = await opportunityStore.refreshFromBackend();
      const sheetsRes = await googleSheetsSync.fetchOpportunities();
      const afterList = opportunityStore.getAllOpportunities();
      const newCount = afterList.filter((o) => !beforeIds.has(o.id)).length;

      const newLog: ExternalSyncLog = {
        id: 'sync-' + Date.now(),
        source: sourceName,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
        itemsFetched: backendOpps.length,
        newItems: newCount,
        status: sheetsRes.success ? 'Success' : 'Warning',
        details: `Synced ${backendOpps.length} unified listings from /api/opportunities (${sheetsRes.message}).`
      };
      setExternalSyncLogs((prev) => [newLog, ...prev]);
      addToast(`Sync completed: ${backendOpps.length} listings verified (${newCount} new).`, 'success');
    } catch (err: any) {
      const failLog: ExternalSyncLog = {
        id: 'sync-' + Date.now(),
        source: sourceName,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
        itemsFetched: 0,
        newItems: 0,
        status: 'Error',
        details: err?.message || 'Backend sync failed.'
      };
      setExternalSyncLogs((prev) => [failLog, ...prev]);
      addToast(err?.message || `Failed to sync ${sourceName}.`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const addReport = (itemType: ReportItem['itemType'], itemTitle: string, reason: ReportItem['reason']) => {
    const newReport: ReportItem = {
      id: 'rep-' + Date.now(),
      itemType,
      itemTitle,
      reportedBy: currentUser.email || 'visitor@bio-inexa.org',
      reason,
      date: new Date().toISOString().split('T')[0],
      status: 'Pending'
    };
    setReports((prev) => [newReport, ...prev]);
  };

  const resolveReport = (id: string, newStatus: ReportItem['status']) => {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
    addToast(`Report marked as ${newStatus}`, 'info');
  };

  const addContactMessage = async (msg: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<ContactResult> => {
    try {
      const res = await bionexaApi.submitContact(msg);
      const entry = { ...msg, date: new Date().toISOString().split('T')[0], referenceId: res.referenceId };
      setContactMessages((prev) => [entry, ...prev]);
      addToast(res.message || 'Your inquiry has been received.', 'success');
      return { ok: true, referenceId: res.referenceId };
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to submit contact inquiry.';
      addToast(errMsg, 'error');
      return { ok: false, error: errMsg };
    }
  };

  const subscribeNewsletter = async (email: string): Promise<boolean> => {
    if (!email || !email.includes('@')) {
      addToast('Please provide a valid email address', 'error');
      return false;
    }
    try {
      const res = await bionexaApi.subscribeNewsletter(email.trim());
      if (res.alreadySubscribed) {
        addToast(res.message || 'You are already subscribed to BIO-INEXA weekly dispatches!', 'info');
      } else {
        setNewsletterEmails((prev) => (prev.includes(email.trim().toLowerCase()) ? prev : [...prev, email.trim().toLowerCase()]));
        addToast(res.message || 'Subscribed! Welcome to the BIO-INEXA scientific career briefing.', 'success');
      }
      return true;
    } catch (err: any) {
      addToast(err?.message || 'Unable to process newsletter subscription.', 'error');
      return false;
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        studentUser,
        isStudentAuthenticated,
        studentAuthLoading,
        refreshStudentSession,
        setStudentSessionUser,
        logoutStudent,
        updateStudentProfile,
        companyUser,
        isCompanyAuthenticated,
        companyAuthLoading,
        refreshCompanySession,
        setCompanySessionUser,
        logoutCompany,
        updateCompanyProfile,
        switchRole,
        updateUserProfile,
        currentPath,
        navigate,
        savedItemIds,
        toggleSaveItem,
        isItemSaved,
        jobs,
        addJob,
        deleteJob,
        internships,
        addInternship,
        deleteInternship,
        courses,
        applications,
        applyToJob,
        updateApplicationStatus,
        enrolledCourseIds,
        enrollInCourse,
        completedLessonIds,
        markLessonComplete,
        certificates,
        awardCertificate,
        discussions,
        addDiscussion,
        addDiscussionReply,
        upvoteDiscussion,
        externalSyncLogs,
        triggerExternalSync,
        isSyncing,
        reports,
        addReport,
        resolveReport,
        isSearchOpen,
        setIsSearchOpen,
        toasts,
        addToast,
        removeToast,
        darkMode,
        toggleDarkMode,
        contactMessages,
        addContactMessage,
        newsletterEmails,
        subscribeNewsletter
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
