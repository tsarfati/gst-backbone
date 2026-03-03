import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Building2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import builderlynkLogo from "@/assets/builderlynk-icon-shield.png";
import { resolveCompanyLogoUrl } from "@/utils/resolveCompanyLogoUrl";

type PublicCompany = {
  id: string;
  name: string;
  display_name: string | null;
  logo_url: string | null;
  vendor_portal_signup_background_image_url: string | null;
  vendor_portal_signup_company_logo_url: string | null;
  vendor_portal_signup_header_logo_url: string | null;
  vendor_portal_signup_header_title: string | null;
  vendor_portal_signup_header_subtitle: string | null;
};

type SignupRole = "vendor" | "design_professional";

export default function VendorSignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const preselectedCompanyId = searchParams.get("company");
  const isCompanyLocked = Boolean(preselectedCompanyId);

  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<PublicCompany[]>([]);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyId: preselectedCompanyId || "",
    businessName: "",
    role: "vendor" as SignupRole,
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("list-public-signup-companies", {
          body: { limit: 150 },
        });
        if (fnError) throw fnError;
        setCompanies(Array.isArray(data?.companies) ? data.companies : []);
      } catch (e: any) {
        console.error("Failed to load companies for vendor signup", e);
        setError("Unable to load companies right now.");
      } finally {
        setLoadingCompanies(false);
      }
    };
    loadCompanies();
  }, []);

  useEffect(() => {
    if (!isCompanyLocked || loadingCompanies) return;
    if (!preselectedCompanyId) return;
    const exists = companies.some((c) => c.id === preselectedCompanyId);
    if (!exists) {
      setError("This company signup link is invalid.");
      return;
    }
    setForm((prev) => ({ ...prev, companyId: preselectedCompanyId }));
  }, [companies, isCompanyLocked, loadingCompanies, preselectedCompanyId]);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === form.companyId) || null,
    [companies, form.companyId],
  );
  const selectedCompanyLogoUrl = useMemo(
    () => resolveCompanyLogoUrl(selectedCompany?.vendor_portal_signup_company_logo_url || selectedCompany?.logo_url),
    [selectedCompany?.vendor_portal_signup_company_logo_url, selectedCompany?.logo_url],
  );
  const selectedCompanyHeaderLogoUrl = useMemo(
    () => resolveCompanyLogoUrl(selectedCompany?.vendor_portal_signup_header_logo_url),
    [selectedCompany?.vendor_portal_signup_header_logo_url],
  );
  const selectedCompanyBackgroundUrl = useMemo(
    () => resolveCompanyLogoUrl(selectedCompany?.vendor_portal_signup_background_image_url),
    [selectedCompany?.vendor_portal_signup_background_image_url],
  );

  const pageTitle = selectedCompany?.display_name || selectedCompany?.name
    ? `Join ${selectedCompany.display_name || selectedCompany.name}`
    : "Vendor / Design Professional Signup";
  const roleLabel = form.role === "design_professional" ? "Design Professional" : "Vendor";
  const vendorSignupHeaderTitle = selectedCompany?.vendor_portal_signup_header_title?.trim() || pageTitle;
  const vendorSignupHeaderSubtitle = selectedCompany?.vendor_portal_signup_header_subtitle?.trim()
    || (selectedCompany
      ? `Create your BuilderLYNK account to request access to ${selectedCompany.display_name || selectedCompany.name}.`
      : "Create your BuilderLYNK account and submit for company approval.");

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!form.companyId) {
      setError("Please select the company you want to request access to.");
      return;
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const normalizedEmail = form.email.trim().toLowerCase();

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            first_name: form.firstName.trim(),
            last_name: form.lastName.trim(),
            requested_role: form.role,
            requested_company_id: form.companyId,
            business_name: form.businessName.trim() || null,
          },
        },
      });
      if (signUpError) throw signUpError;

      if (!signUpData.user?.id) {
        throw new Error("Signup completed but no user id was returned.");
      }

      const { error: requestError } = await supabase.functions.invoke("create-vendor-signup-request", {
        body: {
          userId: signUpData.user.id,
          email: normalizedEmail,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim() || null,
          companyId: form.companyId,
          requestedRole: form.role,
          businessName: form.businessName.trim() || null,
        },
      });
      if (requestError) throw requestError;

      setSubmitted(true);
      toast({
        title: "Request submitted",
        description: "Your account is now pending approval.",
      });
    } catch (e: any) {
      console.error("Vendor signup failed", e);
      const message = e?.message || "Failed to submit your signup request.";
      setError(message);
      toast({
        title: "Signup failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCompanies) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030B20]">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-slate-300">Loading signup options...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030B20] p-4">
        <Card className="w-full max-w-lg border-slate-700 bg-[#071231] text-slate-100">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Request Submitted</h2>
            <p className="text-slate-300 mb-6">
              Your {roleLabel.toLowerCase()} signup is pending approval for{" "}
              <strong>{selectedCompany?.display_name || selectedCompany?.name || "the selected company"}</strong>.
              You will receive an email once approved.
            </p>
            <Button onClick={() => navigate("/auth")}>Go to Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#030B20] p-4 bg-cover bg-center"
      style={selectedCompanyBackgroundUrl ? { backgroundImage: `linear-gradient(rgba(3,11,32,0.82), rgba(3,11,32,0.88)), url(${selectedCompanyBackgroundUrl})` } : undefined}
    >
      <Card className="w-full max-w-2xl border-slate-700 bg-[#071231] text-slate-100">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex flex-col items-center gap-3">
            <img src={builderlynkLogo} alt="BuilderLYNK" className="h-14 w-auto object-contain" />
            {selectedCompanyHeaderLogoUrl && (
              <img
                src={selectedCompanyHeaderLogoUrl}
                alt="Signup header logo"
                className="h-10 w-auto max-w-[220px] object-contain rounded-md bg-white/90 px-2 py-1"
              />
            )}
            {selectedCompanyLogoUrl ? (
              <img
                src={selectedCompanyLogoUrl}
                alt={`${selectedCompany.display_name || selectedCompany.name} logo`}
                className="h-12 w-auto max-w-[220px] object-contain rounded-md bg-white/90 px-2 py-1"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            )}
          </div>
          <CardTitle>{vendorSignupHeaderTitle}</CardTitle>
          <CardDescription className="text-slate-300">
            {vendorSignupHeaderSubtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200 flex items-start gap-2">
                <XCircle className="h-4 w-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="signup-company">Company</Label>
              {isCompanyLocked ? (
                <Input
                  id="signup-company"
                  value={selectedCompany?.display_name || selectedCompany?.name || "Loading company..."}
                  disabled
                />
              ) : (
                <Select
                  value={form.companyId}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, companyId: value }))}
                >
                  <SelectTrigger id="signup-company">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.display_name || company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-role">Account Type</Label>
              <Select
                value={form.role}
                onValueChange={(value: SignupRole) => setForm((prev) => ({ ...prev, role: value }))}
              >
                <SelectTrigger id="signup-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="design_professional">Design Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signup-first-name">First Name</Label>
                <Input
                  id="signup-first-name"
                  value={form.firstName}
                  onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-last-name">Last Name</Label>
                <Input
                  id="signup-last-name"
                  value={form.lastName}
                  onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-phone">Phone</Label>
                <Input
                  id="signup-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-business-name">Business Name</Label>
              <Input
                id="signup-business-name"
                value={form.businessName}
                onChange={(e) => setForm((prev) => ({ ...prev, businessName: e.target.value }))}
                placeholder="Optional"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                <Input
                  id="signup-confirm-password"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate("/auth")} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit For Approval
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
