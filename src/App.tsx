import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { GlobalSearchModal } from './components/common/GlobalSearchModal';
import { ToastContainer } from './components/common/Toast';

import { HomePage } from './components/home/HomePage';
import { JobsPage } from './components/jobs/JobsPage';
import { InternshipsPage } from './components/internships/InternshipsPage';
import { CoursesPage } from './components/courses/CoursesPage';
import { ExamsPage } from './components/exams/ExamsPage';
import { ScholarshipsPage } from './components/scholarships/ScholarshipsPage';
import { ResearchPage } from './components/research/ResearchPage';
import { CareerGuidancePage } from './components/guidance/CareerGuidancePage';
import { CommunityPage } from './components/community/CommunityPage';
import { NewsPage } from './components/news/NewsPage';
import { StudentDashboard } from './components/dashboard/StudentDashboard';
import { CompanyDashboard } from './components/dashboard/CompanyDashboard';
import { AdminPanel } from './components/admin/AdminPanel';
import {
  VerifyCertificatePage,
  AboutPage,
  ContactPage,
  PrivacyPage,
  TermsPage
} from './components/pages/StaticPages';
import { WelcomeLandingPage } from './components/welcome/WelcomeLandingPage';
import { OpportunitiesPortal } from './components/opportunities/OpportunitiesPortal';

const MainContent: React.FC = () => {
  const { currentPath } = useApp();
  const [hasEntered, setHasEntered] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('welcome') === '1') return false;
    if (params.get('autostart') === '1') return true;
    return sessionStorage.getItem('bionexa_welcome_entered') === 'true';
  });

  // Expose global helper to revisit welcome screen at any time
  useEffect(() => {
    (window as unknown as { showBioNexaWelcome?: () => void }).showBioNexaWelcome = () => {
      sessionStorage.removeItem('bionexa_welcome_entered');
      setHasEntered(false);
    };
  }, []);

  const handleEnterWebsite = () => {
    sessionStorage.setItem('bionexa_welcome_entered', 'true');
    setHasEntered(true);
  };

  const renderRoute = () => {
    // Normalise path (remove trailing slash unless root)
    const path = currentPath === '/' ? '/' : currentPath.replace(/\/$/, '');

    if (path === '/') return <HomePage />;
    if (path.startsWith('/opportunities')) return <OpportunitiesPortal initialType="all" />;
    if (path.startsWith('/workshops')) return <OpportunitiesPortal initialType="workshop" />;
    if (path.startsWith('/biotech-jobs')) return <OpportunitiesPortal initialType="biotech_jobs" />;
    if (path.startsWith('/jobs')) return <OpportunitiesPortal initialType="job" />;
    if (path.startsWith('/internships')) return <OpportunitiesPortal initialType="internship" />;
    if (path.startsWith('/courses')) return <CoursesPage />;
    if (path.startsWith('/exams')) return <ExamsPage />;
    if (path.startsWith('/scholarships')) return <ScholarshipsPage />;
    if (path.startsWith('/research')) return <ResearchPage />;
    if (path.startsWith('/career-guidance')) return <CareerGuidancePage />;
    if (path.startsWith('/community')) return <CommunityPage />;
    if (path.startsWith('/news')) return <NewsPage />;
    if (path.startsWith('/dashboard-student') || path.startsWith('/dashboard/student')) return <StudentDashboard />;
    if (path.startsWith('/dashboard-company') || path.startsWith('/dashboard/company')) return <CompanyDashboard />;
    if (path.startsWith('/admin')) return <AdminPanel />;
    if (path.startsWith('/verify-certificate')) return <VerifyCertificatePage />;
    if (path.startsWith('/about')) return <AboutPage />;
    if (path.startsWith('/contact')) return <ContactPage />;
    if (path.startsWith('/privacy')) return <PrivacyPage />;
    if (path.startsWith('/terms')) return <TermsPage />;

    // Fallback to Home if unmatched
    return <HomePage />;
  };

  return (
    <>
      {!hasEntered && <WelcomeLandingPage onEnter={handleEnterWebsite} />}
      <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
        <Navbar />
        <main className="flex-1">
          {renderRoute()}
        </main>
        <Footer />
        <GlobalSearchModal />
        <ToastContainer />
      </div>
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
