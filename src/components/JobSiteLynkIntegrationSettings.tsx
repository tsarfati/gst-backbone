import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, Loader2 } from "lucide-react";
import jobSiteLynkLogo from "@/assets/jobsitelynk-logo.png";

const DEFAULT_JOBSITELYNK_BASE_URL = "https://jobsitelynk.com";
const trimTrailingSlashes = (value: string) => value.replace(/\/+$/g, "");

export default function JobSiteLynkIntegrationSettings() {
  const { currentCompany, userCompanies } = useCompany();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("not_connected");
  const [connectedAccountEmail, setConnectedAccountEmail] = useState<string | null>(null);
  const [connectedAccountName, setConnectedAccountName] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [lastConnectionError, setLastConnectionError] = useState<string | null>(null);
  const [form, setForm] = useState({
    external_company_id: "",
    jobsitelynk_email: "",
    jobsitelynk_password: "",
  });

  const currentUserCompany = userCompanies.find((uc) => uc.company_id === currentCompany?.id);
  const effectiveRole = String(currentUserCompany?.role || profile?.role || "").toLowerCase();
  const canEdit = ["super_admin", "owner", "admin", "company_admin"].includes(effectiveRole);
  const isConnected = connectionStatus === "connected";

  const normalizedCompanyId = useMemo(
    () => form.external_company_id.trim(),
    [form.external_company_id],
  );

  useEffect(() => {
    const loadIntegration = async () => {
      if (!currentCompany?.id) return;

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("company_jobsitelynk_integrations")
          .select("external_company_id, connection_status, connected_account_email, connected_account_name, connected_at, last_connection_error, shared_secret")
          .eq("company_id", currentCompany.id)
          .maybeSingle();

        if (error) throw error;

        setForm((prev) => ({
          ...prev,
          external_company_id: data?.external_company_id || currentCompany.id,
          jobsitelynk_email: "",
          jobsitelynk_password: "",
        }));
        setConfigured(!!(data?.external_company_id || data?.shared_secret));
        setConnectionStatus(data?.connection_status || "not_connected");
        setConnectedAccountEmail(data?.connected_account_email || null);
        setConnectedAccountName(data?.connected_account_name || null);
        setConnectedAt(data?.connected_at || null);
        setLastConnectionError(data?.last_connection_error || null);
      } catch (error) {
        console.error("Error loading JobSiteLynk integration:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadIntegration();
  }, [currentCompany?.id]);

  const saveAndConnect = async () => {
    if (!currentCompany?.id || !canEdit) return;

    if (!normalizedCompanyId) {
      toast({
        title: "Missing company ID",
        description: "Enter the BuilderLynk company ID for this connector.",
        variant: "destructive",
      });
      return;
    }

    if (!form.jobsitelynk_email.trim() || !form.jobsitelynk_password) {
      toast({
        title: "Missing credentials",
        description: "Enter a JobSiteLynk admin or manager email and password.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const { error: saveError } = await supabase
        .from("company_jobsitelynk_integrations")
        .upsert(
          {
            company_id: currentCompany.id,
            jobsitelynk_base_url: trimTrailingSlashes(DEFAULT_JOBSITELYNK_BASE_URL),
            external_company_id: normalizedCompanyId,
          },
          { onConflict: "company_id" },
        );
      if (saveError) throw saveError;

      setConfigured(true);

      setConnecting(true);
      const { data, error } = await supabase.functions.invoke("jobsitelynk-connect-account", {
        body: {
          companyId: currentCompany.id,
          jobsitelynk_email: form.jobsitelynk_email.trim(),
          jobsitelynk_password: form.jobsitelynk_password,
        },
      });
      if (error) throw error;

      setConnectionStatus("connected");
      setConnectedAccountEmail(String(data?.connected_account_email || form.jobsitelynk_email.trim()));
      setConnectedAccountName(data?.connected_account_name ? String(data.connected_account_name) : null);
      setConnectedAt(data?.connected_at ? String(data.connected_at) : new Date().toISOString());
      setLastConnectionError(null);
      setForm((prev) => ({ ...prev, jobsitelynk_email: "", jobsitelynk_password: "" }));
      setSettingsDialogOpen(false);

      toast({
        title: "JobSiteLynk connected",
        description: "BuilderLynk successfully logged into JobSiteLynk for this company.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not connect to JobSiteLynk.";
      console.error("Error connecting JobSiteLynk:", error);
      setConnectionStatus("error");
      setLastConnectionError(message);
      toast({
        title: "Connection failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setConnecting(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Open a connector to manage company-level app connections.
          </p>
        </div>

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
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => setSettingsDialogOpen(true)}
              className="group flex w-[220px] flex-col rounded-2xl border border-border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/70 hover:bg-primary/5 hover:shadow-[0_0_0_1px_rgba(249,115,22,0.25),0_20px_40px_-24px_rgba(249,115,22,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-[180px] flex-1 items-center justify-center overflow-hidden p-1 transition-transform duration-200 group-hover:scale-[1.03]">
                  <img
                    src={jobSiteLynkLogo}
                    alt="JobSiteLynk"
                    className="h-full w-full object-contain"
                  />
                </div>
                <Badge variant={isConnected ? "default" : connectionStatus === "error" ? "destructive" : "outline"}>
                  {isConnected ? "Connected" : connectionStatus === "error" ? "Error" : "Disconnected"}
                </Badge>
              </div>

              <div className="mt-4 flex flex-1 flex-col justify-between space-y-3">
                <CardDescription className="min-h-[40px]">
                  Connect the company once, then paste each JobSiteLynk job code on the matching BuilderLynk job.
                </CardDescription>
              </div>
            </button>
          </div>
        )}
      </div>

      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              JobSiteLynk Connector
            </DialogTitle>
            <DialogDescription>
              Enter the BuilderLynk company ID and a JobSiteLynk admin or manager login to connect this company.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <div className="text-muted-foreground">
                BuilderLynk Company ID: <span className="text-foreground">{normalizedCompanyId || currentCompany?.id || "Not set"}</span>
              </div>
              <div className="text-muted-foreground">
                JobSiteLynk environment: <span className="text-foreground">{DEFAULT_JOBSITELYNK_BASE_URL}</span>
              </div>
              {connectedAccountEmail && (
                <div className="text-muted-foreground">
                  Connected account: <span className="text-foreground">{connectedAccountName || connectedAccountEmail}</span>
                  {connectedAccountName ? <span className="text-muted-foreground"> ({connectedAccountEmail})</span> : null}
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
            </div>

            <div className="grid gap-2">
              <Label htmlFor="jobsitelynk-external-company-id">BuilderLynk Company ID</Label>
              <Input
                id="jobsitelynk-external-company-id"
                value={form.external_company_id}
                onChange={(e) => setForm((prev) => ({ ...prev, external_company_id: e.target.value }))}
                disabled={!canEdit || saving || connecting}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="jobsitelynk-email">JobSiteLynk Username / Email</Label>
              <Input
                id="jobsitelynk-email"
                type="email"
                value={form.jobsitelynk_email}
                onChange={(e) => setForm((prev) => ({ ...prev, jobsitelynk_email: e.target.value }))}
                placeholder="admin@jobsitelynk.com"
                disabled={!canEdit || saving || connecting}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="jobsitelynk-password">JobSiteLynk Password</Label>
              <Input
                id="jobsitelynk-password"
                type="password"
                value={form.jobsitelynk_password}
                onChange={(e) => setForm((prev) => ({ ...prev, jobsitelynk_password: e.target.value }))}
                placeholder="Enter password"
                disabled={!canEdit || saving || connecting}
              />
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              BuilderLynk uses its backend JobSiteLynk connector to complete this login. After this company is connected, users only need to paste the JobSiteLynk job code on each BuilderLynk job.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)} disabled={saving || connecting}>
              Cancel
            </Button>
            <Button onClick={() => void saveAndConnect()} disabled={!canEdit || saving || connecting}>
              {(saving || connecting) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isConnected ? "Reconnect" : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
