import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { PayablesViewType } from '@/components/PayablesViewSelector';

export function usePayablesViewPreference(pageKey: 'bills' | 'subcontracts' | 'purchase_orders') {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [currentView, setCurrentView] = useState<PayablesViewType>('list');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    loadViewPreference();
  }, [user, currentCompany, pageKey]);

  const loadViewPreference = async () => {
    if (!user || !currentCompany) return;

    try {
      const { data, error } = await supabase
        .from('company_ui_settings')
        .select('settings')
        .eq('user_id', user.id)
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (error) throw error;

      if (data?.settings) {
        const viewKey = `${pageKey}_view`;
        const defaultKey = `${pageKey}_view_default`;
        
        if (data.settings[viewKey]) {
          setCurrentView(data.settings[viewKey] as PayablesViewType);
        }
        
        if (data.settings[defaultKey]) {
          setIsDefault(data.settings[defaultKey] === data.settings[viewKey]);
        }
      }
    } catch (error) {
      console.error('Error loading view preference:', error);
    }
  };

  const saveViewPreference = async (view: PayablesViewType) => {
    if (!user || !currentCompany) return;

    try {
      const viewKey = `${pageKey}_view`;
      
      const { data: existing } = await supabase
        .from('company_ui_settings')
        .select('settings')
        .eq('user_id', user.id)
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      const newSettings = {
        ...((existing?.settings as Record<string, any>) || {}),
        [viewKey]: view
      };

      const { error } = await supabase
        .from('company_ui_settings')
        .upsert({
          user_id: user.id,
          company_id: currentCompany.id,
          settings: newSettings
        }, {
          onConflict: 'user_id,company_id'
        });

      if (error) throw error;

      setCurrentView(view);
    } catch (error) {
      console.error('Error saving view preference:', error);
    }
  };

  const setAsDefault = async () => {
    if (!user || !currentCompany) return;

    try {
      const viewKey = `${pageKey}_view`;
      const defaultKey = `${pageKey}_view_default`;

      const { data: existing } = await supabase
        .from('company_ui_settings')
        .select('settings')
        .eq('user_id', user.id)
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      const newSettings = {
        ...((existing?.settings as Record<string, any>) || {}),
        [defaultKey]: currentView
      };

      const { error } = await supabase
        .from('company_ui_settings')
        .upsert({
          user_id: user.id,
          company_id: currentCompany.id,
          settings: newSettings
        }, {
          onConflict: 'user_id,company_id'
        });

      if (error) throw error;

      setIsDefault(true);
    } catch (error) {
      console.error('Error setting default view:', error);
    }
  };

  return {
    currentView,
    setCurrentView: saveViewPreference,
    setAsDefault,
    isDefault
  };
}
