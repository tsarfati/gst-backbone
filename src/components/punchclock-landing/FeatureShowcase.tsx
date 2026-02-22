import { AnimatedSection } from '@/components/AnimatedSection';
import { MapPin, Clock, Camera, FileText } from 'lucide-react';
import mockupPunchIn from '@/assets/mockup-punch-in.png';
import mockupGpsMap from '@/assets/mockup-gps-map.png';
import mockupTimecards from '@/assets/mockup-timecards.png';
import mockupPhotos from '@/assets/mockup-photos.png';

const features = [
  {
    icon: Clock,
    title: 'One-tap GPS punch in & out',
    description: 'Employees clock in with a single tap. Every punch is stamped with GPS coordinates so you know exactly where they are.',
    image: mockupPunchIn,
  },
  {
    icon: MapPin,
    title: 'See your entire crew on the map',
    description: 'Real-time GPS tracking shows where every worker is. Set up geofences around jobsites to prevent offsite punching.',
    image: mockupGpsMap,
  },
  {
    icon: FileText,
    title: 'Payroll-ready timecard reports',
    description: 'Timecards are generated automatically from clock-in/out data. Filter by employee, job, or cost code. Export directly to payroll.',
    image: mockupTimecards,
  },
  {
    icon: Camera,
    title: 'Document progress with photos',
    description: 'Capture photos directly to shared project albums. Every photo is tagged with the job, date, and GPS location automatically.',
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
              Everything you need to manage your{' '}
              <span className="text-[#E88A2D]">crew</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              From clock-in to payroll export, Punch Clock LYNK handles it all.
            </p>
          </div>
        </AnimatedSection>

        <div className="space-y-28">
          {features.map((feature, index) => {
            const isReversed = index % 2 === 1;
            return (
              <AnimatedSection key={index} animation="fade-up">
                <div className={`flex flex-col ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-20`}>
                  {/* Image */}
                  <div className="flex-1 flex justify-center">
                    <div className="w-64 rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40">
                      <img
                        src={feature.image}
                        alt={feature.title}
                        className="w-full h-auto"
                      />
                    </div>
                  </div>

                  {/* Text */}
                  <div className="flex-1 text-center lg:text-left">
                    <div className="w-12 h-12 rounded-xl bg-[#E88A2D]/10 flex items-center justify-center mb-5 mx-auto lg:mx-0">
                      <feature.icon className="h-6 w-6 text-[#E88A2D]" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4 leading-tight">
                      {feature.title}
                    </h3>
                    <p className="text-gray-400 text-lg leading-relaxed max-w-md mx-auto lg:mx-0">
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
