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
import { Building2, Loader2, Save, Upload, UserCircle2 } from "lucide-react";
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
  const { user } = useAuth();
  const { currentCompany, refreshCompanies } = useCompany();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [form, setForm] = useState<CompanyForm>(blankForm);

  const companyLogoUrl = useMemo(
    () => resolveCompanyLogoUrl(currentCompany?.logo_url),
    [currentCompany?.logo_url],
  );

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
      const { error: updateError } = await supabase
        .from("companies")
        .update({ logo_url: storagePath })
        .eq("id", currentCompany.id);
      if (updateError) throw updateError;

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
          <p className="text-sm text-muted-foreground mt-1">
            Configure your independent Design Pro company profile and branding.
          </p>
        </div>
        <Badge variant="outline" className="uppercase tracking-wide">Design Pro</Badge>
      </div>

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="customization">Site Customization</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Company Profile
              </CardTitle>
              <CardDescription>
                This information represents your Design Pro organization account.
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
        </TabsContent>

        <TabsContent value="branding">
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
              <div className="h-24 w-24 rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden">
                {companyLogoUrl ? (
                  <img src={companyLogoUrl} alt="Design Pro logo" className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <Label htmlFor="dp-logo-upload" className="sr-only">Upload logo</Label>
                <Input
                  id="dp-logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={uploadLogo}
                  disabled={uploadingLogo}
                />
              </div>
              <Button variant="outline" disabled={uploadingLogo} onClick={() => document.getElementById("dp-logo-upload")?.click()}>
                {uploadingLogo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Upload Logo
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customization">
          <ThemeSettings embedded hideSaveButtons />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Signed in as {user?.email || "unknown user"}
      </p>
    </div>
  );
}
