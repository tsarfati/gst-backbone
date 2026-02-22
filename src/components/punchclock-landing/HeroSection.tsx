import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle } from 'lucide-react';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';
import punchClockLynkLogo from '@/assets/punchclock-lynk-logo.png';
import mockupPunchIn from '@/assets/mockup-punch-in.png';

interface HeroSectionProps {
  onGetStarted: () => void;
}

export function HeroSection({ onGetStarted }: HeroSectionProps) {
  return (
    <section className="relative px-4 pt-28 pb-20">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 30%, rgba(232,138,45,0.08), transparent 70%), #0f1419`,
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto w-full text-center">
        {/* BuilderLYNK family badge */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-white/50 text-sm font-medium mb-8 hover:text-white/70 transition-colors"
        >
          <img src={builderlynkIcon} alt="" className="h-5 w-auto" />
          A BuilderLYNK Product
        </Link>

        {/* Logo */}
        <div className="mb-8">
          <img
            src={punchClockLynkLogo}
            alt="Punch Clock LYNK"
            className="h-28 w-28 mx-auto rounded-2xl shadow-2xl shadow-[#E88A2D]/20"
          />
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-5 leading-[1.08] tracking-tight">
          GPS Time Tracking{' '}
          <span className="text-[#E88A2D]">Built for Construction</span>
        </h1>

        <p className="text-lg text-gray-400 mb-8 max-w-xl mx-auto leading-relaxed">
          Track your crew from anywhere. GPS-verified punches, real-time job costing, and payroll-ready timecards — all in one app.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          <button
            onClick={onGetStarted}
            className="text-base px-8 py-3.5 text-white font-bold shadow-xl hover:scale-105 hover:shadow-[0_0_30px_rgba(232,138,45,0.4)] transition-all duration-300 rounded-full inline-flex items-center justify-center gap-2"
            style={{ backgroundColor: '#E88A2D' }}
          >
            Start Free Trial <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="https://apps.apple.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-7 py-3.5 text-white font-semibold border border-white/20 hover:border-white/40 transition-all duration-300 rounded-full inline-flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
            App Store
          </a>
          <a
            href="https://play.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-7 py-3.5 text-white font-semibold border border-white/20 hover:border-white/40 transition-all duration-300 rounded-full inline-flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.73c-.36-.17-.62-.44-.77-.82-.15-.37-.18-.76-.07-1.16L5.3 12 2.34 2.25c-.11-.4-.08-.79.07-1.16.15-.38.41-.65.77-.82.36-.17.74-.2 1.14-.1.4.1.73.34.99.7l8.69 10.12v1L5.31 23.13c-.26.36-.59.6-.99.7-.4.1-.78.07-1.14-.1zM5.64 12l7.81 9.11L20.64 12l-7.19-9.11L5.64 12z"/></svg>
            Google Play
          </a>
        </div>

        <div className="flex flex-wrap gap-5 justify-center text-xs text-white/45 mb-14">
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

        {/* Single clean mockup */}
        <div className="max-w-xs mx-auto">
          <div className="rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
            <img
              src={mockupPunchIn}
              alt="GPS Punch In"
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
