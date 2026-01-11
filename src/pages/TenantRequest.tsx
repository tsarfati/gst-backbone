import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Building2, Clock, CheckCircle } from 'lucide-react';

export default function TenantRequest() {
  const { user, profile } = useAuth();
  const { hasTenantAccess, hasPendingRequest, pendingRequest, loading: tenantLoading, refreshTenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [organizationName, setOrganizationName] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tenantLoading && hasTenantAccess) {
      navigate('/', { replace: true });
    }
  }, [hasTenantAccess, tenantLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    if (!organizationName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an organization name.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('tenant_access_requests')
        .insert({
          user_id: user.id,
          request_type: 'create_tenant',
          tenant_name: organizationName.trim(),
          notes: reason.trim() || null,
          status: 'pending'
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Request Already Exists',
            description: 'You already have a pending request. Please wait for approval.',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: 'Request Submitted',
          description: 'Your request has been submitted. You will be notified when it is approved.',
        });
        await refreshTenant();
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show pending status if user has a pending request
  if (hasPendingRequest && pendingRequest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Request Pending</CardTitle>
            <CardDescription>
              Your request to create an organization is being reviewed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{pendingRequest.tenant_name}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Submitted on {new Date(pendingRequest.created_at).toLocaleDateString()}
              </p>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              You will be notified when your request is approved. This typically takes 1-2 business days.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Create Your Organization</CardTitle>
          <CardDescription>
            Request access to create a new organization on GSTHUB. An administrator will review your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name *</Label>
              <Input
                id="org-name"
                placeholder="Enter your organization name"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Why do you want to use GSTHUB? (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Tell us about your organization and how you plan to use GSTHUB..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">Free unlimited access</p>
                <p>Create as many companies as you need within your organization.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
