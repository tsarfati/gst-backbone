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
import logoImage from '@/assets/builderlynk-logo.png';
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

const heroVideos = [heroVideo1, heroVideo2, heroVideo3];

export default function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showTenantRequestModal, setShowTenantRequestModal] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const parallaxOffset = useParallax(0.3);
  const [scrollY, setScrollY] = useState(0);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Handle video ended - cycle to next video
  const handleVideoEnded = () => {
    setCurrentVideoIndex((prev) => (prev + 1) % heroVideos.length);
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

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation - Fixed with backdrop blur */}
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrollY > 50 
            ? 'bg-background/90 backdrop-blur-lg shadow-lg border-b border-border' 
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="BuilderLYNK" className="h-14 w-auto drop-shadow-lg" />
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-foreground/80 hover:text-foreground transition-colors font-medium">Features</a>
              <a href="#about" className="text-foreground/80 hover:text-foreground transition-colors font-medium">About</a>
              <a href="#contact" className="text-foreground/80 hover:text-foreground transition-colors font-medium">Contact</a>
            </div>
            <Button 
              onClick={() => setShowAuthModal(true)} 
              variant={scrollY > 50 ? "default" : "outline"}
              className={scrollY > 50 ? "" : "border-white/50 text-white hover:bg-white/20"}
            >
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Full viewport with video background */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Video Background - loops through multiple videos */}
        <div className="absolute inset-0 z-0">
          <video
            ref={videoRef}
            key={currentVideoIndex}
            autoPlay
            muted
            playsInline
            onEnded={handleVideoEnded}
            className="w-full h-full object-cover"
            style={{ transform: `translateY(${parallaxOffset}px)` }}
          >
            <source src={heroVideos[currentVideoIndex]} type="video/mp4" />
          </video>
          {/* Dark overlay with gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
          {/* Accent color overlay for brand feel */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection animation="fade-down" duration={1000}>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black mb-6 leading-tight tracking-tight drop-shadow-lg" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.5)' }}>
              <span className="text-white">Build </span><span className="text-[#E88A2D]">Smarter.</span>
              <span className="block mt-2"><span className="text-white">Build </span><span className="text-[#E88A2D]">Faster.</span></span>
            </h1>
          </AnimatedSection>
          
          <AnimatedSection animation="fade-up" delay={300} duration={1000}>
            <p className="text-xl sm:text-2xl text-white/90 max-w-3xl mx-auto mb-10 font-light">
              The construction management platform that connects every link in your business. 
              From punch clock to payables—all in one place.
            </p>
          </AnimatedSection>
          
          <AnimatedSection animation="zoom-in" delay={600} duration={800}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => setShowTenantRequestModal(true)}
                className="text-lg px-10 py-7 bg-accent hover:bg-accent/80 text-white font-bold shadow-2xl hover:shadow-accent/25 hover:scale-105 transition-all duration-300"
              >
                Start Building Today
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => setShowAuthModal(true)}
                className="text-lg px-10 py-7 border-white/50 text-white hover:bg-accent hover:border-accent hover:text-white font-bold transition-all duration-300"
              >
                Sign In
              </Button>
            </div>
          </AnimatedSection>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <div className="w-8 h-12 rounded-full border-2 border-white/50 flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-white rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAyIi8+PC9nPjwvc3ZnPg==')] opacity-50" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <AnimatedSection key={index} animation="zoom-in" delay={index * 150}>
                <div className="text-center group">
                  <stat.icon className="h-10 w-10 text-primary-foreground mx-auto mb-3 group-hover:scale-110 transition-transform duration-300" />
                  <div className="text-4xl sm:text-5xl font-black text-[#E88A2D] mb-1">{stat.value}</div>
                  <div className="text-primary-foreground/80 font-medium">{stat.label}</div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-bold text-foreground mb-4">
                Everything You Need to <span className="text-[#E88A2D]">Succeed</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
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
                <div className="bg-card p-8 rounded-xl border border-border hover:border-accent/50 hover:shadow-xl hover:shadow-accent/10 transition-all duration-500 group h-full">
                  <div className="w-14 h-14 rounded-xl bg-[#E88A2D]/10 flex items-center justify-center mb-6 group-hover:bg-[#E88A2D] group-hover:scale-110 transition-all duration-300">
                    <feature.icon className="h-7 w-7 text-[#E88A2D] group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-muted/30 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-accent/5 to-transparent" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
            <AnimatedSection animation="fade-right">
              <div>
                <h2 className="text-3xl sm:text-5xl font-bold text-foreground mb-6 leading-tight">
                  Built for <span className="text-[#E88A2D]">Builders,</span>
                  <span className="block">By Builders</span>
                </h2>
                <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                  BuilderLYNK was created by construction professionals who understand 
                  the unique challenges of managing construction projects. We&apos;ve built a platform 
                  that links every piece of your construction workflow together.
                </p>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
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
                        <span className="text-foreground font-medium">{benefit}</span>
                      </li>
                    </AnimatedSection>
                  ))}
                </ul>
              </div>
            </AnimatedSection>
            
            <AnimatedSection animation="zoom-in" delay={300}>
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur-2xl" />
                <div className="relative bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-10 lg:p-14 shadow-2xl">
                  <div className="text-center">
                    <div className="text-7xl font-black text-[#E88A2D] mb-2">100%</div>
                    <p className="text-2xl text-primary-foreground font-bold mb-8">Cloud-Based Platform</p>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="bg-white/10 rounded-xl p-6 backdrop-blur">
                        <div className="text-4xl font-black text-[#E88A2D] mb-1">24/7</div>
                        <p className="text-primary-foreground/80 font-medium">Access Anywhere</p>
                      </div>
                      <div className="bg-white/10 rounded-xl p-6 backdrop-blur">
                        <div className="text-4xl font-black text-[#E88A2D] mb-1">99.9%</div>
                        <p className="text-primary-foreground/80 font-medium">Uptime SLA</p>
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
              <h3 className="text-2xl sm:text-4xl font-bold text-foreground text-center mb-14">
                Core Capabilities That <span className="text-[#E88A2D]">Drive Results</span>
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {coreCapabilities.map((capability, index) => (
                  <AnimatedSection key={index} animation="fade-up" delay={index * 100}>
                    <div className="bg-card border border-border rounded-xl p-6 hover:shadow-xl hover:border-accent/30 transition-all duration-500 h-full group">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center group-hover:from-primary group-hover:to-accent transition-all duration-300">
                          <CheckCircle className="h-6 w-6 text-primary group-hover:text-white transition-colors" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground mb-2 text-lg">{capability.title}</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">{capability.description}</p>
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

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-primary via-primary to-primary/90 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-white/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <AnimatedSection animation="zoom-in">
            <h2 className="text-3xl sm:text-5xl font-black text-primary-foreground mb-6">
              Ready to Transform Your Business?
            </h2>
            <p className="text-xl text-primary-foreground/80 mb-10 max-w-2xl mx-auto">
              Join construction companies already using BuilderLYNK to streamline their operations 
              and boost profitability.
            </p>
            <Button 
              size="lg" 
              onClick={() => setShowTenantRequestModal(true)}
              className="text-xl px-12 py-8 bg-accent hover:bg-accent/90 text-white font-bold shadow-2xl hover:shadow-accent/40 hover:scale-105 transition-all duration-300"
            >
              Get Started Today
              <ArrowRight className="ml-3 h-6 w-6" />
            </Button>
          </AnimatedSection>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-bold text-foreground mb-4">
                Get in <span className="text-[#E88A2D]">Touch</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Have questions? We&apos;re here to help you find the right solution for your business.
              </p>
            </div>
          </AnimatedSection>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            <AnimatedSection animation="fade-right" delay={100}>
              <div className="text-center p-8 bg-card rounded-xl border border-border hover:border-[#E88A2D]/50 hover:shadow-xl transition-all duration-300 group">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#E88A2D]/10 mb-6 group-hover:bg-[#E88A2D] group-hover:scale-110 transition-all duration-300">
                  <Mail className="h-8 w-8 text-[#E88A2D] group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-bold text-foreground mb-2 text-xl">Email Us</h3>
                <p className="text-muted-foreground text-lg">support@builderlynk.com</p>
              </div>
            </AnimatedSection>
            <AnimatedSection animation="fade-left" delay={200}>
              <div className="text-center p-8 bg-card rounded-xl border border-border hover:border-[#E88A2D]/50 hover:shadow-xl transition-all duration-300 group">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#E88A2D]/10 mb-6 group-hover:bg-[#E88A2D] group-hover:scale-110 transition-all duration-300">
                  <Phone className="h-8 w-8 text-[#E88A2D] group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-bold text-foreground mb-2 text-xl">Call Us</h3>
                <p className="text-muted-foreground text-lg">(555) 123-4567</p>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <img src={logoImage} alt="BuilderLYNK" className="h-10 w-auto brightness-0 invert" />
              </div>
              <p className="text-primary-foreground/70 text-sm leading-relaxed">
                The complete construction management platform for modern builders.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-lg">Product</h4>
              <ul className="space-y-3 text-sm text-primary-foreground/70">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-lg">Company</h4>
              <ul className="space-y-3 text-sm text-primary-foreground/70">
                <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-lg">Legal</h4>
              <ul className="space-y-3 text-sm text-primary-foreground/70">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-primary-foreground/20 mt-12 pt-8 text-center text-sm text-primary-foreground/60">
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
