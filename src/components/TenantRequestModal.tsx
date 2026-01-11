import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, CheckCircle } from 'lucide-react';

interface TenantRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TenantRequestModal({ open, onOpenChange }: TenantRequestModalProps) {
  const [step, setStep] = useState<'auth' | 'request' | 'success'>('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { user, signUp, signIn, signInWithGoogle } = useAuth();
  const { refreshTenant } = useTenant();
  const { toast } = useToast();

  // If user is already authenticated, skip to request step
  const currentStep = user ? (step === 'auth' ? 'request' : step) : step;

  const resetForm = () => {
    setStep('auth');
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setTenantName('');
    setNotes('');
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
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
        title: 'Account Created',
        description: 'Please check your email for verification, then continue.',
      });
      setStep('request');
    }
    setLoading(false);
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
      setStep('request');
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

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);

    try {
      const { error } = await supabase
        .from('tenant_access_requests')
        .insert({
          user_id: user.id,
          tenant_name: tenantName,
          notes: notes || null,
          status: 'pending'
        });

      if (error) throw error;

      await refreshTenant();
      setStep('success');
      toast({
        title: 'Request Submitted',
        description: 'Your organization request has been submitted for review.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {currentStep === 'auth' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-center">Create Your Organization</DialogTitle>
              <DialogDescription className="text-center">
                Create an account to get started
              </DialogDescription>
            </DialogHeader>
            
            <div className="mt-4 space-y-4">
              <div className="space-y-4">
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
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button onClick={handleSignUp} className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account & Continue
                </Button>
                <div className="text-center text-sm text-muted-foreground">or</div>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  Continue with Google
                </Button>
              </div>
            </div>
          </>
        )}

        {currentStep === 'request' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-center">
                <Building2 className="h-8 w-8 text-primary mx-auto mb-2" />
                Request New Organization
              </DialogTitle>
              <DialogDescription className="text-center">
                Tell us about your organization. An admin will review your request.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmitRequest} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tenant-name">Organization Name *</Label>
                <Input
                  id="tenant-name"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="Your company or organization name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tell us a bit about your business..."
                  rows={3}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            </form>
          </>
        )}

        {currentStep === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                Request Submitted!
              </DialogTitle>
              <DialogDescription className="text-center">
                Your organization request has been submitted successfully. 
                An administrator will review your request and you'll be notified once approved.
              </DialogDescription>
            </DialogHeader>
            
            <div className="mt-6">
              <Button onClick={handleClose} className="w-full">
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
