import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useTenant } from '@/contexts/TenantContext';

interface TierNavigationSettings {
  showLockedMenuItems: boolean;
  lockedMenuUpgradeMessage: string;
}

const DEFAULT_MESSAGE = 'You do not have access to this feature. Please upgrade your account or contact your account manager.';

export function useTierNavigationSettings() {
  const { currentCompany } = useCompany();
  const { isSuperAdmin } = useTenant();
  const [settings, setSettings] = useState<TierNavigationSettings>({
    showLockedMenuItems: false,
    lockedMenuUpgradeMessage: DEFAULT_MESSAGE,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (isSuperAdmin) {
        if (!active) return;
        setSettings({ showLockedMenuItems: false, lockedMenuUpgradeMessage: DEFAULT_MESSAGE });
        setLoading(false);
        return;
      }

      if (!currentCompany?.id) {
        if (!active) return;
        setSettings({ showLockedMenuItems: false, lockedMenuUpgradeMessage: DEFAULT_MESSAGE });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data: subscription, error: subscriptionError } = await supabase
          .from('company_subscriptions')
          .select('tier_id')
          .eq('company_id', currentCompany.id)
          .eq('status', 'active')
          .maybeSingle();

        if (subscriptionError) throw subscriptionError;
        if (!subscription?.tier_id) {
          if (!active) return;
          setSettings({ showLockedMenuItems: false, lockedMenuUpgradeMessage: DEFAULT_MESSAGE });
          return;
        }

        const { data: tierRow, error: tierError } = await supabase
          .from('subscription_tiers')
          .select('show_locked_menu_items, locked_menu_upgrade_message')
          .eq('id', subscription.tier_id)
          .maybeSingle();

        if (tierError) {
          const msg = String(tierError.message || '').toLowerCase();
          if (msg.includes('column') && msg.includes('show_locked_menu_items')) {
            if (!active) return;
            setSettings({ showLockedMenuItems: false, lockedMenuUpgradeMessage: DEFAULT_MESSAGE });
            return;
          }
          throw tierError;
        }

        if (!active) return;
        setSettings({
          showLockedMenuItems: !!(tierRow as any)?.show_locked_menu_items,
          lockedMenuUpgradeMessage: (tierRow as any)?.locked_menu_upgrade_message || DEFAULT_MESSAGE,
        });
      } catch (error) {
        console.error('useTierNavigationSettings: failed to load tier navigation settings', error);
        if (!active) return;
        setSettings({ showLockedMenuItems: false, lockedMenuUpgradeMessage: DEFAULT_MESSAGE });
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [currentCompany?.id, isSuperAdmin]);

  return { ...settings, loading };
}
