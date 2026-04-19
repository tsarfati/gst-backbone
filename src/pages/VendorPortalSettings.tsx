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
import { useCompany } from "@/contexts/CompanyContext";
import { useVendorPortalAccess } from "@/hooks/useVendorPortalAccess";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function VendorPortalSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  useVendorPortalAccess();
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
        <Button variant="ghost" className="px-0" onClick={() => navigate("/vendor/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full max-w-[520px] grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="taxes">Taxes</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
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

      </Tabs>
    </div>
  );
}
