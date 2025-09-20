import { useState, useEffect } from 'react';
import { VendorViewType } from '@/components/VendorViewSelector';
import { useSettings } from '@/contexts/SettingsContext';

export function useVendorViewPreference() {
  const { settings } = useSettings();
  const [currentView, setCurrentView] = useState<VendorViewType>(() => {
    const saved = localStorage.getItem('vendor-view-preference');
    return (saved as VendorViewType) || settings.defaultView || 'tiles';
  });

  useEffect(() => {
    localStorage.setItem('vendor-view-preference', currentView);
  }, [currentView]);

  return { currentView, setCurrentView };
}