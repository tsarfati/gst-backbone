import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';
import { useRoleBasedRouting } from '@/hooks/useRoleBasedRouting';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';
import { getPublicAuthOrigin } from '@/utils/publicAuthOrigin';

type InvitePreview = {
  companyName: string;
  companyLogoUrl: string | null;
};

const parseInviteFunctionError = async (error: any) => {
  let payload: any = null;
  try {
    if (typeof error?.context?.json === 'function') {
      payload = await error.context.json();
    }
  } catch {
    payload = null;
  }
  const message = payload?.error || payload?.message || error?.message || 'Unknown invite error';
  return {
    message,
    code: payload?.code || null,
    requestId: payload?.requestId || null,
    debug: payload?.debug || null,
    raw: payload,
  };
};

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [inviteAccepting, setInviteAccepting] = useState(false);
  const [inviteAccepted, setInviteAccepted] = useState(false);
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [inviteHandledToken, setInviteHandledToken] = useState<string | null>(null);
  const [inviteRetryTick, setInviteRetryTick] = useState(0);
  const [inviteAcceptFailures, setInviteAcceptFailures] = useState(0);
  const [showEmailConfirmModal, setShowEmailConfirmModal] = useState(false);
  const [signupConfirmed, setSignupConfirmed] = useState(false);
  const lastInviteAcceptAttemptAtRef = useRef<number>(0);
  const inviteAttemptCountRef = useRef(0);
  
  const { signIn, signUp, signInWithGoogle, user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  
  // Use role-based routing after successful auth
  useRoleBasedRouting();

  useEffect(() => {
    if (!inviteToken) {
      setInvitePreview(null);
      return;
    }

    let cancelled = false;
    const loadInvitePreview = async () => {
      const { data, error } = await supabase.functions.invoke('get-invite-preview', {
        body: { inviteToken },
      });
      if (cancelled) return;

      if (error || !data?.companyName) {
        console.warn('Invite preview unavailable', error || data);
        setInvitePreview(null);
        return;
      }

      setInvitePreview({
        companyName: String(data.companyName),
        companyLogoUrl: data.companyLogoUrl ? String(data.companyLogoUrl) : null,
      });
    };

    loadInvitePreview();
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  // Invitation links should default to Sign Up for first-time users.
  // Users can still switch to Sign In manually if they already have an account.
  useEffect(() => {
    if (inviteToken && !user) {
      setActiveTab('signup');
    }
  }, [inviteToken, user]);

  // Check for recovery token in URL
  useEffect(() => {
    const type = searchParams.get('type');
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const impersonating = searchParams.get('impersonating');
    
    // Check URL hash for tokens (Supabase often puts them there)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hashType = hashParams.get('type');
    const hashAccessToken = hashParams.get('access_token');
    const hashRefreshToken = hashParams.get('refresh_token');
    const hashImpersonating = hashParams.get('impersonating');
    
    const isRecovery = type === 'recovery' || hashType === 'recovery';
    const isSignupConfirmation = type === 'signup' || hashType === 'signup';
    const isImpersonationSession = impersonating === '1' || hashImpersonating === '1';

    if (isImpersonationSession) {
      window.sessionStorage.setItem('builderlynk_impersonation_mode', '1');
    }
    
    if (isRecovery) {
      setIsRecoveryMode(true);
      
      // If we have tokens, set the session
      const token = accessToken || hashAccessToken;
      const refresh = refreshToken || hashRefreshToken;
      
      if (token && refresh) {
        supabase.auth.setSession({
          access_token: token,
          refresh_token: refresh,
        });
      }
      return;
    }

    if (isSignupConfirmation) {
      setSignupConfirmed(true);
      setActiveTab('signin');

      const token = accessToken || hashAccessToken;
      const refresh = refreshToken || hashRefreshToken;
      if (token && refresh) {
        supabase.auth.setSession({
          access_token: token,
          refresh_token: refresh,
        });
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (isRecoveryMode) return;
    if (!user) return;
    // Do not trap users on /auth while invite acceptance retries.
    // Only pause redirect while an accept attempt is actively running.
    if (inviteToken && inviteAccepting) return;
    
    // User is authenticated — redirect away from auth page
    if (!profile || profile?.profile_completed === false) {
      navigate('/profile-completion', { replace: true });
    } else {
      const role = String(profile?.role || '').toLowerCase();
      if (role === 'design_professional') {
        navigate('/design-professional/dashboard', { replace: true });
      } else if (role === 'vendor') {
        navigate('/vendor/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, profile, isRecoveryMode, navigate, inviteToken, inviteAccepting]);

  useEffect(() => {
    const maxInviteAttempts = 6;
    if (!inviteToken || !user || inviteAccepted || inviteAccepting || inviteHandledToken === inviteToken) return;
    if (inviteAttemptCountRef.current >= maxInviteAttempts) return;
    const now = Date.now();
    if (now - lastInviteAcceptAttemptAtRef.current < 3000) return;

    let cancelled = false;
    let retryTimer: number | null = null;

    const acceptInvite = async () => {
      inviteAttemptCountRef.current += 1;
      lastInviteAcceptAttemptAtRef.current = Date.now();
      setInviteAccepting(true);
      try {
        const invokeAcceptInvite = async () => {
          // Session token can lag briefly behind SIGNED_IN UI state in some environments.
          let lastError: any = null;
          for (let attempt = 0; attempt < 4; attempt++) {
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token;

            const { data, error } = await supabase.functions.invoke('accept-user-invite', {
              body: { inviteToken },
              headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
            });

            if (!error) return { data, error: null as any };

            lastError = error;
            const message = String(error?.message || '');
            const isUnauthorized = message.includes('401') || message.toLowerCase().includes('unauthorized');
            if (!isUnauthorized || attempt === 3) {
              return { data, error };
            }

            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          }

          return { data: null, error: lastError };
        };

        const { data, error } = await invokeAcceptInvite();

        if (error) {
          const parsed = await parseInviteFunctionError(error);
          console.error('Invite acceptance failed on /auth', parsed);
          throw parsed;
        }
        if (cancelled) return;

        setInviteAccepted(true);
        setInviteAcceptFailures(0);
        setInviteHandledToken(inviteToken);
        await new Promise((r) => setTimeout(r, 0));
        await refreshProfile();

        toast({
          title: 'Invitation accepted',
          description:
            'Your account is pending admin approval. You will receive an email once access is approved.',
        });
        console.info('Invite accepted on /auth', {
          requestId: data?.requestId || null,
          code: data?.code || null,
          debug: data?.debug || null,
        });

        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
      } catch (err: any) {
        if (cancelled) return;
        setInviteAcceptFailures((n) => n + 1);
        const message = String(err?.message || '').toLowerCase();
        const code = String(err?.code || '').toLowerCase();
        const terminalError =
          code === 'invitation_not_found' ||
          code === 'invitation_expired' ||
          code === 'invitation_email_mismatch' ||
          message.includes('invitation not found') ||
          message.includes('expired') ||
          message.includes('different email');
        if (terminalError) {
          setInviteHandledToken(inviteToken);
        }
        toast({
          title: 'Invitation issue',
          description: `${err?.message || 'Unable to apply this invitation automatically.'}${err?.code ? ` (code: ${err.code})` : ''}${err?.requestId ? ` [request: ${err.requestId}]` : ''}`,
          variant: 'destructive',
        });
        console.error('Invitation issue shown to user', err);

        if (!terminalError && inviteAttemptCountRef.current < maxInviteAttempts) {
          retryTimer = window.setTimeout(() => {
            setInviteRetryTick((n) => n + 1);
          }, 2500);
        }
      } finally {
        if (!cancelled) setInviteAccepting(false);
      }
    };

    acceptInvite();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [inviteToken, user, inviteAccepted, inviteAccepting, inviteHandledToken, toast, inviteRetryTick]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      if (inviteToken) {
        window.sessionStorage.setItem('pending_invite_auto_accept', '1');
      }
      toast({
        title: 'Success',
        description: 'Signed in successfully!',
      });
      // Auth effect above handles role-aware redirect after profile hydration.
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);

    const { error } = await signUp(email, password, firstName, lastName);
    
    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setShowEmailConfirmModal(true);
      setPassword('');
      setConfirmPassword('');
    }
    setLoading(false);
  };

  const handleAcknowledgeEmailConfirmation = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('Failed to sign out after signup confirmation prompt:', error);
    } finally {
      setShowEmailConfirmModal(false);
      setActiveTab('signin');
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    
    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }
    
    if (password.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    
    const { error } = await supabase.auth.updateUser({
      password: password,
    });
    
    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setResetSuccess(true);
      toast({
        title: 'Success',
        description: 'Your password has been reset successfully!',
      });
      // Clear URL params
      window.history.replaceState({}, document.title, '/auth');
    }
    setLoading(false);
  };

  // Password Reset Mode
  if (isRecoveryMode) {
    if (resetSuccess) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Card className="w-full max-w-md animate-fade-in">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Password Reset Complete!</CardTitle>
              <CardDescription>
                Your password has been successfully updated.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => {
                  setIsRecoveryMode(false);
                  setResetSuccess(false);
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="w-full"
                style={{ backgroundColor: '#E88A2D' }}
              >
                Continue to Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md animate-fade-in">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img 
                src={builderlynkIcon} 
                alt="BuilderLYNK" 
                className="h-20 w-auto drop-shadow-lg"
              />
            </div>
            <CardTitle className="text-2xl font-bold">
              <span className="text-gray-800">Reset Your </span>
              <span className="text-[#E88A2D]">Password</span>
            </CardTitle>
            <CardDescription>
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                <Input
                  id="confirm-new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
                style={{ backgroundColor: '#E88A2D' }}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </form>
            
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setIsRecoveryMode(false);
                  window.history.replaceState({}, document.title, '/auth');
                }}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Regular Auth Flow
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {inviteToken && invitePreview?.companyLogoUrl ? (
              <img
                src={invitePreview.companyLogoUrl}
                alt={invitePreview.companyName}
                className="h-20 w-auto max-w-[280px] object-contain"
              />
            ) : (
              <img
                src={builderlynkIcon}
                alt="BuilderLYNK"
                className="h-20 w-auto drop-shadow-lg"
              />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {inviteToken ? (
              <>
                <span className="text-gray-800">Join </span>
                <span className="text-[#E88A2D]">{invitePreview?.companyName || 'Your Team'}</span>
              </>
            ) : (
              <>
                <span className="text-gray-800">Welcome to </span>
                <span className="text-[#E88A2D]">BuilderLYNK</span>
              </>
            )}
          </CardTitle>
          <CardDescription>
            {inviteToken
              ? `${invitePreview?.companyName || 'A company'} invited you to join their team on BuilderLYNK. Create your account to continue.`
              : 'Sign in to your account or create a new one'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inviteToken && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {inviteAccepting
                ? 'Applying your invitation after sign-in...'
                : `Invitation link detected${invitePreview?.companyName ? ` for ${invitePreview.companyName}` : ''}.`}
            </div>
          )}
          {signupConfirmed && (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Email confirmed. Sign in to continue to your workspace.
            </div>
          )}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className={`grid w-full ${inviteToken ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {!inviteToken && <TabsTrigger value="signin">Sign In</TabsTrigger>}
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            {!inviteToken && (
              <TabsContent value="signin" className="animate-fade-in">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!email) {
                          toast({
                            title: 'Email Required',
                            description: 'Please enter your email address first.',
                            variant: 'destructive',
                          });
                          return;
                        }
                        setLoading(true);
                        const { error } = await supabase.auth.resetPasswordForEmail(email, {
                          redirectTo: `${getPublicAuthOrigin()}/auth?type=recovery`,
                        });
                        if (error) {
                          toast({
                            title: 'Error',
                            description: error.message,
                            variant: 'destructive',
                          });
                        } else {
                          toast({
                            title: 'Password Reset Email Sent',
                            description: 'Check your email for a password reset link.',
                          });
                        }
                        setLoading(false);
                      }}
                      className="text-sm text-[#E88A2D] hover:underline font-medium"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                  style={{ backgroundColor: '#E88A2D' }}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
                <div className="text-center text-sm text-muted-foreground">or</div>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue with Google
                </Button>
              </form>
              </TabsContent>
            )}
            
            <TabsContent value="signup" className="animate-fade-in">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name</Label>
                    <Input
                      id="first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input
                      id="last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                  <Input
                    id="signup-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                  style={{ backgroundColor: '#E88A2D' }}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign Up
                </Button>
                <div className="text-center text-sm text-muted-foreground">or</div>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue with Google
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          {!inviteToken && (
            <div className="mt-5 border-t pt-4 space-y-3">
              <p className="text-center text-sm text-muted-foreground">Choose account type</p>
              <div className="grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTab('signup')}
                >
                  Builder / Contractor Account
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/design-professional-signup')}
                >
                  Design Professional (Architect / Engineer)
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={showEmailConfirmModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md [&>button]:hidden">
          <DialogHeader>
            <DialogTitle>Check Your Email</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation email to <span className="font-medium text-foreground">{email}</span>. Please click that confirmation link before signing in.
          </p>
          <DialogFooter>
            <Button onClick={() => void handleAcknowledgeEmailConfirmation()} className="w-full">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
