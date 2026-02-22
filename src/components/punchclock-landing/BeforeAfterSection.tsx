import { AnimatedSection } from '@/components/AnimatedSection';
import { X, Check } from 'lucide-react';

export function BeforeAfterSection() {
  const beforeItems = [
    'Hours wasted collecting and verifying paper timesheets',
    'No idea if your crew is actually on-site',
    'Payroll errors lead to overpaying and re-runs',
    'No job costing data — you\'re flying blind on project costs',
  ];

  const afterItems = [
    'GPS-verified punches eliminate guesswork and time theft',
    'Real-time crew location on a live map',
    'Automatic overtime and payroll calculations',
    'Every hour tracked to a job and cost code automatically',
  ];

  return (
    <section className="py-24 sm:py-32" style={{ background: 'linear-gradient(180deg, #1a1f2e 0%, #0f1419 100%)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection animation="fade-up">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
              From paper timesheets to{' '}
              <span className="text-[#E88A2D]">total visibility</span>
            </h2>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          <AnimatedSection animation="fade-up" delay={0}>
            <div className="rounded-2xl border border-red-500/20 p-8" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
              <h3 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2">
                <X className="w-6 h-6" /> Without Punch Clock LYNK
              </h3>
              <ul className="space-y-4">
                {beforeItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-400">
                    <span className="mt-1 w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                      <X className="w-3 h-3 text-red-400" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </AnimatedSection>

          <AnimatedSection animation="fade-up" delay={100}>
            <div className="rounded-2xl border border-[#E88A2D]/30 p-8" style={{ backgroundColor: 'rgba(232, 138, 45, 0.05)' }}>
              <h3 className="text-xl font-bold text-[#E88A2D] mb-6 flex items-center gap-2">
                <Check className="w-6 h-6" /> With Punch Clock LYNK
              </h3>
              <ul className="space-y-4">
                {afterItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-300">
                    <span className="mt-1 w-5 h-5 rounded-full bg-[#E88A2D]/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-[#E88A2D]" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
