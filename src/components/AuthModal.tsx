import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, X } from 'lucide-react';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { toast } = useToast();

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
      setIsSignUp(false);
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

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    resetForm();
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
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img 
              src={builderlynkIcon} 
              alt="BuilderLYNK" 
              className="h-28 w-auto drop-shadow-lg"
            />
          </div>

          {/* Title */}
          <h2 className="text-2xl md:text-3xl font-black text-center mb-1 tracking-tight">
            <span className="text-gray-800">
              {isSignUp ? 'Create Your ' : 'Welcome Back to '}
            </span>
            <span className="text-[#E88A2D]">BuilderLYNK</span>
          </h2>
          
          {/* Subtitle */}
          <p className="text-center text-gray-500 mb-8">
            {isSignUp ? 'Start building smarter today' : 'Sign in to access your dashboard'}
          </p>

          {/* Form */}
          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-5">
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
            
            <div className="space-y-2">
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
            </div>

            {isSignUp && (
              <div className="space-y-2">
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
            <Button 
              type="submit" 
              className="w-full h-12 text-lg font-bold rounded-lg shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(232,138,45,0.6)]"
              style={{ backgroundColor: '#E88A2D' }}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-400">or</span>
              </div>
            </div>

            {/* Google Sign In */}
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
          </form>

          {/* Toggle Sign In / Sign Up */}
          <p className="text-center mt-8 text-gray-600">
            {isSignUp ? "Already a member? " : "Don't have an account? "}
            <button
              type="button"
              onClick={toggleMode}
              className="font-semibold text-[#E88A2D] hover:underline"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
