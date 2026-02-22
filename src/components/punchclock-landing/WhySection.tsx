import { AnimatedSection } from '@/components/AnimatedSection';
import { Clock, Shield, Zap } from 'lucide-react';

export function WhySection() {
  const reasons = [
    {
      icon: Clock,
      title: 'Simple time tracking',
      description: 'Your crew clocks in with one tap. GPS verifies every punch automatically — no extra steps.',
    },
    {
      icon: Shield,
      title: 'Smart accountability',
      description: 'GPS coordinates on every punch, geofencing, and photo verification for complete confidence.',
    },
    {
      icon: Zap,
      title: 'Payroll in minutes',
      description: 'Timecards calculated automatically with overtime, job codes, and cost codes — ready for export.',
    },
  ];

  return (
    <section className="py-24 sm:py-28" style={{ backgroundColor: '#131820' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection animation="fade-up">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
              Why contractors switch to{' '}
              <span className="text-[#E88A2D]">Punch Clock LYNK</span>
            </h2>
            <p className="text-lg text-gray-400 max-w-xl mx-auto">
              Stop chasing paper timesheets. Get real-time visibility and payroll-ready data.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-6">
          {reasons.map((reason, index) => (
            <AnimatedSection key={index} animation="fade-up" delay={index * 100}>
              <div className="rounded-2xl border border-white/[0.06] p-7 text-center" style={{ backgroundColor: '#1a1f2e' }}>
                <div className="w-12 h-12 rounded-xl bg-[#E88A2D]/10 flex items-center justify-center mb-5 mx-auto">
                  <reason.icon className="h-6 w-6 text-[#E88A2D]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{reason.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{reason.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
