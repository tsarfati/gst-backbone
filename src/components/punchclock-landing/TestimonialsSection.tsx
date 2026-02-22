import { AnimatedSection } from '@/components/AnimatedSection';

const testimonials = [
  {
    quote: 'We went from chasing paper timesheets every Friday to having payroll-ready data in minutes.',
    name: 'Mike R.',
    role: 'General Contractor',
  },
  {
    quote: 'The GPS tracking gives us total confidence. We know exactly where our crews are.',
    name: 'Sarah T.',
    role: 'Operations Manager',
  },
  {
    quote: 'My guys love it. One tap to clock in. Even the guys who hate phones can use it.',
    name: 'James L.',
    role: 'Superintendent',
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-28" style={{ backgroundColor: '#0f1419' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection animation="fade-up">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Trusted by contractors
            </h2>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, index) => (
            <AnimatedSection key={index} animation="fade-up" delay={index * 80}>
              <div className="rounded-xl border border-white/[0.06] p-6 h-full flex flex-col" style={{ backgroundColor: '#151a24' }}>
                <blockquote className="text-gray-300 text-sm leading-relaxed flex-1 mb-5">
                  "{t.quote}"
                </blockquote>
                <div className="border-t border-white/[0.06] pt-4">
                  <p className="text-white text-sm font-semibold">{t.name}</p>
                  <p className="text-white/30 text-xs">{t.role}</p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
