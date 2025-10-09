import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CheckoutSettings {
  checkout_title: string;
  checkout_message: string;
  checkout_show_duration: boolean;
}

export default function VisitorCheckout() {
  const { token } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [visitorLog, setVisitorLog] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedOut, setCheckedOut] = useState(false);
  const [checkoutSettings, setCheckoutSettings] = useState<CheckoutSettings>({
    checkout_title: 'Successfully Checked Out',
    checkout_message: 'Thank you for visiting. Have a safe trip!',
    checkout_show_duration: true,
  });

  useEffect(() => {
    if (token) {
      loadVisitorLog();
    }
  }, [token]);

  const loadVisitorLog = async () => {
    try {
      const { data, error } = await supabase
        .from('visitor_logs')
        .select('*')
        .eq('checkout_token', token)
        .single();

      if (error || !data) {
        setError('Invalid or expired checkout link.');
        return;
      }

      if (data.check_out_time) {
        setCheckedOut(true);
      }

      // Load job details
      const { data: jobData } = await supabase
        .from('jobs')
        .select('name, address, company_id')
        .eq('id', data.job_id)
        .single();

      setVisitorLog({ ...data, jobs: jobData });

      // Load checkout settings from company
      if (jobData?.company_id) {
        const { data: settings } = await supabase
          .from('visitor_login_settings')
          .select('checkout_title, checkout_message, checkout_show_duration')
          .eq('company_id', jobData.company_id)
          .maybeSingle();

        if (settings) {
          setCheckoutSettings(settings);
        }
      }
    } catch (err) {
      console.error('Error loading visitor log:', err);
      setError('Failed to load visitor information.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!visitorLog) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('visitor_logs')
        .update({ 
          check_out_time: new Date().toISOString(),
        })
        .eq('id', visitorLog.id);

      if (error) {
        throw error;
      }

      setCheckedOut(true);
      setVisitorLog(prev => ({ ...prev, check_out_time: new Date().toISOString() }));
      toast({
        title: checkoutSettings.checkout_title,
        description: checkoutSettings.checkout_message,
      });
    } catch (err) {
      console.error('Error checking out:', err);
      toast({
        title: "Checkout Failed",
        description: "Failed to check out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const calculateDuration = () => {
    if (!visitorLog?.check_in_time || !visitorLog?.check_out_time) return null;
    
    const checkIn = new Date(visitorLog.check_in_time);
    const checkOut = new Date(visitorLog.check_out_time);
    const diff = checkOut.getTime() - checkIn.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading checkout information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Checkout Error</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (checkedOut) {
    const duration = calculateDuration();
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-3">{checkoutSettings.checkout_title}</h2>
            <p className="text-muted-foreground mb-4">
              {checkoutSettings.checkout_message}
            </p>
            {checkoutSettings.checkout_show_duration && duration && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Time on site: <span className="font-medium text-foreground">{duration}</span>
                </p>
              </div>
            )}
            <div className="mt-6 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Checked out at: {new Date(visitorLog.check_out_time).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Visitor Checkout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Job Site:</p>
            <p className="font-medium">{visitorLog?.jobs?.name}</p>
            {visitorLog?.jobs?.address && (
              <p className="text-sm text-muted-foreground">{visitorLog.jobs.address}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Visitor:</p>
            <p className="font-medium">{visitorLog?.visitor_name}</p>
            {visitorLog?.company_name && (
              <p className="text-sm text-muted-foreground">Company: {visitorLog.company_name}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Check-in Time:</p>
            <p className="font-medium">
              {new Date(visitorLog?.check_in_time).toLocaleString()}
            </p>
          </div>

          <Button
            onClick={handleCheckout}
            disabled={processing}
            className="w-full"
            size="lg"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking Out...
              </>
            ) : (
              'Check Out Now'
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By checking out, you confirm you are leaving the job site.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
