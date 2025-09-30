import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';

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
    billReminders: boolean;
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
    billReminders: true,
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
  resetSettings: () => Promise<void>;
  applyCustomColors: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  const hexToHsl = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  const toHslToken = (val: string) => (val?.trim().startsWith('#') ? hexToHsl(val.trim()) : val?.trim());

  // Load settings from database when company or user changes
  useEffect(() => {
    const loadSettings = async () => {
      // Reset loaded state to prevent saving old settings during switch
      setIsLoaded(false);
      
      if (!currentCompany?.id || !user?.id) {
        setSettings(defaultSettings);
        // Apply default colors
        const root = document.documentElement;
        Object.entries(defaultSettings.customColors).forEach(([key, value]) => {
          const hsl = toHslToken(value);
          root.style.setProperty(`--${key}`, hsl);
        });
        setIsLoaded(true);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('company_ui_settings')
          .select('settings')
          .eq('company_id', currentCompany.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.warn('Failed to load company settings:', error);
          setSettings(defaultSettings);
          // Apply default colors on error
          const root = document.documentElement;
          Object.entries(defaultSettings.customColors).forEach(([key, value]) => {
            const hsl = toHslToken(value);
            root.style.setProperty(`--${key}`, hsl);
          });
        } else if (data?.settings && typeof data.settings === 'object') {
          const mergedSettings = { ...defaultSettings, ...(data.settings as Partial<AppSettings>) };
          setSettings(mergedSettings);
          // Apply colors immediately after loading
          const root = document.documentElement;
          const colors = mergedSettings.customColors || defaultSettings.customColors;
          Object.entries(colors).forEach(([key, value]) => {
            const hsl = toHslToken(value);
            root.style.setProperty(`--${key}`, hsl);
          });
        } else {
          setSettings(defaultSettings);
          // Apply default colors
          const root = document.documentElement;
          Object.entries(defaultSettings.customColors).forEach(([key, value]) => {
            const hsl = toHslToken(value);
            root.style.setProperty(`--${key}`, hsl);
          });
        }
      } catch (error) {
        console.warn('Error loading settings:', error);
        setSettings(defaultSettings);
        // Apply default colors on error
        const root = document.documentElement;
        Object.entries(defaultSettings.customColors).forEach(([key, value]) => {
          const hsl = toHslToken(value);
          root.style.setProperty(`--${key}`, hsl);
        });
      } finally {
        setIsLoaded(true);
      }
    };

    loadSettings();
  }, [currentCompany?.id, user?.id]);

  // Save settings to database
  useEffect(() => {
    const saveSettings = async () => {
      if (!currentCompany?.id || !user?.id || !isLoaded) {
        return;
      }

      try {
        // Remove large data before saving
        const settingsForStorage = { ...settings };
        if (settingsForStorage.companyLogo?.startsWith('data:')) {
          delete settingsForStorage.companyLogo;
        }
        if (settingsForStorage.headerLogo?.startsWith('data:')) {
          delete settingsForStorage.headerLogo;
        }

        const { error } = await supabase
          .from('company_ui_settings')
          .upsert({
            company_id: currentCompany.id,
            user_id: user.id,
            settings: settingsForStorage
          }, {
            onConflict: 'company_id,user_id'
          });

        if (error) {
          console.warn('Failed to save settings:', error);
        }
      } catch (error) {
        console.warn('Error saving settings:', error);
      }
    };

    // Debounce saving to avoid too many requests
    const timeoutId = setTimeout(saveSettings, 500);
    return () => clearTimeout(timeoutId);
  }, [settings, currentCompany?.id, user?.id, isLoaded]);


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
      const hsl = toHslToken(value as string);
      root.style.setProperty(`--${key}`, hsl);
    });
    // Ensure hover var is set explicitly as well
    root.style.setProperty('--buttonHover', toHslToken(settings.customColors.buttonHover));
  };

  const resetSettings = async () => {
    if (!currentCompany?.id || !user?.id) return;
    
    setSettings(defaultSettings);
    applyCustomColors();
    
    try {
      await supabase
        .from('company_ui_settings')
        .delete()
        .eq('company_id', currentCompany.id)
        .eq('user_id', user.id);
    } catch (error) {
      console.warn('Error resetting settings:', error);
    }
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