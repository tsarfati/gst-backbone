import { AnimatedSection } from '@/components/AnimatedSection';
import { Star } from 'lucide-react';

const testimonials = [
  {
    quote: 'We went from chasing paper timesheets every Friday to having payroll-ready data in minutes. Punch Clock LYNK paid for itself in the first week.',
    name: 'Mike R.',
    role: 'General Contractor',
  },
  {
    quote: 'The GPS tracking gives us total confidence. We know exactly where our crews are and what jobs they\'re working on. No more guessing.',
    name: 'Sarah T.',
    role: 'Operations Manager',
  },
  {
    quote: 'My guys love how simple it is. One tap to clock in, done. Even the guys who hate phones can use it without any training.',
    name: 'James L.',
    role: 'Superintendent',
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 sm:py-32" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a1f2e 100%)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection animation="fade-up">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
              Trusted by contractors across the country
            </h2>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <AnimatedSection key={index} animation="fade-up" delay={index * 100}>
              <div className="rounded-2xl border border-white/10 p-8 h-full flex flex-col" style={{ backgroundColor: '#1a1f2e' }}>
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#E88A2D] text-[#E88A2D]" />
                  ))}
                </div>
                <blockquote className="text-gray-300 leading-relaxed flex-1 mb-6 italic">
                  "{testimonial.quote}"
                </blockquote>
                <div>
                  <p className="text-white font-semibold">{testimonial.name}</p>
                  <p className="text-gray-500 text-sm">{testimonial.role}</p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
