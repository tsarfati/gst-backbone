import { useState, useEffect } from 'react';

export type ChartOfAccountsViewType = 'list' | 'compact' | 'super-compact';

interface ViewPreference {
  currentView: ChartOfAccountsViewType;
  defaultView: ChartOfAccountsViewType;
}

export function useChartOfAccountsViewPreference(initialView: ChartOfAccountsViewType = 'list') {
  const storageKey = 'chart-of-accounts-view-preference';
  
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
  }, [viewPreference]);

  const setCurrentView = (view: ChartOfAccountsViewType) => {
    setViewPreference(prev => ({ ...prev, currentView: view }));
  };

  const setDefaultView = () => {
    setViewPreference(prev => ({ 
      ...prev, 
      defaultView: prev.currentView 
    }));
  };

  return {
    currentView: viewPreference.currentView,
    defaultView: viewPreference.defaultView,
    isDefault: viewPreference.currentView === viewPreference.defaultView,
    setCurrentView,
    setDefaultView
  };
}
