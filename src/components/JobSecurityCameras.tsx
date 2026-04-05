import { useEffect, useState } from "react";
import { Camera, ExternalLink, Loader2, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface JobSecurityCamerasProps {
  companyId?: string | null;
  jobId: string;
  canManage?: boolean;
}

interface CameraMapping {
  id: string;
  provider: string;
  camera_name: string;
  camera_external_id: string | null;
  location_label: string | null;
  provider_camera_url: string | null;
  stream_url: string | null;
  access_notes: string | null;
}

export default function JobSecurityCameras({ companyId, jobId, canManage = false }: JobSecurityCamerasProps) {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [mappings, setMappings] = useState<CameraMapping[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!companyId || !jobId) return;

      try {
        setLoading(true);
        const [{ data: integration }, { data: mappingRows }] = await Promise.all([
          (supabase as any)
            .from("company_eagle_eye_integrations")
            .select("connection_status")
            .eq("company_id", companyId)
            .maybeSingle(),
          (supabase as any)
            .from("job_security_camera_mappings")
            .select("id, provider, camera_name, camera_external_id, location_label, provider_camera_url, stream_url, access_notes")
            .eq("company_id", companyId)
            .eq("job_id", jobId)
            .eq("is_active", true)
            .order("camera_name", { ascending: true }),
        ]);

        setConnected(String(integration?.connection_status || "") === "connected" || (mappingRows || []).length > 0);
        setMappings((mappingRows || []) as CameraMapping[]);
      } catch (error) {
        console.error("Error loading security cameras:", error);
        setConnected(false);
        setMappings([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [companyId, jobId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="loading-dots">Loading cameras</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Cameras
          </CardTitle>
          <CardDescription>
            View the cameras, NVR links, or stream entries mapped to this job.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant={connected ? "default" : "outline"}>
            {connected ? "Camera System Ready" : "Not Connected"}
          </Badge>
          <Badge variant="outline">
            {mappings.length} mapped camera{mappings.length === 1 ? "" : "s"}
          </Badge>
          {canManage ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = "/settings/company?tab=integrations";
              }}
            >
              Manage In Integrations
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {!connected ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Add a camera system in Company Settings before camera feeds or NVR links can be mapped to this job.
          </CardContent>
        </Card>
      ) : mappings.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            No cameras are mapped to this job yet. Use Company Settings &gt; Integrations &gt; Security Cameras to add job camera mappings.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {mappings.map((mapping) => (
            <Card key={mapping.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex aspect-video items-center justify-center bg-muted/40 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Camera className="h-8 w-8" />
                    <div className="text-xs uppercase tracking-[0.18em]">Live Feed Placeholder</div>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <div className="font-medium">{mapping.camera_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[mapping.provider.replace(/_/g, " "), mapping.location_label, mapping.camera_external_id].filter(Boolean).join(" • ") || "Mapped camera"}
                    </div>
                  </div>
                  {mapping.access_notes ? (
                    <div className="text-xs text-muted-foreground">
                      {mapping.access_notes}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={!mapping.stream_url}>
                      {mapping.stream_url ? "Open Stream" : "Stream Unavailable"}
                    </Button>
                    {mapping.provider_camera_url ? (
                      <Button asChild variant="ghost" size="sm">
                        <a href={mapping.provider_camera_url} target="_blank" rel="noreferrer">
                          Open Camera
                          <ExternalLink className="ml-1 h-3.5 w-3.5" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
