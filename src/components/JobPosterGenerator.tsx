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

      // First, use company logo as the primary source
      if (currentCompany.logo_url) {
        logoUrl = currentCompany.logo_url;
      }

      // Try to get visitor login settings for brand color and override logo if available
      const { data: loginSettings } = await supabase
        .from('visitor_login_settings')
        .select('primary_color, button_color, header_logo_url')
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (loginSettings) {
        primaryColor = loginSettings.button_color || loginSettings.primary_color || primaryColor;
        // Override with header logo if available in visitor settings
        if (loginSettings.header_logo_url) {
          logoUrl = loginSettings.header_logo_url;
        }
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

      let yPos = 0.15; // Minimal top margin

      // Load and add company logo if available
      if (logoUrl) {
        try {
          const logoDataUrl = await loadImageAsDataUrl(logoUrl);
          if (logoDataUrl) {
            const logoMaxWidth = 6.5; // Even larger logo
            const logoMaxHeight = 2.5;
            
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
            yPos += logoHeight + 0.1;
          }
        } catch (error) {
          console.error('Error loading logo:', error);
        }
      } else {
        // Add company name as fallback
        pdf.setFontSize(56);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(currentCompany.name || 'Company', centerX, yPos + 0.7, { align: 'center' });
        yPos += 1.0;
      }

      // "VISITORS &" text - larger font
      pdf.setFontSize(72);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('VISITORS &', centerX, yPos + 0.85, { align: 'center' });
      yPos += 0.95;

      // "CONTRACTORS" text
      pdf.text('CONTRACTORS', centerX, yPos + 0.85, { align: 'center' });
      yPos += 1.0;

      // "MUST SIGN IN" text in brand color
      const [r, g, b] = hexToRgb(primaryColor);
      pdf.setTextColor(r, g, b);
      pdf.text('MUST SIGN IN', centerX, yPos + 0.85, { align: 'center' });
      yPos += 0.95;

      // Phone icon - larger, on the left side
      const phoneWidth = 2.1;
      const phoneHeight = 3.6;
      const phoneX = centerX - 3.8;
      const phoneY = yPos;

      // Phone body (rounded rectangle)
      pdf.setDrawColor(0, 0, 0);
      pdf.setFillColor(40, 40, 40);
      pdf.setLineWidth(0.02);
      pdf.roundedRect(phoneX, phoneY, phoneWidth, phoneHeight, 0.2, 0.2, 'F');
      
      // Phone screen (white inner rectangle)
      const screenMargin = 0.15;
      const screenTop = 0.35;
      const screenBottom = 0.55;
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(
        phoneX + screenMargin, 
        phoneY + screenTop, 
        phoneWidth - screenMargin * 2, 
        phoneHeight - screenTop - screenBottom, 
        0.12, 0.12, 'F'
      );
      
      // Home button (circle at bottom)
      pdf.setFillColor(80, 80, 80);
      pdf.circle(phoneX + phoneWidth / 2, phoneY + phoneHeight - 0.25, 0.14, 'F');

      // Arrow pointing from phone to QR code
      const arrowStartX = phoneX + phoneWidth + 0.08;
      const arrowEndX = arrowStartX + 0.5;
      const arrowY = phoneY + phoneHeight / 2;
      
      // Arrow shaft
      pdf.setFillColor(0, 0, 0);
      pdf.rect(arrowStartX, arrowY - 0.12, arrowEndX - arrowStartX, 0.24, 'F');
      
      // Arrow head (triangle)
      pdf.triangle(
        arrowEndX + 0.32, arrowY,
        arrowEndX - 0.05, arrowY - 0.28,
        arrowEndX - 0.05, arrowY + 0.28,
        'F'
      );

      // QR Code - larger, positioned to the right
      const qrSize = 3.6;
      const qrX = arrowEndX + 0.4;
      const qrY = phoneY + (phoneHeight / 2) - (qrSize / 2);
      pdf.addImage(qrCodeDataURL, 'PNG', qrX, qrY, qrSize, qrSize);
      
      yPos = phoneY + phoneHeight + 0.1;

      // "SCAN HERE" text in BLACK - larger
      pdf.setFontSize(72);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('SCAN HERE', centerX, yPos + 0.8, { align: 'center' });
      yPos += 1.0;

      // Job name at the bottom in brand color - larger
      pdf.setFontSize(48);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(r, g, b);
      pdf.text(jobName, centerX, yPos + 0.6, { align: 'center' });

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
