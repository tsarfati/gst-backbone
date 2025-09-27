import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCode, Download, Copy, Smartphone, Users, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface JobQRCodeProps {
  jobId: string;
  jobName: string;
  visitorQrCode?: string;
  onQrCodeUpdate?: (newCode: string) => void;
}

export function JobQRCode({ jobId, jobName, visitorQrCode, onQrCodeUpdate }: JobQRCodeProps) {
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState(visitorQrCode || '');
  const [loading, setLoading] = useState(!visitorQrCode);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!visitorQrCode) {
      loadQrCode();
    }
  }, [jobId, visitorQrCode]);

  const loadQrCode = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('visitor_qr_code')
        .eq('id', jobId)
        .single();

      if (error) throw error;

      if (data?.visitor_qr_code) {
        setQrCode(data.visitor_qr_code);
      } else {
        // Generate new QR code if none exists
        await generateNewQrCode();
      }
    } catch (error) {
      console.error('Error loading QR code:', error);
      toast({
        title: "Error",
        description: "Failed to load QR code.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateNewQrCode = async () => {
    setRegenerating(true);
    try {
      // Generate new QR code using the database function
      const { data: newQrCode, error: qrError } = await supabase
        .rpc('generate_visitor_qr_code');

      if (qrError) throw qrError;

      // Update the job with the new QR code
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ visitor_qr_code: newQrCode })
        .eq('id', jobId);

      if (updateError) throw updateError;

      setQrCode(newQrCode);
      onQrCodeUpdate?.(newQrCode);

      toast({
        title: "QR Code Generated",
        description: "New visitor QR code has been generated successfully.",
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate new QR code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRegenerating(false);
    }
  };

  const copyQrCodeLink = () => {
    const link = `${window.location.origin}/visitor/${qrCode}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link Copied",
      description: "Visitor login link has been copied to clipboard.",
    });
  };

  const downloadQrCode = () => {
    // Create a simple QR code representation for download
    const qrData = `${window.location.origin}/visitor/${qrCode}`;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      canvas.width = 300;
      canvas.height = 350;
      
      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // QR code placeholder (black squares pattern)
      ctx.fillStyle = 'black';
      const qrSize = 200;
      const startX = (canvas.width - qrSize) / 2;
      const startY = 50;
      
      // Simple pattern to represent QR code
      const gridSize = 10;
      for (let i = 0; i < qrSize; i += gridSize) {
        for (let j = 0; j < qrSize; j += gridSize) {
          if ((i + j) % (gridSize * 2) === 0) {
            ctx.fillRect(startX + i, startY + j, gridSize - 1, gridSize - 1);
          }
        }
      }
      
      // Job name text
      ctx.fillStyle = 'black';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(jobName, canvas.width / 2, startY + qrSize + 30);
      
      // QR code text
      ctx.font = '12px Arial';
      ctx.fillText(`QR: ${qrCode}`, canvas.width / 2, startY + qrSize + 50);
      
      // Download
      const link = document.createElement('a');
      link.download = `visitor-qr-${jobName.replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL();
      link.click();
      
      toast({
        title: "QR Code Downloaded",
        description: "QR code has been downloaded as PNG image.",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading QR code...</div>
        </CardContent>
      </Card>
    );
  }

  const visitorLink = `${window.location.origin}/visitor/${qrCode}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <QrCode className="h-5 w-5" />
          <span>Visitor QR Code</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* QR Code Display */}
        <div className="text-center">
          <div className="inline-block p-4 bg-white border-2 border-dashed border-gray-300 rounded-lg">
            <div className="w-32 h-32 bg-gray-100 border flex items-center justify-center rounded">
              <div className="text-center">
                <QrCode className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-xs text-gray-500">QR Code</p>
                <p className="text-xs font-mono">{qrCode}</p>
              </div>
            </div>
          </div>
        </div>

        {/* QR Code Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">QR Code:</span>
            <Badge variant="outline" className="font-mono text-xs">
              {qrCode}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            <Smartphone className="inline h-4 w-4 mr-1" />
            Scan this code or visit the link to access the visitor login
          </div>
        </div>

        {/* Visitor Link */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Visitor Login Link:</Label>
          <div className="flex space-x-2">
            <Input
              value={visitorLink}
              readOnly
              className="font-mono text-sm"
            />
            <Button variant="outline" size="sm" onClick={copyQrCodeLink}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          <Button variant="outline" onClick={downloadQrCode} className="flex-1">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button 
            variant="outline" 
            onClick={generateNewQrCode} 
            disabled={regenerating}
            className="flex-1"
          >
            {regenerating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate
              </>
            )}
          </Button>
        </div>

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p className="flex items-center">
            <Users className="h-4 w-4 mr-2" />
            Visitors can scan this QR code to access the check-in form
          </p>
          <p>• No app installation required</p>
          <p>• Works on any smartphone or tablet</p>
          <p>• Automatically captures date and time</p>
        </div>
      </CardContent>
    </Card>
  );
}