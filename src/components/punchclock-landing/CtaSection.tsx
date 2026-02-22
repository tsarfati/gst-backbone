import { AnimatedSection } from '@/components/AnimatedSection';
import { ArrowRight } from 'lucide-react';

interface CtaSectionProps {
  onGetStarted: () => void;
}

export function CtaSection({ onGetStarted }: CtaSectionProps) {
  return (
    <section className="py-28" style={{ backgroundColor: '#131820' }}>
      <div className="max-w-2xl mx-auto px-4 text-center">
        <AnimatedSection animation="fade-up">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
            Ready to try it?
          </h2>
          <p className="text-gray-400 mb-8">
            Free 14-day trial. No credit card. Set up in under 5 minutes.
          </p>
          <button
            onClick={onGetStarted}
            className="px-10 py-4 text-white font-bold rounded-lg inline-flex items-center gap-2 transition-all duration-200 hover:brightness-110 text-lg"
            style={{ backgroundColor: '#E88A2D' }}
          >
            Start Free Trial <ArrowRight className="w-5 h-5" />
          </button>
        </AnimatedSection>
      </div>
    </section>
  );
}
