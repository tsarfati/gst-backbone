import { useState, useEffect } from 'react';
import { VendorViewType } from '@/components/VendorViewSelector';
import { useSettings } from '@/contexts/SettingsContext';

interface VendorViewPreference {
  currentView: VendorViewType;
  defaultView: VendorViewType;
}

export function useVendorViewPreference() {
  const { settings } = useSettings();
  const [viewPreference, setViewPreference] = useState<VendorViewPreference>(() => {
    const saved = localStorage.getItem('vendor-view-preference');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          currentView: (parsed.currentView as VendorViewType) || 'tiles',
          defaultView: (parsed.defaultView as VendorViewType) || 'tiles',
        };
      } catch {
        // fall through to defaults
      }
    }
    const legacyView = localStorage.getItem('vendor-view-preference');
    const defaultFallback = (settings.defaultView === 'list' || settings.defaultView === 'compact')
      ? (settings.defaultView as VendorViewType)
      : 'tiles';
    return {
      currentView: (legacyView as VendorViewType) || defaultFallback,
      defaultView: (legacyView as VendorViewType) || defaultFallback,
    };
  });

  useEffect(() => {
    localStorage.setItem('vendor-view-preference', JSON.stringify(viewPreference));
  }, [viewPreference]);

  const setCurrentView = (view: VendorViewType) => {
    setViewPreference((prev) => ({ ...prev, currentView: view }));
  };

  const setDefaultView = () => {
    setViewPreference((prev) => ({ ...prev, defaultView: prev.currentView }));
  };

  return {
    currentView: viewPreference.currentView,
    defaultView: viewPreference.defaultView,
    isDefault: viewPreference.currentView === viewPreference.defaultView,
    setCurrentView,
    setDefaultView,
  };
}
