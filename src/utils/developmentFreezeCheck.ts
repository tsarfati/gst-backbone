// Utility for checking development freeze status before making AI changes
export function checkDevelopmentFreeze(path: string): { isFrozen: boolean; message?: string } {
  try {
    const stored = localStorage.getItem('developmentFreeze');
    if (!stored) return { isFrozen: false };

    const pageLocks = JSON.parse(stored);
    const lock = pageLocks.find((lock: any) => lock.path === path && lock.isLocked);
    
    if (lock) {
      const message = `This page is currently frozen for development changes. ${
        lock.lockedBy ? `Locked by ${lock.lockedBy}` : ''
      }${
        lock.lockedAt ? ` on ${new Date(lock.lockedAt).toLocaleDateString()}` : ''
      }. Please unfreeze this page in Security Settings > Development Freeze before making changes.`;
      
      return { isFrozen: true, message };
    }
    
    return { isFrozen: false };
  } catch (error) {
    console.error('Error checking development freeze:', error);
    return { isFrozen: false };
  }
}

export function getCurrentPageFreezeStatus(): { isFrozen: boolean; message?: string } {
  return checkDevelopmentFreeze(window.location.pathname);
}