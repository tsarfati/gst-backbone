import { useState, useEffect } from 'react';

export type ViewType = 'grid' | 'list' | 'compact';

interface ViewPreference {
  currentView: ViewType;
  defaultView: ViewType;
}

export function useViewPreference(storageKey: string, initialView: ViewType = 'grid') {
  const [viewPreference, setViewPreference] = useState<ViewPreference>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          currentView: parsed.currentView || initialView,
          defaultView: parsed.defaultView || initialView
        };
      } catch {
        return { currentView: initialView, defaultView: initialView };
      }
    }
    return { currentView: initialView, defaultView: initialView };
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(viewPreference));
  }, [viewPreference, storageKey]);

  const setCurrentView = (view: ViewType) => {
    setViewPreference(prev => ({ ...prev, currentView: view }));
  };

  const setDefaultView = () => {
    setViewPreference(prev => ({ 
      ...prev, 
      defaultView: prev.currentView 
    }));
  };

  const resetToDefault = () => {
    setViewPreference(prev => ({ 
      ...prev, 
      currentView: prev.defaultView 
    }));
  };

  return {
    currentView: viewPreference.currentView,
    defaultView: viewPreference.defaultView,
    isDefault: viewPreference.currentView === viewPreference.defaultView,
    setCurrentView,
    setDefaultView,
    resetToDefault
  };
}