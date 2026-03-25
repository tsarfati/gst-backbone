import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { toast } from '@/hooks/use-toast';
import type { AvatarLibraryCategory, CustomAvatarEntry } from '@/components/avatarLibrary';
export interface AppSettings {
  navigationMode: 'single' | 'multiple';
  theme: 'light' | 'dark' | 'system';
  themeVariant: 'builderlynk' | 'slate' | 'forest' | 'sunset' | 'mono' | 'macos' | 'android';
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeZone: string;
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
  sidebarHighlightOpacity: number;
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
    sidebarBackground: string;
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
  avatarLibrary?: {
    enabledCategories: AvatarLibraryCategory[];
    enabledSystemLibraryIds?: string[];
    customAvatars: CustomAvatarEntry[];
  };
}

const defaultSettings: AppSettings = {
  navigationMode: 'multiple',
  theme: 'system',
  themeVariant: 'builderlynk',
  dateFormat: 'MM/DD/YYYY',
  timeZone: 'America/New_York',
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
  sidebarHighlightOpacity: 0.14,
  customColors: {
    primary: '210 100% 45%',
    secondary: '210 17% 95%',
    accent: '210 17% 93%',
    success: '120 60% 45%',
    warning: '38 100% 55%',
    destructive: '0 84% 60%',
    buttonHover: '210 100% 40%',
    sidebarBackground: '210 52% 20%',
  },
  avatarLibrary: {
    enabledCategories: ['nintendo', 'generic', 'sports', 'construction'],
    enabledSystemLibraryIds: [],
    customAvatars: [],
  },
};

interface SettingsContextType {
  settings: AppSettings;
  loading: boolean;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => Promise<void>;
  applyCustomColors: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { currentCompany, userCompanies } = useCompany();
  const { user, profile } = useAuth();
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null);
  const [companyDefaults, setCompanyDefaults] = useState<Partial<AppSettings> | null>(null);
  // Prevent saving settings for a newly-selected company before we've actually loaded that company's settings.
  // (Otherwise we can accidentally persist the previous company's colors into the new company.)
  const loadedScopeKeyRef = useRef<string | null>(null);

  const currentScopeKey = useMemo(() => {
    if (!currentCompany?.id || !user?.id) return null;
    return `${currentCompany.id}:${user.id}`;
  }, [currentCompany?.id, user?.id]);
  const latestSettingsRef = useRef<AppSettings>(defaultSettings);
  const latestCompanyIdRef = useRef<string | null>(null);
  const latestUserIdRef = useRef<string | null>(null);
  const latestLoadedScopeKeyRef = useRef<string | null>(null);
  const latestCurrentScopeKeyRef = useRef<string | null>(null);
  const latestIsLoadedRef = useRef(false);
  const latestIsCompanyAdminRoleRef = useRef(false);
  const isLogoutInProgress = () => {
    try {
      return window.localStorage.getItem('builderlynk_logout_in_progress') === '1';
    } catch {
      return false;
    }
  };

  // Get the user's role for the CURRENT company from user_company_access
  const activeCompanyRole = useMemo(() => {
    const companyId = currentCompany?.id ?? profile?.current_company_id ?? null;
    if (!companyId) return null;
    const access = userCompanies.find((uc) => uc.company_id === companyId);
    return access?.role ?? null;
  }, [currentCompany?.id, profile?.current_company_id, userCompanies]);

  const isCompanyAdminRole = useMemo(() => {
    const scopedRole = (activeCompanyRole || '').toLowerCase();
    const profileRole = String(profile?.role || '').toLowerCase();
    return (
      scopedRole === 'super_admin' ||
      scopedRole === 'admin' ||
      scopedRole === 'company_admin' ||
      scopedRole === 'controller' ||
      scopedRole === 'owner' ||
      profileRole === 'super_admin' ||
      profileRole === 'design_professional'
    );
  }, [activeCompanyRole, profile?.role]);

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
  const mergeMissingSettings = (
    base: Partial<AppSettings> | null | undefined,
    fallback: Partial<AppSettings> | null | undefined,
  ): Partial<AppSettings> | null => {
    if (!base && !fallback) return null;
    if (!base) return fallback || null;
    if (!fallback) return base;

    return {
      ...fallback,
      ...base,
      customColors: {
        ...((fallback.customColors as Partial<AppSettings['customColors']>) || {}),
        ...((base.customColors as Partial<AppSettings['customColors']>) || {}),
      },
      notifications: {
        ...((fallback.notifications as Partial<AppSettings['notifications']>) || {}),
        ...((base.notifications as Partial<AppSettings['notifications']>) || {}),
      },
      companySettings: {
        ...((fallback.companySettings as AppSettings['companySettings']) || {}),
        ...((base.companySettings as AppSettings['companySettings']) || {}),
      },
      avatarLibrary: {
        ...((fallback.avatarLibrary as AppSettings['avatarLibrary']) || {}),
        ...((base.avatarLibrary as AppSettings['avatarLibrary']) || {}),
      },
    };
  };
  const applyColorVarsToRoot = (colors: AppSettings['customColors']) => {
    const root = document.documentElement;
    Object.entries(colors).forEach(([key, value]) => {
      const hsl = toHslToken(value as string);
      root.style.setProperty(`--${key}`, hsl);
    });
    // Keep CSS token used by sidebar components in sync immediately (prevents first-paint flash).
    root.style.setProperty('--sidebar-background', toHslToken(colors.sidebarBackground || defaultSettings.customColors.sidebarBackground));
  };

  // Load settings from database when company or user changes
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoaded(false);
      loadedScopeKeyRef.current = null;
      setLoadedScopeKey(null);
      // Clear company defaults immediately when company changes to prevent stale colors
      setCompanyDefaults(null);

      let didLoadFromDb = false;

      if (!currentCompany?.id || !user?.id) {
        // No scope → reset to defaults and REMOVE custom properties so CSS root variables take over
        setSettings(defaultSettings);
        const root = document.documentElement;
        // Remove custom color overrides so the base CSS variables from index.css apply
        ['primary', 'secondary', 'accent', 'success', 'warning', 'destructive', 'buttonHover', 'sidebarBackground'].forEach((key) => {
          root.style.removeProperty(`--${key}`);
        });
        root.style.removeProperty('--sidebar-background');
        root.style.removeProperty('--sidebar-highlight-opacity');
        setIsLoaded(true);
        loadedScopeKeyRef.current = null;
        setLoadedScopeKey(null);
        return;
      }

      const cacheKey = `ui_settings_cache_company_${currentCompany.id}`;

      // Hydrate from cache immediately to minimize flash - but ONLY for the correct company
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as Partial<AppSettings>;
          const mergedCached = {
            ...defaultSettings,
            ...cached,
            customColors: {
              ...defaultSettings.customColors,
              ...(cached.customColors || {}),
            },
          } as AppSettings;
          setSettings(mergedCached);
          const colors = mergedCached.customColors || defaultSettings.customColors;
          applyColorVarsToRoot(colors);
        } catch (_) {
          // ignore cache parse errors - apply defaults
          applyColorVarsToRoot(defaultSettings.customColors);
        }
      } else {
        // No cache for this company - reset to defaults immediately to clear previous company colors
        applyColorVarsToRoot(defaultSettings.customColors);
      }

      try {
        // Always resolve company theme/settings through the server-side resolver so all
        // users in the company receive the same merged result, including legacy admin rows.
        let companySettings: Partial<AppSettings> | null = null;

        const { data: rpcTheme } = await supabase.rpc('get_company_theme_defaults', {
          _company_id: currentCompany.id
        });
        if (rpcTheme) {
          companySettings = rpcTheme as Partial<AppSettings>;
        }

        // Safety fallback if the RPC is unavailable in a local/dev environment.
        if (!companySettings) {
          const companyResp = await supabase
            .from('company_ui_settings')
            .select('settings')
            .eq('company_id', currentCompany.id)
            .is('user_id', null)
            .order('updated_at', { ascending: false })
            .limit(1);

          companySettings = ((companyResp?.data?.[0] as any)?.settings || null) as Partial<AppSettings> | null;
        }

        setCompanyDefaults(companySettings);

        const merged = {
          ...defaultSettings,
          ...(companySettings || {}),
          customColors: {
            ...defaultSettings.customColors,
            ...((companySettings as any)?.customColors || {}),
          },
        } as AppSettings;
        setSettings(merged);

        // Apply effective colors: enforce company colors for ALL users when company colors exist
        const effectiveColors = companySettings?.customColors
          ? ({
              ...defaultSettings.customColors,
              ...(companySettings.customColors as Partial<AppSettings['customColors']>),
            } as AppSettings['customColors'])
          : (merged.customColors || defaultSettings.customColors);

        applyColorVarsToRoot(effectiveColors);

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
        // Mark the current scope as finished loading to prevent first-paint flashes
        // when switching from no-company scope to company scope.
        setLoadedScopeKey(currentScopeKey);
      }
    };

    loadSettings();
  }, [currentCompany?.id, user?.id, activeCompanyRole]);

  const settingsLoadingForScope = !isLoaded || (currentScopeKey !== null && loadedScopeKey !== currentScopeKey);

  useEffect(() => {
    latestSettingsRef.current = settings;
    latestCompanyIdRef.current = currentCompany?.id ?? null;
    latestUserIdRef.current = user?.id ?? null;
    latestLoadedScopeKeyRef.current = loadedScopeKeyRef.current;
    latestCurrentScopeKeyRef.current = currentScopeKey;
    latestIsLoadedRef.current = isLoaded;
    latestIsCompanyAdminRoleRef.current = isCompanyAdminRole;
  }, [settings, currentCompany?.id, user?.id, currentScopeKey, isLoaded, isCompanyAdminRole]);

  const persistCompanySettings = useCallback(async (settingsToPersist: AppSettings) => {
    const companyId = latestCompanyIdRef.current;
    const userId = latestUserIdRef.current;

    if (!companyId || !userId || !latestIsLoadedRef.current) return;
    if (!latestCurrentScopeKeyRef.current || latestLoadedScopeKeyRef.current !== latestCurrentScopeKeyRef.current) return;
    if (!latestIsCompanyAdminRoleRef.current) return;
    if (isLogoutInProgress()) return;

    const companySettingsForStorage: Partial<AppSettings> = {
      navigationMode: settingsToPersist.navigationMode,
      theme: settingsToPersist.theme,
      themeVariant: settingsToPersist.themeVariant,
      dateFormat: settingsToPersist.dateFormat,
      timeZone: settingsToPersist.timeZone,
      currencyFormat: settingsToPersist.currencyFormat,
      distanceUnit: settingsToPersist.distanceUnit,
      defaultView: settingsToPersist.defaultView,
      itemsPerPage: settingsToPersist.itemsPerPage,
      notifications: settingsToPersist.notifications,
      autoSave: settingsToPersist.autoSave,
      compactMode: settingsToPersist.compactMode,
      sidebarHighlightOpacity: settingsToPersist.sidebarHighlightOpacity,
      customLogo: settingsToPersist.customLogo,
      dashboardBanner: settingsToPersist.dashboardBanner,
      customColors: settingsToPersist.customColors,
      companyLogo: settingsToPersist.companyLogo,
      headerLogo: settingsToPersist.headerLogo,
      companySettings: settingsToPersist.companySettings,
      avatarLibrary: settingsToPersist.avatarLibrary,
    };

    const { data: existingCompanyRow } = await supabase
      .from('company_ui_settings')
      .select('id')
      .eq('company_id', companyId)
      .is('user_id', null)
      .maybeSingle();

    if (existingCompanyRow?.id) {
      const { error } = await supabase
        .from('company_ui_settings')
        .update({ settings: companySettingsForStorage as any })
        .eq('id', existingCompanyRow.id);
      if (error) {
        console.warn('Failed to update company default theme settings:', error);
        toast({
          title: 'Settings not saved',
          description: error.message || 'The company settings could not be saved.',
          variant: 'destructive',
        });
      }
    } else {
      const { error } = await supabase
        .from('company_ui_settings')
        .insert({
          company_id: companyId,
          user_id: null as any,
          settings: companySettingsForStorage as any,
        } as any);
      if (error) {
        console.warn('Failed to insert company default theme settings:', error);
        toast({
          title: 'Settings not saved',
          description: error.message || 'The company settings could not be saved.',
          variant: 'destructive',
        });
      }
    }

    const cacheKey = `ui_settings_cache_company_${companyId}`;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(companySettingsForStorage));
    } catch (_) {
      // ignore cache failures
    }
  }, []);

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

        // Theme & appearance should only persist at the company level.
        // Non-admins should not write company appearance settings.
        if (!isCompanyAdminRole) {
          return;
        }

        await persistCompanySettings(settings);
      } catch (error) {
        console.warn('Error saving settings:', error);
      }
    };

    // Debounce saving to avoid too many requests - increase to 1 second
    const timeoutId = setTimeout(saveSettings, 1000);
    return () => {
      clearTimeout(timeoutId);
      // Flush the last pending company-level save on scope change/unmount so switching companies
      // does not silently drop a just-made settings change.
      if (!isLogoutInProgress()) {
        void persistCompanySettings(settings);
      }
    };
  }, [settings, currentCompany?.id, user?.id, isLoaded, activeCompanyRole, currentScopeKey, persistCompanySettings]);


  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({
      ...prev,
      ...updates,
      // Handle nested notification updates
      notifications: updates.notifications 
        ? { ...prev.notifications, ...updates.notifications }
        : prev.notifications,
      // Non-admin users inherit company colors; admins can edit and preview colors live.
      customColors: (() => {
        if (updates.customColors) {
          return { ...prev.customColors, ...updates.customColors };
        }
        if (!isCompanyAdminRole && companyDefaults?.customColors) {
          return {
            ...prev.customColors,
            ...(companyDefaults.customColors as AppSettings['customColors']),
          };
        }
        return prev.customColors;
      })(),
      avatarLibrary: updates.avatarLibrary
        ? {
            ...prev.avatarLibrary,
            ...updates.avatarLibrary,
            enabledCategories: updates.avatarLibrary.enabledCategories ?? prev.avatarLibrary?.enabledCategories ?? defaultSettings.avatarLibrary!.enabledCategories,
            enabledSystemLibraryIds: updates.avatarLibrary.enabledSystemLibraryIds ?? prev.avatarLibrary?.enabledSystemLibraryIds ?? defaultSettings.avatarLibrary!.enabledSystemLibraryIds,
            customAvatars: updates.avatarLibrary.customAvatars ?? prev.avatarLibrary?.customAvatars ?? defaultSettings.avatarLibrary!.customAvatars,
          }
        : prev.avatarLibrary,
    }));
  };


  const applyCustomColors = () => {
    const root = document.documentElement;

    // Admins should see their in-progress edits live; non-admins inherit company colors.
    const effectiveColors = isCompanyAdminRole
      ? ({
          ...defaultSettings.customColors,
          ...settings.customColors,
        } as AppSettings['customColors'])
      : companyDefaults?.customColors
        ? ({
            ...defaultSettings.customColors,
            ...(companyDefaults.customColors as Partial<AppSettings['customColors']>),
          } as AppSettings['customColors'])
        : ({
            ...defaultSettings.customColors,
            ...settings.customColors,
          } as AppSettings['customColors']);

    const effectiveSidebarHighlightOpacity = isCompanyAdminRole
      ? (settings.sidebarHighlightOpacity ?? defaultSettings.sidebarHighlightOpacity)
      : (companyDefaults?.sidebarHighlightOpacity ?? settings.sidebarHighlightOpacity ?? defaultSettings.sidebarHighlightOpacity);

    Object.entries(effectiveColors).forEach(([key, value]) => {
      const hsl = toHslToken(value as string);
      root.style.setProperty(`--${key}`, hsl);
    });
    // Ensure hover var is set explicitly as well
    root.style.setProperty('--buttonHover', toHslToken(effectiveColors.buttonHover));
    root.style.setProperty('--sidebar-background', toHslToken(effectiveColors.sidebarBackground || defaultSettings.customColors.sidebarBackground));
    root.style.setProperty('--sidebar-highlight-opacity', `${effectiveSidebarHighlightOpacity}`);
  };

  const resetSettings = async () => {
    if (!currentCompany?.id || !user?.id) return;
    
    const resetTarget = !isCompanyAdminRole && companyDefaults
      ? {
          ...defaultSettings,
          ...companyDefaults,
          customColors: {
            ...defaultSettings.customColors,
            ...((companyDefaults as any)?.customColors || {}),
          },
        } as AppSettings
      : defaultSettings;

    setSettings(resetTarget);
    applyCustomColors();
    
    try {
      if (isCompanyAdminRole) {
        await persistCompanySettings(resetTarget);
        setCompanyDefaults(resetTarget);
        return;
      }
    } catch (error) {
      console.warn('Error resetting settings:', error);
    }
  };

  // Apply custom colors when settings change or when loaded
  useEffect(() => {
    if (isLoaded) {
      applyCustomColors();
    }
  }, [settings.customColors, settings.themeVariant, settings.sidebarHighlightOpacity, companyDefaults, isCompanyAdminRole, isLoaded]);

  // Apply light/dark/system theme immediately from settings
  useEffect(() => {
    if (!isLoaded) return;
    setTheme(settings.theme);
  }, [settings.theme, setTheme, isLoaded]);

  // Keep base BuilderLYNK style + compact mode classes globally
  useEffect(() => {
    if (!isLoaded) return;
    const root = document.documentElement;
    const variantClasses = [
      'theme-variant-builderlynk',
      'theme-variant-slate',
      'theme-variant-forest',
      'theme-variant-sunset',
      'theme-variant-mono',
      'theme-variant-macos',
      'theme-variant-android',
    ];
    root.classList.remove(...variantClasses);
    root.classList.add(`theme-variant-${settings.themeVariant || 'builderlynk'}`);
    root.classList.toggle('compact-mode', !!settings.compactMode);
  }, [settings.compactMode, settings.themeVariant, isLoaded]);

  return (
    <SettingsContext.Provider value={{ settings, loading: settingsLoadingForScope, updateSettings, resetSettings, applyCustomColors }}>
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
