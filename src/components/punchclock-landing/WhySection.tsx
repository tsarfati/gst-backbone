import { AnimatedSection } from '@/components/AnimatedSection';
import { Clock, Shield, Zap } from 'lucide-react';

export function WhySection() {
  const reasons = [
    {
      icon: Clock,
      title: 'Simple time tracking',
      description: 'Your crew clocks in with one tap. GPS verifies every punch automatically — no extra steps, no confusion.',
      image: null,
    },
    {
      icon: Shield,
      title: 'Smart accountability',
      description: 'GPS coordinates on every punch, geofencing to prevent offsite clocking, and photo verification for complete confidence.',
      image: null,
    },
    {
      icon: Zap,
      title: 'Payroll in minutes',
      description: 'Timecards are calculated automatically with overtime, job codes, and cost codes — ready for payroll export.',
      image: null,
    },
  ];

  return (
    <section className="py-24 sm:py-32" style={{ backgroundColor: '#0f1419' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection animation="fade-up">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
              Why contractors switch to{' '}
              <span className="text-[#E88A2D]">Punch Clock LYNK</span>
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Stop chasing paper timesheets and guessing where your crew is. Get real-time visibility and payroll-ready data.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8">
          {reasons.map((reason, index) => (
            <AnimatedSection key={index} animation="fade-up" delay={index * 100}>
              <div className="rounded-2xl border border-white/10 p-8 hover:border-[#E88A2D]/30 transition-all duration-300" style={{ backgroundColor: '#1a1f2e' }}>
                <div className="w-14 h-14 rounded-xl bg-[#E88A2D]/10 flex items-center justify-center mb-6">
                  <reason.icon className="h-7 w-7 text-[#E88A2D]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{reason.title}</h3>
                <p className="text-gray-400 leading-relaxed text-sm">{reason.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
