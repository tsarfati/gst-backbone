import JobSiteLynkIntegrationSettings from "@/components/JobSiteLynkIntegrationSettings";
import CameraSystemIntegrationSettings from "@/components/CameraSystemIntegrationSettings";

export default function CompanyIntegrationsOverview() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Integrations</h2>
      </div>

      <div className="flex flex-wrap gap-4">
        <JobSiteLynkIntegrationSettings showHeading={false} />
        <CameraSystemIntegrationSettings showHeading={false} />
      </div>
    </div>
  );
}
