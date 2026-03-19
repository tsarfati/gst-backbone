import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import builderlynkLogo from "@/assets/builderlynk-icon-shield.png";
import { resolveCompanyLogoUrl } from "@/utils/resolveCompanyLogoUrl";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";

type PublicCompany = {
  id: string;
  name: string;
  display_name: string | null;
  logo_url: string | null;
  vendor_portal_enabled: boolean | null;
  vendor_portal_signup_background_image_url: string | null;
  vendor_portal_signup_background_color: string | null;
  vendor_portal_signup_company_logo_url: string | null;
  vendor_portal_signup_header_logo_url: string | null;
  vendor_portal_signup_header_title: string | null;
  vendor_portal_signup_header_subtitle: string | null;
  vendor_portal_signup_modal_color: string | null;
  vendor_portal_signup_modal_opacity: number | null;
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(7,18,49,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const formatUsPhone = (input: string) => {
  const digits = input.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export default function VendorSignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const preselectedCompanyId = searchParams.get("company");
  const isConfirmedReturn = searchParams.get("confirmed") === "1";

  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [companies, setCompanies] = useState<PublicCompany[]>([]);
  const [signupResult, setSignupResult] = useState<{
    requiresEmailConfirmation?: boolean;
    linkedCompanyName?: string | null;
    linkedCompanyId?: string | null;
  } | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyId: preselectedCompanyId || "",
    businessName: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("list-public-signup-companies", {
          body: preselectedCompanyId
            ? { companyId: preselectedCompanyId }
            : { limit: 150 },
        });
        if (fnError) throw fnError;
        const rows = Array.isArray(data?.companies) ? data.companies : [];
        setCompanies(rows.filter((company: any) => company.vendor_portal_enabled !== false));
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
    if (loadingCompanies) return;
    if (!preselectedCompanyId) return;
    const exists = companies.some((c) => c.id === preselectedCompanyId);
    if (!exists) {
      setError("This company signup link is invalid.");
      return;
    }
    setForm((prev) => ({ ...prev, companyId: preselectedCompanyId }));
  }, [companies, loadingCompanies, preselectedCompanyId]);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === form.companyId) || null,
    [companies, form.companyId],
  );
  const selectedSignupLogoUrl = useMemo(
    () =>
      resolveCompanyLogoUrl(
        selectedCompany?.vendor_portal_signup_header_logo_url
        || selectedCompany?.vendor_portal_signup_company_logo_url
        || selectedCompany?.logo_url,
      ),
    [
      selectedCompany?.vendor_portal_signup_header_logo_url,
      selectedCompany?.vendor_portal_signup_company_logo_url,
      selectedCompany?.logo_url,
    ],
  );
  const selectedCompanyBackgroundUrl = useMemo(
    () => resolveCompanyLogoUrl(selectedCompany?.vendor_portal_signup_background_image_url),
    [selectedCompany?.vendor_portal_signup_background_image_url],
  );
  const selectedCompanyBackgroundColor = selectedCompany?.vendor_portal_signup_background_color?.trim() || "#030B20";
  const selectedCompanyModalColor = selectedCompany?.vendor_portal_signup_modal_color?.trim() || "#071231";
  const selectedCompanyModalOpacity = Math.min(
    1,
    Math.max(0.1, Number(selectedCompany?.vendor_portal_signup_modal_opacity ?? 0.96)),
  );

  const pageTitle = selectedCompany?.display_name || selectedCompany?.name
    ? `Join ${selectedCompany.display_name || selectedCompany.name}`
    : "Vendor / Design Professional Signup";
  const roleLabel = "Vendor";
  const vendorSignupHeaderTitle = selectedCompany?.vendor_portal_signup_header_title?.trim() || pageTitle;
  const vendorSignupHeaderSubtitle = selectedCompany?.vendor_portal_signup_header_subtitle?.trim()
    || (selectedCompany
      ? `Create your BuilderLYNK account to request access to ${selectedCompany.display_name || selectedCompany.name}.`
      : "Create your BuilderLYNK account and submit for company approval.");

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
      const remainingSeconds = Math.max(1, Math.ceil((rateLimitedUntil - Date.now()) / 1000));
      const waitMessage = `Email service is temporarily rate-limited. Please wait ${remainingSeconds}s before trying again.`;
      setError(waitMessage);
      toast({
        title: "Please wait",
        description: waitMessage,
        variant: "destructive",
      });
      return;
    }

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Phone number is required.");
      return;
    }
    if (!form.businessName.trim()) {
      setError("Business name is required.");
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

      const { data: requestData, error: requestError } = await supabase.functions.invoke("create-vendor-signup-request", {
        body: {
          email: normalizedEmail,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          companyId: form.companyId || null,
          requestedRole: "vendor",
          businessName: form.businessName.trim(),
          password: form.password,
        },
      });
      if (requestError) {
        let fnPayload: any = null;
        try {
          if (typeof (requestError as any)?.context?.json === "function") {
            fnPayload = await (requestError as any).context.json();
          }
        } catch {
          fnPayload = null;
        }
        const enrichedMessage =
          fnPayload?.error ||
          requestError.message ||
          "Failed to submit your signup request.";
        const enrichedError = new Error(enrichedMessage);
        (enrichedError as any).code = fnPayload?.code || null;
        (enrichedError as any).details = fnPayload?.details || null;
        throw enrichedError;
      }

      setSignupResult({
        requiresEmailConfirmation: Boolean(requestData?.requiresEmailConfirmation),
        linkedCompanyName: requestData?.linkedCompanyName || null,
        linkedCompanyId: requestData?.linkedCompanyId || null,
      });
      setSubmitted(true);
      toast({
        title: requestData?.requiresEmailConfirmation ? "Check your email" : "Request submitted",
        description: requestData?.requiresEmailConfirmation
          ? "We sent you a confirmation email to finish setting up your vendor account."
          : "Your vendor account signup was submitted successfully.",
      });
    } catch (e: any) {
      console.error("Vendor signup failed", e);
      const rawMessage = String(e?.message || "");
      const isRateLimited =
        rawMessage.toLowerCase().includes("rate limit") ||
        rawMessage.toLowerCase().includes("too many requests") ||
        rawMessage.includes("429");
      const message = isRateLimited
        ? "Email service is temporarily rate-limited. Please wait a few minutes, then try again."
        : (rawMessage || "Failed to submit your signup request.");
      const suffix = e?.details ? ` (${e.details})` : "";

      if (isRateLimited) {
        const cooldownMs = 2 * 60 * 1000;
        const until = Date.now() + cooldownMs;
        setRateLimitedUntil(until);
        setRateLimitCountdown(Math.ceil(cooldownMs / 1000));
      }
      setError(message);
      toast({
        title: "Signup failed",
        description: `${message}${suffix}`,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!rateLimitedUntil) return;

    const tick = () => {
      const seconds = Math.max(0, Math.ceil((rateLimitedUntil - Date.now()) / 1000));
      setRateLimitCountdown(seconds);
      if (seconds <= 0) {
        setRateLimitedUntil(null);
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [rateLimitedUntil]);

  if (loadingCompanies) {
    return <PremiumLoadingScreen text="Loading signup options..." />;
  }

  if (isConfirmedReturn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030B20] p-4">
        <Card className="w-full max-w-lg border-slate-700 bg-[#071231] text-slate-100">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Email Confirmed</h2>
            <p className="text-slate-300 mb-6">
              Your vendor account email has been confirmed. You can now sign in and continue setting up your BuilderLYNK vendor workspace.
            </p>
            <Button onClick={() => navigate("/auth")}>Go to Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030B20] p-4">
        <Card className="w-full max-w-lg border-slate-700 bg-[#071231] text-slate-100">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">
              {signupResult?.requiresEmailConfirmation ? "Check Your Email" : "Request Submitted"}
            </h2>
            <p className="text-slate-300 mb-6">
              {signupResult?.requiresEmailConfirmation
                ? (
                  <>
                    We sent a confirmation email to <strong>{form.email.trim().toLowerCase()}</strong>.
                    Confirm your email to finish setting up your vendor account
                    {signupResult?.linkedCompanyName
                      ? <> and connect it to <strong>{signupResult.linkedCompanyName}</strong>.</>
                      : "."}
                  </>
                )
                : selectedCompany
                ? (
                  <>
                    Your {roleLabel.toLowerCase()} account has been created and connected to{" "}
                    <strong>{selectedCompany.display_name || selectedCompany.name}</strong>.
                    You can now sign in and finish setup.
                  </>
                )
                : (
                  <>
                    Your independent {roleLabel.toLowerCase()} account has been created.
                    You can now sign in and manage your workspace.
                  </>
                )}
            </p>
            <Button onClick={() => navigate(signupResult?.requiresEmailConfirmation ? "/vendor-signup" : "/auth")}>
              {signupResult?.requiresEmailConfirmation ? "Back to Signup" : "Go to Sign In"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-4 bg-cover bg-center"
      style={
        selectedCompanyBackgroundUrl
          ? {
              backgroundImage: `url(${selectedCompanyBackgroundUrl})`,
            }
          : { backgroundColor: selectedCompanyBackgroundColor }
      }
    >
      <Card
        className="w-full max-w-2xl border-slate-700 text-slate-100"
        style={{ backgroundColor: hexToRgba(selectedCompanyModalColor, selectedCompanyModalOpacity) }}
      >
        <CardHeader className="text-center">
          {selectedSignupLogoUrl ? (
            <img
              src={selectedSignupLogoUrl}
              alt={`${selectedCompany?.display_name || selectedCompany?.name || 'Company'} logo`}
              className="mx-auto h-24 w-auto max-w-[320px] object-contain sm:h-28"
            />
          ) : (
            <div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-9 w-9 text-primary" />
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200 flex items-start gap-2">
                <XCircle className="h-4 w-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2 text-center pb-1">
              <CardTitle className="text-xl sm:text-2xl">{vendorSignupHeaderTitle}</CardTitle>
              <CardDescription className="text-slate-300">{vendorSignupHeaderSubtitle}</CardDescription>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-company">Request Access To (Optional)</Label>
              {preselectedCompanyId ? (
                <Input
                  id="signup-company"
                  value={selectedCompany?.display_name || selectedCompany?.name || "Loading company..."}
                  disabled
                />
              ) : (
                <Select
                  value={form.companyId || "__none__"}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, companyId: value === "__none__" ? "" : value }))}
                >
                  <SelectTrigger id="signup-company">
                    <SelectValue placeholder="No company selected (create independent vendor account)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No company selected (create independent vendor account)</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.display_name || company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, phone: formatUsPhone(e.target.value) }))
                  }
                  placeholder="(555) 555-5555"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-business-name">Business Name</Label>
              <Input
                id="signup-business-name"
                value={form.businessName}
                onChange={(e) => setForm((prev) => ({ ...prev, businessName: e.target.value }))}
                placeholder="Your company name"
                required
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

            <div className="flex flex-col items-center gap-2 pt-2">
              <Button
                type="submit"
                disabled={submitting || (!!rateLimitedUntil && Date.now() < rateLimitedUntil)}
              >
                {submitting
                  ? "Submitting..."
                  : (rateLimitedUntil && Date.now() < rateLimitedUntil)
                    ? `Try again in ${rateLimitCountdown}s`
                    : "Submit For Approval"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <a
        href="https://www.builderlynk.com"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-md border border-white/20 bg-black/30 px-3 py-2 text-xs text-slate-100 transition-colors hover:bg-black/45"
      >
        <img src={builderlynkLogo} alt="BuilderLYNK" className="h-5 w-auto object-contain" />
        <span>Powered by BuilderLYNK</span>
      </a>
    </div>
  );
}
