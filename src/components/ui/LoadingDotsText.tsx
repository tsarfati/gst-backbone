import { useEffect, useState } from 'react';

interface LoadingDotsTextProps {
  label?: string;
  className?: string;
}

export default function LoadingDotsText({ label = 'Loading', className }: LoadingDotsTextProps) {
  const [dotCount, setDotCount] = useState(4);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDotCount((current) => (current >= 4 ? 1 : current + 1));
    }, 350);

    return () => window.clearInterval(timer);
  }, []);

  return <span className={className}>{label}{'.'.repeat(dotCount)}</span>;
}
