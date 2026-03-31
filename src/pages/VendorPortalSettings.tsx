import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";
import { useToast } from "@/hooks/use-toast";
import { useVendorPortalData } from "@/hooks/useVendorPortalData";
import { resolveCompanyLogoUrl } from "@/utils/resolveCompanyLogoUrl";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useVendorPortalAccess, type VendorPortalRole } from "@/hooks/useVendorPortalAccess";
import { supabase } from "@/integrations/supabase/client";

type VendorUserProfile = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  vendor_portal_role: VendorPortalRole | null;
};

const VENDOR_ROLE_OPTIONS: Array<{ value: VendorPortalRole; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "accounting", label: "Accounting" },
  { value: "project_contact", label: "Project Contact" },
  { value: "estimator", label: "Estimator" },
  { value: "compliance_manager", label: "Compliance Manager" },
  { value: "basic_user", label: "Basic User" },
];

export default function VendorPortalSettings() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const { currentCompany } = useCompany();
  const { roleCaps } = useVendorPortalAccess();
  const {
    loading,
    settingsForm,
    setSettingsForm,
    paymentMethod,
    saveCompanySettings,
    savePaymentSettings,
    uploadVendorLogo,
  } = useVendorPortalData();
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentType, setPaymentType] = useState(paymentMethod?.type || "check");
  const [checkDelivery, setCheckDelivery] = useState(paymentMethod?.check_delivery || "mail");
  const [bankName, setBankName] = useState(paymentMethod?.bank_name || "");
  const [accountType, setAccountType] = useState(paymentMethod?.account_type || "checking");
  const [routingNumber, setRoutingNumber] = useState(paymentMethod?.routing_number || "");
  const [confirmRoutingNumber, setConfirmRoutingNumber] = useState(paymentMethod?.routing_number || "");
  const [accountNumber, setAccountNumber] = useState(paymentMethod?.account_number || "");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState(paymentMethod?.account_number || "");
  const [voidedCheckFile, setVoidedCheckFile] = useState<File | null>(null);
  const [vendorUsers, setVendorUsers] = useState<VendorUserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [workspaceLogoOverride, setWorkspaceLogoOverride] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadLogoProgress, setUploadLogoProgress] = useState(0);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const voidedCheckInputRef = useRef<HTMLInputElement | null>(null);

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

  const resolvedCompanyLogo = useMemo(
    () => resolveCompanyLogoUrl(workspaceLogoOverride || currentCompany?.logo_url || settingsForm.logo_url),
    [workspaceLogoOverride, currentCompany?.logo_url, settingsForm.logo_url],
  );

  useEffect(() => {
    setPaymentType(paymentMethod?.type || "check");
    setCheckDelivery(paymentMethod?.check_delivery || "mail");
    setBankName(paymentMethod?.bank_name || "");
    setAccountType(paymentMethod?.account_type || "checking");
    setRoutingNumber(paymentMethod?.routing_number || "");
    setConfirmRoutingNumber(paymentMethod?.routing_number || "");
    setAccountNumber(paymentMethod?.account_number || "");
    setConfirmAccountNumber(paymentMethod?.account_number || "");
  }, [paymentMethod]);

  useEffect(() => {
    let ignore = false;

    async function loadVendorUsers() {
      if (!profile?.vendor_id || !roleCaps.canManageUsers) {
        setVendorUsers([]);
        return;
      }

      try {
        setLoadingUsers(true);
        const { data, error } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, display_name, email, vendor_portal_role")
          .eq("vendor_id", profile.vendor_id)
          .eq("role", "vendor")
          .order("first_name", { ascending: true });

        if (error) throw error;
        if (!ignore) {
          setVendorUsers((data || []) as VendorUserProfile[]);
        }
      } catch (error) {
        console.error("Failed to load vendor users:", error);
        if (!ignore) {
          toast({
            title: "Could not load users",
            description: "Vendor users could not be loaded right now.",
            variant: "destructive",
          });
        }
      } finally {
        if (!ignore) {
          setLoadingUsers(false);
        }
      }
    }

    void loadVendorUsers();
    return () => {
      ignore = true;
    };
  }, [profile?.vendor_id, roleCaps.canManageUsers, toast]);

  const updateVendorUserRole = async (userId: string, role: VendorPortalRole) => {
    try {
      setSavingUserId(userId);
      const { error } = await supabase
        .from("profiles")
        .update({ vendor_portal_role: role })
        .eq("user_id", userId);

      if (error) throw error;

      setVendorUsers((prev) =>
        prev.map((user) => (user.user_id === userId ? { ...user, vendor_portal_role: role } : user)),
      );
      toast({
        title: "Role updated",
        description: "Vendor user permissions have been updated.",
      });
    } catch (error: any) {
      console.error("Failed to update vendor role:", error);
      toast({
        title: "Update failed",
        description: error?.message || "Could not update this vendor user role.",
        variant: "destructive",
      });
    } finally {
      setSavingUserId(null);
    }
  };

  const saveCompany = async () => {
    try {
      setSavingCompany(true);
      await saveCompanySettings();
      toast({ title: "Settings saved", description: "Vendor company settings updated." });
    } catch (error: any) {
      toast({ title: "Save failed", description: error?.message || "Could not save vendor settings.", variant: "destructive" });
    } finally {
      setSavingCompany(false);
    }
  };

  const savePayment = async () => {
    const isElectronicPayment = paymentType === "ach" || paymentType === "wire";
    if (isElectronicPayment) {
      if (!bankName.trim()) {
        toast({ title: "Bank name required", description: "Enter the bank name before saving.", variant: "destructive" });
        return;
      }
      if (!routingNumber.trim() || !accountNumber.trim()) {
        toast({ title: "Bank details required", description: "Enter the routing and account numbers before saving.", variant: "destructive" });
        return;
      }
      if (routingNumber.trim() !== confirmRoutingNumber.trim()) {
        toast({ title: "Routing numbers do not match", description: "Re-enter the routing number so both fields match.", variant: "destructive" });
        return;
      }
      if (accountNumber.trim() !== confirmAccountNumber.trim()) {
        toast({ title: "Account numbers do not match", description: "Re-enter the account number so both fields match.", variant: "destructive" });
        return;
      }
      if (!voidedCheckFile && !paymentMethod?.voided_check_url) {
        toast({ title: "Voided check required", description: "Upload a voided check or bank document before saving ACH or wire details.", variant: "destructive" });
        return;
      }
    }

    try {
      setSavingPayment(true);
      await savePaymentSettings({
        type: paymentType,
        check_delivery: paymentType === "check" ? checkDelivery : null,
        bank_name: isElectronicPayment ? bankName : null,
        account_type: isElectronicPayment ? accountType : null,
        routing_number: isElectronicPayment ? routingNumber : null,
        account_number: isElectronicPayment ? accountNumber : null,
        voided_check_file: isElectronicPayment ? voidedCheckFile : null,
      });
      setVoidedCheckFile(null);
      toast({ title: "Payment settings saved", description: "Preferred payment method updated." });
    } catch (error: any) {
      toast({ title: "Save failed", description: error?.message || "Could not save payment settings.", variant: "destructive" });
    } finally {
      setSavingPayment(false);
    }
  };

  if (loading) {
    return <PremiumLoadingScreen text="Loading vendor settings..." />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className={`grid w-full ${roleCaps.canManageUsers ? "max-w-[680px] grid-cols-4" : "max-w-[520px] grid-cols-3"}`}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="taxes">Taxes</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          {roleCaps.canManageUsers && <TabsTrigger value="users">User Management</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <Card>
            <CardHeader><CardTitle>Company Overview</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Company Logo</Label>
                <div className="flex items-center gap-4 rounded-lg border p-4">
                  {resolvedCompanyLogo ? (
                    <img src={resolvedCompanyLogo} alt="Vendor logo" className="h-16 w-auto max-w-[180px] object-contain" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded border text-xs text-muted-foreground">No logo</div>
                  )}
                  <div>
                    <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}>Upload Logo</Button>
                    <Input
                      ref={logoInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          setUploadingLogo(true);
                          setUploadLogoProgress(0);
                          await uploadVendorLogo(file, { onProgress: (percent) => setUploadLogoProgress(percent) });
                          toast({ title: "Logo updated", description: "Your vendor logo has been saved." });
                        } catch (error: any) {
                          toast({ title: "Upload failed", description: error?.message || "Could not upload vendor logo.", variant: "destructive" });
                        } finally {
                          setUploadingLogo(false);
                          setTimeout(() => setUploadLogoProgress(0), 250);
                          event.target.value = "";
                        }
                      }}
                    />
                  </div>
                </div>
                {uploadingLogo ? <Progress value={uploadLogoProgress} className="h-2" /> : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Company Name</Label><Input value={settingsForm.name} onChange={(e) => setSettingsForm((prev) => ({ ...prev, name: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Contact Person</Label><Input value={settingsForm.contact_person} onChange={(e) => setSettingsForm((prev) => ({ ...prev, contact_person: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={settingsForm.email} onChange={(e) => setSettingsForm((prev) => ({ ...prev, email: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={settingsForm.phone} onChange={(e) => setSettingsForm((prev) => ({ ...prev, phone: e.target.value }))} /></div>
                <div className="space-y-2 md:col-span-2"><Label>Address</Label><Input value={settingsForm.address} onChange={(e) => setSettingsForm((prev) => ({ ...prev, address: e.target.value }))} /></div>
                <div className="space-y-2"><Label>City</Label><Input value={settingsForm.city} onChange={(e) => setSettingsForm((prev) => ({ ...prev, city: e.target.value }))} /></div>
                <div className="space-y-2"><Label>State</Label><Input value={settingsForm.state} onChange={(e) => setSettingsForm((prev) => ({ ...prev, state: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Zip Code</Label><Input value={settingsForm.zip_code} onChange={(e) => setSettingsForm((prev) => ({ ...prev, zip_code: e.target.value }))} /></div>
              </div>

              <div className="flex justify-end"><Button onClick={saveCompany} disabled={savingCompany}>{savingCompany ? "Saving..." : "Save Company Settings"}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="taxes" className="pt-4">
          <Card>
            <CardHeader><CardTitle>Tax Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Tax ID / EIN</Label><Input value={settingsForm.tax_id} onChange={(e) => setSettingsForm((prev) => ({ ...prev, tax_id: e.target.value }))} /></div>
              <div className="flex justify-end"><Button onClick={saveCompany} disabled={savingCompany}>{savingCompany ? "Saving..." : "Save Tax Settings"}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="pt-4">
          <Card>
            <CardHeader><CardTitle>Payment Preferences</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Preferred Method</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="ach">ACH</SelectItem>
                    <SelectItem value="wire">Wire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paymentType === "check" && (
                <div className="space-y-2">
                  <Label>Check Delivery</Label>
                  <Select value={checkDelivery} onValueChange={setCheckDelivery}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mail">Mail Check</SelectItem>
                      <SelectItem value="pickup">Pick Up Check</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(paymentType === "ach" || paymentType === "wire") && (
                <>
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Enter bank name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <Select value={accountType} onValueChange={setAccountType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="checking">Checking</SelectItem>
                        <SelectItem value="savings">Savings</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Routing Number</Label>
                    <Input value={routingNumber} onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, ""))} placeholder="9-digit routing number" />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Routing Number</Label>
                    <Input value={confirmRoutingNumber} onChange={(e) => setConfirmRoutingNumber(e.target.value.replace(/\D/g, ""))} placeholder="Re-enter routing number" />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} placeholder="Enter account number" />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Account Number</Label>
                    <Input value={confirmAccountNumber} onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ""))} placeholder="Re-enter account number" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Voided Check / Bank Document</Label>
                    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-muted-foreground">
                        {voidedCheckFile?.name || paymentMethod?.voided_check_url ? "Bank verification document uploaded." : "Upload a voided check or bank-issued document."}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => voidedCheckInputRef.current?.click()}>
                          {voidedCheckFile?.name || paymentMethod?.voided_check_url ? "Replace Document" : "Upload Document"}
                        </Button>
                        <Input
                          ref={voidedCheckInputRef}
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(event) => {
                            setVoidedCheckFile(event.target.files?.[0] || null);
                            event.target.value = "";
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div className="md:col-span-2 flex justify-end"><Button onClick={savePayment} disabled={savingPayment}>{savingPayment ? "Saving..." : "Save Payment Settings"}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        {roleCaps.canManageUsers && (
          <TabsContent value="users" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Vendor Users</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingUsers ? (
                  <p className="text-sm text-muted-foreground"><span className="loading-dots">Loading vendor users</span></p>
                ) : vendorUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No vendor users found yet.</p>
                ) : (
                  <div className="space-y-3">
                    {vendorUsers.map((vendorUser) => {
                      const fullName =
                        vendorUser.display_name
                        || `${vendorUser.first_name || ""} ${vendorUser.last_name || ""}`.trim()
                        || vendorUser.email
                        || "Vendor User";
                      const selectedRole = (vendorUser.vendor_portal_role || "basic_user") as VendorPortalRole;

                      return (
                        <div key={vendorUser.user_id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">{fullName}</div>
                            {vendorUser.email && (
                              <div className="truncate text-sm text-muted-foreground">{vendorUser.email}</div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Portal Role</Label>
                            <Select
                              value={selectedRole}
                              onValueChange={(value: VendorPortalRole) => void updateVendorUserRole(vendorUser.user_id, value)}
                              disabled={savingUserId === vendorUser.user_id}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {VENDOR_ROLE_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
