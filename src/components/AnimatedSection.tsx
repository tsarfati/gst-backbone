import { ReactNode } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { cn } from '@/lib/utils';

type AnimationType = 
  | 'fade-up' 
  | 'fade-down' 
  | 'fade-left' 
  | 'fade-right' 
  | 'zoom-in' 
  | 'zoom-out'
  | 'flip-up'
  | 'flip-left';

interface AnimatedSectionProps {
  children: ReactNode;
  animation?: AnimationType;
  delay?: number;
  duration?: number;
  className?: string;
  threshold?: number;
}

const animationStyles: Record<AnimationType, { hidden: string; visible: string }> = {
  'fade-up': {
    hidden: 'opacity-0 translate-y-12',
    visible: 'opacity-100 translate-y-0',
  },
  'fade-down': {
    hidden: 'opacity-0 -translate-y-12',
    visible: 'opacity-100 translate-y-0',
  },
  'fade-left': {
    hidden: 'opacity-0 translate-x-12',
    visible: 'opacity-100 translate-x-0',
  },
  'fade-right': {
    hidden: 'opacity-0 -translate-x-12',
    visible: 'opacity-100 translate-x-0',
  },
  'zoom-in': {
    hidden: 'opacity-0 scale-75',
    visible: 'opacity-100 scale-100',
  },
  'zoom-out': {
    hidden: 'opacity-0 scale-125',
    visible: 'opacity-100 scale-100',
  },
  'flip-up': {
    hidden: 'opacity-0 rotateX-90',
    visible: 'opacity-100 rotateX-0',
  },
  'flip-left': {
    hidden: 'opacity-0 rotateY-90',
    visible: 'opacity-100 rotateY-0',
  },
};

export function AnimatedSection({
  children,
  animation = 'fade-up',
  delay = 0,
  duration = 700,
  className,
  threshold = 0.1,
}: AnimatedSectionProps) {
  const { ref, isVisible } = useScrollAnimation<HTMLDivElement>({ threshold });
  const styles = animationStyles[animation];

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all ease-out',
        isVisible ? styles.visible : styles.hidden,
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function StaggeredChildren({
  children,
  animation = 'fade-up',
  staggerDelay = 100,
  className,
}: {
  children: ReactNode[];
  animation?: AnimationType;
  staggerDelay?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <AnimatedSection
          key={index}
          animation={animation}
          delay={index * staggerDelay}
        >
          {child}
        </AnimatedSection>
      ))}
    </div>
  );
}
