import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface Invitation {
  id: string;
  vendor_id: string;
  company_id: string;
  email: string;
  status: string;
  expires_at: string;
  vendor?: {
    name: string;
  };
  company?: {
    name: string;
  };
}

export default function VendorRegister() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: ''
  });

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
          email,
          status,
          expires_at,
          vendor:vendors(name),
          company:companies(name)
        `)
        .eq('token', token)
        .single();

      if (error || !data) {
        setError('Invalid or expired invitation link');
        setLoading(false);
        return;
      }

      // Check if already accepted
      if (data.status === 'accepted') {
        setError('This invitation has already been used');
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
          emailRedirectTo: `${window.location.origin}/`,
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
            first_name: formData.firstName,
            last_name: formData.lastName,
            is_vendor_user: true,
            vendor_id: invitation!.vendor_id
          });

        // Give them access to the company as a vendor
        await supabase
          .from('user_company_access')
          .insert({
            user_id: authData.user.id,
            company_id: invitation!.company_id,
            role: 'vendor',
            granted_by: invitation!.vendor_id
          });

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Invitation</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
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
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Account Created!</h2>
            <p className="text-muted-foreground mb-6">
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
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Create Your Vendor Account</CardTitle>
          <CardDescription>
            You've been invited by <strong>{(invitation?.company as any)?.name}</strong> to join as <strong>{(invitation?.vendor as any)?.name}</strong>
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
                className="bg-muted"
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
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Account...
                </>
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
    </div>
  );
}