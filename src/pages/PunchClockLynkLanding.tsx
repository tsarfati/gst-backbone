import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthModal } from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedSection } from '@/components/AnimatedSection';
import { Loader2 } from 'lucide-react';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';
import punchClockLynkLogo from '@/assets/punchclock-lynk-logo.png';
import mockupPunchIn from '@/assets/mockup-punch-in.png';
import mockupTimecards from '@/assets/mockup-timecards.png';
import mockupPhotos from '@/assets/mockup-photos.png';
import mockupGpsMap from '@/assets/mockup-gps-map.png';
import {
  MapPin,
  Camera,
  BarChart3,
  Smartphone,
  CheckCircle,
  ArrowRight,
  MessageSquare,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const darkBg = '#0f1419';
const darkCardBg = '#1a1f2e';

const heroSlides = [
  { image: mockupPunchIn, label: 'GPS Punch In', description: 'One tap to clock in — GPS verified' },
  { image: mockupGpsMap, label: 'Live GPS Tracking', description: 'See your entire crew on the map' },
  { image: mockupTimecards, label: 'Timecard Reports', description: 'Detailed, filterable reports for payroll' },
  { image: mockupPhotos, label: 'Shared Photo Albums', description: 'Capture jobsite progress effortlessly' },
];

export default function PunchClockLynkLanding() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signIn' | 'signUp'>('signUp');
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);

  const nextSlide = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % heroSlides.length);
  }, []);

  const prevSlide = useCallback(() => {
    setActiveSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    const timer = setInterval(nextSlide, 7000);
    return () => clearInterval(timer);
  }, [nextSlide]);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: darkBg }}>
        <Loader2 className="h-8 w-8 animate-spin text-[#E88A2D]" />
      </div>
    );
  }

  const features = [
    {
      icon: MapPin,
      title: 'GPS Time Tracking',
      description: 'Every punch is verified with GPS coordinates. Know exactly where your crew is clocking in and out.',
    },
    {
      icon: BarChart3,
      title: 'Job Costing',
      description: 'Every hour ties to a job and cost code automatically. See real-time labor costs by project.',
    },
    {
      icon: Camera,
      title: 'Shared Photo Albums',
      description: 'Employees capture jobsite photos directly to shared project folders. Document progress effortlessly.',
    },
    {
      icon: MessageSquare,
      title: 'Team Communication',
      description: 'Built-in messaging keeps your office and field crews connected. Announcements, updates, all in one place.',
    },
    {
      icon: FileText,
      title: 'Timecard Reports',
      description: 'Detailed, filterable timecard reports ready for payroll. No more chasing paper timesheets.',
    },
    {
      icon: Smartphone,
      title: 'Native Mobile Apps',
      description: 'Available on Apple and Android. Built for construction — works with gloves, dirt, and all.',
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: darkBg }}>
      {/* BuilderLYNK Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrollY > 50
            ? 'backdrop-blur-lg shadow-lg border-b border-white/10 opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
        style={{ backgroundColor: scrollY > 50 ? 'rgba(15, 20, 25, 0.95)' : 'transparent' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center gap-2">
              <img src={builderlynkIcon} alt="BuilderLYNK" className="h-14 w-auto" />
            </Link>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  setAuthModalMode('signIn');
                  setShowAuthModal(true);
                }}
                variant="outline"
                className="border-white/50 text-gray-900 bg-white hover:bg-white/90"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero — Screenshot carousel */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-4 pt-24 pb-16">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 50% 45%, rgba(232,138,45,0.10), transparent 70%), ${darkBg}`,
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto w-full">
          {/* BuilderLYNK family badge */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-white/60 text-sm font-medium mb-6 hover:text-white/80 transition-colors"
          >
            <img src={builderlynkIcon} alt="" className="h-5 w-auto" />
            A BuilderLYNK Product
          </Link>

          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
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
                Punch Clock{' '}
                <span className="text-[#E88A2D]">LYNK</span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-400 mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed font-light">
                GPS-verified time tracking built for construction.
                Simple for your crew. Powerful for your business.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6">
                <button
                  onClick={() => { setAuthModalMode('signUp'); setShowAuthModal(true); }}
                  className="text-base px-8 py-3.5 text-white font-bold shadow-2xl hover:scale-105 hover:shadow-[0_0_30px_rgba(232,138,45,0.5)] transition-all duration-300 rounded-full inline-flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#E88A2D' }}
                >
                  Get Started Free <ArrowRight className="w-4 h-4" />
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
                  <CheckCircle className="w-3.5 h-3.5 text-[#E88A2D]" /> Apple & Android
                </span>
              </div>
            </div>

            {/* Right: phone carousel */}
            <div className="flex-1 flex flex-col items-center max-w-sm w-full">
              <div className="relative w-full aspect-[9/18] max-w-[280px]">
                {heroSlides.map((slide, i) => (
                  <img
                    key={i}
                    src={slide.image}
                    alt={slide.label}
                    className={`absolute inset-0 w-full h-full object-contain rounded-[2rem] transition-all duration-500 ${
                      i === activeSlide
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 scale-95 pointer-events-none'
                    }`}
                  />
                ))}
              </div>

              {/* Caption */}
              <div className="mt-6 text-center min-h-[3.5rem]">
                <p className="text-white font-semibold text-lg">{heroSlides[activeSlide].label}</p>
                <p className="text-gray-400 text-sm">{heroSlides[activeSlide].description}</p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-4 mt-4">
                <button onClick={prevSlide} className="text-white/40 hover:text-white transition-colors p-1">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex gap-2">
                  {heroSlides.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSlide(i)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        i === activeSlide ? 'bg-[#E88A2D] w-6' : 'bg-white/30 hover:bg-white/50'
                      }`}
                    />
                  ))}
                </div>
                <button onClick={nextSlide} className="text-white/40 hover:text-white transition-colors p-1">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features — clean grid, generous spacing */}
      <section className="py-24 sm:py-32" style={{ backgroundColor: darkBg }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-20">
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
                Built for the <span className="text-[#E88A2D]">Jobsite</span>
              </h2>
              <p className="text-lg text-gray-400 max-w-xl mx-auto">
                Everything your construction company needs to track time, costs, and crew — in one app.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-10">
            {features.map((feature, index) => (
              <AnimatedSection key={index} animation="fade-up" delay={index * 80}>
                <div className="text-center p-8 group">
                  <div className="w-16 h-16 rounded-2xl bg-[#E88A2D]/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-[#E88A2D] group-hover:scale-110 transition-all duration-300">
                    <feature.icon className="h-8 w-8 text-[#E88A2D] group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-400 leading-relaxed text-sm">{feature.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="py-20" style={{ background: 'linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%)' }}>
        <div className="max-w-3xl mx-auto px-4 text-center">
          <AnimatedSection animation="fade-up">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
              Ready to modernize your time tracking?
            </h2>
            <p className="text-lg text-gray-400 mb-8">
              Sign up for a free BuilderLYNK account and start using Punch Clock LYNK today.
            </p>
            <button
              onClick={() => {
                setAuthModalMode('signUp');
                setShowAuthModal(true);
              }}
              className="text-lg px-10 py-4 text-white font-bold shadow-2xl hover:scale-105 hover:shadow-[0_0_30px_rgba(232,138,45,0.5)] transition-all duration-300 rounded-full inline-flex items-center gap-2"
              style={{ backgroundColor: '#E88A2D' }}
            >
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </button>
          </AnimatedSection>
        </div>
      </section>

      {/* BuilderLYNK Footer (same as main landing page) */}
      <footer style={{ backgroundColor: darkCardBg }} className="text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 lg:gap-8">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <img src={builderlynkIcon} alt="BuilderLYNK" className="h-12 w-auto" />
                <span className="text-xl font-bold text-white">BuilderLYNK</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                The complete construction management platform for modern builders.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-lg">Product</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link to="/" className="hover:text-white transition-colors">Features</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-lg">Company</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link to="/" className="hover:text-white transition-colors">About</Link></li>
                <li><a href="mailto:support@builderlynk.com" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-lg">LYNK Family</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link to="/punch-clock-lynk" className="hover:text-white transition-colors text-[#E88A2D]">Punch Clock LYNK</Link></li>
                <li><Link to="/pm-lynk" className="hover:text-white transition-colors">PM LYNK</Link></li>
                <li><a href="https://jobsitelynk.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">JobSiteLYNK</a></li>
                <li><a href="https://residentlynk.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">ResidentLYNK</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-lg">Legal</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 mt-12 pt-8 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} BuilderLYNK. All rights reserved.
          </div>
        </div>
      </footer>

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} initialMode={authModalMode} />
    </div>
  );
}
