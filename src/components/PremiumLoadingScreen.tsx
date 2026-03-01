import { useState } from 'react';
import builderLynkShield from '@/assets/builderlynk-icon-shield.png';
import builderLynkIcon from '@/assets/builderlynk-icon.png';
import builderLynkLogo from '@/assets/builderlynk-logo-new.png';

interface PremiumLoadingScreenProps {
  text?: string;
}

export function PremiumLoadingScreen({ text = 'Loading...' }: PremiumLoadingScreenProps) {
  const logoFallbacks = [builderLynkShield, builderLynkIcon, builderLynkLogo];
  const [logoIndex, setLogoIndex] = useState(0);
  const size = 260;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference / 3; // ~120 degrees

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-4">
        <div
          className="relative"
          style={{
            width: "min(72vw, 260px)",
            height: "min(72vw, 260px)",
          }}
        >
          <svg
            viewBox={`0 0 ${size} ${size}`}
            width="100%"
            height="100%"
            className="absolute inset-0"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="premium-spinner-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#E88A2D" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#222222"
              strokeWidth={strokeWidth}
            />
            <g style={{ transformOrigin: '50% 50%', animation: 'spin 2s linear infinite' }}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="url(#premium-spinner-gradient)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${arcLength} ${circumference}`}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            </g>
          </svg>

          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={logoFallbacks[logoIndex]}
              alt="BuilderLYNK"
              className="h-[202px] w-[202px] max-h-[32vw] max-w-[32vw] object-contain select-none pointer-events-none"
              draggable={false}
              onError={() => {
                setLogoIndex((current) => (current < logoFallbacks.length - 1 ? current + 1 : current));
              }}
            />
          </div>
        </div>

        <p className="text-lg text-[#9CA3AF]">{text}</p>
      </div>
    </div>
  );
}
