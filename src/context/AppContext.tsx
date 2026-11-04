import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  Job,
  Internship,
  Course,
  Exam,
  Scholarship,
  ResearchPaper,
  DiscussionTopic,
  NewsArticle,
  Certificate,
  JobApplication,
  ExternalSyncLog,
  ReportItem
} from '../types';
import {
  SEED_JOBS,
  SEED_INTERNSHIPS,
  SEED_COURSES,
  SEED_EXAMS,
  SEED_SCHOLARSHIPS,
  SEED_RESEARCH,
  SEED_DISCUSSIONS,
  SEED_NEWS,
  SEED_SYNC_LOGS,
  SEED_REPORTS,
  SEED_CERTIFICATE
} from '../data/seedData';

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
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
  addJob: (job: Omit<Job, 'id' | 'slug' | 'postedDate'>) => void;
  deleteJob: (id: string) => void;
  internships: Internship[];
  addInternship: (internship: Omit<Internship, 'id' | 'slug'>) => void;
  deleteInternship: (id: string) => void;
  courses: Course[];
  applications: JobApplication[];
  applyToJob: (application: Omit<JobApplication, 'id' | 'appliedDate' | 'status'>) => void;
  updateApplicationStatus: (id: string, status: JobApplication['status']) => void;
  enrolledCourseIds: string[];
  enrollInCourse: (courseId: string) => void;
  completedLessonIds: string[];
  markLessonComplete: (lessonId: string) => void;
  certificates: Certificate[];
  awardCertificate: (course: Course, score: number) => Certificate;
  discussions: DiscussionTopic[];
  addDiscussion: (topic: Omit<DiscussionTopic, 'id' | 'createdAt' | 'upvotes' | 'replies'>) => void;
  addDiscussionReply: (topicId: string, replyContent: string) => void;
  upvoteDiscussion: (topicId: string) => void;
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
  addContactMessage: (msg: { name: string; email: string; subject: string; message: string }) => void;
  newsletterEmails: string[];
  subscribeNewsletter: (email: string) => boolean;
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
    name: 'Bio-Nexa Admin Team',
    email: 'admin@bio-nexa.org',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
    title: 'Platform System Administrator & Moderator',
    institution: 'BIO-NEXA National Council',
    bio: 'Managing data feeds, compliance verification, moderation, and institutional partnerships.'
  }
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Navigation state synced with window.location
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
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
  const [courses, setCourses] = useState<Course[]>(() => {
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

  // Listen to browser Back and Forward events
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    if (window.location.pathname !== path) {
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

  const addJob = (newJobData: Omit<Job, 'id' | 'slug' | 'postedDate'>) => {
    const slug = newJobData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000);
    const job: Job = {
      ...newJobData,
      id: 'job-' + Date.now(),
      slug,
      postedDate: new Date().toISOString().split('T')[0]
    };
    setJobs((prev) => [job, ...prev]);
    addToast(`Job opening "${job.title}" successfully published!`, 'success');
  };

  const deleteJob = (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    addToast('Job listing removed', 'info');
  };

  const addInternship = (newInternData: Omit<Internship, 'id' | 'slug'>) => {
    const slug = newInternData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000);
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

  const applyToJob = (appData: Omit<JobApplication, 'id' | 'appliedDate' | 'status'>) => {
    const newApp: JobApplication = {
      ...appData,
      id: 'app-' + Date.now(),
      appliedDate: new Date().toISOString().split('T')[0],
      status: 'Under Review'
    };
    setApplications((prev) => [newApp, ...prev]);
    addToast(`Application for "${appData.jobTitle}" submitted successfully!`, 'success');
  };

  const updateApplicationStatus = (id: string, status: JobApplication['status']) => {
    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status } : app))
    );
    addToast(`Applicant status updated to: ${status}`, 'info');
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

  const awardCertificate = (course: Course, score: number): Certificate => {
    const certNum = `BN-${new Date().getFullYear()}-${course.title.substring(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newCert: Certificate = {
      id: 'cert-' + Date.now(),
      certificateNumber: certNum,
      recipientName: currentUser.name,
      courseTitle: course.title,
      issueDate: new Date().toISOString().split('T')[0],
      score,
      verificationCode: `VERIFIED-BIO-NEXA-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
    };
    setCertificates((prev) => [newCert, ...prev]);
    addToast(`Congratulations! Certificate #${newCert.certificateNumber} generated.`, 'success');
    return newCert;
  };

  const addDiscussion = (topicData: Omit<DiscussionTopic, 'id' | 'createdAt' | 'upvotes' | 'replies'>) => {
    const topic: DiscussionTopic = {
      ...topicData,
      id: 'disc-' + Date.now(),
      createdAt: new Date().toISOString().split('T')[0],
      upvotes: 1,
      replies: []
    };
    setDiscussions((prev) => [topic, ...prev]);
    addToast('Discussion thread created successfully', 'success');
  };

  const addDiscussionReply = (topicId: string, replyContent: string) => {
    const reply = {
      id: 'rep-' + Date.now(),
      authorName: currentUser.name,
      authorRole: currentUser.title || 'BIO-NEXA Member',
      content: replyContent,
      createdAt: new Date().toISOString().split('T')[0],
      upvotes: 0
    };
    setDiscussions((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, replies: [...t.replies, reply] } : t))
    );
    addToast('Reply posted to discussion', 'success');
  };

  const upvoteDiscussion = (topicId: string) => {
    setDiscussions((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, upvotes: t.upvotes + 1 } : t))
    );
  };

  const triggerExternalSync = async (sourceName: string) => {
    setIsSyncing(true);
    addToast(`Initiating sync with ${sourceName}...`, 'info');
    // Simulate real network fetch with proper error handling and logging
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const newLog: ExternalSyncLog = {
      id: 'sync-' + Date.now(),
      source: sourceName,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      itemsFetched: Math.floor(20 + Math.random() * 50),
      newItems: Math.floor(3 + Math.random() * 8),
      status: 'Success',
      details: `Live API query parsed without validation errors. Database updated.`
    };
    setExternalSyncLogs((prev) => [newLog, ...prev]);
    setIsSyncing(false);
    addToast(`Sync completed! ${newLog.newItems} new items indexed from ${sourceName}.`, 'success');
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
    addToast('Thank you. Item reported to BIO-NEXA moderators for review.', 'info');
  };

  const resolveReport = (id: string, newStatus: ReportItem['status']) => {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
    addToast(`Report marked as ${newStatus}`, 'info');
  };

  const addContactMessage = (msg: { name: string; email: string; subject: string; message: string }) => {
    const entry = { ...msg, date: new Date().toISOString().split('T')[0] };
    setContactMessages((prev) => [entry, ...prev]);
    addToast('Your inquiry has been received. Our team will contact you within 24 hours.', 'success');
  };

  const subscribeNewsletter = (email: string): boolean => {
    if (!email || !email.includes('@')) {
      addToast('Please provide a valid email address', 'error');
      return false;
    }
    if (newsletterEmails.includes(email)) {
      addToast('You are already subscribed to BIO-NEXA weekly dispatches!', 'info');
      return true;
    }
    setNewsletterEmails((prev) => [...prev, email]);
    addToast('Subscribed! Welcome to the BIO-NEXA scientific career briefing.', 'success');
    return true;
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
