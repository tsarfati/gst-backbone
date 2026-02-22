import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthModal } from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedSection } from '@/components/AnimatedSection';
import { Loader2 } from 'lucide-react';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';
import punchClockLynkLogo from '@/assets/punchclock-lynk-logo.png';
import pmLynkLogo from '@/assets/pm-lynk-logo.png';
import {
  Clock,
  MapPin,
  Camera,
  BarChart3,
  Smartphone,
  CheckCircle,
  ArrowRight,
  Mail,
  Phone,
  MessageSquare,
  FileText,
} from 'lucide-react';

const darkBg = '#0f1419';
const darkCardBg = '#1a1f2e';

export default function PunchClockLynkLanding() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signIn' | 'signUp'>('signUp');
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

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

      {/* Hero — Apple-esque centered layout */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-4 pt-20">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 50% 45%, rgba(232,138,45,0.12), transparent 70%), ${darkBg}`,
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* BuilderLYNK family badge */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-white/60 text-sm font-medium mb-8 hover:text-white/80 transition-colors"
          >
            <img src={builderlynkIcon} alt="" className="h-5 w-auto" />
            A BuilderLYNK Product
          </Link>

          {/* App icon */}
          <div className="mb-8">
            <img
              src={punchClockLynkLogo}
              alt="Punch Clock LYNK"
              className="h-28 w-28 mx-auto rounded-[1.75rem] shadow-2xl shadow-[#E88A2D]/20"
            />
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-6 leading-[1.05] tracking-tight">
            Punch Clock{' '}
            <span className="text-[#E88A2D]">LYNK</span>
          </h1>

          <p className="text-xl sm:text-2xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed font-light">
            GPS-verified time tracking built for construction.
            <br className="hidden sm:block" />
            Simple for your crew. Powerful for your business.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <button
              onClick={() => {
                setAuthModalMode('signUp');
                setShowAuthModal(true);
              }}
              className="text-lg px-10 py-4 text-white font-bold shadow-2xl hover:scale-105 hover:shadow-[0_0_30px_rgba(232,138,45,0.5)] transition-all duration-300 rounded-full inline-flex items-center justify-center gap-2"
              style={{ backgroundColor: '#E88A2D' }}
            >
              Get Started Free <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="https://play.google.com/store/apps/details?id=com.gst.punchclock"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg px-10 py-4 text-white font-semibold border border-white/20 hover:border-white/40 transition-all duration-300 rounded-full inline-flex items-center justify-center gap-2"
            >
              <Smartphone className="w-5 h-5" /> Download App
            </a>
          </div>

          {/* Trust line */}
          <div className="flex flex-wrap gap-6 justify-center text-sm text-white/60">
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#E88A2D]" /> No credit card required
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#E88A2D]" /> 14-day free trial
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#E88A2D]" /> Apple & Android
            </span>
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
