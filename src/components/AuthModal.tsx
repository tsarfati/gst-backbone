import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Eye, EyeOff, X, ArrowLeft } from 'lucide-react';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';
import { getPublicAuthOrigin } from '@/utils/publicAuthOrigin';
import { setAuthEntryContext } from '@/utils/authEntryContext';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: 'signIn' | 'contact';
}

type AuthMode = 'signIn' | 'contact' | 'forgotPassword';

export function AuthModal({ open, onOpenChange, initialMode = 'contact' }: AuthModalProps) {
  const brandBlue = '#3B82F6';
  const brandOrange = '#E88A2D';
  const supportEmail = 'support@builderlink.com';
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactCompany, setContactCompany] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { signIn, signInWithGoogle } = useAuth();
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
    setContactName('');
    setContactCompany('');
    setContactEmail('');
    setContactMessage('');
    setShowPassword(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setAuthEntryContext('builder');
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
      navigate('/dashboard', { replace: true });
    }
    setLoading(false);
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please complete your name, email, and message.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
          <h2 style="margin: 0 0 16px;">BuilderLYNK Setup Request</h2>
          <p style="margin: 0 0 8px;"><strong>Name:</strong> ${escapeHtml(contactName.trim())}</p>
          <p style="margin: 0 0 8px;"><strong>Email:</strong> ${escapeHtml(contactEmail.trim())}</p>
          <p style="margin: 0 0 8px;"><strong>Company:</strong> ${escapeHtml(contactCompany.trim() || 'Not provided')}</p>
          <p style="margin: 16px 0 8px;"><strong>Message:</strong></p>
          <div style="white-space: pre-wrap; line-height: 1.5; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;">
            ${escapeHtml(contactMessage.trim())}
          </div>
        </div>
      `;

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: supportEmail,
          subject: `BuilderLYNK setup request: ${contactName.trim()}`,
          html,
        },
      });

      if (error) throw error;

      toast({
        title: 'Request sent',
        description: "We'll reach out to get your account set up.",
      });
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Could not send request',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
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
        description: 'Please check your email for a password reset link.',
      });
      setMode('signIn');
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setAuthEntryContext('builder');
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
      case 'contact':
        return (
          <>
            <span className="text-foreground">Contact </span>
            <span style={{ color: brandOrange }}>BuilderLYNK</span>
          </>
        );
      case 'signIn':
        return (
          <>
            <span className="text-foreground">Welcome Back to </span>
            <span style={{ color: brandBlue }}>BuilderLYNK</span>
          </>
        );
      case 'forgotPassword':
        return (
          <>
            <span className="text-foreground">Reset Your </span>
            <span style={{ color: brandBlue }}>Password</span>
          </>
        );
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'contact':
        return 'Tell us about your company and we will get your account set up';
      case 'signIn':
        return 'Sign in to access your dashboard';
      case 'forgotPassword':
        return "Enter your email and we'll send you a reset link";
    }
  };

  const accentColor = mode === 'contact' ? brandOrange : brandBlue;
  const accentRing = mode === 'contact' ? 'rgba(232, 138, 45, 0.3)' : 'rgba(59, 130, 246, 0.35)';
  const inputFocusClass = mode === 'contact'
    ? 'focus:border-[#E88A2D] focus:ring-[#E88A2D]'
    : 'focus:border-[#3B82F6] focus:ring-[#3B82F6]';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
        className="sm:max-w-lg w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] p-0 overflow-y-auto overflow-x-hidden border-0 shadow-2xl [&>button]:hidden"
        style={{ 
          borderRadius: '16px',
          boxShadow: `0 0 0 3px ${accentRing}, 0 25px 50px -12px rgba(0, 0, 0, 0.25)`
        }}
      >

        <div className="p-6 sm:p-8 pt-6">
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

          <div className="min-h-[88px] mb-3">
            {/* Title */}
            <h2 className="text-xl md:text-2xl font-black text-center mb-1 tracking-tight leading-tight whitespace-nowrap animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.2s' }}>
              {getTitle()}
            </h2>
            
            {/* Subtitle */}
            <p className="text-center text-gray-500 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.3s' }}>
              {getSubtitle()}
            </p>
          </div>

          {/* Forgot Password Form */}
          {mode === 'forgotPassword' && (
            <form onSubmit={handleForgotPassword} className="space-y-4 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.35s' }}>
              <div className="space-y-2">
              <Label htmlFor="auth-email" className="text-foreground font-semibold">
                  Email
                </Label>
                <Input
                  id="auth-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={`h-12 px-4 border-gray-300 rounded-lg ${inputFocusClass}`}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-bold rounded-lg shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(59,130,246,0.55)]"
                style={{ backgroundColor: accentColor }}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Send Reset Link
              </Button>
            </form>
          )}

          {/* Sign In / Contact Form */}
          {mode !== 'forgotPassword' && (
            <form onSubmit={mode === 'contact' ? handleContactSubmit : handleSignIn} className="space-y-3.5">
              {mode === 'signIn' ? (
                <>
                  <div className="space-y-2 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.35s' }}>
                    <Label htmlFor="auth-email" className="text-foreground font-semibold">
                      Email
                    </Label>
                    <Input
                      id="auth-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={`h-12 px-4 border-gray-300 rounded-lg ${inputFocusClass}`}
                    />
                  </div>

                  <div className="space-y-1.5 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.4s' }}>
                    <Label htmlFor="auth-password" className="text-foreground font-semibold">
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
                        className={`h-12 px-4 pr-12 border-gray-300 rounded-lg ${inputFocusClass}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>

                    <div className="text-right min-h-5">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgotPassword');
                          setPassword('');
                        }}
                        className="text-sm hover:underline font-medium"
                        style={{ color: accentColor }}
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>

                  <div className="animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.5s' }}>
                    <Button 
                      type="submit" 
                      className="w-full h-12 text-lg font-bold rounded-lg shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(59,130,246,0.55)]"
                      style={{ backgroundColor: accentColor }}
                      disabled={loading}
                    >
                      {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                      Sign In
                    </Button>
                  </div>

                  <div className="relative my-6 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.55s' }}>
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-400">or</span>
                    </div>
                  </div>

                  <div className="animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.6s' }}>
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full h-12 text-base font-medium rounded-lg border-border hover:bg-accent hover:text-accent-foreground"
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
                </>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.35s' }}>
                      <Label htmlFor="contact-name" className="text-foreground font-semibold">
                        Name
                      </Label>
                      <Input
                        id="contact-name"
                        placeholder="Your name"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        required
                        className={`h-12 px-4 border-gray-300 rounded-lg ${inputFocusClass}`}
                      />
                    </div>
                    <div className="space-y-2 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.4s' }}>
                      <Label htmlFor="contact-company" className="text-foreground font-semibold">
                        Company
                      </Label>
                      <Input
                        id="contact-company"
                        placeholder="Your company"
                        value={contactCompany}
                        onChange={(e) => setContactCompany(e.target.value)}
                        className={`h-12 px-4 border-gray-300 rounded-lg ${inputFocusClass}`}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.45s' }}>
                    <Label htmlFor="contact-email" className="text-foreground font-semibold">
                      Email
                    </Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="you@company.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      required
                      className={`h-12 px-4 border-gray-300 rounded-lg ${inputFocusClass}`}
                    />
                  </div>
                  <div className="space-y-2 animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.5s' }}>
                    <Label htmlFor="contact-message" className="text-foreground font-semibold">
                      Message
                    </Label>
                    <Textarea
                      id="contact-message"
                      placeholder="Tell us about your company and what you need set up."
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      required
                      rows={5}
                      className={`px-4 py-3 border-gray-300 rounded-lg resize-none ${inputFocusClass}`}
                    />
                  </div>
                  <div className="animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.55s' }}>
                    <Button
                      type="submit"
                      className="w-full h-12 text-lg font-bold rounded-lg shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(232,138,45,0.55)]"
                      style={{ backgroundColor: accentColor }}
                      disabled={loading}
                    >
                      {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                      Contact Us to Get Set Up
                    </Button>
                  </div>
                </>
              )}
            </form>
          )}

          {/* Toggle Sign In / Contact */}
          {mode !== 'forgotPassword' && (
            <p className="text-center mt-8 text-muted-foreground animate-[fade-in_0.4s_ease-out_forwards] opacity-0" style={{ animationDelay: '0.65s' }}>
              {mode === 'contact' ? 'Already have access? ' : "Don't have an account? "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'contact' ? 'signIn' : 'contact');
                  resetForm();
                }}
                className="font-semibold hover:underline"
                style={{ color: accentColor }}
              >
                {mode === 'contact' ? 'Sign In' : 'Contact us to get set up'}
              </button>
            </p>
          )}
        </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
