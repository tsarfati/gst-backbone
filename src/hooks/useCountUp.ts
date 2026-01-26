import { useState, useEffect, useRef } from 'react';

interface UseCountUpOptions {
  end: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  startOnView?: boolean;
}

export function useCountUp({
  end,
  duration = 1500,
  decimals = 0,
  suffix = '',
  prefix = '',
  startOnView = true,
}: UseCountUpOptions) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true);
      return;
    }

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
  }, [startOnView, hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    const startTime = performance.now();
    const startValue = 0;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth deceleration
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      const currentValue = startValue + (end - startValue) * easeOutQuart;
      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    requestAnimationFrame(animate);
  }, [hasStarted, end, duration]);

  const formattedValue = `${prefix}${count.toFixed(decimals)}${suffix}`;

  return { ref, value: formattedValue, rawValue: count };
}

// Parse stat values like "10x", "99.9%", "30%", "24/7"
export function parseStatValue(value: string): { 
  end: number; 
  decimals: number; 
  suffix: string; 
  prefix: string;
  isSpecial?: boolean;
  specialValue?: string;
} {
  // Handle special case like "24/7"
  if (value.includes('/')) {
    return { end: 24, decimals: 0, suffix: '/7', prefix: '', isSpecial: false };
  }
  
  // Handle percentage like "99.9%"
  if (value.includes('%')) {
    const num = parseFloat(value.replace('%', ''));
    const decimals = value.includes('.') ? (value.split('.')[1]?.replace('%', '').length || 0) : 0;
    return { end: num, decimals, suffix: '%', prefix: '' };
  }
  
  // Handle multiplier like "10x"
  if (value.toLowerCase().includes('x')) {
    const num = parseFloat(value.replace(/x/i, ''));
    return { end: num, decimals: 0, suffix: 'x', prefix: '' };
  }
  
  // Default: just a number
  const num = parseFloat(value);
  return { end: num, decimals: 0, suffix: '', prefix: '' };
}
