import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2, CheckCircle, XCircle } from 'lucide-react';
import builderlynkLogo from '@/assets/builderlynk-icon-shield.png';
import { PremiumLoadingScreen } from '@/components/PremiumLoadingScreen';
import { getPublicAuthOrigin } from '@/utils/publicAuthOrigin';
import { resolveCompanyLogoUrl } from '@/utils/resolveCompanyLogoUrl';

interface Invitation {
  id: string;
  vendor_id: string;
  company_id: string;
  invited_by?: string | null;
  email: string;
  status: string;
  expires_at: string;
  vendor?: {
    name: string;
    vendor_type?: string | null;
  };
  company?: {
    name: string;
    logo_url?: string | null;
  };
}

type PublicCompanyBranding = {
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

const isDesignProfessionalVendorType = (value: string | null | undefined) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'design_professional' || normalized === 'design professional';
};

export default function VendorRegister() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get('token');
  const rfpId = searchParams.get('rfpId');
  const vendorId = searchParams.get('vendorId');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [companyBranding, setCompanyBranding] = useState<PublicCompanyBranding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: ''
  });

  const vendorType = String((invitation?.vendor as any)?.vendor_type || '').toLowerCase();
  const isDesignProfessional = vendorType === 'design_professional';
  const companyName = companyBranding?.display_name || companyBranding?.name || (invitation?.company as any)?.name || 'BuilderLYNK';
  const selectedSignupLogoUrl = useMemo(
    () =>
      resolveCompanyLogoUrl(
        companyBranding?.vendor_portal_signup_header_logo_url
        || companyBranding?.vendor_portal_signup_company_logo_url
        || companyBranding?.logo_url
        || (invitation?.company as any)?.logo_url,
      ),
    [
      companyBranding?.vendor_portal_signup_header_logo_url,
      companyBranding?.vendor_portal_signup_company_logo_url,
      companyBranding?.logo_url,
      (invitation?.company as any)?.logo_url,
    ],
  );
  const selectedCompanyBackgroundUrl = useMemo(
    () => resolveCompanyLogoUrl(companyBranding?.vendor_portal_signup_background_image_url),
    [companyBranding?.vendor_portal_signup_background_image_url],
  );
  const selectedCompanyBackgroundColor = String(companyBranding?.vendor_portal_signup_background_color || '#030B20').trim();
  const selectedCompanyModalColor = String(companyBranding?.vendor_portal_signup_modal_color || '#071231').trim();
  const selectedCompanyModalOpacity = Math.min(
    1,
    Math.max(0.1, Number(companyBranding?.vendor_portal_signup_modal_opacity ?? 0.96)),
  );
  const landingTitle = isDesignProfessional ? 'Create Your Design Professional Account' : 'Create Your Vendor Account';
  const defaultLandingSubtitle = isDesignProfessional
    ? `You've been invited by ${companyName} to join as a design professional.`
    : `You've been invited by ${companyName} to join as a vendor.`;
  const brandedHeaderTitle = String(companyBranding?.vendor_portal_signup_header_title || '').trim() || landingTitle;
  const brandedHeaderSubtitle = String(companyBranding?.vendor_portal_signup_header_subtitle || '').trim() || defaultLandingSubtitle;
  const vendorLoginHref = invitation?.company_id
    ? `/vendor-login?company=${encodeURIComponent(invitation.company_id)}${token ? `&token=${encodeURIComponent(token)}` : ''}`
    : '/vendor-login';

  const loadCompanyBranding = async (companyId: string) => {
    const { data: companyPayload, error: companyPayloadError } = await supabase.functions.invoke('list-public-signup-companies', {
      body: { companyId },
    });

    if (companyPayloadError) {
      console.error('Failed loading vendor register branding payload:', companyPayloadError);
      return;
    }

    const brandedCompany = Array.isArray(companyPayload?.companies) ? companyPayload.companies[0] : null;
    setCompanyBranding(brandedCompany || null);
  };

  useEffect(() => {
    if (token) {
      validateToken();
    } else {
      setError('No invitation token provided');
      setLoading(false);
    }
  }, [token, rfpId, vendorId]);

  const validateToken = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_invitations')
        .select(`
          id,
          vendor_id,
          company_id,
          invited_by,
          email,
          status,
          expires_at,
          created_user_id,
          vendor:vendors(name, vendor_type),
          company:companies(name, logo_url)
        `)
        .eq('token', token)
        .single();

      if (error || !data) {
        setError('Invalid or expired invitation link');
        setLoading(false);
        return;
      }

      if (data.status !== 'pending') {
        if (data.status === 'accepted' && (data as any).created_user_id) {
          setInvitation(data as unknown as Invitation);
          setAlreadyAccepted(true);
          if ((data as any)?.company_id) {
            await loadCompanyBranding((data as any).company_id);
          }
        } else {
          setError(data.status === 'accepted' ? 'This invitation has already been used' : 'This invitation is no longer active');
        }
        setLoading(false);
        return;
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        setError('This invitation has expired');
        setLoading(false);
        return;
      }

      setInvitation(data as unknown as Invitation);

      if (rfpId && vendorId) {
        supabase.functions.invoke('track-rfp-invite-open', {
          body: { rfpId, vendorId },
        }).catch((trackingError) => {
          console.error('Failed to mark RFP invite as opened from vendor register:', trackingError);
        });
      }

      if ((data as any)?.company_id) {
        await loadCompanyBranding((data as any).company_id);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error validating token:', err);
      setError('Failed to validate invitation');
      setLoading(false);
    }
  };

  const sendPasswordReset = async () => {
    const targetEmail = invitation?.email?.trim();
    if (!targetEmail) return;

    setResetSending(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${getPublicAuthOrigin()}/auth?type=recovery`,
      });
      if (resetError) throw resetError;
      toast({
        title: 'Password reset sent',
        description: `Check ${targetEmail} for the password reset link.`,
      });
    } catch (resetError: any) {
      toast({
        title: 'Password reset failed',
        description: resetError?.message || 'Unable to send a password reset email right now.',
        variant: 'destructive',
      });
    } finally {
      setResetSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'Password mismatch',
        description: 'Passwords do not match',
        variant: 'destructive'
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSubmitting(true);

      // Create the user account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invitation!.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${getPublicAuthOrigin()}/`,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            is_vendor: true,
            vendor_id: invitation!.vendor_id
          }
        }
      });

      if (signUpError) throw signUpError;

      const authUser = authData.user;
      const identityCount = Array.isArray((authUser as any)?.identities)
        ? (authUser as any).identities.length
        : 0;

      if (authUser && identityCount === 0) {
        toast({
          title: 'Account already exists',
          description: 'This email already has a BuilderLYNK account. Sign in to this company vendor portal instead.',
        });
        navigate(vendorLoginHref, { replace: true });
        return;
      }

      if (authUser) {
        const { data: finalizeData, error: finalizeError } = await supabase.functions.invoke(
          'finalize-vendor-invite-registration',
          {
            body: {
              token,
              userId: authUser.id,
              firstName: formData.firstName,
              lastName: formData.lastName,
            },
          },
        );

        if (finalizeError) {
          throw finalizeError;
        }

        if (!finalizeData?.success) {
          throw new Error('Failed to finalize vendor invitation registration');
        }

        setSuccess(true);
        toast({
          title: 'Account created!',
          description: 'Please check your email to verify your account'
        });
      }
    } catch (err: any) {
      console.error('Error creating account:', err);
      const errorMessage = String(err?.message || '').toLowerCase();
      if (errorMessage.includes('already registered') || errorMessage.includes('already exists')) {
        toast({
          title: 'Account already exists',
          description: 'This email already has a BuilderLYNK account. Sign in to the vendor portal for this company instead.',
        });
        navigate(vendorLoginHref, { replace: true });
        return;
      }
      toast({
        title: 'Error',
        description: err.message || 'Failed to create account',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PremiumLoadingScreen text="Validating invitation..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030B20] p-4">
        <Card className="w-full max-w-md border-slate-700 bg-[#071231] text-slate-100">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Invitation</h2>
            <p className="text-slate-300 mb-6">{error}</p>
            <Button onClick={() => navigate(vendorLoginHref)}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030B20] p-4">
        <Card className="w-full max-w-md border-slate-700 bg-[#071231] text-slate-100">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Account Created!</h2>
            <p className="text-slate-300 mb-6">
              Please check your email ({invitation?.email}) to verify your account before logging in.
            </p>
            <Button onClick={() => navigate(vendorLoginHref)}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (alreadyAccepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030B20] p-4">
        <Card className="w-full max-w-md border-slate-700 bg-[#071231] text-slate-100">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Account Already Created</h2>
            <p className="text-slate-300 mb-2">
              This invitation has already been accepted for {invitation?.email}.
            </p>
            <p className="text-sm text-slate-400 mb-6">
              Sign in to continue, or send a password reset if the password was not saved.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate(vendorLoginHref)}>
                Go to Login
              </Button>
              <Button variant="outline" onClick={sendPasswordReset} disabled={resetSending}>
                {resetSending ? 'Sending Reset...' : 'Send Password Reset'}
              </Button>
            </div>
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
          ? { backgroundImage: `url(${selectedCompanyBackgroundUrl})` }
          : { backgroundColor: selectedCompanyBackgroundColor }
      }
    >
      <Card
        className="w-full max-w-lg border-slate-700 text-slate-100"
        style={{ backgroundColor: hexToRgba(selectedCompanyModalColor, selectedCompanyModalOpacity) }}
      >
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex flex-col items-center gap-3">
            {selectedSignupLogoUrl ? (
              <img
                src={selectedSignupLogoUrl}
                alt={`${companyName} logo`}
                className="h-16 w-auto max-w-[260px] object-contain rounded-md bg-white/90 px-2 py-1"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            )}
          </div>
          <CardTitle>{brandedHeaderTitle}</CardTitle>
          <CardDescription className="text-slate-300">
            {brandedHeaderSubtitle}
            <br />
            Invited entity: <strong className="text-slate-100">{(invitation?.vendor as any)?.name}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={invitation?.email || ''}
                readOnly
                autoComplete="email"
                className="bg-slate-800 border-slate-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                name="company_name"
                value={(invitation?.vendor as any)?.name || ''}
                readOnly
                className="bg-slate-800 border-slate-600"
              />
              <p className="text-xs text-slate-300">
                This comes from the RFP invitation. Contact the builder if it needs to be changed.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="first_name"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="John"
                  autoComplete="given-name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="last_name"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Doe"
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="new_password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirm_password"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                'Creating Account...'
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate(vendorLoginHref)}>
              Sign in
            </Button>
          </p>
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
