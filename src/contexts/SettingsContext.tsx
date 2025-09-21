import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface AppSettings {
  navigationMode: 'single' | 'multiple';
  theme: 'light' | 'dark' | 'system';
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  currencyFormat: 'USD' | 'EUR' | 'GBP';
  defaultView: 'tiles' | 'list' | 'compact';
  itemsPerPage: 10 | 25 | 50 | 100;
  notifications: {
    email: boolean;
    push: boolean;
    receiptUploads: boolean;
    jobUpdates: boolean;
    invoiceReminders: boolean;
  };
  autoSave: boolean;
  compactMode: boolean;
  customLogo?: string;
  dashboardBanner?: string;
  customColors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    destructive: string;
    buttonHover: string;
  };
  companyLogo?: string;
  headerLogo?: string;
  companySettings?: {
    checkPickupLocations?: Array<{
      id: string;
      name: string;
      address: string;
      contactPerson?: string;
      phone?: string;
    }>;
  };
}

const defaultSettings: AppSettings = {
  navigationMode: 'multiple',
  theme: 'system',
  dateFormat: 'MM/DD/YYYY',
  currencyFormat: 'USD',
  defaultView: 'tiles',
  itemsPerPage: 25,
  notifications: {
    email: true,
    push: true,
    receiptUploads: true,
    jobUpdates: true,
    invoiceReminders: true,
  },
  autoSave: true,
  compactMode: false,
  customColors: {
    primary: '210 100% 45%',
    secondary: '210 17% 95%',
    accent: '210 17% 93%',
    success: '120 60% 45%',
    warning: '38 100% 55%',
    destructive: '0 84% 60%',
    buttonHover: '210 100% 40%',
  },
};

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
  applyCustomColors: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('app-settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  useEffect(() => {
    try {
      // Create a copy of settings without potentially large logo data for localStorage
      const settingsForStorage = { ...settings };
      // Remove logo data if it's base64 (starts with 'data:')
      if (settingsForStorage.companyLogo?.startsWith('data:')) {
        delete settingsForStorage.companyLogo;
      }
      if (settingsForStorage.headerLogo?.startsWith('data:')) {
        delete settingsForStorage.headerLogo;
      }
      
      localStorage.setItem('app-settings', JSON.stringify(settingsForStorage));
    } catch (error) {
      console.warn('Failed to save settings to localStorage:', error);
      // If localStorage is full, try to clear it and save essential settings only
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        try {
          localStorage.removeItem('app-settings');
          const essentialSettings = {
            theme: settings.theme,
            navigationMode: settings.navigationMode,
            customColors: settings.customColors
          };
          localStorage.setItem('app-settings', JSON.stringify(essentialSettings));
        } catch (fallbackError) {
          console.error('Failed to save even essential settings:', fallbackError);
        }
      }
    }
  }, [settings]);

  // Apply custom colors on mount
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(settings.customColors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  }, []);

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({
      ...prev,
      ...updates,
      // Handle nested notification updates
      notifications: updates.notifications 
        ? { ...prev.notifications, ...updates.notifications }
        : prev.notifications,
      // Handle nested color updates
      customColors: updates.customColors
        ? { ...prev.customColors, ...updates.customColors }
        : prev.customColors
    }));
  };

  const applyCustomColors = () => {
    const root = document.documentElement;
    Object.entries(settings.customColors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('app-settings');
    applyCustomColors();
  };

  // Apply custom colors when settings change
  useEffect(() => {
    applyCustomColors();
  }, [settings.customColors]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings, applyCustomColors }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}