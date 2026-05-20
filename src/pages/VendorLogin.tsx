import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building2, LogIn, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { resolveCompanyLogoUrl } from "@/utils/resolveCompanyLogoUrl";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";
import builderlynkLogo from "@/assets/builderlynk-icon-shield.png";
import { useAuth } from "@/contexts/AuthContext";
import { setAuthEntryContext } from "@/utils/authEntryContext";
import { setVendorPortalCompanyId } from "@/utils/vendorPortalSession";

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
  const normalized = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(7,18,49,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function VendorLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { signIn, signOut, user } = useAuth();

  const preselectedCompanyId = searchParams.get("company");
  const invitationToken = searchParams.get("token");

  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<PublicCompany[]>([]);
  const [form, setForm] = useState({
    companyId: preselectedCompanyId || "",
    email: "",
    password: "",
  });

  useEffect(() => {
    setAuthEntryContext("vendor");
  }, []);

  useEffect(() => {
    setVendorPortalCompanyId(form.companyId || null);
  }, [form.companyId]);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("list-public-signup-companies", {
          body: preselectedCompanyId ? { companyId: preselectedCompanyId } : { limit: 150 },
        });
        if (fnError) throw fnError;
        const rows = Array.isArray(data?.companies) ? data.companies : [];
        setCompanies(rows.filter((company: PublicCompany) => company.vendor_portal_enabled !== false));
      } catch (loadError) {
        console.error("Failed to load companies for vendor login", loadError);
        setError("Unable to load company branding right now.");
      } finally {
        setLoadingCompanies(false);
      }
    };

    void loadCompanies();
  }, [preselectedCompanyId]);

  useEffect(() => {
    if (loadingCompanies || !preselectedCompanyId) return;
    const exists = companies.some((company) => company.id === preselectedCompanyId);
    if (!exists) {
      setError("This company login link is invalid.");
      return;
    }
    setForm((prev) => ({ ...prev, companyId: preselectedCompanyId }));
  }, [companies, loadingCompanies, preselectedCompanyId]);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === form.companyId) || null,
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
      selectedCompany?.logo_url,
      selectedCompany?.vendor_portal_signup_company_logo_url,
      selectedCompany?.vendor_portal_signup_header_logo_url,
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
    ? `${selectedCompany.display_name || selectedCompany.name} Vendor Portal`
    : "Vendor Portal Login";
  const loginHeaderTitle = selectedCompany?.vendor_portal_signup_header_title?.trim() || pageTitle;
  const loginHeaderSubtitle = selectedCompany?.vendor_portal_signup_header_subtitle?.trim()
    || (selectedCompany
      ? `Sign in to access ${selectedCompany.display_name || selectedCompany.name}'s vendor portal.`
      : "Sign in to access your BuilderLYNK vendor portal.");

  const vendorSignupHref = form.companyId
    ? `/vendor-signup?company=${encodeURIComponent(form.companyId)}`
    : "/vendor-signup";
  const vendorLoginHref = form.companyId
    ? `/vendor-login?company=${encodeURIComponent(form.companyId)}`
    : "/vendor-login";

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      setAuthEntryContext("vendor");
      setVendorPortalCompanyId(form.companyId || null);
      const { error: signInError } = await signIn(form.email.trim(), form.password);
      if (signInError) throw signInError;

      const { data: authUserData, error: authUserError } = await supabase.auth.getUser();
      if (authUserError) throw authUserError;
      const signedInUser = authUserData.user;

      if (signedInUser && (invitationToken || form.companyId)) {
        const { data: finalizeData, error: finalizeError } = await supabase.functions.invoke(
          "finalize-vendor-invite-registration",
          {
            body: {
              token: invitationToken,
              userId: signedInUser.id,
              companyId: form.companyId,
            },
          },
        );

        if (finalizeError) throw finalizeError;
        if (!finalizeData?.success) {
          throw new Error("Failed to finalize vendor portal access for this company");
        }
      }

      toast({
        title: "Signed in",
        description: "Taking you to your vendor portal.",
      });
      navigate("/vendor/dashboard", { replace: true });
    } catch (signInError: any) {
      console.error("Vendor login failed", signInError);
      const message = signInError?.message || "Unable to sign in right now.";
      setError(message);
      toast({
        title: "Sign in failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCompanies) {
    return <PremiumLoadingScreen text="Loading vendor portal..." />;
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-4 bg-cover bg-center"
      style={
        selectedCompanyBackgroundUrl
          ? { backgroundImage: `url(${selectedCompanyBackgroundUrl})` }
          : { backgroundColor: selectedCompanyBackgroundColor }
      }
    >
      <Card
        className="w-full max-w-xl border-slate-700 text-slate-100"
        style={{ backgroundColor: hexToRgba(selectedCompanyModalColor, selectedCompanyModalOpacity) }}
      >
        <CardHeader className="text-center">
          {selectedSignupLogoUrl ? (
            <img
              src={selectedSignupLogoUrl}
              alt={`${selectedCompany?.display_name || selectedCompany?.name || "Company"} logo`}
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
            {user && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                <p className="mb-2">
                  You are currently signed in to BuilderLYNK. Sign in below to switch to this vendor portal account.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void signOut(vendorLoginHref)}
                >
                  Sign Out First
                </Button>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200 flex items-start gap-2">
                <XCircle className="h-4 w-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2 text-center pb-1">
              <CardTitle className="text-xl sm:text-2xl">{loginHeaderTitle}</CardTitle>
              <CardDescription className="text-slate-300">{loginHeaderSubtitle}</CardDescription>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-company">Company</Label>
              <Input
                id="login-company"
                value={selectedCompany?.display_name || selectedCompany?.name || "Vendor portal"}
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                autoComplete="current-password"
                required
              />
            </div>

            <div className="flex flex-col items-center gap-2 pt-2">
              <Button type="submit" disabled={submitting} className="min-w-40">
                <LogIn className="mr-2 h-4 w-4" />
                {submitting ? "Signing In..." : "Sign In"}
              </Button>
              <p className="text-sm text-slate-300 text-center">
                Need an account?{" "}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-slate-100"
                  onClick={() => navigate(vendorSignupHref)}
                >
                  Request vendor access
                </Button>
              </p>
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
