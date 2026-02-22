import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';
import punchClockLynkLogo from '@/assets/punchclock-lynk-logo.png';
import mockupPunchIn from '@/assets/mockup-punch-in.png';

interface HeroSectionProps {
  onGetStarted: () => void;
}

export function HeroSection({ onGetStarted }: HeroSectionProps) {
  return (
    <section className="relative min-h-screen flex items-center px-4 sm:px-6 lg:px-8">
      {/* Subtle background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 70% 50%, rgba(232,138,45,0.06), transparent 50%), #0f1419`,
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto w-full py-24">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          {/* Left — Copy */}
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-white/40 text-xs font-medium uppercase tracking-widest mb-10 hover:text-white/60 transition-colors"
            >
              <img src={builderlynkIcon} alt="" className="h-4 w-auto opacity-60" />
              A BuilderLYNK Product
            </Link>

            <div className="flex items-center gap-4 mb-8">
              <img
                src={punchClockLynkLogo}
                alt="Punch Clock LYNK"
                className="h-16 w-16 rounded-xl shadow-lg shadow-[#E88A2D]/15"
              />
              <span className="text-white/80 text-lg font-semibold tracking-tight">Punch Clock LYNK</span>
            </div>

            <h1 className="text-4xl sm:text-5xl xl:text-[3.5rem] font-extrabold text-white leading-[1.1] tracking-tight mb-6">
              Know where your crew is.{' '}
              <span className="text-[#E88A2D]">Always.</span>
            </h1>

            <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-lg">
              GPS-verified time tracking that eliminates guesswork. One tap to clock in, automatic timecards, instant payroll export.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <button
                onClick={onGetStarted}
                className="px-8 py-3.5 text-white font-bold rounded-lg inline-flex items-center gap-2 transition-all duration-200 hover:brightness-110"
                style={{ backgroundColor: '#E88A2D' }}
              >
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </button>
              <div className="flex gap-2">
                <a
                  href="https://apps.apple.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3.5 text-white/70 text-sm font-medium border border-white/10 hover:border-white/25 rounded-lg inline-flex items-center gap-2 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                  iOS
                </a>
                <a
                  href="https://play.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3.5 text-white/70 text-sm font-medium border border-white/10 hover:border-white/25 rounded-lg inline-flex items-center gap-2 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.73c-.36-.17-.62-.44-.77-.82-.15-.37-.18-.76-.07-1.16L5.3 12 2.34 2.25c-.11-.4-.08-.79.07-1.16.15-.38.41-.65.77-.82.36-.17.74-.2 1.14-.1.4.1.73.34.99.7l8.69 10.12v1L5.31 23.13c-.26.36-.59.6-.99.7-.4.1-.78.07-1.14-.1zM5.64 12l7.81 9.11L20.64 12l-7.19-9.11L5.64 12z"/></svg>
                  Android
                </a>
              </div>
            </div>

            <p className="text-white/30 text-xs">
              Free 14-day trial · No credit card required
            </p>
          </div>

          {/* Right — Single clean mockup */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-72 sm:w-80">
              {/* Glow behind phone */}
              <div
                className="absolute -inset-8 rounded-full blur-3xl opacity-20"
                style={{ background: 'radial-gradient(circle, #E88A2D, transparent 70%)' }}
              />
              <div className="relative rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl">
                <img
                  src={mockupPunchIn}
                  alt="Punch Clock LYNK — GPS Punch In"
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
