import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle } from 'lucide-react';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';
import punchClockLynkLogo from '@/assets/punchclock-lynk-logo.png';
import mockupPunchIn from '@/assets/mockup-punch-in.png';
import mockupGpsMap from '@/assets/mockup-gps-map.png';
import mockupTimecards from '@/assets/mockup-timecards.png';
import mockupPhotos from '@/assets/mockup-photos.png';

interface HeroSectionProps {
  onGetStarted: () => void;
}

export function HeroSection({ onGetStarted }: HeroSectionProps) {
  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-4 pt-24 pb-16">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 45%, rgba(232,138,45,0.10), transparent 70%), #0f1419`,
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto w-full">
        {/* BuilderLYNK family badge */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-white/60 text-sm font-medium mb-6 hover:text-white/80 transition-colors"
        >
          <img src={builderlynkIcon} alt="" className="h-5 w-auto" />
          A BuilderLYNK Product
        </Link>

        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Left: text */}
          <div className="flex-1 text-center lg:text-left">
            <div className="mb-6">
              <img
                src={punchClockLynkLogo}
                alt="Punch Clock LYNK"
                className="h-44 w-44 mx-auto lg:mx-0 rounded-3xl shadow-2xl shadow-[#E88A2D]/30"
              />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 leading-[1.05] tracking-tight">
              GPS Time Tracking{' '}
              <span className="text-[#E88A2D]">Built for Construction</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed font-light">
              Track your crew from anywhere. GPS-verified punches, real-time job costing, and payroll-ready timecards — all in one app.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6">
              <button
                onClick={onGetStarted}
                className="text-base px-8 py-3.5 text-white font-bold shadow-2xl hover:scale-105 hover:shadow-[0_0_30px_rgba(232,138,45,0.5)] transition-all duration-300 rounded-full inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: '#E88A2D' }}
              >
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="https://apps.apple.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-base px-8 py-3.5 text-white font-semibold border border-white/20 hover:border-white/40 transition-all duration-300 rounded-full inline-flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                App Store
              </a>
              <a
                href="https://play.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-base px-8 py-3.5 text-white font-semibold border border-white/20 hover:border-white/40 transition-all duration-300 rounded-full inline-flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.73c-.36-.17-.62-.44-.77-.82-.15-.37-.18-.76-.07-1.16L5.3 12 2.34 2.25c-.11-.4-.08-.79.07-1.16.15-.38.41-.65.77-.82.36-.17.74-.2 1.14-.1.4.1.73.34.99.7l8.69 10.12v1L5.31 23.13c-.26.36-.59.6-.99.7-.4.1-.78.07-1.14-.1zM5.64 12l7.81 9.11L20.64 12l-7.19-9.11L5.64 12z"/></svg>
                Google Play
              </a>
            </div>
            <div className="flex flex-wrap gap-4 justify-center lg:justify-start text-xs text-white/50">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#E88A2D]" /> No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#E88A2D]" /> 14-day free trial
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#E88A2D]" /> Apple &amp; Android
              </span>
            </div>
          </div>

          {/* Right: Layered multi-screen product shots (BuddyPunch style) */}
          <div className="flex-1 relative max-w-xl w-full min-h-[400px] lg:min-h-[500px]">
            {/* Background screen - timecards */}
            <img
              src={mockupTimecards}
              alt="Timecard Reports"
              className="absolute top-0 right-0 w-[55%] rounded-2xl shadow-2xl shadow-black/40 border border-white/10"
            />
            {/* Middle screen - GPS map */}
            <img
              src={mockupGpsMap}
              alt="GPS Tracking Map"
              className="absolute top-12 right-[30%] w-[55%] rounded-2xl shadow-2xl shadow-black/40 border border-white/10 z-10"
            />
            {/* Front screen - punch in */}
            <img
              src={mockupPunchIn}
              alt="GPS Punch In"
              className="absolute top-24 left-0 w-[55%] rounded-2xl shadow-2xl shadow-black/40 border border-white/10 z-20"
            />
            {/* Floating mini screen - photos */}
            <img
              src={mockupPhotos}
              alt="Shared Photo Albums"
              className="absolute bottom-0 right-4 w-[40%] rounded-2xl shadow-2xl shadow-black/40 border border-white/10 z-30"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
