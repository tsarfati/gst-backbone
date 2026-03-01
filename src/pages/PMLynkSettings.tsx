import PMMobileSettings from '@/components/PMMobileSettings';
import { useCompanyFeatureAccess } from '@/hooks/useCompanyFeatureAccess';

export default function PMLynkSettings() {
  const { hasFeature } = useCompanyFeatureAccess(['pm_lynk']);

  if (!hasFeature('pm_lynk')) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-lg border bg-card p-6">
          <h1 className="text-2xl font-bold">PM Lynk Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            PM Lynk settings are not included in your current subscription tier. Enable PM Lynk Access in your tier to use this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PMMobileSettings />
    </div>
  );
}
