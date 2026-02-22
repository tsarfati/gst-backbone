import { AnimatedSection } from '@/components/AnimatedSection';
import { MapPin, FileText, Camera, Clock } from 'lucide-react';
import mockupPunchIn from '@/assets/mockup-punch-in.png';
import mockupGpsMap from '@/assets/mockup-gps-map.png';
import mockupTimecards from '@/assets/mockup-timecards.png';
import mockupPhotos from '@/assets/mockup-photos.png';

const features = [
  {
    icon: Clock,
    title: 'One-tap punch in & out',
    description: 'GPS-stamped every time. Works on any phone.',
    image: mockupPunchIn,
  },
  {
    icon: MapPin,
    title: 'Live crew map',
    description: 'See where everyone is. Geofence your jobsites.',
    image: mockupGpsMap,
  },
  {
    icon: FileText,
    title: 'Auto timecards',
    description: 'Overtime, job codes, cost codes — calculated and ready.',
    image: mockupTimecards,
  },
  {
    icon: Camera,
    title: 'Jobsite photos',
    description: 'Tagged with job, date, and GPS. Build a visual record.',
    image: mockupPhotos,
  },
];

export function FeatureShowcase() {
  return (
    <section className="py-28" style={{ backgroundColor: '#0f1419' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection animation="fade-up">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
              Four tools. One app.
            </h2>
            <p className="text-gray-400 text-lg max-w-lg mx-auto">
              Everything your field crew needs, nothing they don't.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <AnimatedSection key={index} animation="fade-up" delay={index * 80}>
              <div
                className="group rounded-2xl border border-white/[0.06] overflow-hidden hover:border-[#E88A2D]/20 transition-colors duration-300"
                style={{ backgroundColor: '#151a24' }}
              >
                {/* Image area */}
                <div className="relative h-56 sm:h-64 overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#111620' }}>
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="h-full w-auto object-contain group-hover:scale-[1.02] transition-transform duration-500"
                  />
                </div>
                {/* Text */}
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <feature.icon className="w-5 h-5 text-[#E88A2D] flex-shrink-0" />
                    <h3 className="text-lg font-bold text-white">{feature.title}</h3>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed pl-8">
                    {feature.description}
                  </p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
