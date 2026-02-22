import { AnimatedSection } from '@/components/AnimatedSection';

export function StatsBar() {
  return (
    <section style={{ backgroundColor: '#131820' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <AnimatedSection animation="fade-up">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '1 Tap', label: 'To clock in' },
              { value: 'GPS', label: 'On every punch' },
              { value: '< 5 min', label: 'Payroll prep time' },
              { value: '100%', label: 'Mobile-first' },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#E88A2D] mb-1">{stat.value}</div>
                <div className="text-white/40 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
