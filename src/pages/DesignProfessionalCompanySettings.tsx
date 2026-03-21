import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Briefcase, Building2, Loader2, Mail, Save, Upload, UserCircle2, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { resolveCompanyLogoUrl } from "@/utils/resolveCompanyLogoUrl";
import ThemeSettings from "@/pages/ThemeSettings";

type CompanyForm = {
  display_name: string;
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  tax_id: string;
  license_number: string;
};

const blankForm: CompanyForm = {
  display_name: "",
  name: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  tax_id: "",
  license_number: "",
};

export default function DesignProfessionalCompanySettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentCompany, refreshCompanies } = useCompany();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [form, setForm] = useState<CompanyForm>(blankForm);
  const [workspaceLogoOverride, setWorkspaceLogoOverride] = useState<string | null>(null);

  const companyLogoUrl = useMemo(
    () => resolveCompanyLogoUrl(workspaceLogoOverride || currentCompany?.logo_url),
    [workspaceLogoOverride, currentCompany?.logo_url],
  );

  useEffect(() => {
    if (!currentCompany?.id) {
      setWorkspaceLogoOverride(null);
      return;
    }
    setWorkspaceLogoOverride(window.localStorage.getItem(`workspace-logo:${currentCompany.id}`));

    const handleWorkspaceLogoUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ companyId: string; storagePath: string }>).detail;
      if (!detail?.companyId || detail.companyId !== currentCompany.id) return;
      setWorkspaceLogoOverride(detail.storagePath);
    };

    window.addEventListener("workspace-logo-updated", handleWorkspaceLogoUpdated as EventListener);
    return () => {
      window.removeEventListener("workspace-logo-updated", handleWorkspaceLogoUpdated as EventListener);
    };
  }, [currentCompany?.id]);

  useEffect(() => {
    setForm({
      display_name: currentCompany?.display_name || "",
      name: currentCompany?.name || "",
      email: currentCompany?.email || "",
      phone: currentCompany?.phone || "",
      website: currentCompany?.website || "",
      address: currentCompany?.address || "",
      city: currentCompany?.city || "",
      state: currentCompany?.state || "",
      zip_code: currentCompany?.zip_code || "",
      tax_id: currentCompany?.tax_id || "",
      license_number: currentCompany?.license_number || "",
    });
  }, [currentCompany?.id]);

  const setField = (key: keyof CompanyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveCompany = async () => {
    if (!currentCompany?.id) return;
    if (!form.name.trim()) {
      toast({
        title: "Company name required",
        description: "Please enter a company name before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from("companies")
        .update({
          display_name: form.display_name.trim() || null,
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          website: form.website.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          zip_code: form.zip_code.trim() || null,
          tax_id: form.tax_id.trim() || null,
          license_number: form.license_number.trim() || null,
        })
        .eq("id", currentCompany.id);
      if (error) throw error;

      await refreshCompanies();
      toast({
        title: "Saved",
        description: "Design Pro company settings updated.",
      });
    } catch (error: any) {
      console.error("Error saving design pro company settings:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !currentCompany?.id) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingLogo(true);
      const ext = file.name.split(".").pop() || "png";
      const objectPath = `${currentCompany.id}/design-pro-logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(objectPath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const storagePath = `company-logos/${objectPath}`;
      window.localStorage.setItem(`workspace-logo:${currentCompany.id}`, storagePath);
      window.dispatchEvent(new CustomEvent("workspace-logo-updated", {
        detail: {
          companyId: currentCompany.id,
          storagePath,
        },
      }));
      const { data: updatedCompanyRows, error: updateError } = await supabase
        .from("companies")
        .update({ logo_url: storagePath })
        .eq("id", currentCompany.id)
        .select("id, logo_url");
      if (updateError) throw updateError;
      if (!updatedCompanyRows || (Array.isArray(updatedCompanyRows) && updatedCompanyRows.length === 0)) {
        throw new Error("Design professional logo update did not persist.");
      }

      await refreshCompanies();
      toast({
        title: "Logo updated",
        description: "Your Design Pro logo has been saved.",
      });
    } catch (error: any) {
      console.error("Error uploading design pro logo:", error);
      toast({
        title: "Upload failed",
        description: error?.message || "Could not upload logo.",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Design Pro Settings</h1>
        </div>
        <Badge variant="outline" className="uppercase tracking-wide">Design Pro</Badge>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="appearance">Themes and Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="flex">
                <label className="group relative block h-24 w-52 overflow-hidden rounded-md border bg-muted/30 cursor-pointer">
                  <input
                    id="dp-logo-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={uploadLogo}
                    disabled={uploadingLogo}
                  />
                  {companyLogoUrl ? (
                    <>
                      <img
                        src={companyLogoUrl}
                        alt={currentCompany?.display_name || currentCompany?.name || "Design Pro"}
                        className="h-full w-full object-contain p-2"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100">
                        Upload Logo
                      </div>
                    </>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                      {uploadingLogo ? "Uploading..." : "Upload Logo"}
                    </div>
                  )}
                  {uploadingLogo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-white text-sm font-medium">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </div>
                  )}
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Company Name</Label>
                  <p className="text-sm">{currentCompany?.name || "Not set"}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Display Name</Label>
                  <p className="text-sm">{currentCompany?.display_name || "Not set"}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Phone</Label>
                  <p className="text-sm">{currentCompany?.phone || "Not set"}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                  <p className="text-sm break-all">{currentCompany?.email || "Not set"}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Website</Label>
                  <p className="text-sm break-all">{currentCompany?.website || "Not set"}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Address</Label>
                  <p className="text-sm">
                    {[
                      currentCompany?.address,
                      [currentCompany?.city, currentCompany?.state].filter(Boolean).join(", "),
                      currentCompany?.zip_code,
                    ].filter(Boolean).join(" ") || "Not set"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle2 className="h-4 w-4" />
                Brand & Identity
              </CardTitle>
              <CardDescription>
                This logo is used in the left navigation header and Design Pro-facing UI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="dp-display-name">Display Name</Label>
                  <Input id="dp-display-name" value={form.display_name} onChange={(e) => setField("display_name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dp-company-name">Legal Name</Label>
                  <Input id="dp-company-name" value={form.name} onChange={(e) => setField("name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dp-email">Email</Label>
                  <Input id="dp-email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dp-phone">Phone</Label>
                  <Input id="dp-phone" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="dp-website">Website</Label>
                  <Input id="dp-website" value={form.website} onChange={(e) => setField("website", e.target.value)} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="dp-address">Address</Label>
                  <Textarea id="dp-address" value={form.address} onChange={(e) => setField("address", e.target.value)} rows={2} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dp-city">City</Label>
                  <Input id="dp-city" value={form.city} onChange={(e) => setField("city", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dp-state">State</Label>
                  <Input id="dp-state" value={form.state} onChange={(e) => setField("state", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dp-zip">ZIP</Label>
                  <Input id="dp-zip" value={form.zip_code} onChange={(e) => setField("zip_code", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dp-license">License</Label>
                  <Input id="dp-license" value={form.license_number} onChange={(e) => setField("license_number", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dp-tax-id">Tax ID</Label>
                  <Input id="dp-tax-id" value={form.tax_id} onChange={(e) => setField("tax_id", e.target.value)} />
                </div>
              </div>
              <div>
                <Button onClick={saveCompany} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Company Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Company Email Setup</CardTitle>
                <CardDescription>
                  Configure email sending from your user profile for Design Pro communication workflows.
                </CardDescription>
              </div>
              <Button onClick={() => navigate("/profile-settings?tab=email-setup")}>
                <Mail className="h-4 w-4 mr-2" />
                Email Setup
              </Button>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Manage Users</CardTitle>
                <CardDescription>
                  Manage your Design Pro team members and their workspace access.
                </CardDescription>
              </div>
              <Button onClick={() => navigate("/design-professional/settings/users")}>
                <Users className="h-4 w-4 mr-2" />
                Open User Management
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Jobs Workspace
              </CardTitle>
              <CardDescription>
                Manage the Design Pro job experience, including your active jobs, RFIs, and submittals workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">
                  Your Design Pro company can create its own jobs and also work inside jobs shared by builders. Use the links below to manage that workspace.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link to="/design-professional/jobs">
                    Open Jobs
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/design-professional/jobs/rfis">
                    Open RFIs
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/design-professional/jobs/submittals">
                    Open Submittals
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <ThemeSettings embedded hideSaveButtons />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Signed in as {user?.email || "unknown user"}
      </p>
    </div>
  );
}
