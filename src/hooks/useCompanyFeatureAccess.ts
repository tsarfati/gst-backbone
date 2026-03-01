import { useCallback } from "react";

export function useCompanyFeatureAccess(_features: string[]) {
  const hasFeature = useCallback((_feature: string) => {
    // All features enabled by default
    return true;
  }, []);

  return { hasFeature };
}
