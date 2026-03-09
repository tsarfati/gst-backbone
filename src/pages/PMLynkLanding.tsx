import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthModal } from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedSection } from '@/components/AnimatedSection';
import { ArrowRight, CheckCircle, ClipboardCheck, Loader2, MessageSquare, Receipt, Smartphone, Truck, Users } from 'lucide-react';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';
import pmLynkLogo from '@/assets/pm-lynk-logo.png';
import pmLynkHeroLogo from '@/assets/pm-lynk-hero-new.png';
import { NavBar } from '@/components/punchclock-landing/NavBar';

const darkBg = '#0f1419';
const darkCardBg = '#1a1f2e';

export default function PMLynkLanding() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signIn' | 'signUp'>('signUp');
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
      icon: Receipt,
      title: 'Receipt Scanning',
      description: 'Snap a photo of any receipt. OCR extracts vendor, amount, and details automatically.',
    },
    {
      icon: Truck,
      title: 'Delivery Tickets',
      description: 'Log and track every material delivery on site. Never lose a ticket again.',
    },
    {
      icon: Users,
      title: 'Visitor Management',
      description: 'Track who comes and goes from your jobsite with digital sign-in and notifications.',
    },
    {
      icon: MessageSquare,
      title: 'Team Messaging',
      description: 'Communicate with office and field teams instantly. Keep everyone on the same page.',
    },
    {
      icon: ClipboardCheck,
      title: 'Task Management',
      description: 'Assign, track, and complete project tasks from anywhere on the jobsite.',
    },
    {
      icon: Smartphone,
      title: 'Native Mobile Apps',
      description: 'Purpose-built for iOS and Android. Designed to work fast in the field.',
    },
  ];

  const handleGetStarted = () => {
    setAuthModalMode('signUp');
    setShowAuthModal(true);
  };

  const handleSignIn = () => {
    setAuthModalMode('signIn');
    setShowAuthModal(true);
  };

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: darkBg }}>
      <NavBar scrollY={scrollY} onSignIn={handleSignIn} />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center px-4 sm:px-6 lg:px-8">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 70% 50%, rgba(232,138,45,0.06), transparent 50%), #0f1419`,
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto w-full py-24">
          <div className="grid lg:grid-cols-[1fr_30%] gap-12 lg:gap-16 items-center">
            <div>
              <div className="lg:hidden flex justify-center mb-10">
                <img src={pmLynkHeroLogo} alt="PM LYNK" className="w-64 h-auto drop-shadow-2xl" />
              </div>

              <h1 className="text-5xl sm:text-6xl xl:text-7xl font-extrabold text-white leading-[1.08] tracking-tight mb-7">
                Run the field from one app.{' '}
                <span className="text-[#E88A2D]">Keep every detail connected.</span>
              </h1>

              <p className="text-gray-400 text-xl sm:text-2xl leading-relaxed mb-12 max-w-lg">
                Receipts, deliveries, visitors, tasks, and team communication in one PM workflow built for active jobsites.
              </p>

              <div className="flex flex-wrap gap-3 mb-12">
                <button
                  onClick={handleGetStarted}
                  className="px-10 py-4 text-white font-bold rounded-lg inline-flex items-center gap-2 transition-all duration-200 hover:brightness-110 text-lg"
                  style={{ backgroundColor: '#E88A2D' }}
                >
                  Start Free Trial <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-6 text-sm text-white/60">
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#E88A2D]" /> Built for PMs
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#E88A2D]" /> Apple & Android
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#E88A2D]" /> Real-time team sync
                </span>
              </div>
            </div>

            <div className="hidden lg:flex items-center justify-center">
              <div className="relative">
                <div
                  className="absolute -inset-10 rounded-full blur-3xl opacity-15"
                  style={{ background: 'radial-gradient(circle, #E88A2D, transparent 70%)' }}
                />
                <img src={pmLynkHeroLogo} alt="PM LYNK" className="relative w-full h-auto object-contain drop-shadow-2xl" />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <div className="w-8 h-12 rounded-full border-2 border-white/50 flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-white rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 sm:py-32" style={{ backgroundColor: darkBg }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-20">
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
                Your Jobsite, <span className="text-[#E88A2D]">Connected</span>
              </h2>
              <p className="text-lg text-gray-400 max-w-xl mx-auto">
                Everything a project manager needs to stay on top of the job — right from your phone.
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
              Manage your projects from anywhere.
            </h2>
            <p className="text-lg text-gray-400 mb-8">
              Sign up for a free BuilderLYNK account and start using PM LYNK today.
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

      {/* BuilderLYNK Footer */}
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
                <li><Link to="/design-pro-lynk" className="hover:text-white transition-colors">DesignProLYNK</Link></li>
                <li><Link to="/punch-clock-lynk" className="hover:text-white transition-colors">Punch Clock LYNK</Link></li>
                <li><Link to="/pm-lynk" className="hover:text-white transition-colors text-[#E88A2D]">PM LYNK</Link></li>
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
