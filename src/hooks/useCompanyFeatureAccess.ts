import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useTenant } from "@/contexts/TenantContext";

export function useCompanyFeatureAccess(features: string[] = []) {
  const { currentCompany } = useCompany();
  const { isSuperAdmin } = useTenant();
  const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const requestedFeatureKey = useMemo(
    () => features.slice().sort().join("|"),
    [features]
  );

  useEffect(() => {
    let mounted = true;

    const loadFeatures = async () => {
      // Super admins can access all modules regardless of subscription mapping.
      if (isSuperAdmin) {
        if (!mounted) return;
        setEnabledFeatures(new Set(["*"]));
        setLoading(false);
        return;
      }

      if (!currentCompany?.id) {
        if (!mounted) return;
        setEnabledFeatures(new Set());
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const { data: subscription, error: subscriptionError } = await supabase
          .from("company_subscriptions")
          .select("tier_id, status")
          .eq("company_id", currentCompany.id)
          .eq("status", "active")
          .maybeSingle();

        if (subscriptionError) throw subscriptionError;

        if (!subscription?.tier_id) {
          if (!mounted) return;
          setEnabledFeatures(new Set());
          return;
        }

        const { data: tierFeatures, error: featureError } = await supabase
          .from("tier_feature_access")
          .select("feature_modules(key)")
          .eq("tier_id", subscription.tier_id);

        if (featureError) throw featureError;

        const keys = new Set<string>();
        for (const row of tierFeatures || []) {
          const key = (row as any)?.feature_modules?.key as string | undefined;
          if (key) keys.add(key);
        }

        if (!mounted) return;
        setEnabledFeatures(keys);
      } catch (error) {
        console.error("useCompanyFeatureAccess: failed to load features", error);
        // Strict pass: fail closed on errors so restricted modules stay blocked.
        if (!mounted) return;
        setEnabledFeatures(new Set());
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadFeatures();
    return () => {
      mounted = false;
    };
  }, [currentCompany?.id, isSuperAdmin, requestedFeatureKey]);

  const hasFeature = useCallback(
    (feature: string) => {
      if (enabledFeatures.has("*")) return true;
      if (loading) return false;
      return enabledFeatures.has(feature);
    },
    [enabledFeatures, loading]
  );

  return { hasFeature, loading };
}
