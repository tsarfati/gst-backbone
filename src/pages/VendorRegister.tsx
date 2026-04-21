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

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [companyBranding, setCompanyBranding] = useState<PublicCompanyBranding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

  useEffect(() => {
    if (token) {
      validateToken();
    } else {
      setError('No invitation token provided');
      setLoading(false);
    }
  }, [token]);

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

      // Check if still active
      if (data.status !== 'pending') {
        setError(data.status === 'accepted' ? 'This invitation has already been used' : 'This invitation is no longer active');
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

      if ((data as any)?.company_id) {
        const { data: companyPayload, error: companyPayloadError } = await supabase.functions.invoke('list-public-signup-companies', {
          body: { companyId: (data as any).company_id },
        });

        if (companyPayloadError) {
          console.error('Failed loading vendor register branding payload:', companyPayloadError);
        } else {
          const brandedCompany = Array.isArray(companyPayload?.companies) ? companyPayload.companies[0] : null;
          setCompanyBranding(brandedCompany || null);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Error validating token:', err);
      setError('Failed to validate invitation');
      setLoading(false);
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

      if (authData.user) {
        const externalRole = isDesignProfessionalVendorType((invitation?.vendor as any)?.vendor_type)
          ? 'design_professional'
          : 'vendor';
        const approvedAt = new Date().toISOString();

        // Update the invitation status
        await supabase
          .from('vendor_invitations')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
            created_user_id: authData.user.id
          })
          .eq('id', invitation!.id);

        // Create profile for the vendor user
        await supabase
          .from('profiles')
          .upsert({
            user_id: authData.user.id,
            email: invitation!.email,
            first_name: formData.firstName,
            last_name: formData.lastName,
            display_name: `${formData.firstName} ${formData.lastName}`.trim(),
            role: externalRole,
            current_company_id: invitation!.company_id,
            default_company_id: invitation!.company_id,
            status: 'approved',
            approved_at: approvedAt,
            approved_by: invitation!.invited_by || authData.user.id,
            vendor_id: invitation!.vendor_id,
          });

        // Give them access to the company as a vendor
        await supabase
          .from('user_company_access')
          .upsert({
            user_id: authData.user.id,
            company_id: invitation!.company_id,
            role: externalRole,
            is_active: true,
            granted_by: invitation!.invited_by || authData.user.id
          }, { onConflict: 'user_id,company_id' });

        setSuccess(true);
        toast({
          title: 'Account created!',
          description: 'Please check your email to verify your account'
        });
      }
    } catch (err: any) {
      console.error('Error creating account:', err);
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
            <Button onClick={() => navigate('/auth')}>
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
            <Button onClick={() => navigate('/auth')}>
              Go to Login
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
            <img
              src={builderlynkLogo}
              alt="BuilderLYNK"
              className="h-12 w-auto object-contain"
            />
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={invitation?.email || ''}
                disabled
                className="bg-slate-800 border-slate-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="John"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="••••••••"
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
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/auth')}>
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
