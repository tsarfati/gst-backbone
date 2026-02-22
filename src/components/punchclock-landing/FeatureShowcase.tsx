import { useState } from 'react';
import { AnimatedSection } from '@/components/AnimatedSection';
import {
  MapPin, FileText, Camera, Clock, Shield, Users,
  BarChart3, Paintbrush, Smartphone, Globe, Lock, Zap,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import mockupPunchIn from '@/assets/mockup-punch-in.png';
import mockupGpsMap from '@/assets/mockup-gps-map.png';
import mockupTimecards from '@/assets/mockup-timecards.png';
import mockupPhotos from '@/assets/mockup-photos.png';

const features = [
  {
    icon: Clock,
    title: 'GPS & Timestamp',
    description: 'Every punch is stamped with exact time and GPS coordinates. Know where your crew is and when they clocked in — no guessing, no disputes.',
    image: mockupPunchIn,
  },
  {
    icon: Camera,
    title: 'AI Photo Presence',
    description: 'Employees must stay in frame to punch in. Real-time face detection ensures the right person is on-site — eliminates buddy punching entirely.',
    image: mockupPhotos,
  },
  {
    icon: MapPin,
    title: 'Job & Task Selection',
    description: 'Employees select their job, location, and task at punch-in. Assign access per user — unlimited locations and unlimited tasks.',
    image: mockupGpsMap,
  },
  {
    icon: BarChart3,
    title: 'Custom Reports',
    description: 'Pull reports by employee, job, task, date range, or any combination. Export to Excel or PDF. Overtime and cost codes calculated automatically.',
    image: mockupTimecards,
  },
  {
    icon: Users,
    title: 'Per-User Access Control',
    description: 'Different employees see different jobs and tasks. Admins control exactly who has access to what — role-based permissions at every level.',
    image: null,
  },
  {
    icon: Paintbrush,
    title: 'Fully Branded',
    description: 'Your company logo, your colors, your branding throughout the entire app. Looks and feels like your own custom-built application.',
    image: null,
  },
  {
    icon: Shield,
    title: 'Geofencing',
    description: 'Set virtual boundaries around your jobsites. Get alerts when employees punch in outside approved zones. Full location accountability.',
    image: null,
  },
  {
    icon: FileText,
    title: 'Automatic Timecards',
    description: 'Overtime rules, break deductions, and job cost codes — all calculated automatically. Ready for payroll export with zero manual entry.',
    image: null,
  },
  {
    icon: Smartphone,
    title: 'Native iOS & Android',
    description: 'Real native apps on both platforms. Works offline, syncs when connected. Designed for the field — fast, simple, reliable.',
    image: null,
  },
  {
    icon: Globe,
    title: 'Unlimited Locations',
    description: 'Add as many jobsites as you need. Each with its own settings, geofence, assigned crew, and cost codes. No per-location fees.',
    image: null,
  },
  {
    icon: Lock,
    title: 'PIN & Photo Login',
    description: 'Employees log in with a simple PIN and verified photo. No passwords to forget, no accounts to manage. Secure and frictionless.',
    image: null,
  },
  {
    icon: Zap,
    title: 'Real-Time Dashboard',
    description: 'See who is clocked in right now, where they are, and what they are working on. Live updates across all your jobsites at a glance.',
    image: null,
  },
];

type Feature = typeof features[number];

function FeatureModal({ feature, open, onOpenChange }: { feature: Feature | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  if (!feature) return null;
  const Icon = feature.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 border-white/10 overflow-hidden" style={{ backgroundColor: '#151a24' }}>
        {feature.image && (
          <div className="flex items-center justify-center p-6 pb-0" style={{ backgroundColor: '#111620' }}>
            <img
              src={feature.image}
              alt={feature.title}
              className="h-64 w-auto object-contain"
            />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(232,138,45,0.12)' }}>
              <Icon className="w-5 h-5 text-[#E88A2D]" />
            </div>
            <h3 className="text-xl font-bold text-white">{feature.title}</h3>
          </div>
          <p className="text-gray-400 leading-relaxed">
            {feature.description}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FeatureShowcase() {
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  return (
    <section className="py-28" style={{ backgroundColor: '#0f1419' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection animation="fade-up">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
              Built for how you actually run jobs.
            </h2>
            <p className="text-gray-400 text-lg max-w-lg mx-auto">
              Tap any feature to learn more.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <AnimatedSection key={index} animation="fade-up" delay={index * 40}>
                <button
                  onClick={() => setSelectedFeature(feature)}
                  className="w-full text-left group rounded-xl border border-white/[0.06] p-5 hover:border-[#E88A2D]/30 transition-all duration-300 cursor-pointer"
                  style={{ backgroundColor: '#151a24' }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300"
                    style={{ backgroundColor: 'rgba(232,138,45,0.1)' }}
                  >
                    <Icon className="w-5 h-5 text-[#E88A2D]" />
                  </div>
                  <h3 className="text-sm font-semibold text-white leading-tight">
                    {feature.title}
                  </h3>
                </button>
              </AnimatedSection>
            );
          })}
        </div>
      </div>

      <FeatureModal
        feature={selectedFeature}
        open={!!selectedFeature}
        onOpenChange={(v) => { if (!v) setSelectedFeature(null); }}
      />
    </section>
  );
}
