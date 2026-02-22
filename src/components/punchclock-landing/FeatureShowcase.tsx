import { AnimatedSection } from '@/components/AnimatedSection';
import mockupPunchIn from '@/assets/mockup-punch-in.png';
import mockupGpsMap from '@/assets/mockup-gps-map.png';
import mockupTimecards from '@/assets/mockup-timecards.png';
import mockupPhotos from '@/assets/mockup-photos.png';

const features = [
  {
    title: 'One-tap GPS punch in and out',
    description: 'Employees clock in with a single tap. Every punch is stamped with GPS coordinates so you know exactly where they are. Works on any phone — no special hardware needed.',
    image: mockupPunchIn,
  },
  {
    title: 'See your entire crew on the map',
    description: 'Real-time GPS tracking shows where every worker is. Set up geofences around jobsites to prevent offsite punching. Get alerts when employees arrive or leave.',
    image: mockupGpsMap,
  },
  {
    title: 'Payroll-ready timecard reports',
    description: 'Timecards are generated automatically from clock-in/out data. Filter by employee, job, date range, or cost code. Export directly to your payroll provider.',
    image: mockupTimecards,
  },
  {
    title: 'Document jobsite progress with photos',
    description: 'Employees capture photos directly to shared project albums. Every photo is tagged with the job, date, and GPS location. Build a visual record of your projects effortlessly.',
    image: mockupPhotos,
  },
];

export function FeatureShowcase() {
  return (
    <section className="py-24 sm:py-32" style={{ backgroundColor: '#0f1419' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection animation="fade-up">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
              Everything you need to track time, costs, and your{' '}
              <span className="text-[#E88A2D]">crew</span>
            </h2>
          </div>
        </AnimatedSection>

        <div className="space-y-24 lg:space-y-32">
          {features.map((feature, index) => {
            const isReversed = index % 2 === 1;
            return (
              <AnimatedSection key={index} animation="fade-up">
                <div className={`flex flex-col ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-16`}>
                  {/* Image */}
                  <div className="flex-1 w-full max-w-md">
                    <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/30">
                      <img
                        src={feature.image}
                        alt={feature.title}
                        className="w-full h-auto"
                      />
                    </div>
                  </div>

                  {/* Text */}
                  <div className="flex-1">
                    <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4 leading-tight">
                      {feature.title}
                    </h3>
                    <p className="text-gray-400 text-lg leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </AnimatedSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
