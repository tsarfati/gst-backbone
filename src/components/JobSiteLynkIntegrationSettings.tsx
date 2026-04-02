import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, Link2, Loader2, PlugZap, RefreshCw } from "lucide-react";

type IntegrationRecord = {
  jobsitelynk_base_url: string;
  external_company_id: string;
  shared_secret: string;
  connection_status?: string;
  connected_account_email?: string | null;
  connected_account_name?: string | null;
  connected_at?: string | null;
  last_connection_error?: string | null;
};

const DEFAULT_JOBSITELYNK_BASE_URL = "https://jobsitelynk.com";
const trimTrailingSlashes = (value: string) => value.replace(/\/+$/g, "");

export default function JobSiteLynkIntegrationSettings() {
  const { currentCompany, userCompanies } = useCompany();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncingProjects, setSyncingProjects] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("not_connected");
  const [connectedAccountEmail, setConnectedAccountEmail] = useState<string | null>(null);
  const [connectedAccountName, setConnectedAccountName] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [lastConnectionError, setLastConnectionError] = useState<string | null>(null);
  const [syncedProjectCount, setSyncedProjectCount] = useState(0);
  const [lastProjectSyncAt, setLastProjectSyncAt] = useState<string | null>(null);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [connectForm, setConnectForm] = useState({
    jobsitelynk_email: "",
    jobsitelynk_password: "",
  });
  const [form, setForm] = useState({
    jobsitelynk_base_url: "",
    external_company_id: "",
    shared_secret: "",
  });

  const currentUserCompany = userCompanies.find((uc) => uc.company_id === currentCompany?.id);
  const effectiveRole = String(currentUserCompany?.role || profile?.role || "").toLowerCase();
  const canEdit = ["super_admin", "owner", "admin", "company_admin"].includes(effectiveRole);

  const normalizedBaseUrl = useMemo(
    () => trimTrailingSlashes((form.jobsitelynk_base_url.trim() || DEFAULT_JOBSITELYNK_BASE_URL)),
    [form.jobsitelynk_base_url],
  );

  useEffect(() => {
    const loadIntegration = async () => {
      if (!currentCompany?.id) return;

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("company_jobsitelynk_integrations")
          .select("jobsitelynk_base_url, external_company_id, connection_status, connected_account_email, connected_account_name, connected_at, last_connection_error")
          .eq("company_id", currentCompany.id)
          .maybeSingle();

        if (error) throw error;

        setForm({
          jobsitelynk_base_url: data?.jobsitelynk_base_url || DEFAULT_JOBSITELYNK_BASE_URL,
          external_company_id: data?.external_company_id || currentCompany.id,
          shared_secret: "",
        });
        setConfigured(!!(data?.jobsitelynk_base_url || data?.external_company_id));
        setConnectionStatus(data?.connection_status || "not_connected");
        setConnectedAccountEmail(data?.connected_account_email || null);
        setConnectedAccountName(data?.connected_account_name || null);
        setConnectedAt(data?.connected_at || null);
        setLastConnectionError(data?.last_connection_error || null);

        const { count, error: countError } = await supabase
          .from("company_jobsitelynk_projects")
          .select("*", { count: "exact", head: true })
          .eq("company_id", currentCompany.id);
        if (countError) throw countError;
        setSyncedProjectCount(count || 0);

        const { data: latestProject, error: latestProjectError } = await supabase
          .from("company_jobsitelynk_projects")
          .select("last_synced_at")
          .eq("company_id", currentCompany.id)
          .order("last_synced_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestProjectError) throw latestProjectError;
        setLastProjectSyncAt(latestProject?.last_synced_at || null);
      } catch (error) {
        console.error("Error loading JobSiteLynk integration:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadIntegration();
  }, [currentCompany?.id]);

  const saveIntegration = async () => {
    if (!currentCompany?.id || !canEdit) return;

    if (!form.external_company_id.trim()) {
      toast({
        title: "Missing fields",
        description: "BuilderLynk company ID is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const { data: existing, error: existingError } = await supabase
        .from("company_jobsitelynk_integrations")
        .select("id, shared_secret, connection_status")
        .eq("company_id", currentCompany.id)
        .maybeSingle();
      if (existingError) throw existingError;

      const sharedSecret = form.shared_secret.trim() || existing?.shared_secret;
      if (!sharedSecret) {
        toast({
          title: "Missing secret",
          description: "Enter the JobSiteLynk shared secret.",
          variant: "destructive",
        });
        return;
      }

      const payload: IntegrationRecord & { company_id: string } = {
        company_id: currentCompany.id,
        jobsitelynk_base_url: normalizedBaseUrl,
        external_company_id: form.external_company_id.trim(),
        shared_secret: sharedSecret,
      };

      const { error } = await supabase
        .from("company_jobsitelynk_integrations")
        .upsert(payload, { onConflict: "company_id" });
      if (error) throw error;

      setConfigured(true);
      setForm((prev) => ({ ...prev, jobsitelynk_base_url: normalizedBaseUrl, shared_secret: "" }));
      if (existing) {
        setConnectionStatus(existing.connection_status || "not_connected");
      }
      toast({
        title: "Saved",
        description: "JobSiteLynk integration settings updated.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not save JobSiteLynk integration settings.";
      console.error("Error saving JobSiteLynk integration:", error);
      toast({
        title: "Save failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const connectAccount = async () => {
    if (!currentCompany?.id || !canEdit) return;

    if (!form.external_company_id.trim()) {
      toast({
        title: "Save integration first",
        description: "Save the company ID and shared secret before connecting an account.",
        variant: "destructive",
      });
      return;
    }

    if (!connectForm.jobsitelynk_email.trim() || !connectForm.jobsitelynk_password) {
      toast({
        title: "Missing credentials",
        description: "Enter the JobSiteLynk email and password for the company owner or admin account.",
        variant: "destructive",
      });
      return;
    }

    try {
      setConnecting(true);

      const { data, error } = await supabase.functions.invoke("jobsitelynk-connect-account", {
        body: {
          companyId: currentCompany.id,
          jobsitelynk_email: connectForm.jobsitelynk_email.trim(),
          jobsitelynk_password: connectForm.jobsitelynk_password,
        },
      });

      if (error) throw error;

      setConnectionStatus("connected");
      setConnectedAccountEmail(String(data?.connected_account_email || connectForm.jobsitelynk_email.trim()));
      setConnectedAccountName(data?.connected_account_name ? String(data.connected_account_name) : null);
      setConnectedAt(data?.connected_at ? String(data.connected_at) : new Date().toISOString());
      setLastConnectionError(null);
      setConnectForm({ jobsitelynk_email: "", jobsitelynk_password: "" });
      setConnectDialogOpen(false);

      toast({
        title: "JobSiteLynk connected",
        description: "The company JobSiteLynk connection is ready for project linking.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not connect to JobSiteLynk.";
      setConnectionStatus("error");
      setLastConnectionError(message);
      toast({
        title: "Connection failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const syncProjects = async () => {
    if (!currentCompany?.id || !canEdit) return;

    try {
      setSyncingProjects(true);
      const { data, error } = await supabase.functions.invoke("jobsitelynk-sync-projects", {
        body: { companyId: currentCompany.id },
      });
      if (error) throw error;

      setSyncedProjectCount(Number(data?.synced_count || 0));
      setLastProjectSyncAt(data?.synced_at ? String(data.synced_at) : new Date().toISOString());
      toast({
        title: "Projects synced",
        description: `Synced ${Number(data?.synced_count || 0)} JobSiteLynk projects for this company.`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not sync JobSiteLynk projects.";
      toast({
        title: "Sync failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSyncingProjects(false);
    }
  };

  const isConnected = connectionStatus === "connected";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              JobSiteLynk Integration
            </CardTitle>
            <CardDescription>
              Configure the company-level JobSiteLynk connection used for embedded project viewing and project linking.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {configured && <Badge variant="secondary">Configured</Badge>}
            <Badge variant={isConnected ? "default" : connectionStatus === "error" ? "destructive" : "outline"}>
              {isConnected ? "Connected" : connectionStatus === "error" ? "Connection Error" : "Not Connected"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="py-4 text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="loading-dots">Loading integration</span>
          </div>
        ) : (
          <>
            <div className="grid gap-2">
              <Label htmlFor="jobsitelynk-external-company-id">BuilderLynk Company ID</Label>
              <Input
                id="jobsitelynk-external-company-id"
                value={form.external_company_id}
                onChange={(e) => setForm((prev) => ({ ...prev, external_company_id: e.target.value }))}
                disabled={!canEdit || saving}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="jobsitelynk-shared-secret">
                Shared Secret {configured ? "(leave blank to keep current secret)" : ""}
              </Label>
              <Input
                id="jobsitelynk-shared-secret"
                type="password"
                placeholder={configured ? "Current secret stored" : "Enter shared secret"}
                value={form.shared_secret}
                onChange={(e) => setForm((prev) => ({ ...prev, shared_secret: e.target.value }))}
                disabled={!canEdit || saving}
              />
            </div>

            <div className="flex justify-end">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => void syncProjects()}
                  disabled={!canEdit || saving || !isConnected || syncingProjects}
                >
                  {syncingProjects ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sync Projects
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConnectDialogOpen(true)}
                  disabled={!canEdit || saving || !configured}
                >
                  <PlugZap className="h-4 w-4 mr-2" />
                  {isConnected ? "Reconnect Account" : "Connect JobSiteLynk"}
                </Button>
                <Button onClick={saveIntegration} disabled={!canEdit || saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Integration
                </Button>
              </div>
            </div>

            <Separator />

            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <div className="font-medium text-foreground">Connection status</div>
              <div className="text-muted-foreground">
                JobSiteLynk environment: <span className="text-foreground">{DEFAULT_JOBSITELYNK_BASE_URL}</span>
              </div>
              <div className="text-muted-foreground">
                {isConnected
                  ? "A JobSiteLynk company admin account is connected. Admins can now link BuilderLynk jobs to JobSiteLynk projects."
                  : "No JobSiteLynk account is connected yet. Save the integration details, then connect a JobSiteLynk admin account."}
              </div>
              {connectedAccountEmail && (
                <div className="text-muted-foreground">
                  Connected account: <span className="text-foreground">{connectedAccountName || connectedAccountEmail}</span>
                  {connectedAccountName && <span className="text-muted-foreground"> ({connectedAccountEmail})</span>}
                </div>
              )}
              {connectedAt && (
                <div className="text-muted-foreground">
                  Connected on: <span className="text-foreground">{new Date(connectedAt).toLocaleString()}</span>
                </div>
              )}
              {lastConnectionError && connectionStatus === "error" && (
                <div className="text-destructive">
                  Last error: {lastConnectionError}
                </div>
              )}
              <div className="text-muted-foreground">
                Synced projects: <span className="text-foreground">{syncedProjectCount}</span>
              </div>
              {lastProjectSyncAt && (
                <div className="text-muted-foreground">
                  Last project sync: <span className="text-foreground">{new Date(lastProjectSyncAt).toLocaleString()}</span>
                </div>
              )}
            </div>

          </>
        )}
      </CardContent>

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Connect JobSiteLynk Account
            </DialogTitle>
            <DialogDescription>
              Use a JobSiteLynk owner or admin account to authorize project mapping for this BuilderLynk company.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="jobsitelynk-email">JobSiteLynk Email</Label>
              <Input
                id="jobsitelynk-email"
                type="email"
                value={connectForm.jobsitelynk_email}
                onChange={(e) => setConnectForm((prev) => ({ ...prev, jobsitelynk_email: e.target.value }))}
                placeholder="admin@jobsitelynk.com"
                disabled={connecting}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="jobsitelynk-password">JobSiteLynk Password</Label>
              <Input
                id="jobsitelynk-password"
                type="password"
                value={connectForm.jobsitelynk_password}
                onChange={(e) => setConnectForm((prev) => ({ ...prev, jobsitelynk_password: e.target.value }))}
                placeholder="Enter password"
                disabled={connecting}
              />
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              BuilderLynk sends these credentials to JobSiteLynk only to establish the company connection. The embed flow for everyday users still uses short-lived launch URLs.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialogOpen(false)} disabled={connecting}>
              Cancel
            </Button>
            <Button onClick={connectAccount} disabled={connecting}>
              {connecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Connect Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Card>
  );
}
