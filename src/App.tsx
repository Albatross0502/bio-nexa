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
import { JobDetailPage } from './components/jobs/JobDetailPage';
import { WorkshopsPage } from './components/workshops/WorkshopsPage';
import { NotFoundPage } from './components/pages/NotFoundPage';
import { parseRoute } from './utils/routeMatcher';

const MainContent: React.FC = () => {
  const { currentPath } = useApp();
  const [hasEntered, setHasEntered] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('welcome') === '1') return false;
    if (params.get('autostart') === '1') return true;
    // Direct deep routes should open directly without welcome splash obstruction
    if (window.location.pathname !== '/' && window.location.pathname !== '') return true;
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
    const parsed = parseRoute(currentPath);

    switch (parsed.route) {
      case 'home':
        return <HomePage />;
      case 'job-detail':
        return <JobDetailPage jobId={parsed.params.id || ''} />;
      case 'jobs':
        return <JobsPage />;
      case 'biotech-jobs':
        return <OpportunitiesPortal initialType="biotech_jobs" />;
      case 'opportunities':
        return <OpportunitiesPortal initialType="all" />;
      case 'opportunity-detail':
        return <JobDetailPage jobId={parsed.params.id || ''} />;
      case 'workshops':
        return <WorkshopsPage />;
      case 'internships':
        return <OpportunitiesPortal initialType="internship" />;
      case 'courses':
        return <CoursesPage />;
      case 'exams':
        return <ExamsPage />;
      case 'scholarships':
        return <ScholarshipsPage />;
      case 'research':
        return <ResearchPage />;
      case 'career-guidance':
        return <CareerGuidancePage />;
      case 'community':
        return <CommunityPage />;
      case 'news':
        return <NewsPage />;
      case 'dashboard-student':
        return <StudentDashboard />;
      case 'dashboard-company':
        return <CompanyDashboard />;
      case 'admin':
        return <AdminPanel />;
      case 'verify-certificate':
        return <VerifyCertificatePage />;
      case 'about':
        return <AboutPage />;
      case 'contact':
        return <ContactPage />;
      case 'privacy':
        return <PrivacyPage />;
      case 'terms':
        return <TermsPage />;
      case 'not-found':
      default:
        return (
          <NotFoundPage 
            title="404 - Page Not Found"
            message={`The URL "${parsed.pathname}" does not correspond to any active BIO-NEXA scientific page or resource.`}
            requestedResource={parsed.pathname}
          />
        );
    }
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
