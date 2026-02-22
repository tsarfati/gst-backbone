import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthModal } from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedSection } from '@/components/AnimatedSection';
import { Loader2 } from 'lucide-react';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';
import pmLynkLogo from '@/assets/pm-lynk-logo.png';
import {
  FileText,
  Camera,
  Truck,
  Users,
  MessageSquare,
  Shield,
  Smartphone,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Zap,
  Target,
  TrendingUp,
  ClipboardCheck,
  Receipt,
  Star,
  ChevronDown,
  Mail,
  Phone,
  Bell,
  FolderOpen,
} from 'lucide-react';
import { CountUpStat } from '@/components/CountUpStat';

const darkBg = '#0f1419';
const darkCardBg = '#1a1f2e';

export default function PMLynkLanding() {
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
      icon: Receipt,
      title: 'Receipt Scanning',
      description: 'Scan receipts in the field with OCR extraction. Automatically capture vendor, amount, and date.',
    },
    {
      icon: Truck,
      title: 'Delivery Tickets',
      description: 'Log and photograph delivery tickets on arrival. Link materials to jobs and cost codes instantly.',
    },
    {
      icon: Users,
      title: 'Visitor Management',
      description: 'Track who\'s on site with digital sign-in/out. Maintain compliance and safety records effortlessly.',
    },
    {
      icon: MessageSquare,
      title: 'Team Communication',
      description: 'Message your crew, share updates, and send announcements. Keep everyone on the same page.',
    },
    {
      icon: Camera,
      title: 'Job Photos',
      description: 'Capture progress photos tied to specific jobs. Build a visual timeline of every project.',
    },
    {
      icon: FolderOpen,
      title: 'Document Access',
      description: 'Access plans, permits, and project documents from anywhere on the jobsite.',
    },
  ];

  const howItWorks = [
    {
      step: '01',
      title: 'Connect to BuilderLYNK',
      description: 'PM LYNK syncs with your BuilderLYNK account. All your jobs, vendors, and cost codes are ready to go.',
    },
    {
      step: '02',
      title: 'Manage in the Field',
      description: 'Scan receipts, log deliveries, track visitors, and communicate — all from your phone.',
    },
    {
      step: '03',
      title: 'Auto-Sync to Office',
      description: 'Everything you capture flows back to BuilderLYNK automatically. No double entry, no lost paperwork.',
    },
    {
      step: '04',
      title: 'Stay in Control',
      description: 'Review dashboards, approve requests, and make decisions with real-time field data.',
    },
  ];

  const benefits = [
    { icon: Zap, title: 'Zero Double Entry', description: 'Capture once in the field, it flows everywhere automatically.' },
    { icon: TrendingUp, title: 'Real-Time Visibility', description: 'See field activity as it happens, not days later on paper.' },
    { icon: Shield, title: 'Complete Records', description: 'Every receipt, delivery, and visitor is documented and searchable.' },
    { icon: ClipboardCheck, title: 'Compliance Ready', description: 'Maintain digital records for safety, insurance, and audit requirements.' },
    { icon: Smartphone, title: 'Built for Mobile', description: 'Designed for one-handed use in the field. Works in any conditions.' },
    { icon: Target, title: 'Reduce Errors', description: 'OCR and auto-fill eliminate manual data entry mistakes.' },
  ];

  const stats = [
    { icon: Zap, value: '80%', label: 'Less Paperwork' },
    { icon: Target, value: '5min', label: 'Receipt to Coded' },
    { icon: TrendingUp, value: '100%', label: 'Field Coverage' },
    { icon: Users, value: '24/7', label: 'Document Access' },
  ];

  const faqs = [
    {
      q: 'Do I need BuilderLYNK to use PM LYNK?',
      a: 'Yes. PM LYNK is the mobile companion app for BuilderLYNK. It syncs with your existing BuilderLYNK account to bring field management capabilities to your phone.',
    },
    {
      q: 'What can I do with PM LYNK that I can\'t do on the web?',
      a: 'PM LYNK is optimized for field tasks: scanning receipts with your camera, photographing deliveries, managing visitors face-to-face, and capturing job photos on the go.',
    },
    {
      q: 'Does it work offline?',
      a: 'Yes. PM LYNK caches your job data and queues actions for sync when connectivity returns. Critical field work is never blocked by signal issues.',
    },
    {
      q: 'Who on my team should use PM LYNK?',
      a: 'PM LYNK is designed for project managers, superintendents, and foremen — anyone who needs to manage field operations from their phone.',
    },
    {
      q: 'Is PM LYNK available on both iOS and Android?',
      a: 'PM LYNK is being released on both platforms. Check the app stores for availability in your region.',
    },
  ];

  const testimonials = [
    {
      quote: "I used to carry a folder of paper receipts every day. Now I just snap a photo and it's coded to the right job before I leave the store.",
      name: 'James P.',
      role: 'Project Manager',
      rating: 5,
    },
    {
      quote: "The visitor log feature keeps us compliant without the clipboard-and-pen hassle. Everyone signs in digitally and we have perfect records.",
      name: 'Linda K.',
      role: 'Safety Director',
      rating: 5,
    },
    {
      quote: "Being able to message my crew and share photos from the app means fewer phone calls and fewer misunderstandings. Everything's documented.",
      name: 'Robert D.',
      role: 'Superintendent',
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
              <img src={pmLynkLogo} alt="PM LYNK" className="h-12 w-auto rounded-xl" />
              <span className="text-xl font-bold text-white hidden sm:inline">
                PM <span className="text-[#E88A2D]">LYNK</span>
              </span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-white/80 hover:text-white transition-colors font-medium">Features</a>
              <a href="#how-it-works" className="text-white/80 hover:text-white transition-colors font-medium">How It Works</a>
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
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% 40%, rgba(232,138,45,0.12), transparent 70%), ${darkBg}`,
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-[#E88A2D] text-sm font-semibold mb-6 hover:underline"
              >
                <img src={builderlynkIcon} alt="" className="h-6 w-auto" />
                Part of the BuilderLYNK Platform
              </Link>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-6 leading-[1.05]">
                Your Jobsite,
                <span className="block text-[#E88A2D]">In Your Pocket</span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-400 mb-8 leading-relaxed max-w-xl">
                The project manager's mobile companion. Scan receipts, log deliveries, manage visitors, 
                and communicate with your team — all from the field.
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
                  Get Started <ArrowRight className="w-5 h-5" />
                </button>
                <button className="text-lg px-8 py-4 text-white font-semibold border-2 border-white/20 hover:border-white/40 transition-all duration-300 rounded-lg inline-flex items-center justify-center gap-2">
                  <Smartphone className="w-5 h-5" /> Download App
                </button>
              </div>
              <div className="flex flex-wrap gap-6 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#E88A2D]" /> Works with BuilderLYNK
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#E88A2D]" /> iOS & Android
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#E88A2D]" /> Offline capable
                </div>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="relative flex justify-center">
              <div
                className="relative w-72 sm:w-80 rounded-[2.5rem] border-4 border-white/10 overflow-hidden shadow-2xl shadow-[#E88A2D]/10"
                style={{ backgroundColor: darkCardBg, aspectRatio: '9/19' }}
              >
                <div className="p-6 pt-12 flex flex-col items-center h-full">
                  <img src={pmLynkLogo} alt="" className="h-20 w-20 rounded-2xl mb-6 shadow-lg" />
                  <h3 className="text-white font-bold text-lg mb-1">PM LYNK</h3>
                  <p className="text-gray-500 text-sm mb-8">Field Management</p>

                  <div className="w-full grid grid-cols-2 gap-3">
                    {[
                      { icon: Receipt, label: 'Receipts' },
                      { icon: Truck, label: 'Deliveries' },
                      { icon: Users, label: 'Visitors' },
                      { icon: Camera, label: 'Photos' },
                      { icon: MessageSquare, label: 'Messages' },
                      { icon: FolderOpen, label: 'Documents' },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center gap-2"
                      >
                        <item.icon className="w-6 h-6 text-[#E88A2D]" />
                        <span className="text-white text-xs font-medium">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Floating badges */}
              <div className="absolute -left-4 top-1/3 bg-green-500/20 border border-green-500/30 rounded-xl px-4 py-2 backdrop-blur-sm hidden lg:block">
                <p className="text-green-400 text-sm font-semibold flex items-center gap-2">
                  <Receipt className="w-4 h-4" /> Receipt Scanned
                </p>
              </div>
              <div className="absolute -right-4 bottom-1/3 bg-blue-500/20 border border-blue-500/30 rounded-xl px-4 py-2 backdrop-blur-sm hidden lg:block">
                <p className="text-blue-400 text-sm font-semibold flex items-center gap-2">
                  <Bell className="w-4 h-4" /> Synced to Office
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
                Field Management, <span className="text-[#E88A2D]">Simplified</span>
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Everything a project manager needs, designed for one-handed use in the field
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
                From Field to <span className="text-[#E88A2D]">Office</span>, Seamlessly
              </h2>
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
                Why PMs <span className="text-[#E88A2D]">Love It</span>
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

      {/* Testimonials */}
      <section className="py-24" style={{ background: 'linear-gradient(to bottom, #1a1f2e, #0f1419)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">
                Built for the <span className="text-[#E88A2D]">Field</span>
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
      <section id="faq" className="py-24" style={{ backgroundColor: darkBg }}>
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
      <section className="py-24" style={{ background: 'linear-gradient(to bottom, #1a1f2e, #0f1419)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection animation="zoom-in">
            <img src={pmLynkLogo} alt="" className="h-24 w-24 mx-auto rounded-2xl shadow-lg mb-8" />
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-6">
              Take Your <span className="text-[#E88A2D]">Office</span> to the Field
            </h2>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
              Download PM LYNK and start managing your jobsite from your pocket.
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
                Get Started <ArrowRight className="w-5 h-5" />
              </button>
              <button className="text-lg px-10 py-4 text-white font-semibold border-2 border-white/20 hover:border-white/40 transition-all duration-300 rounded-lg inline-flex items-center justify-center gap-2">
                <Smartphone className="w-5 h-5" /> Download App
              </button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Contact */}
      <section className="py-24" style={{ backgroundColor: darkBg }}>
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
              <img src={pmLynkLogo} alt="" className="h-10 w-auto rounded-xl" />
              <span className="text-lg font-bold">
                PM <span className="text-[#E88A2D]">LYNK</span>
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link to="/" className="hover:text-white transition-colors">BuilderLYNK</Link>
              <Link to="/punch-clock-lynk" className="hover:text-white transition-colors">Punch Clock LYNK</Link>
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
