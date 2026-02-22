import { AnimatedSection } from '@/components/AnimatedSection';

export function WhySection() {
  const items = [
    {
      before: 'Chasing paper timesheets every Friday',
      after: 'GPS-verified punches, automatic timecards',
    },
    {
      before: "No idea who's working on which job",
      after: 'Employees select job, location, and task at punch-in',
    },
    {
      before: 'Manually building reports in spreadsheets',
      after: 'Instant reports by employee, job, task, or custom filters',
    },
    {
      before: "Generic apps that don't feel like yours",
      after: 'Your logo, your colors — a fully branded experience',
    },
  ];

  return (
    <section className="py-28" style={{ backgroundColor: '#131820' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection animation="fade-up">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
              The old way vs. the <span className="text-[#E88A2D]">LYNK</span> way
            </h2>
          </div>
        </AnimatedSection>

        <div className="space-y-4">
          {items.map((item, index) => (
            <AnimatedSection key={index} animation="fade-up" delay={index * 60}>
              <div className="grid md:grid-cols-2 gap-px rounded-xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                {/* Before */}
                <div className="flex items-center gap-3 px-6 py-5" style={{ backgroundColor: '#1a1f2a' }}>
                  <span className="w-2 h-2 rounded-full bg-red-400/60 flex-shrink-0" />
                  <span className="text-gray-400 text-sm">{item.before}</span>
                </div>
                {/* After */}
                <div className="flex items-center gap-3 px-6 py-5" style={{ backgroundColor: '#1c2230' }}>
                  <span className="w-2 h-2 rounded-full bg-[#E88A2D] flex-shrink-0" />
                  <span className="text-white text-sm font-medium">{item.after}</span>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
