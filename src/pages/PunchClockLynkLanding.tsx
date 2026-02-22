import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthModal } from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedSection } from '@/components/AnimatedSection';
import { Loader2 } from 'lucide-react';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';
import punchClockLynkLogo from '@/assets/punchclock-lynk-logo.png';
import {
  Clock,
  MapPin,
  Camera,
  BarChart3,
  Shield,
  Users,
  Smartphone,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Zap,
  Target,
  TrendingUp,
  Building2,
  FileText,
  Bell,
  Star,
  ChevronDown,
  Mail,
  Phone,
} from 'lucide-react';
import { CountUpStat } from '@/components/CountUpStat';

const darkBg = '#0f1419';
const darkCardBg = '#1a1f2e';

export default function PunchClockLynkLanding() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signIn' | 'signUp'>('signUp');
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
      icon: Clock,
      title: 'GPS Punch Clock',
      description: 'Employees punch in and out with GPS verification. Know exactly where and when your crew is working.',
    },
    {
      icon: Camera,
      title: 'Photo Verification',
      description: 'Selfie capture at punch-in and punch-out eliminates buddy punching and ensures accountability.',
    },
    {
      icon: MapPin,
      title: 'Geofenced Job Sites',
      description: 'Set virtual boundaries around your job sites. Get alerts when employees punch from unexpected locations.',
    },
    {
      icon: BarChart3,
      title: 'Job Cost Tracking',
      description: 'Every punch ties to a job and cost code. See real-time labor costs broken down by project.',
    },
    {
      icon: FileText,
      title: 'Automated Timecards',
      description: 'Timecards are generated automatically from punches — no manual data entry, no lost paper timesheets.',
    },
    {
      icon: Bell,
      title: 'Real-Time Notifications',
      description: 'Managers get instant alerts for late arrivals, missed punches, and overtime thresholds.',
    },
  ];

  const howItWorks = [
    {
      step: '01',
      title: 'Set Up Your Jobs',
      description: 'Create your job sites with addresses and assign cost codes. Set shift times and geofence boundaries.',
    },
    {
      step: '02',
      title: 'Invite Your Crew',
      description: 'Add employees via PIN, QR code, or user account. They download the app and they\'re ready to go.',
    },
    {
      step: '03',
      title: 'Punch In & Out',
      description: 'Workers select their job, take a photo, and punch. GPS and timestamp are captured automatically.',
    },
    {
      step: '04',
      title: 'Review & Approve',
      description: 'Managers review timecards, approve hours, and export to payroll. All data flows to job costing automatically.',
    },
  ];

  const benefits = [
    { icon: Shield, title: 'Eliminate Time Theft', description: 'Photo verification and GPS tracking end buddy punching and phantom hours.' },
    { icon: TrendingUp, title: 'Accurate Job Costing', description: 'Every hour is coded to a job and cost code, giving you real labor cost data.' },
    { icon: Zap, title: 'Save Hours on Payroll', description: 'Automated timecards mean no more chasing paper sheets or deciphering handwriting.' },
    { icon: Users, title: 'Multi-Crew Management', description: 'Manage multiple crews across multiple job sites from a single dashboard.' },
    { icon: Smartphone, title: 'Works Offline', description: 'Punches sync when connectivity returns. Never lose data in the field.' },
    { icon: Building2, title: 'Built for Construction', description: 'Designed for the realities of construction — dirt, rain, gloves, and all.' },
  ];

  const stats = [
    { icon: Zap, value: '95%', label: 'Less Payroll Errors' },
    { icon: Target, value: '2hrs', label: 'Saved Per Week' },
    { icon: TrendingUp, value: '30%', label: 'Better Cost Visibility' },
    { icon: Users, value: '100%', label: 'Crew Accountability' },
  ];

  const faqs = [
    {
      q: 'Does the app work without internet in the field?',
      a: 'Yes. Punch Clock LYNK stores punches locally and syncs them automatically when connectivity is restored. Your crew never loses a punch.',
    },
    {
      q: 'Can I track multiple job sites at once?',
      a: 'Absolutely. You can set up unlimited job sites, each with their own cost codes, shift times, and geofence boundaries. Managers can view all sites from a single dashboard.',
    },
    {
      q: 'How does photo verification work?',
      a: 'When an employee punches in or out, the app captures a selfie automatically. Managers can review photos on timecards to verify identity and presence on site.',
    },
    {
      q: 'Can employees use PIN codes instead of accounts?',
      a: 'Yes. Punch Clock LYNK supports PIN-based employees for crews that don\'t need full user accounts. PINs are fast, simple, and perfect for field workers.',
    },
    {
      q: 'Does it integrate with payroll software?',
      a: 'Timecards can be exported in standard formats compatible with major payroll systems. We\'re continuously adding direct integrations.',
    },
    {
      q: 'What\'s included in the free trial?',
      a: 'Everything. Full access to all features for 14 days. No credit card required. Set up your jobs, invite your crew, and see results immediately.',
    },
  ];

  const testimonials = [
    {
      quote: "We went from spending 3 hours every Friday reconciling paper timesheets to having everything ready in minutes. It's a game changer.",
      name: 'Mike R.',
      role: 'General Contractor',
      rating: 5,
    },
    {
      quote: "The GPS tracking and photo verification gave us complete confidence in our labor reports. No more guessing who was where.",
      name: 'Sarah T.',
      role: 'Project Manager',
      rating: 5,
    },
    {
      quote: "Our foremen love how simple it is. Punch in, select the job, snap a photo — done. Even the guys who hate technology picked it up immediately.",
      name: 'Carlos M.',
      role: 'Construction Superintendent',
      rating: 5,
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: darkBg }}>
      {/* Navigation */}
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
            <div className="flex items-center gap-3">
              <img src={punchClockLynkLogo} alt="Punch Clock LYNK" className="h-12 w-auto rounded-xl" />
              <span className="text-xl font-bold text-white hidden sm:inline">
                Punch Clock <span className="text-[#E88A2D]">LYNK</span>
              </span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-white/80 hover:text-white transition-colors font-medium">Features</a>
              <a href="#how-it-works" className="text-white/80 hover:text-white transition-colors font-medium">How It Works</a>
              <a href="#pricing" className="text-white/80 hover:text-white transition-colors font-medium">Pricing</a>
              <a href="#faq" className="text-white/80 hover:text-white transition-colors font-medium">FAQ</a>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/" className="text-white/60 hover:text-white text-sm flex items-center gap-1 mr-2">
                <ArrowLeft className="w-4 h-4" /> BuilderLYNK
              </Link>
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

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Animated background gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% 40%, rgba(232,138,45,0.15), transparent 70%), ${darkBg}`,
          }}
        />
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Text content */}
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-[#E88A2D] text-sm font-semibold mb-6 hover:underline"
              >
                <img src={builderlynkIcon} alt="" className="h-6 w-auto" />
                Part of the BuilderLYNK Platform
              </Link>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-6 leading-[1.05]">
                Stop Losing
                <span className="block text-[#E88A2D]">Time & Money</span>
                <span className="block text-3xl sm:text-4xl lg:text-5xl font-bold text-white/80 mt-2">
                  on Paper Timesheets
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-400 mb-8 leading-relaxed max-w-xl">
                GPS-verified punch clock built for construction crews. Track hours, job costs, and crew
                locations — all from a simple mobile app your workers will actually use.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button
                  onClick={() => {
                    setAuthModalMode('signUp');
                    setShowAuthModal(true);
                  }}
                  className="text-lg px-8 py-4 text-white font-bold shadow-2xl hover:scale-105 hover:shadow-[0_0_30px_rgba(232,138,45,0.6)] transition-all duration-300 rounded-lg inline-flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#E88A2D' }}
                >
                  Start Free Trial <ArrowRight className="w-5 h-5" />
                </button>
                <a
                  href="https://play.google.com/store/apps/details?id=com.gst.punchclock"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg px-8 py-4 text-white font-semibold border-2 border-white/20 hover:border-white/40 transition-all duration-300 rounded-lg inline-flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-5 h-5" /> Download App
                </a>
              </div>
              <div className="flex flex-wrap gap-6 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#E88A2D]" /> No credit card required
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#E88A2D]" /> 14-day free trial
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#E88A2D]" /> Setup in 5 minutes
                </div>
              </div>
            </div>

            {/* Right: App preview / visual */}
            <div className="relative flex justify-center">
              <div
                className="relative w-72 sm:w-80 rounded-[2.5rem] border-4 border-white/10 overflow-hidden shadow-2xl shadow-[#E88A2D]/10"
                style={{ backgroundColor: darkCardBg, aspectRatio: '9/19' }}
              >
                {/* Phone mockup content */}
                <div className="p-6 pt-12 flex flex-col items-center h-full">
                  <img src={punchClockLynkLogo} alt="" className="h-20 w-20 rounded-2xl mb-6 shadow-lg" />
                  <h3 className="text-white font-bold text-lg mb-1">Punch Clock LYNK</h3>
                  <p className="text-gray-500 text-sm mb-8">Ready to clock in</p>

                  <div className="w-full space-y-3 mb-8">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-[#E88A2D]" />
                      <div>
                        <p className="text-white text-sm font-medium">Downtown Office Tower</p>
                        <p className="text-gray-500 text-xs">123 Main St</p>
                      </div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                      <FileText className="w-5 h-5 text-[#E88A2D]" />
                      <div>
                        <p className="text-white text-sm font-medium">Cost Code: 1.01</p>
                        <p className="text-gray-500 text-xs">General Labor</p>
                      </div>
                    </div>
                  </div>

                  <button
                    className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg mt-auto mb-6"
                    style={{ backgroundColor: '#E88A2D' }}
                  >
                    <Clock className="w-5 h-5 inline mr-2" />
                    PUNCH IN
                  </button>
                </div>
              </div>
              {/* Floating badges */}
              <div className="absolute -left-4 top-1/4 bg-green-500/20 border border-green-500/30 rounded-xl px-4 py-2 backdrop-blur-sm hidden lg:block">
                <p className="text-green-400 text-sm font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> GPS Verified
                </p>
              </div>
              <div className="absolute -right-4 top-1/2 bg-blue-500/20 border border-blue-500/30 rounded-xl px-4 py-2 backdrop-blur-sm hidden lg:block">
                <p className="text-blue-400 text-sm font-semibold flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Photo Captured
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #1a1f2e, #0f1419)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <AnimatedSection key={index} animation="zoom-in" delay={index * 150}>
                <CountUpStat icon={stat.icon} value={stat.value} label={stat.label} duration={1200} />
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24" style={{ backgroundColor: darkBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">
                Everything Your <span className="text-[#E88A2D]">Crew</span> Needs
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Purpose-built time tracking for construction companies that demand accuracy
              </p>
            </div>
          </AnimatedSection>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <AnimatedSection key={index} animation={index % 2 === 0 ? 'fade-right' : 'fade-left'} delay={index * 100}>
                <div
                  className="p-8 rounded-xl border border-white/10 hover:border-[#E88A2D]/50 hover:shadow-xl hover:shadow-[#E88A2D]/10 transition-all duration-500 group h-full"
                  style={{ backgroundColor: darkCardBg }}
                >
                  <div className="w-14 h-14 rounded-xl bg-[#E88A2D]/10 flex items-center justify-center mb-6 group-hover:bg-[#E88A2D] group-hover:scale-110 transition-all duration-300">
                    <feature.icon className="h-7 w-7 text-[#E88A2D] group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24" style={{ background: 'linear-gradient(to bottom, #1a1f2e, #0f1419)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">
                Up and Running in <span className="text-[#E88A2D]">Minutes</span>
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Four simple steps to modernize your time tracking
              </p>
            </div>
          </AnimatedSection>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((step, index) => (
              <AnimatedSection key={index} animation="fade-up" delay={index * 150}>
                <div className="relative text-center">
                  <div className="text-7xl font-black text-[#E88A2D]/10 mb-4">{step.step}</div>
                  <h3 className="text-xl font-bold text-white mb-3 -mt-6">{step.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{step.description}</p>
                  {index < howItWorks.length - 1 && (
                    <div className="hidden lg:block absolute top-8 -right-4 text-[#E88A2D]/30">
                      <ArrowRight className="w-8 h-8" />
                    </div>
                  )}
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24" style={{ backgroundColor: darkBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">
                Why Construction Companies <span className="text-[#E88A2D]">Choose Us</span>
              </h2>
            </div>
          </AnimatedSection>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <AnimatedSection key={index} animation="zoom-in" delay={index * 100}>
                <div
                  className="p-8 rounded-xl border border-white/10 hover:border-[#E88A2D]/30 transition-all duration-300 h-full"
                  style={{ backgroundColor: darkCardBg }}
                >
                  <benefit.icon className="h-8 w-8 text-[#E88A2D] mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">{benefit.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{benefit.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section id="pricing" className="py-24" style={{ background: 'linear-gradient(to bottom, #1a1f2e, #0f1419)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection animation="fade-up">
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">
              Simple, <span className="text-[#E88A2D]">Transparent</span> Pricing
            </h2>
            <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
              Start free. Scale as you grow. No hidden fees, no long-term contracts.
            </p>
          </AnimatedSection>
          <AnimatedSection animation="zoom-in" delay={200}>
            <div
              className="rounded-2xl border-2 border-[#E88A2D]/30 p-10 max-w-lg mx-auto"
              style={{ backgroundColor: darkCardBg }}
            >
              <p className="text-[#E88A2D] font-semibold text-sm uppercase tracking-wider mb-2">Coming Soon</p>
              <h3 className="text-4xl font-black text-white mb-2">Free to Start</h3>
              <p className="text-gray-400 mb-8">14-day trial with full access to all features</p>
              <ul className="text-left space-y-3 mb-8">
                {['Unlimited job sites', 'GPS & photo verification', 'Automated timecards', 'Job cost tracking', 'Manager dashboard', 'Export to payroll'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-[#E88A2D] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  setAuthModalMode('signUp');
                  setShowAuthModal(true);
                }}
                className="w-full py-4 text-white font-bold rounded-lg hover:scale-105 transition-transform"
                style={{ backgroundColor: '#E88A2D' }}
              >
                Start Your Free Trial
              </button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24" style={{ backgroundColor: darkBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">
                Trusted by <span className="text-[#E88A2D]">Builders</span>
              </h2>
            </div>
          </AnimatedSection>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, index) => (
              <AnimatedSection key={index} animation="fade-up" delay={index * 150}>
                <div
                  className="p-8 rounded-xl border border-white/10 h-full flex flex-col"
                  style={{ backgroundColor: darkCardBg }}
                >
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-[#E88A2D] fill-[#E88A2D]" />
                    ))}
                  </div>
                  <p className="text-gray-300 leading-relaxed mb-6 flex-1 italic">"{t.quote}"</p>
                  <div>
                    <p className="text-white font-bold">{t.name}</p>
                    <p className="text-gray-500 text-sm">{t.role}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24" style={{ background: 'linear-gradient(to bottom, #1a1f2e, #0f1419)' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">
                Frequently Asked <span className="text-[#E88A2D]">Questions</span>
              </h2>
            </div>
          </AnimatedSection>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <AnimatedSection key={index} animation="fade-up" delay={index * 80}>
                <div
                  className="rounded-xl border border-white/10 overflow-hidden"
                  style={{ backgroundColor: darkCardBg }}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="w-full text-left p-6 flex items-center justify-between gap-4"
                  >
                    <span className="text-white font-semibold">{faq.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-[#E88A2D] flex-shrink-0 transition-transform duration-300 ${
                        openFaq === index ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      openFaq === index ? 'max-h-40 pb-6' : 'max-h-0'
                    }`}
                  >
                    <p className="px-6 text-gray-400 leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24" style={{ backgroundColor: darkBg }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection animation="zoom-in">
            <img src={punchClockLynkLogo} alt="" className="h-24 w-24 mx-auto rounded-2xl shadow-lg mb-8" />
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-6">
              Ready to Modernize Your <span className="text-[#E88A2D]">Time Tracking?</span>
            </h2>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
              Join construction companies already saving time and money with Punch Clock LYNK.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => {
                  setAuthModalMode('signUp');
                  setShowAuthModal(true);
                }}
                className="text-lg px-10 py-4 text-white font-bold shadow-2xl hover:scale-105 hover:shadow-[0_0_30px_rgba(232,138,45,0.6)] transition-all duration-300 rounded-lg inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: '#E88A2D' }}
              >
                Start Your Free Trial <ArrowRight className="w-5 h-5" />
              </button>
              <a
                href="https://play.google.com/store/apps/details?id=com.gst.punchclock"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg px-10 py-4 text-white font-semibold border-2 border-white/20 hover:border-white/40 transition-all duration-300 rounded-lg inline-flex items-center justify-center gap-2"
              >
                <Smartphone className="w-5 h-5" /> Get the App
              </a>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Contact */}
      <section className="py-24" style={{ background: 'linear-gradient(to bottom, #1a1f2e, #0f1419)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Questions? <span className="text-[#E88A2D]">Let's Talk</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            <div
              className="text-center p-8 rounded-xl border border-white/10 hover:border-[#E88A2D]/50 transition-all duration-300 group"
              style={{ backgroundColor: darkCardBg }}
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#E88A2D]/10 mb-6 group-hover:bg-[#E88A2D] transition-all duration-300">
                <Mail className="h-8 w-8 text-[#E88A2D] group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-bold text-white mb-2 text-xl">Email Us</h3>
              <p className="text-gray-400 text-lg">support@builderlynk.com</p>
            </div>
            <div
              className="text-center p-8 rounded-xl border border-white/10 hover:border-[#E88A2D]/50 transition-all duration-300 group"
              style={{ backgroundColor: darkCardBg }}
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#E88A2D]/10 mb-6 group-hover:bg-[#E88A2D] transition-all duration-300">
                <Phone className="h-8 w-8 text-[#E88A2D] group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-bold text-white mb-2 text-xl">Call Us</h3>
              <p className="text-gray-400 text-lg">(267) 625-4866</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: darkCardBg }} className="text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={punchClockLynkLogo} alt="" className="h-10 w-auto rounded-xl" />
              <span className="text-lg font-bold">
                Punch Clock <span className="text-[#E88A2D]">LYNK</span>
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link to="/" className="hover:text-white transition-colors">BuilderLYNK</Link>
              <Link to="/pm-lynk" className="hover:text-white transition-colors">PM LYNK</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            </div>
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} BuilderLYNK. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} initialMode={authModalMode} />
    </div>
  );
}
