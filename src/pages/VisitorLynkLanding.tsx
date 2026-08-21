import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthModal } from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedSection } from '@/components/AnimatedSection';
import { NavBar } from '@/components/punchclock-landing/NavBar';
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Camera,
  CheckCircle,
  ClipboardList,
  Loader2,
  MapPinned,
  QrCode,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';
import visitorLynkLogo from '@/assets/visitor-lynk-logo.png';

const darkBg = '#0f1419';
const darkCardBg = '#1a1f2e';
const accentGold = '#F5BE18';
const accentBlue = '#16C4FF';
const accentSteel = '#D9DEE7';

const features = [
  {
    icon: QrCode,
    title: 'QR Visitor Check-In',
    description: 'Generate a jobsite QR poster so guests can sign in from their phone without hunting down your field team.',
  },
  {
    icon: Camera,
    title: 'Photo Capture',
    description: 'Require visitor selfies and contact details before someone is logged onto the site.',
  },
  {
    icon: ClipboardList,
    title: 'Live Visitor Logs',
    description: 'See who is currently onsite, who already checked out, and who still needs follow-up.',
  },
  {
    icon: BellRing,
    title: 'Checkout Reminders',
    description: 'Use reminder flows, manual checkout, and auto-checkout settings to keep the log accurate.',
  },
  {
    icon: ShieldCheck,
    title: 'Safety Accountability',
    description: 'Keep a timestamped record of everyone who came through the site for audits and incident review.',
  },
  {
    icon: MapPinned,
    title: 'Jobsite Ready',
    description: 'Built for trailers, gates, and active projects where speed matters more than office-style workflows.',
  },
];

export default function VisitorLynkLanding() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signIn' | 'contact'>('contact');
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
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: accentGold }} />
      </div>
    );
  }

  const handleGetStarted = () => {
    setAuthModalMode('contact');
    setShowAuthModal(true);
  };

  const handleSignIn = () => {
    setAuthModalMode('signIn');
    setShowAuthModal(true);
  };

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: darkBg }}>
      <NavBar scrollY={scrollY} onSignIn={handleSignIn} />

      <section className="relative min-h-screen flex items-center px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 76% 34%, rgba(245,190,24,0.18), transparent 28%), radial-gradient(circle at 68% 58%, rgba(22,196,255,0.16), transparent 24%), linear-gradient(180deg, #070b12 0%, #0f1419 100%)',
          }}
        />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '72px 72px' }} />

        <div className="relative z-10 max-w-7xl mx-auto w-full py-24">
          <div className="grid lg:grid-cols-[1fr_30%] gap-12 lg:gap-16 items-center">
            <div>
              <div className="lg:hidden flex justify-center mb-10">
                <img src={visitorLynkLogo} alt="VisitorLYNK" className="w-[19rem] sm:w-[22rem] h-auto drop-shadow-2xl" />
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 mb-6">
                <BadgeCheck className="h-4 w-4" style={{ color: accentGold }} />
                A focused BuilderLYNK entry product for jobsite access control
              </div>

              <h1 className="text-5xl sm:text-6xl xl:text-7xl font-extrabold text-white leading-[1.08] tracking-tight mb-7">
                Run visitor check-in from one clean flow.{' '}
                <span style={{ color: accentGold }}>Keep every person on site accounted for.</span>
              </h1>

              <p className="text-gray-400 text-xl sm:text-2xl leading-relaxed mb-7 max-w-2xl">
                VisitorLYNK gives builders a focused, branded visitor sign-in product backed by BuilderLYNK jobs, permissions, and reporting.
              </p>

              <p className="text-gray-500 text-lg leading-relaxed mb-12 max-w-xl">
                Sell it as a simpler product now. Keep it tied to real BuilderLYNK jobs underneath so it is easy to expand into the full platform later.
              </p>

              <div className="flex flex-wrap gap-3 mb-12">
                <button
                  onClick={handleGetStarted}
                  className="px-10 py-4 text-[#081015] font-bold rounded-lg inline-flex items-center gap-2 transition-all duration-200 hover:brightness-110 text-lg"
                  style={{ background: `linear-gradient(90deg, ${accentGold}, ${accentBlue})` }}
                >
                  Start VisitorLYNK <ArrowRight className="w-5 h-5" />
                </button>
                <Link
                  to="/visitor-lynk/start"
                  className="px-10 py-4 rounded-lg inline-flex items-center gap-2 text-lg font-semibold text-white border border-white/15 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Plan Your Rollout
                </Link>
              </div>

              <div className="flex flex-wrap gap-6 text-sm text-white/60">
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" style={{ color: accentGold }} /> Branded check-in pages
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" style={{ color: accentBlue }} /> QR posters for every site
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" style={{ color: accentSteel }} /> Built to upsell into BuilderLYNK
                </span>
              </div>
            </div>

            <div className="hidden lg:flex items-center justify-center">
              <div className="relative">
                <div
                  className="absolute -inset-10 rounded-full blur-3xl opacity-30"
                  style={{ background: `radial-gradient(circle, ${accentGold}, transparent 55%)` }}
                />
                <div
                  className="absolute -inset-4 rounded-full blur-3xl opacity-20"
                  style={{ background: `radial-gradient(circle, ${accentBlue}, transparent 60%)` }}
                />
                <img src={visitorLynkLogo} alt="VisitorLYNK" className="relative w-[30rem] max-w-full h-auto object-contain drop-shadow-2xl" />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <div className="w-8 h-12 rounded-full border-2 border-white/50 flex items-start justify-center p-2">
            <div className="w-1.5 h-3 rounded-full animate-pulse" style={{ backgroundColor: accentGold }} />
          </div>
        </div>
      </section>

      <section className="py-24 sm:py-32" style={{ backgroundColor: darkBg }} id="features">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-20">
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
                Every Visitor, <span style={{ color: accentGold }}>Logged Cleanly</span>
              </h2>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                A focused visitor workflow for jobsites that need speed at the gate and clean records after the fact.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-10">
            {features.map((feature, index) => (
              <AnimatedSection key={feature.title} animation="fade-up" delay={index * 80}>
                <div className="text-center p-8 group">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-all duration-300 group-hover:scale-110"
                    style={{ background: 'linear-gradient(135deg, rgba(245,190,24,0.16), rgba(22,196,255,0.12))' }}
                  >
                    <feature.icon className="h-8 w-8 transition-colors" style={{ color: index % 2 === 0 ? accentGold : accentBlue }} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-400 leading-relaxed text-sm">{feature.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" style={{ backgroundColor: darkCardBg }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5 tracking-tight">
                  A simpler front-end. The same real BuilderLYNK foundation.
                </h2>
                <p className="text-lg text-gray-400 leading-relaxed mb-5">
                  VisitorLYNK should feel lightweight to buy and easy to launch. Under the hood, it still creates a real BuilderLYNK company and real jobs so you never have to migrate data later.
                </p>
                <p className="text-base text-gray-500 leading-relaxed">
                  That means you can onboard someone for visitor sign-in today, then unlock more BuilderLYNK workflows when they are ready.
                </p>
              </div>

              <div className="grid gap-4">
                {[
                  'Set up a job and QR poster fast',
                  'Track active visitors and checkouts live',
                  'Keep visitor logs tied to the actual job record',
                  'Upgrade later into full BuilderLYNK without rebuilding anything',
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: accentGold }} />
                    <span className="text-white/80">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <section className="py-20" style={{ background: 'linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%)' }}>
        <div className="max-w-3xl mx-auto px-4 text-center">
          <AnimatedSection animation="fade-up">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
              Launch a focused visitor workflow first.
            </h2>
            <p className="text-lg text-gray-400 mb-8">
              Start with visitor sign-in, QR check-in, and reporting. Grow into the full BuilderLYNK platform when the customer is ready.
            </p>
            <button
              onClick={handleGetStarted}
              className="text-lg px-10 py-4 font-bold shadow-2xl hover:scale-105 transition-all duration-300 rounded-full inline-flex items-center gap-2 text-[#081015]"
              style={{ background: `linear-gradient(90deg, ${accentGold}, ${accentBlue})` }}
            >
              Start VisitorLYNK <ArrowRight className="w-5 h-5" />
            </button>
          </AnimatedSection>
        </div>
      </section>

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
                <li><Link to="/visitor-lynk" className="hover:text-white transition-colors">VisitorLYNK</Link></li>
                <li><Link to="/pm-lynk" className="hover:text-white transition-colors">PM LYNK</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-lg">Company</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link to="/" className="hover:text-white transition-colors">About</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-lg">LYNK Family</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link to="/design-pro-lynk" className="hover:text-white transition-colors">DesignProLYNK</Link></li>
                <li><Link to="/punch-clock-lynk" className="hover:text-white transition-colors">Punch Clock LYNK</Link></li>
                <li><Link to="/pm-lynk" className="hover:text-white transition-colors">PM LYNK</Link></li>
                <li><Link to="/visitor-lynk" className="hover:text-white transition-colors">VisitorLYNK</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-lg">Legal</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
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
