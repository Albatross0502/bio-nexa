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
  SEED_REPORTS,
  SEED_CERTIFICATE
} from '../data/seedData';
import { bionexaApi } from '../services/api/bionexaApiClient';
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
  switchRole: (role: 'student' | 'company' | 'admin') => void;
  updateUserProfile: (profile: Partial<User>) => void;
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

const DEMO_USERS: Record<'student' | 'company' | 'admin', User> = {
  student: {
    id: 'user-stu-1',
    name: 'Aarav Gautam',
    email: 'aarav.biotech@university.edu',
    role: 'student',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
    title: 'M.Sc Biotechnology Scholar (Final Year)',
    institution: 'Department of Biotechnology, Pune University',
    skills: ['CRISPR sgRNA Design', 'RT-qPCR', 'SDS-PAGE', 'Python for Bioinformatics', 'Bacterial Transformation'],
    bio: 'Aspiring molecular biologist focused on genome editing therapeutics and bioprocess fermentation.'
  },
  company: {
    id: 'user-comp-1',
    name: 'Dr. Nalini Parthasarathy',
    email: 'nalini.p@biocon.com',
    role: 'company',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&h=120&q=80',
    title: 'Talent Acquisition & University Relations Lead',
    institution: 'Biocon Biologics Ltd.',
    skills: ['Bioprocess Scale-Up', 'Monoclonal Antibodies', 'cGMP Hiring'],
    bio: 'Recruiting exceptional scientific talent for discovery, fermentation, and regulatory operations.'
  },
  admin: {
    id: 'user-adm-1',
    name: 'BIO-INEXA Admin Team',
    email: 'admin@bionexa.org',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
    title: 'Platform System Administrator & Moderator',
    institution: 'BIO-INEXA National Council',
    bio: 'Managing data feeds, compliance verification, moderation, and institutional partnerships.'
  }
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Navigation state synced with window.location
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window === 'undefined') return '/';
    return (window.location.pathname + window.location.search) || '/';
  });

  // User state
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('bionexa_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return DEMO_USERS.student;
  });

  // Bookmarks
  const [savedItemIds, setSavedItemIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('bionexa_saved_ids');
    return saved ? JSON.parse(saved) : ['job-1', 'course-1', 'exam-1', 'sch-1'];
  });

  // Jobs state
  const [jobs, setJobs] = useState<Job[]>(() => {
    const saved = localStorage.getItem('bionexa_jobs');
    return saved ? JSON.parse(saved) : SEED_JOBS;
  });

  // Internships state
  const [internships, setInternships] = useState<Internship[]>(() => {
    const saved = localStorage.getItem('bionexa_internships');
    return saved ? JSON.parse(saved) : SEED_INTERNSHIPS;
  });

  // Courses state
  const [courses] = useState<Course[]>(() => {
    const saved = localStorage.getItem('bionexa_courses');
    return saved ? JSON.parse(saved) : SEED_COURSES;
  });

  // Applications state
  const [applications, setApplications] = useState<JobApplication[]>(() => {
    const saved = localStorage.getItem('bionexa_applications');
    return saved ? JSON.parse(saved) : [
      {
        id: 'app-initial-1',
        jobId: 'job-1',
        jobTitle: 'Senior Bioprocess Scientist - Upstream Fermentation',
        company: 'Biocon Biologics',
        applicantName: 'Aarav Gautam',
        applicantEmail: 'aarav.biotech@university.edu',
        phone: '+91 98765 43210',
        qualification: 'M.Sc / M.Tech',
        experienceYears: '1 Year Research Project',
        coverNote: 'Extensive hands-on training with 10L fermenters and DO cascade control.',
        appliedDate: '2026-11-02',
        status: 'Under Review'
      }
    ];
  });

  // Course Enrollments & Progress
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('bionexa_enrolled_courses');
    return saved ? JSON.parse(saved) : ['course-1'];
  });

  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('bionexa_completed_lessons');
    return saved ? JSON.parse(saved) : ['c1-l1', 'c1-l2'];
  });

  // Certificates
  const [certificates, setCertificates] = useState<Certificate[]>(() => {
    const saved = localStorage.getItem('bionexa_certificates');
    return saved ? JSON.parse(saved) : [SEED_CERTIFICATE];
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

  // Keep state saved to localStorage
  useEffect(() => {
    localStorage.setItem('bionexa_user', JSON.stringify(currentUser));
  }, [currentUser]);

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
        if (isMounted && Array.isArray(dbInternships) && dbInternships.length > 0) {
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
              featured: Boolean(i.featured)
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

  const switchRole = (role: 'student' | 'company' | 'admin') => {
    setCurrentUser(DEMO_USERS[role]);
    addToast(`Switched active view to ${role.toUpperCase()}: ${DEMO_USERS[role].name}`, 'info');
    if (role === 'admin') {
      navigate('/admin');
    } else if (role === 'company') {
      navigate('/dashboard-company');
    } else {
      navigate('/dashboard-student');
    }
  };

  const updateUserProfile = (profile: Partial<User>) => {
    setCurrentUser((prev) => ({ ...prev, ...profile }));
    addToast('Profile updated successfully', 'success');
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
        recipientName: currentUser.name,
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
        authorName: currentUser.name,
        authorRole: currentUser.title || 'BIO-INEXA Member',
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
      reportedBy: currentUser.email,
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
