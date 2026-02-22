import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';
import punchClockHeroLogo from '@/assets/punchclock-lynk-hero-logo.png';

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
            <h1 className="text-5xl sm:text-6xl xl:text-7xl font-extrabold text-white leading-[1.08] tracking-tight mb-7">
              Track every hour.{' '}
              <span className="text-[#E88A2D]">Know every cost.</span>
            </h1>

            <p className="text-gray-400 text-xl sm:text-2xl leading-relaxed mb-12 max-w-lg">
              GPS-verified, time-stamped, AI-powered photo presence — every punch confirmed. Assign jobs and tasks, pull custom reports, all under your brand.
            </p>

            <div className="flex flex-wrap gap-3 mb-12">
              <button
                onClick={onGetStarted}
                className="px-10 py-4 text-white font-bold rounded-lg inline-flex items-center gap-2 transition-all duration-200 hover:brightness-110 text-lg"
                style={{ backgroundColor: '#E88A2D' }}
              >
                Start Free Trial <ArrowRight className="w-5 h-5" />
              </button>
              <div className="flex gap-2">
                <a
                  href="https://apps.apple.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-4 text-white/70 font-medium border border-white/10 hover:border-white/25 rounded-lg inline-flex items-center gap-2 transition-colors text-lg"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                  iOS
                </a>
                <a
                  href="https://play.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-4 text-white/70 font-medium border border-white/10 hover:border-white/25 rounded-lg inline-flex items-center gap-2 transition-colors text-lg"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.73c-.36-.17-.62-.44-.77-.82-.15-.37-.18-.76-.07-1.16L5.3 12 2.34 2.25c-.11-.4-.08-.79.07-1.16.15-.38.41-.65.77-.82.36-.17.74-.2 1.14-.1.4.1.73.34.99.7l8.69 10.12v1L5.31 23.13c-.26.36-.59.6-.99.7-.4.1-.78.07-1.14-.1zM5.64 12l7.81 9.11L20.64 12l-7.19-9.11L5.64 12z"/></svg>
                  Android
                </a>
              </div>
            </div>

            <Link
              to="/"
              className="inline-flex items-center gap-2 text-white/40 text-xs font-medium uppercase tracking-widest hover:text-white/60 transition-colors"
            >
              <img src={builderlynkIcon} alt="" className="h-4 w-auto opacity-60" />
              A BuilderLYNK Product
            </Link>
          </div>

          {/* Right — Logo */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              {/* Glow behind logo */}
              <div
                className="absolute -inset-10 rounded-full blur-3xl opacity-15"
                style={{ background: 'radial-gradient(circle, #E88A2D, transparent 70%)' }}
              />
              <img
                src={punchClockHeroLogo}
                alt="Punch Clock LYNK"
                className="relative w-full max-w-md lg:max-w-lg xl:max-w-xl h-auto drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
