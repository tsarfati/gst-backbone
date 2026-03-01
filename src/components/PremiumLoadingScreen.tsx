import builderLynkShield from '@/assets/builderlynk-icon-shield.png';

interface PremiumLoadingScreenProps {
  text?: string;
}

export function PremiumLoadingScreen({ text = 'Loading...' }: PremiumLoadingScreenProps) {
  const size = 520;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference / 3; // ~120 degrees

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-4">
        <div
          className="relative"
          style={{
            width: "min(72vw, 520px)",
            height: "min(72vw, 520px)",
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
              src={builderLynkShield}
              alt="BuilderLYNK"
              className="h-[374px] w-[374px] max-h-[56vw] max-w-[56vw] object-contain select-none pointer-events-none"
              draggable={false}
            />
          </div>
        </div>

        <p className="text-lg text-[#9CA3AF]">{text}</p>
      </div>
    </div>
  );
}
