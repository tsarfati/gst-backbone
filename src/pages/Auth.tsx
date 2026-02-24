import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';
import { useRoleBasedRouting } from '@/hooks/useRoleBasedRouting';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';

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
  const [inviteHandledToken, setInviteHandledToken] = useState<string | null>(null);
  
  const { signIn, signUp, signInWithGoogle, user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  
  // Use role-based routing after successful auth
  useRoleBasedRouting();

  // Check for recovery token in URL
  useEffect(() => {
    const type = searchParams.get('type');
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    
    // Check URL hash for tokens (Supabase often puts them there)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hashType = hashParams.get('type');
    const hashAccessToken = hashParams.get('access_token');
    const hashRefreshToken = hashParams.get('refresh_token');
    
    const isRecovery = type === 'recovery' || hashType === 'recovery';
    
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
    }
  }, [searchParams]);

  useEffect(() => {
    if (isRecoveryMode) return;
    if (!user) return;
    if (inviteToken && (inviteAccepting || (!inviteAccepted && inviteHandledToken !== inviteToken))) return;
    
    // Wait for profile to load
    if (profile === null && user) return;

    // User is authenticated — redirect away from auth page
    if (profile?.profile_completed === false) {
      navigate('/profile-completion', { replace: true });
    } else {
      // Let useRoleBasedRouting handle it, but if no role yet just go to dashboard
      navigate('/dashboard', { replace: true });
    }
  }, [user, profile, isRecoveryMode, navigate, inviteToken, inviteAccepting, inviteAccepted, inviteHandledToken]);

  useEffect(() => {
    if (!inviteToken || !user || inviteAccepted || inviteAccepting || inviteHandledToken === inviteToken) return;

    let cancelled = false;

    const acceptInvite = async () => {
      setInviteAccepting(true);
      try {
        const { data, error } = await supabase.functions.invoke('accept-user-invite', {
          body: { inviteToken },
        });

        if (error) throw error;
        if (cancelled) return;

        setInviteAccepted(true);
        setInviteHandledToken(inviteToken);
        await new Promise((r) => setTimeout(r, 0));
        await refreshProfile();

        toast({
          title: 'Invitation accepted',
          description: data?.customRoleId
            ? 'Your company access and custom role have been applied.'
            : 'Your company access has been applied.',
        });

        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
      } catch (err: any) {
        if (cancelled) return;
        setInviteHandledToken(inviteToken);
        toast({
          title: 'Invitation issue',
          description: err?.message || 'Unable to apply this invitation automatically. Please contact your administrator.',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setInviteAccepting(false);
      }
    };

    acceptInvite();

    return () => {
      cancelled = true;
    };
  }, [inviteToken, user, inviteAccepted, inviteAccepting, inviteHandledToken, toast]);

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
      toast({
        title: 'Success',
        description: 'Signed in successfully!',
      });
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
      toast({
        title: 'Success',
        description: inviteToken
          ? 'Account created. If email confirmation is enabled, check your inbox; then sign in to finish accepting your invitation.'
          : 'Account created! Please check your email for verification.',
      });
    }
    setLoading(false);
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
            <img 
              src={builderlynkIcon} 
              alt="BuilderLYNK" 
              className="h-20 w-auto drop-shadow-lg"
            />
          </div>
          <CardTitle className="text-2xl font-bold">
            <span className="text-gray-800">Welcome to </span>
            <span className="text-[#E88A2D]">BuilderLYNK</span>
          </CardTitle>
          <CardDescription>
            {inviteToken ? 'You were invited to join a company. Sign in or create your account to accept the invitation.' : 'Sign in to your account or create a new one'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inviteToken && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {inviteAccepting ? 'Applying your invitation after sign-in...' : 'This page was opened from a BuilderLYNK invitation link.'}
            </div>
          )}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
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
                          redirectTo: `${window.location.origin}/auth?type=recovery`,
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
        </CardContent>
      </Card>
    </div>
  );
}
