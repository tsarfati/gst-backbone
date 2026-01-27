import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthModal } from '@/components/AuthModal';
import { TenantRequestModal } from '@/components/TenantRequestModal';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedSection } from '@/components/AnimatedSection';
import { useParallax } from '@/hooks/useScrollAnimation';
import { Loader2 } from 'lucide-react';
import heroVideo1 from '@/assets/hero-construction.mp4';
import heroVideo2 from '@/assets/hero-construction-2.mp4';
import heroVideo3 from '@/assets/hero-construction-3.mp4';
import heroVideo4 from '@/assets/hero-construction-4.mp4';
import heroVideo5 from '@/assets/hero-construction-5.mp4';
import logoImage from '@/assets/builderlynk-logo-new.png';
import logoTransparent from '@/assets/builderlynk-logo-new.png';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';
import headerLogo from '@/assets/builderlynk-header-logo.png';
import {
  Shield,
  Users,
  BarChart3,
  Clock,
  FileText,
  CheckCircle,
  ArrowRight,
  Mail,
  Phone,
  Building2,
  Zap,
  Target,
  TrendingUp
} from 'lucide-react';
import { CountUpStat } from '@/components/CountUpStat';

const heroVideos = [heroVideo1, heroVideo2, heroVideo3, heroVideo4, heroVideo5];

export default function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showTenantRequestModal, setShowTenantRequestModal] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const parallaxOffset = useParallax(0.3);
  const [scrollY, setScrollY] = useState(0);
  const [showFirstVideo, setShowFirstVideo] = useState(true);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);

  // Track which video sources are assigned to A and B
  const [videoASource, setVideoASource] = useState(0);
  const [videoBSource, setVideoBSource] = useState(1);

  // Handle video ended - crossfade to the other video element
  const handleVideoEnded = () => {
    if (showFirstVideo) {
      // Video A just ended, crossfade to Video B
      videoBRef.current?.play();
      setShowFirstVideo(false);
      // After transition, prepare next video for A
      setTimeout(() => {
        const nextIndex = (videoBSource + 1) % heroVideos.length;
        setVideoASource(nextIndex);
      }, 1000);
    } else {
      // Video B just ended, crossfade to Video A
      videoARef.current?.play();
      setShowFirstVideo(true);
      // After transition, prepare next video for B
      setTimeout(() => {
        const nextIndex = (videoASource + 1) % heroVideos.length;
        setVideoBSource(nextIndex);
      }, 1000);
    }
  };

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is authenticated, don't render (will redirect)
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const features = [
    {
      icon: Building2,
      title: 'Multi-Company Management',
      description: 'Manage multiple construction companies from a single platform with complete data isolation.'
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Bank-level security with role-based access control and audit trails for every action.'
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Seamlessly collaborate with your team with real-time updates and notifications.'
    },
    {
      icon: BarChart3,
      title: 'Financial Insights',
      description: 'Comprehensive reporting and analytics to track project costs and profitability.'
    },
    {
      icon: Clock,
      title: 'Time Tracking',
      description: 'GPS-enabled punch clock with photo verification for accurate time tracking.'
    },
    {
      icon: FileText,
      title: 'Document Management',
      description: 'Centralized document storage with version control and easy sharing capabilities.'
    }
  ];

  const benefits = [
    'Streamline payables and receivables',
    'Real-time job cost tracking & budget monitoring',
    'Manage subcontracts and purchase orders',
    'Generate professional invoices',
    'Comprehensive audit trails',
    'Mobile-ready for field teams'
  ];

  const stats = [
    { icon: Zap, value: '10x', label: 'Faster Workflows' },
    { icon: Target, value: '99.9%', label: 'Uptime SLA' },
    { icon: TrendingUp, value: '30%', label: 'Cost Savings' },
    { icon: Users, value: '24/7', label: 'Access Anywhere' },
  ];

  const coreCapabilities = [
    {
      title: 'Precision Job Costing',
      description: 'Track every dollar across projects with detailed cost code breakdowns. Know exactly where your money goes and keep projects profitable.'
    },
    {
      title: 'Smart Receipt Management',
      description: 'Capture, organize, and code receipts instantly. Turn chaos into clarity with automated receipt processing and categorization.'
    },
    {
      title: 'Streamlined Receipt Coding',
      description: 'Project managers can route purchase receipts directly to job costing with a few clicks. Coding requests flow seamlessly through approval workflows.'
    },
    {
      title: 'Job Cost Accounting Integration',
      description: 'Built around construction-specific accounting principles. Every coding request ties directly to your job cost structure for accurate financial reporting.'
    },
    {
      title: 'Vendor Portal & AIA Billing',
      description: 'Empower vendors to submit AIA-formatted invoices with detailed payment breakdowns. Custom invoice structures that match your company requirements.'
    }
  ];

  // Dark theme colors matching original design
  const darkBg = '#0f1419';
  const darkCardBg = '#1a1f2e';
  const lightCardBg = '#f5f5f0';
  
  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ backgroundColor: darkBg }}
    >
      {/* Navigation - Hidden until scroll, then fixed with backdrop blur */}
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
            <div className="flex items-center gap-2">
              <img src={builderlynkIcon} alt="BuilderLYNK" className="h-14 w-auto" />
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-white/80 hover:text-white transition-colors font-medium">Features</a>
              <a href="#about" className="text-white/80 hover:text-white transition-colors font-medium">About</a>
              <a href="#contact" className="text-white/80 hover:text-white transition-colors font-medium">Contact</a>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => navigate('/punch-clock-login')} 
                variant="ghost"
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <Clock className="h-4 w-4 mr-2" />
                Employee Login
              </Button>
              <Button 
                onClick={() => setShowAuthModal(true)} 
                variant="outline"
                className="border-white/50 text-gray-900 bg-white hover:bg-white/90"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Full viewport with video background */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Video Background - crossfade between two video elements */}
        <div className="absolute inset-0 z-0">
          {/* Video A */}
          <video
            ref={videoARef}
            key={`videoA-${videoASource}`}
            autoPlay={showFirstVideo}
            muted
            playsInline
            onEnded={showFirstVideo ? handleVideoEnded : undefined}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
            style={{ 
              transform: `translateY(${parallaxOffset}px)`,
              opacity: showFirstVideo ? 1 : 0
            }}
          >
            <source src={heroVideos[videoASource]} type="video/mp4" />
          </video>
          {/* Video B */}
          <video
            ref={videoBRef}
            key={`videoB-${videoBSource}`}
            muted
            playsInline
            preload="auto"
            onEnded={!showFirstVideo ? handleVideoEnded : undefined}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
            style={{ 
              transform: `translateY(${parallaxOffset}px)`,
              opacity: showFirstVideo ? 0 : 1
            }}
          >
            <source src={heroVideos[videoBSource]} type="video/mp4" />
          </video>
          {/* Neutral overlay (no color hue) */}
          <div className="absolute inset-0 bg-black/45" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection animation="fade-down" duration={1000}>
            <img 
              src={builderlynkIcon} 
              alt="BuilderLYNK Icon" 
              className="h-52 sm:h-64 lg:h-80 w-auto mx-auto mb-6 drop-shadow-[0_8px_32px_rgba(0,0,0,0.5)]" 
            />
            <h1 className="text-7xl sm:text-8xl lg:text-9xl font-black mb-4 tracking-tight drop-shadow-[0_8px_32px_rgba(0,0,0,0.7)]" style={{ textShadow: '4px 4px 16px rgba(0,0,0,0.6)' }}>
              <span className="text-white">Builder</span><span className="text-[#E88A2D]">LYNK</span>
            </h1>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6 tracking-tight drop-shadow-lg" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.5)' }}>
              <span className="text-white">Build </span><span className="text-[#E88A2D]">Smarter.</span>
              <span className="text-white"> Build </span><span className="text-[#E88A2D]">Faster.</span>
            </h2>
          </AnimatedSection>
          
          <AnimatedSection animation="fade-up" delay={300} duration={1000}>
            <p className="text-xl sm:text-2xl text-white/90 max-w-3xl mx-auto mb-10 font-light">
              The construction management platform that connects every link in your business. 
              From punch clock to payables—all in one place.
            </p>
          </AnimatedSection>
          
          <AnimatedSection animation="zoom-in" delay={600} duration={800}>
            <Button 
              size="lg" 
              onClick={() => setShowTenantRequestModal(true)}
              className="text-lg px-10 py-7 text-white font-bold shadow-2xl hover:scale-105 transition-all duration-300 pointer-events-auto"
              style={{ backgroundColor: '#E88A2D' }}
            >
              Start Building Today
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </AnimatedSection>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <div className="w-8 h-12 rounded-full border-2 border-white/50 flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-white rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Stats Section - Dark gradient background */}
      <section className="py-16 relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #1a1f2e, #0f1419)' }}>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAyIi8+PC9nPjwvc3ZnPg==')] opacity-50" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <AnimatedSection key={index} animation="zoom-in" delay={index * 150}>
                <CountUpStat 
                  icon={stat.icon} 
                  value={stat.value} 
                  label={stat.label}
                  duration={1200}
                />
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Dark theme */}
      <section id="features" className="py-24" style={{ backgroundColor: darkBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">
                Everything You Need to <span className="text-[#E88A2D]">Succeed</span>
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Comprehensive tools designed specifically for construction companies
              </p>
            </div>
          </AnimatedSection>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <AnimatedSection 
                key={index} 
                animation={index % 2 === 0 ? 'fade-right' : 'fade-left'} 
                delay={index * 100}
              >
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

      {/* About Section - Dark theme */}
      <section id="about" className="py-24 relative overflow-hidden" style={{ backgroundColor: darkBg }}>
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#E88A2D]/5 to-transparent" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
            <AnimatedSection animation="fade-right">
              <div>
                <h2 className="text-3xl sm:text-5xl font-bold text-white mb-6 leading-tight">
                  Built for <span className="text-[#E88A2D]">Builders,</span>
                  <span className="block">By Builders</span>
                </h2>
                <p className="text-lg text-gray-400 mb-6 leading-relaxed">
                  BuilderLYNK was created by construction professionals who understand 
                  the unique challenges of managing construction projects. We&apos;ve built a platform 
                  that links every piece of your construction workflow together.
                </p>
                <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                  From small contractors to large construction firms, our platform scales with 
                  your business and adapts to your specific needs.
                </p>
                <ul className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <AnimatedSection key={index} animation="fade-left" delay={index * 80}>
                      <li className="flex items-center gap-4 group">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#E88A2D]/10 flex items-center justify-center group-hover:bg-[#E88A2D] transition-colors">
                          <CheckCircle className="h-5 w-5 text-[#E88A2D] group-hover:text-white transition-colors" />
                        </div>
                        <span className="text-white font-medium">{benefit}</span>
                      </li>
                    </AnimatedSection>
                  ))}
                </ul>
              </div>
            </AnimatedSection>
            
            <AnimatedSection animation="zoom-in" delay={300}>
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-[#1e3a5f]/20 to-[#E88A2D]/20 rounded-3xl blur-2xl" />
                {/* Light cream card for stats - matches reference */}
                <div className="relative rounded-2xl p-10 lg:p-14 shadow-2xl" style={{ backgroundColor: lightCardBg }}>
                  <div className="text-center">
                    <div className="text-7xl font-black text-[#E88A2D] mb-2">100%</div>
                    <p className="text-2xl text-gray-900 font-bold mb-8">Cloud-Based Platform</p>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="text-4xl font-black text-[#E88A2D] mb-1">24/7</div>
                        <p className="text-gray-600 font-medium">Access Anywhere</p>
                      </div>
                      <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="text-4xl font-black text-[#E88A2D] mb-1">99.9%</div>
                        <p className="text-gray-600 font-medium">Uptime SLA</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          </div>

          {/* Core Capabilities */}
          <AnimatedSection animation="fade-up">
            <div className="mt-20">
              <h3 className="text-2xl sm:text-4xl font-bold text-white text-center mb-14">
                Core Capabilities That <span className="text-[#E88A2D]">Drive Results</span>
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {coreCapabilities.map((capability, index) => (
                  <AnimatedSection key={index} animation="fade-up" delay={index * 100}>
                    <div 
                      className="rounded-xl p-6 border border-white/10 hover:shadow-xl hover:border-[#E88A2D]/30 transition-all duration-500 h-full group"
                      style={{ backgroundColor: darkCardBg }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#E88A2D]/10 to-[#E88A2D]/20 flex items-center justify-center group-hover:from-[#E88A2D] group-hover:to-[#d67a20] transition-all duration-300">
                          <CheckCircle className="h-6 w-6 text-[#E88A2D] group-hover:text-white transition-colors" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white mb-2 text-lg">{capability.title}</h4>
                          <p className="text-sm text-gray-400 leading-relaxed">{capability.description}</p>
                        </div>
                      </div>
                    </div>
                  </AnimatedSection>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* CTA Section - Dark gradient */}
      <section className="py-24 relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #1a1f2e, #0f1419)' }}>
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#E88A2D]/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-white/5 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <AnimatedSection animation="zoom-in">
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-6">
              Ready to Transform Your Business?
            </h2>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
              Join construction companies already using BuilderLYNK to streamline their operations 
              and boost profitability.
            </p>
            <Button 
              size="lg" 
              onClick={() => setShowTenantRequestModal(true)}
              className="text-xl px-12 py-8 bg-[#E88A2D] hover:bg-[#d67a20] text-white font-bold shadow-2xl hover:shadow-[#E88A2D]/40 hover:scale-105 transition-all duration-300"
            >
              Get Started Today
              <ArrowRight className="ml-3 h-6 w-6" />
            </Button>
          </AnimatedSection>
        </div>
      </section>

      {/* Contact Section - Dark theme */}
      <section id="contact" className="py-24" style={{ backgroundColor: darkBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4">
                Get in <span className="text-[#E88A2D]">Touch</span>
              </h2>
              <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                Have questions? We&apos;re here to help you find the right solution for your business.
              </p>
            </div>
          </AnimatedSection>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            <AnimatedSection animation="fade-right" delay={100}>
              <div 
                className="text-center p-8 rounded-xl border border-white/10 hover:border-[#E88A2D]/50 hover:shadow-xl transition-all duration-300 group"
                style={{ backgroundColor: darkCardBg }}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#E88A2D]/10 mb-6 group-hover:bg-[#E88A2D] group-hover:scale-110 transition-all duration-300">
                  <Mail className="h-8 w-8 text-[#E88A2D] group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-bold text-white mb-2 text-xl">Email Us</h3>
                <p className="text-gray-400 text-lg">support@builderlynk.com</p>
              </div>
            </AnimatedSection>
            <AnimatedSection animation="fade-left" delay={200}>
              <div 
                className="text-center p-8 rounded-xl border border-white/10 hover:border-[#E88A2D]/50 hover:shadow-xl transition-all duration-300 group"
                style={{ backgroundColor: darkCardBg }}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#E88A2D]/10 mb-6 group-hover:bg-[#E88A2D] group-hover:scale-110 transition-all duration-300">
                  <Phone className="h-8 w-8 text-[#E88A2D] group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-bold text-white mb-2 text-xl">Call Us</h3>
                <p className="text-gray-400 text-lg">(267) 625-4866</p>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Footer - Dark theme */}
      <footer style={{ backgroundColor: darkCardBg }} className="text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12">
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
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-lg">Company</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="https://www.jobsitelynk.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">JobSiteLYNK</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-lg">Legal</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 mt-12 pt-8 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} BuilderLYNK. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      <TenantRequestModal open={showTenantRequestModal} onOpenChange={setShowTenantRequestModal} />
    </div>
  );
}
