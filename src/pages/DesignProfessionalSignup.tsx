import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Building2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import designProLogo from '@/assets/design-pro-lynk-logo.png';
import { resolveCompanyLogoUrl } from '@/utils/resolveCompanyLogoUrl';
import { PremiumLoadingScreen } from '@/components/PremiumLoadingScreen';
import { getPublicAuthOrigin } from '@/utils/publicAuthOrigin';

type PublicCompany = {
  id: string;
  name: string;
  display_name: string | null;
  logo_url: string | null;
  design_professional_portal_enabled: boolean | null;
  design_professional_signup_background_image_url: string | null;
  design_professional_signup_background_color: string | null;
  design_professional_signup_logo_url: string | null;
  design_professional_signup_header_title: string | null;
  design_professional_signup_header_subtitle: string | null;
  design_professional_signup_modal_color: string | null;
  design_professional_signup_modal_opacity: number | null;
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

const parseFunctionInvokeError = async (error: any) => {
  let payload: any = null;
  try {
    if (typeof error?.context?.json === 'function') {
      payload = await error.context.json();
    }
  } catch {
    payload = null;
  }

  return {
    message: payload?.error || error?.message || 'Failed to submit your signup request.',
    code: payload?.code || null,
    details: payload?.details || null,
    hint: payload?.hint || null,
  };
};

export default function DesignProfessionalSignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const preselectedCompanyId = searchParams.get('company');
  const jobInviteToken = searchParams.get('jobInvite');
  const isInviteFlow = Boolean(jobInviteToken);
  const confirmationSuccess = searchParams.get('confirmed') === '1';
  const isCompanyLocked = isInviteFlow && Boolean(preselectedCompanyId);

  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<PublicCompany[]>([]);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyId: isInviteFlow ? (preselectedCompanyId || '') : '',
    businessName: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!isInviteFlow) {
      setLoadingCompanies(false);
      setCompanies([]);
      return;
    }

    const loadCompanies = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('list-public-signup-companies', {
          body: preselectedCompanyId
            ? { companyId: preselectedCompanyId }
            : { limit: 150 },
        });
        if (fnError) throw fnError;

        const rows = Array.isArray(data?.companies) ? data.companies : [];
        setCompanies(rows.filter((company: any) => company.design_professional_portal_enabled !== false));
      } catch (e: any) {
        console.error('Failed to load companies for design professional signup', e);
        setError('Unable to load companies right now.');
      } finally {
        setLoadingCompanies(false);
      }
    };

    void loadCompanies();
  }, [isInviteFlow, preselectedCompanyId]);

  useEffect(() => {
    if (!isInviteFlow || !isCompanyLocked || loadingCompanies || !preselectedCompanyId) return;
    const exists = companies.some((c) => c.id === preselectedCompanyId);
    if (!exists) {
      setError('This company signup link is invalid or unavailable.');
      return;
    }
    setForm((prev) => ({ ...prev, companyId: preselectedCompanyId }));
  }, [companies, isInviteFlow, isCompanyLocked, loadingCompanies, preselectedCompanyId]);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === form.companyId) || null,
    [companies, form.companyId],
  );

  const signupLogoUrl = useMemo(
    () => resolveCompanyLogoUrl(selectedCompany?.design_professional_signup_logo_url || selectedCompany?.logo_url),
    [selectedCompany?.design_professional_signup_logo_url, selectedCompany?.logo_url],
  );

  const backgroundImageUrl = useMemo(
    () => resolveCompanyLogoUrl(selectedCompany?.design_professional_signup_background_image_url),
    [selectedCompany?.design_professional_signup_background_image_url],
  );
  const selectedBackgroundColor = selectedCompany?.design_professional_signup_background_color?.trim() || '#030B20';
  const selectedModalColor = selectedCompany?.design_professional_signup_modal_color?.trim() || '#071231';
  const selectedModalOpacity = Math.min(
    1,
    Math.max(0.1, Number(selectedCompany?.design_professional_signup_modal_opacity ?? 0.96)),
  );

  const pageTitle = selectedCompany?.display_name || selectedCompany?.name
    ? `Join ${selectedCompany.display_name || selectedCompany.name}`
    : 'Design Professional Signup';

  const signupHeader = selectedCompany?.design_professional_signup_header_title?.trim() || pageTitle;
  const signupSubheader = selectedCompany?.design_professional_signup_header_subtitle?.trim()
    || (selectedCompany
      ? `Create your BuilderLYNK design professional account for ${selectedCompany.display_name || selectedCompany.name}.`
      : 'Create your BuilderLYNK design professional account. Company/job access is granted only through invite links.');

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }
    if (isInviteFlow && !form.companyId) {
      setError('This invitation is invalid. Please use your latest invite link.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const normalizedEmail = form.email.trim().toLowerCase();

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: form.password,
        options: {
          emailRedirectTo: `${getPublicAuthOrigin()}/auth?type=signup&portal=designpro`,
          data: {
            first_name: form.firstName.trim(),
            last_name: form.lastName.trim(),
            requested_role: 'design_professional',
            requested_company_id: isInviteFlow ? form.companyId : null,
            business_name: form.businessName.trim() || null,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user?.id) throw new Error('Signup completed but no user id was returned.');

      const { error: requestError } = await supabase.functions.invoke('create-vendor-signup-request', {
        body: {
          userId: signUpData.user.id,
          email: normalizedEmail,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim() || null,
          companyId: isInviteFlow ? (form.companyId || null) : null,
          requestedRole: 'design_professional',
          businessName: form.businessName.trim() || null,
          jobInviteToken: jobInviteToken || null,
        },
      });

      if (requestError) {
        const parsed = await parseFunctionInvokeError(requestError);
        const enrichedError = new Error(parsed.message);
        (enrichedError as any).code = parsed.code;
        (enrichedError as any).details = parsed.details;
        (enrichedError as any).hint = parsed.hint;
        throw enrichedError;
      }

      setSubmitted(true);
      toast({
        title: 'Account created',
        description: 'Please confirm your email, then sign in to access your design professional account.',
      });
    } catch (e: any) {
      console.error('Design professional signup failed', e);
      const message = e?.message || 'Failed to submit your signup request.';
      const suffix = e?.hint
        ? ` Hint: ${e.hint}`
        : e?.details
          ? ` (${e.details})`
          : '';
      setError(message);
      toast({ title: 'Signup failed', description: `${message}${suffix}`, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCompanies) {
    return <PremiumLoadingScreen text="Loading signup options..." />;
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030B20] p-4">
        <Card className="w-full max-w-lg border-slate-700 bg-[#071231] text-slate-100">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Account Created</h2>
            <p className="text-slate-300 mb-6">
              Your design professional account has been created for{' '}
              <strong>{selectedCompany?.display_name || selectedCompany?.name || 'the selected company'}</strong>.
              Please confirm your email, then sign in.
            </p>
            <Button onClick={() => navigate('/auth')}>Go to Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (confirmationSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030B20] p-4">
        <Card className="w-full max-w-lg border-slate-700 bg-[#071231] text-slate-100">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-green-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Email Confirmed</h2>
            <p className="text-slate-300 mb-6">
              Your email has been confirmed. Sign in to continue to your DesignProLYNK workspace.
            </p>
            <Button onClick={() => navigate('/auth?type=signup&portal=designpro')}>Go to Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-4 bg-cover bg-center"
      style={backgroundImageUrl
        ? { backgroundImage: `url(${backgroundImageUrl})` }
        : { backgroundColor: selectedBackgroundColor }}
    >
      <Card
        className="w-full max-w-2xl border-slate-700 text-slate-100"
        style={{ backgroundColor: hexToRgba(selectedModalColor, selectedModalOpacity) }}
      >
        <CardHeader className="text-center pb-2">
          {signupLogoUrl ? (
            <img
              src={signupLogoUrl}
              alt={`${selectedCompany?.display_name || selectedCompany?.name || 'Company'} logo`}
              className="mx-auto w-64 h-auto object-contain drop-shadow-2xl sm:w-72"
            />
          ) : (
            <img
              src={designProLogo}
              alt="Design Pro LYNK"
              className="mx-auto w-64 h-auto object-contain drop-shadow-2xl sm:w-72"
            />
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

            <div className="text-center pb-2">
              <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight mb-3">
                {signupHeader}
              </h1>
              <p className="text-gray-400 text-lg sm:text-xl leading-relaxed max-w-lg mx-auto">
                {signupSubheader}
              </p>
            </div>

            {isInviteFlow ? (
              <div className="space-y-2">
                <Label htmlFor="signup-company">Invited Company</Label>
                {isCompanyLocked ? (
                <Input id="signup-company" value={selectedCompany?.display_name || selectedCompany?.name || 'Loading company...'} disabled />
                ) : (
                  <Input id="signup-company" value="Loading invitation details..." disabled />
                )}
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signup-first-name">First Name</Label>
                <Input id="signup-first-name" value={form.firstName} onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-last-name">Last Name</Label>
                <Input id="signup-last-name" value={form.lastName} onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))} required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input id="signup-email" type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-phone">Phone</Label>
                <Input
                  id="signup-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: formatUsPhone(e.target.value) }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-business-name">Business Name</Label>
              <Input id="signup-business-name" value={form.businessName} onChange={(e) => setForm((prev) => ({ ...prev, businessName: e.target.value }))} placeholder="Optional" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input id="signup-password" type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                <Input id="signup-confirm-password" type="password" value={form.confirmPassword} onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} required />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="px-10 py-4 text-white font-bold rounded-lg inline-flex items-center gap-2 transition-all duration-200 hover:brightness-110 text-lg disabled:opacity-50 disabled:pointer-events-none"
                style={{ backgroundColor: '#E88A2D' }}
              >
                {submitting ? 'Creating Account...' : 'Create Account'} <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

    </div>
  );
}
