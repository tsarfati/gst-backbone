import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Eye, EyeOff, X, ArrowLeft } from 'lucide-react';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: 'signIn' | 'signUp';
}

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

export function AuthModal({ open, onOpenChange, initialMode = 'signUp' }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { toast } = useToast();

  // Reset mode when modal opens with a new initialMode
  useEffect(() => {
    if (open) {
      setMode(initialMode);
    }
  }, [open, initialMode]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

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
      resetForm();
      onOpenChange(false);
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

    const { error } = await signUp(email, password);
    
    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Account created! Please check your email to verify your account.',
      });
      resetForm();
      setMode('signIn');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
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
        description: 'Please check your email for a password reset link.',
      });
      setMode('signIn');
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

  const getTitle = () => {
    switch (mode) {
      case 'signUp':
        return (
          <>
            <span className="text-gray-800">Create Your </span>
            <span className="text-[#E88A2D]">BuilderLYNK</span>
          </>
        );
      case 'signIn':
        return (
          <>
            <span className="text-gray-800">Welcome Back to </span>
            <span className="text-[#E88A2D]">BuilderLYNK</span>
          </>
        );
      case 'forgotPassword':
        return (
          <>
            <span className="text-gray-800">Reset Your </span>
            <span className="text-[#E88A2D]">Password</span>
          </>
        );
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'signUp':
        return 'Start building smarter today';
      case 'signIn':
        return 'Sign in to access your dashboard';
      case 'forgotPassword':
        return "Enter your email and we'll send you a reset link";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md p-0 overflow-hidden border-0 shadow-2xl"
        style={{ 
          borderRadius: '16px',
          boxShadow: '0 0 0 3px rgba(232, 138, 45, 0.3), 0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>

        <div className="p-8 pt-6">
          {/* Back button for forgot password */}
          {mode === 'forgotPassword' && (
            <button
              onClick={() => setMode('signIn')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition-colors animate-fade-in"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back to sign in</span>
            </button>
          )}

          {/* Logo */}
          <div className="flex justify-center mb-6 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.1s' }}>
            <img 
              src={builderlynkIcon} 
              alt="BuilderLYNK" 
              className="h-28 w-auto drop-shadow-lg"
            />
          </div>

          {/* Title */}
          <h2 className="text-2xl md:text-3xl font-black text-center mb-1 tracking-tight animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.2s' }}>
            {getTitle()}
          </h2>
          
          {/* Subtitle */}
          <p className="text-center text-gray-500 mb-8 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.3s' }}>
            {getSubtitle()}
          </p>

          {/* Forgot Password Form */}
          {mode === 'forgotPassword' && (
            <form onSubmit={handleForgotPassword} className="space-y-5 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.35s' }}>
              <div className="space-y-2">
                <Label htmlFor="auth-email" className="text-gray-700 font-semibold">
                  Email
                </Label>
                <Input
                  id="auth-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 px-4 border-gray-300 rounded-lg focus:border-[#E88A2D] focus:ring-[#E88A2D]"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-bold rounded-lg shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(232,138,45,0.6)]"
                style={{ backgroundColor: '#E88A2D' }}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Send Reset Link
              </Button>
            </form>
          )}

          {/* Sign In / Sign Up Form */}
          {mode !== 'forgotPassword' && (
            <form onSubmit={mode === 'signUp' ? handleSignUp : handleSignIn} className="space-y-5">
              <div className="space-y-2 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.35s' }}>
                <Label htmlFor="auth-email" className="text-gray-700 font-semibold">
                  Email
                </Label>
                <Input
                  id="auth-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 px-4 border-gray-300 rounded-lg focus:border-[#E88A2D] focus:ring-[#E88A2D]"
                />
              </div>
              
              <div className="space-y-2 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.4s' }}>
                <Label htmlFor="auth-password" className="text-gray-700 font-semibold">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 px-4 pr-12 border-gray-300 rounded-lg focus:border-[#E88A2D] focus:ring-[#E88A2D]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                
                {/* Forgot Password Link */}
                {mode === 'signIn' && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgotPassword');
                        setPassword('');
                        setConfirmPassword('');
                      }}
                      className="text-sm text-[#E88A2D] hover:underline font-medium"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>

              {mode === 'signUp' && (
                <div className="space-y-2 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.45s' }}>
                  <Label htmlFor="auth-confirm-password" className="text-gray-700 font-semibold">
                    Confirm Password
                  </Label>
                  <Input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-12 px-4 border-gray-300 rounded-lg focus:border-[#E88A2D] focus:ring-[#E88A2D]"
                  />
                </div>
              )}

              {/* Sign In / Sign Up Button */}
              <div className="animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.5s' }}>
                <Button 
                  type="submit" 
                  className="w-full h-12 text-lg font-bold rounded-lg shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(232,138,45,0.6)]"
                  style={{ backgroundColor: '#E88A2D' }}
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  {mode === 'signUp' ? 'Sign Up' : 'Sign In'}
                </Button>
              </div>

              {/* Divider */}
              <div className="relative my-6 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.55s' }}>
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-400">or</span>
                </div>
              </div>

              {/* Google Sign In */}
              <div className="animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.6s' }}>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full h-12 text-base font-medium rounded-lg border-gray-300 hover:bg-gray-50" 
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  )}
                  Continue with Google
                </Button>
              </div>
            </form>
          )}

          {/* Toggle Sign In / Sign Up */}
          {mode !== 'forgotPassword' && (
            <p className="text-center mt-8 text-gray-600 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.65s' }}>
              {mode === 'signUp' ? "Already a member? " : "Don't have an account? "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signUp' ? 'signIn' : 'signUp');
                  resetForm();
                }}
                className="font-semibold text-[#E88A2D] hover:underline"
              >
                {mode === 'signUp' ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
