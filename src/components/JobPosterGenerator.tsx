import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileImage, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

interface JobPosterGeneratorProps {
  jobId: string;
  jobName: string;
  qrCode: string;
}

export function JobPosterGenerator({ jobId, jobName, qrCode }: JobPosterGeneratorProps) {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [generating, setGenerating] = useState(false);

  const loadImageAsDataUrl = async (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [16, 185, 129]; // Default green
  };

  const generatePoster = async () => {
    if (!currentCompany?.id) {
      toast({
        title: "Error",
        description: "Company not found.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);

    try {
      // Fetch company branding settings
      let primaryColor = '#10b981'; // Default green
      let logoUrl: string | null = null;

      // Try to get visitor login settings for brand color
      const { data: loginSettings } = await supabase
        .from('visitor_login_settings')
        .select('primary_color, button_color, header_logo_url')
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (loginSettings) {
        primaryColor = loginSettings.button_color || loginSettings.primary_color || primaryColor;
        logoUrl = loginSettings.header_logo_url || null;
      }

      // Fallback to company logo if no header logo in settings
      if (!logoUrl && currentCompany.logo_url) {
        logoUrl = currentCompany.logo_url;
      }

      // Generate QR code
      const baseUrl = 'https://builderlynk.lovable.app';
      const qrData = `${baseUrl}/visitor/${qrCode}`;
      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        width: 400,
        margin: 0,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Create PDF (Letter size: 8.5 x 11 inches)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter'
      });

      const pageWidth = 8.5;
      const pageHeight = 11;
      const centerX = pageWidth / 2;

      // White background
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');

      let yPos = 0.5;

      // Load and add company logo if available
      if (logoUrl) {
        try {
          const logoDataUrl = await loadImageAsDataUrl(logoUrl);
          if (logoDataUrl) {
            const logoMaxWidth = 3;
            const logoMaxHeight = 1.5;
            
            // Get image dimensions
            const img = new Image();
            await new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.src = logoDataUrl;
            });
            
            const aspectRatio = img.width / img.height;
            let logoWidth = logoMaxWidth;
            let logoHeight = logoWidth / aspectRatio;
            
            if (logoHeight > logoMaxHeight) {
              logoHeight = logoMaxHeight;
              logoWidth = logoHeight * aspectRatio;
            }
            
            const logoX = centerX - logoWidth / 2;
            pdf.addImage(logoDataUrl, 'PNG', logoX, yPos, logoWidth, logoHeight);
            yPos += logoHeight + 0.3;
          }
        } catch (error) {
          console.error('Error loading logo:', error);
        }
      } else {
        // Add company name as fallback
        pdf.setFontSize(36);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(currentCompany.name || 'Company', centerX, yPos + 0.5, { align: 'center' });
        yPos += 1;
      }

      // "VISITORS &" text
      pdf.setFontSize(48);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('VISITORS &', centerX, yPos + 0.8, { align: 'center' });
      yPos += 0.9;

      // "CONTRACTORS" text
      pdf.text('CONTRACTORS', centerX, yPos + 0.6, { align: 'center' });
      yPos += 0.7;

      // "MUST SIGN IN" text in brand color
      const [r, g, b] = hexToRgb(primaryColor);
      pdf.setTextColor(r, g, b);
      pdf.text('MUST SIGN IN', centerX, yPos + 0.7, { align: 'center' });
      yPos += 1.2;

      // Draw phone icon with arrow (simplified)
      const phoneX = centerX - 2.5;
      const phoneY = yPos;
      const phoneWidth = 1.2;
      const phoneHeight = 2;

      // Phone outline
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.05);
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(phoneX, phoneY, phoneWidth, phoneHeight, 0.1, 0.1, 'FD');
      
      // Phone screen
      pdf.setFillColor(200, 200, 200);
      pdf.rect(phoneX + 0.1, phoneY + 0.2, phoneWidth - 0.2, phoneHeight - 0.4, 'F');
      
      // Home button
      pdf.setFillColor(0, 0, 0);
      pdf.circle(phoneX + phoneWidth / 2, phoneY + phoneHeight - 0.12, 0.06, 'F');

      // Arrow
      const arrowStartX = phoneX + phoneWidth + 0.15;
      const arrowEndX = arrowStartX + 0.8;
      const arrowY = phoneY + phoneHeight / 2;
      
      pdf.setLineWidth(0.08);
      pdf.line(arrowStartX, arrowY, arrowEndX, arrowY);
      
      // Arrow head
      pdf.setFillColor(0, 0, 0);
      pdf.triangle(
        arrowEndX + 0.2, arrowY,
        arrowEndX, arrowY - 0.12,
        arrowEndX, arrowY + 0.12,
        'F'
      );

      // QR Code
      const qrSize = 2.5;
      const qrX = centerX - 0.3;
      const qrY = phoneY - 0.25;
      pdf.addImage(qrCodeDataURL, 'PNG', qrX, qrY, qrSize, qrSize);
      yPos += 2.7;

      // "SCAN HERE" text in brand color
      pdf.setFontSize(48);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(r, g, b);
      pdf.text('SCAN HERE', centerX, yPos + 0.6, { align: 'center' });
      yPos += 1.3;

      // Job name at the bottom
      pdf.setFontSize(32);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(r, g, b);
      pdf.text(jobName, centerX, yPos + 0.4, { align: 'center' });

      // Save the PDF
      const fileName = `visitor-poster-${jobName.replace(/\s+/g, '-')}.pdf`;
      pdf.save(fileName);

      toast({
        title: "Poster Downloaded",
        description: "Job site visitor poster has been downloaded successfully.",
      });
    } catch (error) {
      console.error('Error generating poster:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate job poster. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={generatePoster} 
      disabled={generating}
      className="flex-1"
    >
      {generating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <FileImage className="mr-2 h-4 w-4" />
          Download Poster
        </>
      )}
    </Button>
  );
}
