import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function VisitorCheckout() {
  const { token } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [visitorLog, setVisitorLog] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedOut, setCheckedOut] = useState(false);

  useEffect(() => {
    if (token) {
      loadVisitorLog();
    }
  }, [token]);

  const loadVisitorLog = async () => {
    try {
      const { data, error } = await supabase
        .from('visitor_logs')
        .select('*, jobs(name, address)')
        .eq('checkout_token', token)
        .single();

      if (error || !data) {
        setError('Invalid or expired checkout link.');
        return;
      }

      if (data.checked_out_at) {
        setCheckedOut(true);
      }

      setVisitorLog(data);
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
          checked_out_at: new Date().toISOString(),
        })
        .eq('id', visitorLog.id);

      if (error) {
        throw error;
      }

      setCheckedOut(true);
      toast({
        title: "Checked Out Successfully",
        description: "Thank you for visiting. Have a safe trip!",
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Already Checked Out</h2>
            <p className="text-muted-foreground mb-4">
              You have already checked out from {visitorLog?.jobs?.name}.
            </p>
            <p className="text-sm text-muted-foreground">
              Checked out at: {new Date(visitorLog.checked_out_at).toLocaleString()}
            </p>
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
