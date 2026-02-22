import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthModal } from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { NavBar } from '@/components/punchclock-landing/NavBar';
import { HeroSection } from '@/components/punchclock-landing/HeroSection';
import { StatsBar } from '@/components/punchclock-landing/StatsBar';
import { FeatureShowcase } from '@/components/punchclock-landing/FeatureShowcase';
import { WhySection } from '@/components/punchclock-landing/WhySection';
import { TestimonialsSection } from '@/components/punchclock-landing/TestimonialsSection';
import { CtaSection } from '@/components/punchclock-landing/CtaSection';
import { FooterSection } from '@/components/punchclock-landing/FooterSection';


export default function PunchClockLynkLanding() {
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f1419' }}>
        <Loader2 className="h-8 w-8 animate-spin text-[#E88A2D]" />
      </div>
    );
  }

  const handleGetStarted = () => {
    setAuthModalMode('signUp');
    setShowAuthModal(true);
  };

  const handleSignIn = () => {
    setAuthModalMode('signIn');
    setShowAuthModal(true);
  };

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: '#0f1419' }}>
      <NavBar scrollY={scrollY} onSignIn={handleSignIn} />
      <HeroSection onGetStarted={handleGetStarted} />
      <StatsBar />
      <FeatureShowcase />
      <WhySection />
      <TestimonialsSection />
      <CtaSection onGetStarted={handleGetStarted} />
      <FooterSection />
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} initialMode={authModalMode} />
    </div>
  );
}
