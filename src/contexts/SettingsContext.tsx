import { createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
export interface AppSettings {
  navigationMode: 'single' | 'multiple';
  theme: 'light' | 'dark' | 'system';
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  currencyFormat: 'USD' | 'EUR' | 'GBP';
  distanceUnit: 'meters' | 'feet';
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
  distanceUnit: 'meters',
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
  const { currentCompany, userCompanies } = useCompany();
  const { user, profile } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);
  const [companyDefaults, setCompanyDefaults] = useState<Partial<AppSettings> | null>(null);
  // Prevent saving settings for a newly-selected company before we've actually loaded that company's settings.
  // (Otherwise we can accidentally persist the previous company's colors into the new company.)
  const loadedScopeKeyRef = useRef<string | null>(null);

  const currentScopeKey = useMemo(() => {
    if (!currentCompany?.id || !user?.id) return null;
    return `${currentCompany.id}:${user.id}`;
  }, [currentCompany?.id, user?.id]);

  // Get the user's role for the CURRENT company from user_company_access
  const activeCompanyRole = useMemo(() => {
    const companyId = currentCompany?.id ?? profile?.current_company_id ?? null;
    if (!companyId) return null;
    const access = userCompanies.find((uc) => uc.company_id === companyId);
    return access?.role ?? null;
  }, [currentCompany?.id, profile?.current_company_id, userCompanies]);

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
      setIsLoaded(false);
      loadedScopeKeyRef.current = null;
      // Clear company defaults immediately when company changes to prevent stale colors
      setCompanyDefaults(null);

      let didLoadFromDb = false;

      if (!currentCompany?.id || !user?.id) {
        // No scope → reset to defaults and REMOVE custom properties so CSS root variables take over
        setSettings(defaultSettings);
        const root = document.documentElement;
        // Remove custom color overrides so the base CSS variables from index.css apply
        ['primary', 'secondary', 'accent', 'success', 'warning', 'destructive', 'buttonHover'].forEach((key) => {
          root.style.removeProperty(`--${key}`);
        });
        setIsLoaded(true);
        loadedScopeKeyRef.current = null;
        return;
      }

      const cacheKey = `ui_settings_cache_${currentCompany.id}_${user.id}`;

      // Hydrate from cache immediately to minimize flash - but ONLY for the correct company
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as Partial<AppSettings>;
          const mergedCached = { ...defaultSettings, ...cached } as AppSettings;
          setSettings(mergedCached);
          const root = document.documentElement;
          const colors = mergedCached.customColors || defaultSettings.customColors;
          Object.entries(colors).forEach(([key, value]) => {
            const hsl = toHslToken(value as string);
            root.style.setProperty(`--${key}`, hsl);
          });
        } catch (_) {
          // ignore cache parse errors - apply defaults
          const root = document.documentElement;
          Object.entries(defaultSettings.customColors).forEach(([key, value]) => {
            const hsl = toHslToken(value as string);
            root.style.setProperty(`--${key}`, hsl);
          });
        }
      } else {
        // No cache for this company - reset to defaults immediately to clear previous company colors
        const root = document.documentElement;
        Object.entries(defaultSettings.customColors).forEach(([key, value]) => {
          const hsl = toHslToken(value as string);
          root.style.setProperty(`--${key}`, hsl);
        });
      }

      try {
        // Fetch company defaults and user-specific settings in parallel
        const [companyResp, userResp] = await Promise.all([
          supabase
            .from('company_ui_settings')
            .select('settings')
            .eq('company_id', currentCompany.id)
            .is('user_id', null)
            .order('updated_at', { ascending: false })
            .limit(1),
          supabase
            .from('company_ui_settings')
            .select('settings')
            .eq('company_id', currentCompany.id)
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(1)
        ]);

        let companySettings = ((companyResp?.data?.[0] as any)?.settings || null) as Partial<AppSettings> | null;
        const userSettings = ((userResp?.data?.[0] as any)?.settings || null) as Partial<AppSettings> | null;

        // Backward-compatible fallback:
        // Some companies only have admin/controller user-level theme settings saved (legacy),
        // but no shared company default (user_id IS NULL). In that case, inherit colors
        // from the most recent admin/controller user setting so non-admin users still get branding.
        if (!companySettings?.customColors) {
          const { data: allCompanyUiRows } = await supabase
            .from('company_ui_settings')
            .select('user_id, settings, updated_at')
            .eq('company_id', currentCompany.id)
            .not('user_id', 'is', null)
            .order('updated_at', { ascending: false })
            .limit(30);

          const settingUserIds = (allCompanyUiRows || [])
            .map((row: any) => row.user_id)
            .filter(Boolean);

          if (settingUserIds.length > 0) {
            const { data: accessRows } = await supabase
              .from('user_company_access')
              .select('user_id, role, is_active')
              .eq('company_id', currentCompany.id)
              .in('user_id', settingUserIds)
              .eq('is_active', true);

            const adminUserSet = new Set(
              (accessRows || [])
                .filter((row: any) => ['admin', 'company_admin', 'controller'].includes(String(row.role || '').toLowerCase()))
                .map((row: any) => row.user_id)
            );

          const fallbackAdminSettings = (allCompanyUiRows || [])
              .find((row: any) => adminUserSet.has(row.user_id) && (row?.settings as any)?.customColors)?.settings as any || null;

            if ((fallbackAdminSettings as any)?.customColors) {
              companySettings = {
                ...(companySettings || {}),
                customColors: (fallbackAdminSettings as any).customColors,
              };
            }
          }
        }

        setCompanyDefaults(companySettings);

        const merged = { ...defaultSettings, ...(companySettings || {}), ...(userSettings || {}) } as AppSettings;
        setSettings(merged);

        // Apply effective colors: enforce company colors for ALL users when company colors exist
        const effectiveColors = companySettings?.customColors
          ? (companySettings.customColors as AppSettings['customColors'])
          : (merged.customColors || defaultSettings.customColors);

        const root = document.documentElement;
        Object.entries(effectiveColors).forEach(([key, value]) => {
          const hsl = toHslToken(value as string);
          root.style.setProperty(`--${key}`, hsl);
        });

        // Refresh cache
        localStorage.setItem(cacheKey, JSON.stringify(merged));

        didLoadFromDb = true;
      } catch (error) {
        console.warn('Error loading settings:', error);
      } finally {
        setIsLoaded(true);
        // Only allow future saves once we've loaded this company's settings from DB.
        // If the fetch fails, keep writes blocked to avoid persisting stale/cached colors into the company.
        loadedScopeKeyRef.current = didLoadFromDb ? currentScopeKey : null;
      }
    };

    loadSettings();
  }, [currentCompany?.id, user?.id, activeCompanyRole]);

  // Save settings to database
  useEffect(() => {
    const saveSettings = async () => {
      // IMPORTANT: block writes during company switch until that company's settings have loaded.
      if (!currentCompany?.id || !user?.id || !isLoaded) {
        return;
      }

      if (!currentScopeKey || loadedScopeKeyRef.current !== currentScopeKey) {
        return;
      }

      try {
        // Remove large data before saving
        const settingsForStorage = { ...settings } as Partial<AppSettings> & Record<string, any>;
        if (settingsForStorage.companyLogo && typeof settingsForStorage.companyLogo === 'string' && settingsForStorage.companyLogo.startsWith('data:')) {
          delete settingsForStorage.companyLogo;
        }
        if (settingsForStorage.headerLogo && typeof settingsForStorage.headerLogo === 'string' && settingsForStorage.headerLogo.startsWith('data:')) {
          delete settingsForStorage.headerLogo;
        }

        const role = (activeCompanyRole || '').toLowerCase();
        const isCompanyAdmin = role === 'admin' || role === 'company_admin' || role === 'controller';

        // Enforce company-wide colors: non-admins cannot persist custom color overrides
        if (!isCompanyAdmin) {
          delete settingsForStorage.customColors;
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

        // If admin/company_admin, also persist company-wide defaults (user_id = null)
        // Use explicit check + insert/update since PostgreSQL UNIQUE treats NULL as distinct
        if (isCompanyAdmin) {
          const companySettingsForStorage: Partial<AppSettings> = {
            customColors: settings.customColors,
          };
          
          // Check if company-wide row exists
          const { data: existingCompanyRow } = await supabase
            .from('company_ui_settings')
            .select('id')
            .eq('company_id', currentCompany.id)
            .is('user_id', null)
            .maybeSingle();
          
          if (existingCompanyRow?.id) {
            // Update existing row
            await supabase
              .from('company_ui_settings')
              .update({ settings: companySettingsForStorage })
              .eq('id', existingCompanyRow.id);
          } else {
            // Insert new company-wide row
            await supabase
              .from('company_ui_settings')
              .insert({
                company_id: currentCompany.id,
                user_id: null,
                settings: companySettingsForStorage
              });
          }
        }

        if (error) {
          console.warn('Failed to save settings:', error);
        }
        // Update local cache optimistically
        const cacheKey = currentCompany ? `ui_settings_cache_${currentCompany.id}_${user.id}` : '';
        if (cacheKey) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(settingsForStorage));
          } catch (_) {}
        }
      } catch (error) {
        console.warn('Error saving settings:', error);
      }
    };

    // Debounce saving to avoid too many requests - increase to 1 second
    const timeoutId = setTimeout(saveSettings, 1000);
    return () => clearTimeout(timeoutId);
  }, [settings, currentCompany?.id, user?.id, isLoaded, activeCompanyRole, currentScopeKey]);


  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({
      ...prev,
      ...updates,
      // Handle nested notification updates
      notifications: updates.notifications 
        ? { ...prev.notifications, ...updates.notifications }
        : prev.notifications,
      // Company colors always take precedence when they exist
      customColors: companyDefaults?.customColors
        ? (companyDefaults.customColors as AppSettings['customColors'])
        : updates.customColors
          ? { ...prev.customColors, ...updates.customColors }
          : prev.customColors
    }));
  };


  const applyCustomColors = () => {
    const root = document.documentElement;
    // Always use company colors if they exist, regardless of role
    const effectiveColors = companyDefaults?.customColors
      ? (companyDefaults.customColors as AppSettings['customColors'])
      : settings.customColors;

    Object.entries(effectiveColors).forEach(([key, value]) => {
      const hsl = toHslToken(value as string);
      root.style.setProperty(`--${key}`, hsl);
    });
    // Ensure hover var is set explicitly as well
    root.style.setProperty('--buttonHover', toHslToken(effectiveColors.buttonHover));
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

  // Apply custom colors when settings change or when loaded
  useEffect(() => {
    if (isLoaded) {
      applyCustomColors();
    }
  }, [settings.customColors, companyDefaults, isLoaded]);

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
