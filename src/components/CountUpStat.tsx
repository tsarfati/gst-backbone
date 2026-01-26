import { useEffect, useRef, useState } from 'react';
import { LucideIcon } from 'lucide-react';

interface CountUpStatProps {
  icon: LucideIcon;
  value: string;
  label: string;
  duration?: number;
}

// Parse stat values like "10x", "99.9%", "30%", "24/7"
function parseStatValue(value: string): { 
  end: number; 
  decimals: number; 
  suffix: string;
} {
  // Handle special case like "24/7"
  if (value.includes('/')) {
    return { end: 24, decimals: 0, suffix: '/7' };
  }
  
  // Handle percentage like "99.9%"
  if (value.includes('%')) {
    const num = parseFloat(value.replace('%', ''));
    const decimals = value.includes('.') ? (value.split('.')[1]?.replace('%', '').length || 0) : 0;
    return { end: num, decimals, suffix: '%' };
  }
  
  // Handle multiplier like "10x"
  if (value.toLowerCase().includes('x')) {
    const num = parseFloat(value.replace(/x/i, ''));
    return { end: num, decimals: 0, suffix: 'x' };
  }
  
  // Default: just a number
  const num = parseFloat(value);
  return { end: num, decimals: 0, suffix: '' };
}

export function CountUpStat({ icon: Icon, value, label, duration = 1500 }: CountUpStatProps) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  const { end, decimals, suffix } = parseStatValue(value);

  // Intersection observer to trigger animation on view
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasStarted]);

  // Count-up animation
  useEffect(() => {
    if (!hasStarted) return;

    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth deceleration
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      const currentValue = end * easeOutQuart;
      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    requestAnimationFrame(animate);
  }, [hasStarted, end, duration]);

  const displayValue = `${count.toFixed(decimals)}${suffix}`;

  return (
    <div ref={ref} className="text-center group">
      <Icon className="h-10 w-10 text-white mx-auto mb-3 group-hover:scale-110 transition-transform duration-300" />
      <div className="text-4xl sm:text-5xl font-black text-[#E88A2D] mb-1 tabular-nums">
        {displayValue}
      </div>
      <div className="text-white/80 font-medium">{label}</div>
    </div>
  );
}
