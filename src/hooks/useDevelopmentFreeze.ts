import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface PageLock {
  id: string;
  name: string;
  path: string;
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: string;
}

export function useDevelopmentFreeze() {
  const [pageLocks, setPageLocks] = useState<PageLock[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const stored = localStorage.getItem('developmentFreeze');
    if (stored) {
      try {
        setPageLocks(JSON.parse(stored));
      } catch (error) {
        console.error('Failed to parse development freeze settings:', error);
      }
    }
    setIsLoaded(true);
  }, []);

  const isPageFrozen = (path: string): boolean => {
    if (!isLoaded) return false;
    
    const lock = pageLocks.find(lock => lock.path === path);
    return lock?.isLocked || false;
  };

  const isCurrentPageFrozen = (): boolean => {
    return isPageFrozen(location.pathname);
  };

  const getFrozenPageInfo = (path: string): PageLock | undefined => {
    return pageLocks.find(lock => lock.path === path && lock.isLocked);
  };

  const getCurrentPageFreezeInfo = (): PageLock | undefined => {
    return getFrozenPageInfo(location.pathname);
  };

  return {
    isPageFrozen,
    isCurrentPageFrozen,
    getFrozenPageInfo,
    getCurrentPageFreezeInfo,
    isLoaded
  };
}