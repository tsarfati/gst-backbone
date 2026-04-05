import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Plus, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import securityCameraIntegrationIcon from "@/assets/security-camera-integration.png";

interface JobOption {
  id: string;
  name: string;
}

interface CameraMapping {
  id: string;
  job_id: string;
  provider: string;
  camera_name: string;
  camera_external_id: string | null;
  location_label: string | null;
  provider_camera_url: string | null;
  stream_url: string | null;
  access_notes: string | null;
  jobs?: {
    name: string;
  } | null;
}

export default function CameraSystemIntegrationSettings({ showHeading = true }: { showHeading?: boolean }) {
  const { currentCompany, userCompanies } = useCompany();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [mappings, setMappings] = useState<CameraMapping[]>([]);
  const [form, setForm] = useState({
    provider_label: "",
    default_provider: "generic_nvr",
    access_notes: "",
    provider_portal_url: "",
  });
  const [connectionStatus, setConnectionStatus] = useState("not_connected");
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [mappingForm, setMappingForm] = useState({
    job_id: "",
    provider: "generic_nvr",
    camera_name: "",
    camera_external_id: "",
    location_label: "",
    provider_camera_url: "",
    stream_url: "",
    access_notes: "",
  });
  const [addingMapping, setAddingMapping] = useState(false);

  const currentUserCompany = userCompanies.find((uc) => uc.company_id === currentCompany?.id);
  const effectiveRole = String(currentUserCompany?.role || profile?.role || "").toLowerCase();
  const canEdit = ["super_admin", "owner", "admin", "company_admin", "controller"].includes(effectiveRole);
  const isConnected = connectionStatus === "connected";

  const groupedMappings = useMemo(() => {
    return mappings.reduce<Record<string, CameraMapping[]>>((accumulator, mapping) => {
      const key = mapping.jobs?.name || "Unknown Job";
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(mapping);
      return accumulator;
    }, {});
  }, [mappings]);

  const loadSettings = async () => {
    if (!currentCompany?.id) return;

    try {
      setLoading(true);

      const [{ data: integration }, { data: jobRows }, { data: mappingRows }] = await Promise.all([
        (supabase as any)
          .from("company_eagle_eye_integrations")
          .select("account_label, account_region, provider_account_email, provider_portal_url, connection_status, connected_at")
          .eq("company_id", currentCompany.id)
          .maybeSingle(),
        (supabase as any)
          .from("jobs")
          .select("id, name")
          .eq("company_id", currentCompany.id)
          .order("name", { ascending: true }),
        (supabase as any)
          .from("job_security_camera_mappings")
          .select("id, job_id, provider, camera_name, camera_external_id, location_label, provider_camera_url, stream_url, access_notes, jobs(name)")
          .eq("company_id", currentCompany.id)
          .eq("is_active", true)
          .order("camera_name", { ascending: true }),
      ]);

      setForm({
        provider_label: integration?.account_label || "",
        default_provider: integration?.account_region || "generic_nvr",
        access_notes: integration?.provider_account_email || "",
        provider_portal_url: integration?.provider_portal_url || "",
      });
      setConnectionStatus(integration?.connection_status || "not_connected");
      setConnectedAt(integration?.connected_at || null);
      setJobs((jobRows || []) as JobOption[]);
      setMappings((mappingRows || []) as CameraMapping[]);
    } catch (error) {
      console.error("Error loading camera system settings:", error);
      toast({
        title: "Could not load camera settings",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, [currentCompany?.id]);

  const saveConnection = async () => {
    if (!currentCompany?.id || !canEdit) return;

    try {
      setSaving(true);
      const nextStatus = form.provider_label.trim() || form.access_notes.trim() ? "connected" : "not_connected";

      const { error } = await (supabase as any)
        .from("company_eagle_eye_integrations")
        .upsert(
          {
            company_id: currentCompany.id,
            account_label: form.provider_label.trim() || null,
            account_region: form.default_provider,
            provider_account_email: form.access_notes.trim() || null,
            provider_portal_url: form.provider_portal_url.trim() || null,
            connection_status: nextStatus,
            connected_at: nextStatus === "connected" ? new Date().toISOString() : null,
          },
          { onConflict: "company_id" },
        );
      if (error) throw error;

      setConnectionStatus(nextStatus);
      setConnectedAt(nextStatus === "connected" ? new Date().toISOString() : null);
      setSettingsDialogOpen(false);
      toast({
        title: "Camera system saved",
        description: "You can now map cameras or NVR links to jobs.",
      });
    } catch (error: any) {
      console.error("Error saving camera system settings:", error);
      toast({
        title: "Save failed",
        description: error?.message || "Could not save camera settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addMapping = async () => {
    if (!currentCompany?.id || !canEdit || !mappingForm.job_id || !mappingForm.camera_name.trim()) {
      toast({
        title: "Missing details",
        description: "Select a job and enter a camera name.",
        variant: "destructive",
      });
      return;
    }

    try {
      setAddingMapping(true);
      const { error } = await (supabase as any)
        .from("job_security_camera_mappings")
        .insert({
          company_id: currentCompany.id,
          job_id: mappingForm.job_id,
          provider: mappingForm.provider,
          camera_name: mappingForm.camera_name.trim(),
          camera_external_id: mappingForm.camera_external_id.trim() || null,
          location_label: mappingForm.location_label.trim() || null,
          provider_camera_url: mappingForm.provider_camera_url.trim() || null,
          stream_url: mappingForm.stream_url.trim() || null,
          access_notes: mappingForm.access_notes.trim() || null,
        });
      if (error) throw error;

      setMappingForm({
        job_id: "",
        provider: form.default_provider || "generic_nvr",
        camera_name: "",
        camera_external_id: "",
        location_label: "",
        provider_camera_url: "",
        stream_url: "",
        access_notes: "",
      });
      await loadSettings();
      toast({
        title: "Camera mapping saved",
        description: "This camera is now available on the job Security Cameras tab.",
      });
    } catch (error: any) {
      console.error("Error saving camera mapping:", error);
      toast({
        title: "Mapping failed",
        description: error?.message || "Could not save the camera mapping.",
        variant: "destructive",
      });
    } finally {
      setAddingMapping(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {showHeading ? (
          <div>
            <h2 className="text-xl font-semibold">Integrations</h2>
          </div>
        ) : null}

        {loading ? (
          <Card>
            <CardContent className="py-10">
              <div className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="loading-dots">Loading connector</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <button
            type="button"
            onClick={() => setSettingsDialogOpen(true)}
            className="group flex h-[240px] w-[240px] flex-col items-center justify-between rounded-3xl border border-border bg-card p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/70 hover:bg-primary/5 hover:shadow-[0_0_0_1px_rgba(14,165,233,0.22),0_20px_40px_-24px_rgba(14,165,233,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <div className="flex flex-1 items-center justify-center overflow-hidden px-2 py-4 transition-transform duration-200 group-hover:scale-[1.04]">
              <div className="flex h-[168px] w-[168px] items-center justify-center">
                <img
                  src={securityCameraIntegrationIcon}
                  alt="Security Cameras"
                  className="h-full w-full object-contain"
                />
              </div>
            </div>

            <div className="flex w-full flex-col items-center gap-2">
              <Badge variant={isConnected ? "default" : "outline"} className="px-3 py-1">
                {isConnected ? "Connected" : "Not Connected"}
              </Badge>
              <div className="text-center text-xs text-muted-foreground">
                {mappings.length} mapped camera{mappings.length === 1 ? "" : "s"}
              </div>
            </div>
          </button>
        )}
      </div>

      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Camera System
            </DialogTitle>
            <DialogDescription>
              Set up a generic NVR or camera provider for your company, then map cameras, stream links, or provider URLs to specific jobs.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <div className="text-muted-foreground">
                  Connection status: <span className="text-foreground capitalize">{connectionStatus.replace(/_/g, " ")}</span>
                </div>
                {connectedAt ? (
                  <div className="text-muted-foreground">
                    Connected on: <span className="text-foreground">{new Date(connectedAt).toLocaleString()}</span>
                  </div>
                ) : null}
                <div className="text-muted-foreground">
                  Optional provider docs:
                  <a
                    href="https://developer.eagleeyenetworks.com/reference/listcameras"
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Eagle Eye Cameras API
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="camera-provider-label">System Label</Label>
                <Input
                  id="camera-provider-label"
                  value={form.provider_label}
                  onChange={(e) => setForm((prev) => ({ ...prev, provider_label: e.target.value }))}
                  placeholder="Main Jobsite Camera System"
                  disabled={!canEdit || saving}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="camera-provider-type">Default Provider</Label>
                <Select
                  value={form.default_provider}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, default_provider: value }))}
                  disabled={!canEdit || saving}
                >
                  <SelectTrigger id="camera-provider-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="generic_nvr">Generic NVR / Camera System</SelectItem>
                    <SelectItem value="hikvision">Hikvision</SelectItem>
                    <SelectItem value="dahua">Dahua</SelectItem>
                    <SelectItem value="unifi_protect">Ubiquiti UniFi Protect</SelectItem>
                    <SelectItem value="eagle_eye">Eagle Eye</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="camera-provider-portal-url">Provider Portal URL</Label>
                <Input
                  id="camera-provider-portal-url"
                  value={form.provider_portal_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, provider_portal_url: e.target.value }))}
                  placeholder="https://nvr.example.com"
                  disabled={!canEdit || saving}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="camera-provider-notes">Access Notes</Label>
                <Textarea
                  id="camera-provider-notes"
                  value={form.access_notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, access_notes: e.target.value }))}
                  placeholder="Login notes, viewing instructions, VPN requirements, or NVR access details."
                  rows={4}
                  disabled={!canEdit || saving}
                />
              </div>

              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                This generic setup is meant for mixed real-world jobsites where customers may use local NVRs, Hikvision, Dahua, UniFi Protect, or simple provider web portals. A future provider-specific integration can still plug into this structure.
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Map Cameras To Jobs</div>
                  <Badge variant="outline">{mappings.length}</Badge>
                </div>

                <div className="grid gap-2">
                  <Label>BuilderLynk Job</Label>
                  <Select
                    value={mappingForm.job_id}
                    onValueChange={(value) => setMappingForm((prev) => ({ ...prev, job_id: value }))}
                    disabled={!canEdit || addingMapping}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a job" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Provider Type</Label>
                  <Select
                    value={mappingForm.provider}
                    onValueChange={(value) => setMappingForm((prev) => ({ ...prev, provider: value }))}
                    disabled={!canEdit || addingMapping}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="generic_nvr">Generic NVR / Camera System</SelectItem>
                      <SelectItem value="hikvision">Hikvision</SelectItem>
                      <SelectItem value="dahua">Dahua</SelectItem>
                      <SelectItem value="unifi_protect">Ubiquiti UniFi Protect</SelectItem>
                      <SelectItem value="eagle_eye">Eagle Eye</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Camera Name</Label>
                  <Input
                    value={mappingForm.camera_name}
                    onChange={(e) => setMappingForm((prev) => ({ ...prev, camera_name: e.target.value }))}
                    placeholder="Front Gate Camera"
                    disabled={!canEdit || addingMapping}
                  />
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Location Label</Label>
                    <Input
                      value={mappingForm.location_label}
                      onChange={(e) => setMappingForm((prev) => ({ ...prev, location_label: e.target.value }))}
                      placeholder="Gate A"
                      disabled={!canEdit || addingMapping}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Camera / Channel ID</Label>
                    <Input
                      value={mappingForm.camera_external_id}
                      onChange={(e) => setMappingForm((prev) => ({ ...prev, camera_external_id: e.target.value }))}
                      placeholder="camera-id or channel"
                      disabled={!canEdit || addingMapping}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Launch URL</Label>
                  <Input
                    value={mappingForm.provider_camera_url}
                    onChange={(e) => setMappingForm((prev) => ({ ...prev, provider_camera_url: e.target.value }))}
                    placeholder="https://portal-or-camera-link"
                    disabled={!canEdit || addingMapping}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Stream / Embed URL</Label>
                  <Input
                    value={mappingForm.stream_url}
                    onChange={(e) => setMappingForm((prev) => ({ ...prev, stream_url: e.target.value }))}
                    placeholder="rtsp://, hls://, or embeddable stream URL"
                    disabled={!canEdit || addingMapping}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Access Notes</Label>
                  <Textarea
                    value={mappingForm.access_notes}
                    onChange={(e) => setMappingForm((prev) => ({ ...prev, access_notes: e.target.value }))}
                    placeholder="VPN requirements, login notes, or camera viewing instructions."
                    rows={3}
                    disabled={!canEdit || addingMapping}
                  />
                </div>

                <Button onClick={() => void addMapping()} disabled={!canEdit || addingMapping} className="w-full">
                  {addingMapping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Add Camera Mapping
                </Button>
              </div>

              <div className="max-h-[320px] space-y-3 overflow-y-auto rounded-xl border p-4">
                {Object.keys(groupedMappings).length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No mapped cameras yet.
                  </div>
                ) : (
                  Object.entries(groupedMappings).map(([jobName, jobMappings]) => (
                    <div key={jobName} className="space-y-2">
                      <div className="text-sm font-semibold">{jobName}</div>
                      {jobMappings.map((mapping) => (
                        <div key={mapping.id} className="rounded-lg border px-3 py-2 text-sm">
                          <div className="font-medium">{mapping.camera_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[mapping.provider.replace(/_/g, " "), mapping.location_label].filter(Boolean).join(" • ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void saveConnection()} disabled={!canEdit || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Camera System
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
