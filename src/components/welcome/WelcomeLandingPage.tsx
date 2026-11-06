import React, { useState } from 'react';
import { sendVisitorTracking } from '../../utils/visitorTracker';

interface WelcomeLandingPageProps {
  onEnter: () => void;
}

export const WelcomeLandingPage: React.FC<WelcomeLandingPageProps> = ({ onEnter }) => {
  const [isEntering, setIsEntering] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  /**
   * handleBioNexaEnter()
   * 
   * Orchestrates the transition into the BIO-NEXA platform:
   * 1. Immediately prevents duplicate clicks
   * 2. Initiates non-blocking visitor tracking to Google Apps Script / Google Sheets
   * 3. Triggers the landing-page exit animation
   * 4. Smoothly reveals the existing BIO-NEXA website
   */
  const handleBioNexaEnter = () => {
    // 1. Immediately prevent additional clicks
    if (isEntering) return;
    setIsEntering(true);

    // 2. Initiate non-blocking visitor tracking
    sendVisitorTracking().catch(() => {
      // Guaranteed silent failover - website access is never blocked
    });

    // 3. Start landing-page exit animation
    setIsExiting(true);

    // 4. Smoothly reveal the existing BIO-NEXA website after exit transition
    setTimeout(() => {
      onEnter();
    }, 450);
  };

  return (
    <div
      className={`fixed inset-0 z-50 overflow-y-auto overflow-x-hidden min-h-screen w-full flex flex-col justify-between items-center bg-gradient-to-b from-[#F2F7FC] via-[#E4F0FB] to-[#D5EAF9] selection:bg-teal-100 selection:text-teal-900 transition-all duration-500 ease-out ${
        isExiting ? 'opacity-0 scale-[1.02] pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
      }}
    >
      {/* =========================================================================
          BACKGROUND SCIENTIFIC DECORATIONS & AMBIENT ATMOSPHERE
      ========================================================================== */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none" aria-hidden="true">
        {/* Soft radial blue and teal glow patches */}
        <div className="absolute -top-32 -left-32 w-[420px] h-[420px] bg-sky-200/35 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -right-32 w-[420px] h-[420px] bg-teal-200/25 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-[500px] h-[500px] bg-blue-200/25 rounded-full blur-3xl" />

        {/* Left DNA Strand (translucent vector illustration) */}
        <svg
          className="absolute -left-8 top-16 w-44 md:w-56 h-[620px] opacity-20 text-sky-500 animate-[float_10s_ease-in-out_infinite]"
          viewBox="0 0 100 400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M20,0 C80,50 80,100 20,150 C-40,200 -40,250 20,300 C80,350 80,400 20,450" />
          <path d="M80,0 C20,50 20,100 80,150 C140,200 140,250 80,300 C20,350 20,400 80,450" />
          <line x1="25" y1="25" x2="75" y2="25" strokeDasharray="3 3" />
          <line x1="50" y1="75" x2="50" y2="75" strokeWidth="6" strokeLinecap="round" />
          <line x1="25" y1="125" x2="75" y2="125" strokeDasharray="3 3" />
          <line x1="25" y1="175" x2="75" y2="175" strokeDasharray="3 3" />
          <line x1="25" y1="275" x2="75" y2="275" strokeDasharray="3 3" />
          <line x1="25" y1="325" x2="75" y2="325" strokeDasharray="3 3" />
        </svg>

        {/* Right DNA Strand (translucent vector illustration) */}
        <svg
          className="absolute -right-8 top-10 w-44 md:w-56 h-[660px] opacity-20 text-sky-500 animate-[float_12s_ease-in-out_infinite_reverse]"
          viewBox="0 0 100 400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M80,0 C20,50 20,100 80,150 C140,200 140,250 80,300 C20,350 20,400 80,450" />
          <path d="M20,0 C80,50 80,100 20,150 C-40,200 -40,250 20,300 C80,350 80,400 20,450" />
          <line x1="25" y1="50" x2="75" y2="50" strokeDasharray="3 3" />
          <line x1="25" y1="150" x2="75" y2="150" strokeDasharray="3 3" />
          <line x1="25" y1="250" x2="75" y2="250" strokeDasharray="3 3" />
          <line x1="25" y1="350" x2="75" y2="350" strokeDasharray="3 3" />
        </svg>

        {/* Floating Hexagonal Icon 1: Laboratory Flask (top left) */}
        <div className="absolute left-8 md:left-20 top-24 opacity-40 hover:opacity-75 transition-opacity">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/75 backdrop-blur-sm border border-sky-200/60 shadow-sm flex items-center justify-center text-sky-600">
            <svg className="w-7 h-7 md:w-8 md:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M10 2v7.31L4.89 17.5a2 2 0 0 0 1.66 2.5h10.9a2 2 0 0 0 1.66-2.5L14 9.31V2" />
              <path d="M8.5 2h7" />
              <path d="M14 9.3a6.5 6.5 0 1 1-4 0" />
              <circle cx="12" cy="15" r="1.5" fill="currentColor" />
            </svg>
          </div>
        </div>

        {/* Floating Hexagonal Icon 2: Microscope (mid left) */}
        <div className="absolute left-6 md:left-14 top-1/2 -translate-y-1/2 opacity-35 hover:opacity-75 transition-opacity">
          <div className="w-13 h-13 md:w-15 md:h-15 rounded-2xl bg-white/75 backdrop-blur-sm border border-sky-200/60 shadow-sm flex items-center justify-center text-teal-600">
            <svg className="w-6 h-6 md:w-7 md:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 18h8" />
              <path d="M3 22h18" />
              <path d="M14 22a7 7 0 1 0 0-14h-1" />
              <path d="M9 14h2" />
              <path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" />
              <path d="M12 6V3a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3" />
            </svg>
          </div>
        </div>

        {/* Floating Hexagonal Icon 3: Molecular Structure (mid right) */}
        <div className="absolute right-8 md:right-20 top-1/3 opacity-35 hover:opacity-75 transition-opacity">
          <div className="w-13 h-13 md:w-15 md:h-15 rounded-2xl bg-white/75 backdrop-blur-sm border border-sky-200/60 shadow-sm flex items-center justify-center text-sky-600">
            <svg className="w-6 h-6 md:w-7 md:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="6" cy="6" r="2.5" />
              <circle cx="18" cy="6" r="2.5" />
              <circle cx="12" cy="18" r="2.5" />
              <line x1="8.2" y1="7" x2="15.8" y2="7" />
              <line x1="7.2" y1="8.2" x2="10.8" y2="15.8" />
              <line x1="16.8" y1="8.2" x2="13.2" y2="15.8" />
            </svg>
          </div>
        </div>

        {/* Floating Hexagonal Icon 4: Test Tube (bottom right) */}
        <div className="absolute right-8 md:right-24 bottom-24 opacity-35 hover:opacity-75 transition-opacity">
          <div className="w-13 h-13 md:w-15 md:h-15 rounded-2xl bg-white/75 backdrop-blur-sm border border-sky-200/60 shadow-sm flex items-center justify-center text-teal-600">
            <svg className="w-6 h-6 md:w-7 md:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V2" />
              <path d="M8.5 2h7" />
              <path d="M9.5 9h5" />
              <path d="M9.5 13h5" />
            </svg>
          </div>
        </div>

        {/* Botanical Green Leaves (Bottom Left Corner) */}
        <div className="absolute -bottom-4 -left-4 w-40 h-40 sm:w-52 sm:h-52 md:w-64 md:h-64 pointer-events-none">
          <svg viewBox="0 0 220 220" fill="none" className="w-full h-full drop-shadow-md">
            {/* Primary Upright Leaf */}
            <path
              d="M0,220 C20,130 90,95 155,90 C130,135 85,185 0,220 Z"
              fill="url(#leaf-main-1)"
            />
            {/* Secondary Arching Leaf */}
            <path
              d="M10,210 C55,155 135,140 180,148 C150,185 95,208 10,210 Z"
              fill="url(#leaf-main-2)"
            />
            {/* Bottom Accent Leaf */}
            <path
              d="M-10,225 C35,185 95,185 125,205 C90,218 45,224 -10,225 Z"
              fill="url(#leaf-main-3)"
            />
            <defs>
              <linearGradient id="leaf-main-1" x1="10" y1="210" x2="155" y2="90" gradientUnits="userSpaceOnUse">
                <stop stopColor="#15803D" />
                <stop offset="0.5" stopColor="#16A34A" />
                <stop offset="1" stopColor="#4ADE80" />
              </linearGradient>
              <linearGradient id="leaf-main-2" x1="20" y1="205" x2="180" y2="148" gradientUnits="userSpaceOnUse">
                <stop stopColor="#166534" />
                <stop offset="0.6" stopColor="#22C55E" />
                <stop offset="1" stopColor="#86EFAC" />
              </linearGradient>
              <linearGradient id="leaf-main-3" x1="0" y1="220" x2="125" y2="205" gradientUnits="userSpaceOnUse">
                <stop stopColor="#14532D" />
                <stop offset="1" stopColor="#16A34A" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Botanical Green Leaves (Bottom Right Corner) */}
        <div className="absolute -bottom-4 -right-4 w-40 h-40 sm:w-52 sm:h-52 md:w-64 md:h-64 pointer-events-none">
          <svg viewBox="0 0 220 220" fill="none" className="w-full h-full drop-shadow-md transform -scale-x-100">
            {/* Primary Upright Leaf */}
            <path
              d="M0,220 C20,130 90,95 155,90 C130,135 85,185 0,220 Z"
              fill="url(#leaf-right-1)"
            />
            {/* Secondary Arching Leaf */}
            <path
              d="M10,210 C55,155 135,140 180,148 C150,185 95,208 10,210 Z"
              fill="url(#leaf-right-2)"
            />
            {/* Bottom Accent Leaf */}
            <path
              d="M-10,225 C35,185 95,185 125,205 C90,218 45,224 -10,225 Z"
              fill="url(#leaf-right-3)"
            />
            <defs>
              <linearGradient id="leaf-right-1" x1="10" y1="210" x2="155" y2="90" gradientUnits="userSpaceOnUse">
                <stop stopColor="#15803D" />
                <stop offset="0.5" stopColor="#16A34A" />
                <stop offset="1" stopColor="#4ADE80" />
              </linearGradient>
              <linearGradient id="leaf-right-2" x1="20" y1="205" x2="180" y2="148" gradientUnits="userSpaceOnUse">
                <stop stopColor="#166534" />
                <stop offset="0.6" stopColor="#22C55E" />
                <stop offset="1" stopColor="#86EFAC" />
              </linearGradient>
              <linearGradient id="leaf-right-3" x1="0" y1="220" x2="125" y2="205" gradientUnits="userSpaceOnUse">
                <stop stopColor="#14532D" />
                <stop offset="1" stopColor="#16A34A" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: TOP BRANDING SECTION
      ========================================================================== */}
      <header className="relative z-10 w-full pt-6 sm:pt-8 md:pt-10 px-4 flex flex-col items-center">
        <h1 className="sr-only">BIO-NEXA | Connecting Science. Creating Careers.</h1>
        <div className="flex flex-col items-center max-w-2xl mx-auto transition-transform hover:scale-[1.01] duration-300">
          {/* Pristine Transparent BIO-NEXA Brand Logo */}
          <img
            src="/assets/img/logo-transparent.png"
            alt="BIO-NEXA - Connecting Science. Creating Careers."
            className="h-20 sm:h-24 md:h-28 w-auto object-contain select-none filter drop-shadow-[0_2px_8px_rgba(11,42,91,0.08)]"
            loading="eager"
            fetchPriority="high"
          />
        </div>
      </header>

      {/* =========================================================================
          SECTION 3: MAIN WELCOME SECTION (ROBOT GUIDE + SPEECH BUBBLE)
      ========================================================================== */}
      <main className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 my-auto py-2 sm:py-4 flex flex-col items-center">
        <div className="w-full flex flex-col lg:flex-row items-center justify-center gap-6 sm:gap-8 lg:gap-10">
          {/* -------------------------------------------------------------------
              LEFT SIDE: 3D BIOTECHNOLOGY ROBOT GUIDE
          -------------------------------------------------------------------- */}
          <div className="relative flex-shrink-0 flex items-center justify-center group">
            {/* Ambient Cyan Halo Behind Robot */}
            <div className="absolute inset-0 bg-sky-400/25 blur-3xl rounded-full transform scale-90 group-hover:scale-105 transition-transform duration-700" />

            {/* Playful Cyan Energy Ray Ticks near robot's waving hand */}
            <div className="absolute -top-3 left-6 sm:left-10 flex gap-1.5 z-20 pointer-events-none" aria-hidden="true">
              <span className="w-1.5 h-4 sm:h-5 bg-sky-500 rounded-full transform -rotate-25 shadow-sm" />
              <span className="w-1.5 h-5 sm:h-6 bg-sky-500 rounded-full transform -translate-y-1 shadow-sm" />
              <span className="w-1.5 h-4 sm:h-5 bg-sky-500 rounded-full transform rotate-25 shadow-sm" />
            </div>

            {/* 3D Robot Image with Gentle Floating Animation */}
            <div className="relative w-56 h-56 sm:w-68 sm:h-68 md:w-76 md:h-76 lg:w-84 lg:h-84 flex items-center justify-center animate-[float_4s_ease-in-out_infinite]">
              <img
                src="/assets/img/bionexa-robot-bust.png"
                alt="BIO-NEXA 3D Biotech Guide Robot"
                className="w-full h-full object-contain rounded-3xl filter drop-shadow-[0_16px_36px_rgba(31,111,178,0.22)] select-none"
                loading="eager"
              />
            </div>
          </div>

          {/* -------------------------------------------------------------------
              RIGHT SIDE: LARGE WHITE SPEECH BUBBLE
          -------------------------------------------------------------------- */}
          <div className="relative max-w-xl w-full">
            {/* Playful Cyan Energy Ray Ticks at speech bubble top right */}
            <div className="absolute -top-4 right-8 sm:right-12 flex gap-1.5 z-20 pointer-events-none" aria-hidden="true">
              <span className="w-1.5 h-4 sm:h-5 bg-sky-500 rounded-full transform -rotate-25 shadow-sm" />
              <span className="w-1.5 h-5 sm:h-6 bg-sky-500 rounded-full transform -translate-y-1 shadow-sm" />
              <span className="w-1.5 h-4 sm:h-5 bg-sky-500 rounded-full transform rotate-25 shadow-sm" />
            </div>

            {/* The Speech Bubble Container */}
            <div className="relative bg-white/95 backdrop-blur-md rounded-3xl sm:rounded-4xl p-6 sm:p-8 md:p-9 border-2 border-sky-200/80 shadow-[0_18px_45px_rgba(31,111,178,0.14),0_2px_8px_rgba(0,0,0,0.03)]">
              {/* Pointer Triangle pointing towards Robot */}
              {/* Desktop pointer: points left */}
              <div
                className="hidden lg:block absolute -left-3.5 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[14px] border-t-transparent border-b-[14px] border-b-transparent border-r-[16px] border-r-white drop-shadow-[-3px_0_1px_rgba(186,230,253,0.9)]"
                aria-hidden="true"
              />
              {/* Mobile pointer: points up */}
              <div
                className="block lg:hidden absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-b-[14px] border-b-white drop-shadow-[0_-2px_1px_rgba(186,230,253,0.9)]"
                aria-hidden="true"
              />

              {/* Exact Requested Greeting Typography */}
              <div className="space-y-3 sm:space-y-3.5 text-slate-800">
                {/* Hello! 👋 */}
                <h2 className="text-3xl sm:text-4xl md:text-[42px] font-extrabold text-[#1A73E8] tracking-tight flex items-center gap-2">
                  <span>Hello!</span>
                  <span className="inline-block animate-[wave_2s_ease-in-out_infinite] origin-[70%_70%] select-none">
                    👋
                  </span>
                </h2>

                {/* Hi, welcome to BIO-NEXA! */}
                <p className="text-xl sm:text-2xl md:text-[25px] font-bold text-slate-900 leading-snug">
                  Hi, welcome to{' '}
                  <span className="text-[#1A73E8] font-extrabold tracking-tight">
                    BIO-NEXA
                  </span>
                  !
                </p>

                {/* I'm your little guide. */}
                <p className="text-lg sm:text-xl md:text-[21px] font-medium text-slate-700">
                  I'm your little guide.
                </p>

                {/* Please click ENTER to explore our amazing world of Biotechnology! */}
                <p className="text-base sm:text-lg md:text-xl text-slate-600 font-normal leading-relaxed pt-1">
                  Please click{' '}
                  <span className="font-bold text-slate-900">
                    ENTER
                  </span>{' '}
                  to explore our amazing world of Biotechnology!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* =======================================================================
            SECTION 4: ENTER BUTTON WITH CYAN ACCENT TICKS
        ======================================================================== */}
        <div className="mt-8 sm:mt-10 md:mt-11 flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            {/* Left Decorative Cyan Energy Ray Ticks (Pointing Outward) */}
            <div className="hidden sm:flex flex-col gap-1.5 mr-4 sm:mr-6 pointer-events-none" aria-hidden="true">
              <span className="w-5 sm:w-6 h-1.5 bg-sky-500 rounded-full transform -rotate-25 shadow-sm" />
              <span className="w-6 sm:w-7 h-1.5 bg-sky-500 rounded-full transform -translate-x-1 shadow-sm" />
              <span className="w-5 sm:w-6 h-1.5 bg-sky-500 rounded-full transform rotate-25 shadow-sm" />
            </div>

            {/* Large Pill ENTER Button */}
            <button
              id="bionexa-enter-button"
              type="button"
              onClick={handleBioNexaEnter}
              disabled={isEntering}
              aria-label="Enter BIO-NEXA website"
              className={`group relative inline-flex items-center justify-center gap-3 px-14 sm:px-18 md:px-22 py-4 sm:py-5 rounded-full text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-wide transition-all duration-300 cursor-pointer select-none ${
                isEntering
                  ? 'opacity-85 scale-95 cursor-wait'
                  : 'hover:-translate-y-1 hover:scale-[1.03] active:scale-95'
              }`}
              style={{
                background: 'linear-gradient(135deg, #2499F8 0%, #1A73E8 50%, #0F58D6 100%)',
                boxShadow: '0 12px 35px -5px rgba(26, 115, 232, 0.65), 0 0 24px 2px rgba(20, 163, 160, 0.35)'
              }}
            >
              {/* Inner Gloss Light Highlight */}
              <span
                className="absolute inset-x-8 top-1 h-3 rounded-full bg-white/30 pointer-events-none blur-[0.5px]"
                aria-hidden="true"
              />

              <span className="relative z-10 flex items-center gap-3">
                <span>ENTER</span>
                <span className="inline-block transition-transform duration-200 group-hover:translate-x-1.5">
                  →
                </span>
              </span>
            </button>

            {/* Right Decorative Cyan Energy Ray Ticks (Pointing Outward) */}
            <div className="hidden sm:flex flex-col gap-1.5 ml-4 sm:ml-6 pointer-events-none" aria-hidden="true">
              <span className="w-5 sm:w-6 h-1.5 bg-sky-500 rounded-full transform rotate-25 shadow-sm" />
              <span className="w-6 sm:w-7 h-1.5 bg-sky-500 rounded-full transform translate-x-1 shadow-sm" />
              <span className="w-5 sm:w-6 h-1.5 bg-sky-500 rounded-full transform -rotate-25 shadow-sm" />
            </div>
          </div>

          {/* =====================================================================
              SECTION 5: BOTTOM INFORMATION (NO LOGIN REQUIRED • NO REGISTRATION)
          ====================================================================== */}
          <div className="mt-5 sm:mt-7 flex items-center justify-center gap-2 sm:gap-4 text-slate-600 px-2">
            {/* Subtle left horizontal line */}
            <div className="h-px w-6 sm:w-16 md:w-24 bg-gradient-to-r from-transparent to-sky-300/80 flex-shrink" aria-hidden="true" />

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Blue Shield with White Checkmark */}
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#1A73E8] flex items-center justify-center text-white shadow-sm flex-shrink-0">
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span className="text-xs sm:text-base font-semibold text-slate-700 tracking-tight whitespace-nowrap">
                No Login Required <span className="mx-1 text-slate-400">•</span> No Registration
              </span>
            </div>

            {/* Subtle right horizontal line */}
            <div className="h-px w-6 sm:w-16 md:w-24 bg-gradient-to-l from-transparent to-sky-300/80 flex-shrink" aria-hidden="true" />
          </div>
        </div>
      </main>

      {/* Subtle bottom spacing */}
      <footer className="relative z-10 pb-4 text-center text-xs text-slate-400">
        <span className="sr-only">BIO-NEXA Portal Gateway</span>
      </footer>

      {/* Keyframe Styles for Waving Hand & Floating Robot */}
      <style>{`
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(14deg); }
          40% { transform: rotate(-8deg); }
          60% { transform: rotate(14deg); }
          80% { transform: rotate(-4deg); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-7px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[float_4s_ease-in-out_infinite\\],
          .animate-\\[float_10s_ease-in-out_infinite\\],
          .animate-\\[float_12s_ease-in-out_infinite_reverse\\],
          .animate-\\[wave_2s_ease-in-out_infinite\\] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};
