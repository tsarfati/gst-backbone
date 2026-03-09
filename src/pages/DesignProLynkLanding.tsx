import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedSection } from '@/components/AnimatedSection';
import {
  ArrowRight,
  CheckCircle,
  Compass,
  FileSearch,
  Layers,
  Loader2,
  MessageSquare,
  Ruler,
  ShieldCheck,
} from 'lucide-react';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';
import designProShield from '@/assets/design-pro-lynk-shield.png';
import heroVideo1 from '@/assets/design-pro-hero-v2-1.mp4';
import heroVideo2 from '@/assets/design-pro-hero-2.mp4';
import heroVideo3 from '@/assets/design-pro-hero-v2-2.mp4';
import heroVideo4 from '@/assets/design-pro-hero-4.mp4';
import heroVideo5 from '@/assets/design-pro-hero-v2-5.mp4';

const darkBg = '#0f1419';
const darkCardBg = '#1a1f2e';
const accent = '#2DB6E8';
const designHeroVideos = [heroVideo1, heroVideo2, heroVideo3, heroVideo4, heroVideo5];

export default function DesignProLynkLanding() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [scrollY, setScrollY] = useState(0);
  const [showFirstVideo, setShowFirstVideo] = useState(true);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [videoASource, setVideoASource] = useState(0);
  const [videoBSource, setVideoBSource] = useState(1);
  const parallaxOffset = scrollY * 0.2;

  const handleVideoEnded = () => {
    if (showFirstVideo) {
      videoBRef.current?.play();
      setShowFirstVideo(false);
      setTimeout(() => {
        const nextIndex = (videoBSource + 1) % designHeroVideos.length;
        setVideoASource(nextIndex);
      }, 1000);
      return;
    }

    videoARef.current?.play();
    setShowFirstVideo(true);
    setTimeout(() => {
      const nextIndex = (videoASource + 1) % designHeroVideos.length;
      setVideoBSource(nextIndex);
    }, 1000);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: darkBg }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: accent }} />
      </div>
    );
  }

  const features = [
    {
      icon: FileSearch,
      title: 'Plan Intelligence',
      description: 'Ask plan questions with grounded citations from sheets, callouts, and specs.',
    },
    {
      icon: MessageSquare,
      title: 'RFI Coordination',
      description: 'Keep RFIs, responses, and context linked to the exact job records.',
    },
    {
      icon: Layers,
      title: 'Cross-Company Jobs',
      description: 'See all assigned jobs from multiple contractor clients in one workspace.',
    },
    {
      icon: Ruler,
      title: 'Submittal Workflow',
      description: 'Review, comment, and move submittals through discipline-specific approvals.',
    },
    {
      icon: Compass,
      title: 'Field-to-Design Sync',
      description: 'Close the loop between site feedback and design decisions in real time.',
    },
    {
      icon: ShieldCheck,
      title: 'Controlled Access',
      description: 'Role-based permissions and audit trails for every design communication.',
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: darkBg }}>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrollY > 24
            ? 'backdrop-blur-lg shadow-lg border-b border-white/10 opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
        style={{ backgroundColor: scrollY > 24 ? 'rgba(15, 20, 25, 0.95)' : 'transparent' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-20 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src={builderlynkIcon} alt="BuilderLYNK" className="h-14 w-auto" />
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-white/80 hover:text-white transition-colors font-medium">Features</a>
              <a href="#for-firms" className="text-white/80 hover:text-white transition-colors font-medium">For Firms</a>
              <Link to="/contact" className="text-white/80 hover:text-white transition-colors font-medium">Contact</Link>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" className="border-white/50 text-gray-900 bg-white hover:bg-white/90">
                <Link to="/auth">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <section className="relative min-h-screen flex items-center px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <video
            ref={videoARef}
            key={`design-videoA-${videoASource}`}
            autoPlay={showFirstVideo}
            muted
            playsInline
            onEnded={showFirstVideo ? handleVideoEnded : undefined}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
            style={{
              transform: `translateY(${parallaxOffset}px)`,
              opacity: showFirstVideo ? 1 : 0,
            }}
          >
            <source src={designHeroVideos[videoASource]} type="video/mp4" />
          </video>
          <video
            ref={videoBRef}
            key={`design-videoB-${videoBSource}`}
            muted
            playsInline
            preload="auto"
            onEnded={!showFirstVideo ? handleVideoEnded : undefined}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
            style={{
              transform: `translateY(${parallaxOffset}px)`,
              opacity: showFirstVideo ? 0 : 1,
            }}
          >
            <source src={designHeroVideos[videoBSource]} type="video/mp4" />
          </video>
        </div>
        <div className="absolute inset-0 z-[1] bg-black/55" />
        <div
          className="absolute inset-0 pointer-events-none z-[2]"
          style={{ background: 'radial-gradient(circle at 70% 40%, rgba(45,182,232,0.16), transparent 52%)' }}
        />
        <div className="relative z-10 max-w-7xl mx-auto w-full py-24">
          <div className="grid lg:grid-cols-[1fr_30%] gap-12 lg:gap-16 items-center">
            {/* Left — Copy */}
            <div>
              {/* Mobile logo */}
              <div className="lg:hidden flex justify-center mb-10">
                <img
                  src={designProShield}
                  alt="DesignProLYNK"
                  className="w-64 h-auto drop-shadow-2xl"
                />
              </div>

              <p className="uppercase tracking-[0.24em] text-xs font-bold mb-5" style={{ color: accent }}>
                Powered By BuilderLYNK
              </p>
              <h1 className="text-5xl sm:text-6xl xl:text-7xl font-extrabold text-white leading-[1.07] tracking-tight mb-7">
                DesignProLYNK for{' '}
                <span style={{ color: accent }}>architects and engineers.</span>
              </h1>
              <p className="text-gray-400 text-xl sm:text-2xl leading-relaxed mb-10 max-w-3xl">
                One place for design teams to manage RFIs, submittals, and plan intelligence across every assigned project and contractor.
              </p>
              <div className="flex flex-wrap gap-3 mb-10">
                <Link
                  to="/design-professional-signup"
                  className="px-10 py-4 text-white font-bold rounded-lg inline-flex items-center gap-2 transition-all duration-200 hover:brightness-110 text-lg"
                  style={{ backgroundColor: accent }}
                >
                  Request Design Access <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  to="/auth"
                  className="px-6 py-4 text-white/70 font-medium border border-white/10 hover:border-white/25 rounded-lg inline-flex items-center gap-2 transition-colors text-lg"
                >
                  I already have an account
                </Link>
              </div>
              <div className="flex flex-wrap gap-6 text-sm text-white/65">
                <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" style={{ color: accent }} /> Architecture + Engineering</span>
                <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" style={{ color: accent }} /> Cross-company job view</span>
                <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" style={{ color: accent }} /> Grounded plan answers</span>
              </div>

              <Link
                to="/"
                className="inline-flex items-center gap-2 text-white/40 text-xs font-medium uppercase tracking-widest hover:text-white/60 transition-colors mt-12"
              >
                <img src={builderlynkIcon} alt="" className="h-4 w-auto opacity-60" />
                A BuilderLYNK Product
              </Link>
            </div>

            {/* Right — Shield Logo */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="relative">
                <div
                  className="absolute -inset-10 rounded-full blur-3xl opacity-15"
                  style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
                />
                <img
                  src={designProShield}
                  alt="DesignProLYNK"
                  className="relative w-full h-auto object-contain drop-shadow-2xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-20">
              <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
                Built for Design Work, Not Generic Chat
              </h2>
              <p className="text-lg text-gray-400 max-w-3xl mx-auto">
                Designed for architects, structural, civil, and MEP teams collaborating with contractors in active projects.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {features.map((feature, index) => (
              <AnimatedSection key={feature.title} animation="fade-up" delay={index * 70}>
                <div className="h-full rounded-2xl border border-white/10 p-7" style={{ backgroundColor: darkCardBg }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: 'rgba(45,182,232,0.15)' }}>
                    <feature.icon className="h-6 w-6" style={{ color: accent }} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section id="for-firms" className="py-20" style={{ backgroundColor: darkCardBg }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection animation="fade-up">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">For Firms Managing Multiple Clients</h2>
            <p className="text-lg text-gray-300 mb-9">
              Your team keeps one login and one workspace while tracking projects from different contractor clients.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="text-white font-bold" style={{ backgroundColor: accent }}>
                <Link to="/design-professional-signup">Start with DesignProLYNK</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/5">
                <Link to="/contact">Talk to our team</Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <footer className="text-white py-14" style={{ backgroundColor: darkBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex items-center gap-3">
              <img src={builderlynkIcon} alt="BuilderLYNK" className="h-11 w-auto" />
              <div>
                <p className="font-semibold">DesignProLYNK</p>
                <p className="text-xs text-gray-400">Powered by BuilderLYNK</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-5 text-sm text-gray-400">
              <Link to="/" className="hover:text-white transition-colors">BuilderLYNK</Link>
              <Link to="/design-professional-signup" className="hover:text-white transition-colors">Design Professional Signup</Link>
              <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-6 text-xs text-gray-500">
            © {new Date().getFullYear()} BuilderLYNK. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
