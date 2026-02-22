import { AnimatedSection } from '@/components/AnimatedSection';
import { ArrowRight } from 'lucide-react';

interface CtaSectionProps {
  onGetStarted: () => void;
}

export function CtaSection({ onGetStarted }: CtaSectionProps) {
  return (
    <section className="py-24" style={{ background: 'linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%)' }}>
      <div className="max-w-3xl mx-auto px-4 text-center">
        <AnimatedSection animation="fade-up">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
            Ready to modernize your time tracking?
          </h2>
          <p className="text-lg text-gray-400 mb-8">
            Sign up for a free BuilderLYNK account and start using Punch Clock LYNK today.
          </p>
          <button
            onClick={onGetStarted}
            className="text-lg px-10 py-4 text-white font-bold shadow-2xl hover:scale-105 hover:shadow-[0_0_30px_rgba(232,138,45,0.5)] transition-all duration-300 rounded-full inline-flex items-center gap-2"
            style={{ backgroundColor: '#E88A2D' }}
          >
            Start Free Trial <ArrowRight className="w-5 h-5" />
          </button>
        </AnimatedSection>
      </div>
    </section>
  );
}
