import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { PayablesViewType } from '@/components/PayablesViewSelector';
import { loadUserUiPreferences, saveUserUiPreferences } from '@/utils/userUiPreferences';

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
      const settings = await loadUserUiPreferences(user.id, currentCompany.id);
      const viewKey = `${pageKey}_view`;
      const defaultKey = `${pageKey}_view_default`;

      if (settings[viewKey]) {
        setCurrentView(settings[viewKey] as PayablesViewType);
      }

      if (settings[defaultKey]) {
        setIsDefault(settings[defaultKey] === settings[viewKey]);
      }
    } catch (error) {
      console.error('Error loading view preference:', error);
    }
  };

  const saveViewPreference = async (view: PayablesViewType) => {
    if (!user || !currentCompany) return;

    try {
      const viewKey = `${pageKey}_view`;
      await saveUserUiPreferences(user.id, currentCompany.id, { [viewKey]: view });

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
      await saveUserUiPreferences(user.id, currentCompany.id, {
        [viewKey]: currentView,
        [defaultKey]: currentView,
      });

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
