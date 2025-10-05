import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Users, MapPin, Phone, Building2, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Job {
  id: string;
  name: string;
  address: string;
  client: string;
}

interface Subcontractor {
  id: string;
  vendor_id: string;
  vendor_name: string;
}

interface VisitorSettings {
  background_image_url?: string;
  background_color?: string;
  header_logo_url?: string;
  primary_color: string;
  button_color: string;
  text_color?: string;
  confirmation_title: string;
  confirmation_message: string;
  require_company_name: boolean;
  require_purpose_visit: boolean;
  enable_checkout: boolean;
  theme?: 'light' | 'dark';
  require_photo: boolean;
}

export default function VisitorLogin() {
  const { qrCode } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [settings, setSettings] = useState<VisitorSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showCustomCompany, setShowCustomCompany] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    visitor_name: '',
    visitor_phone: '',
    company_name: '',
    vendor_id: '',
    purpose_of_visit: '',
    notes: ''
  });

  useEffect(() => {
    if (qrCode) {
      loadJobAndSettings();
    }
  }, [qrCode]);

  const resolveColor = (value?: string) => {
    if (!value) return undefined;
    const v = value.trim();
    // If value looks like HSL triplet (e.g., "350 76% 39%"), wrap in hsl()
    if (/^\d+\s+\d+%\s+\d+%$/.test(v)) return `hsl(${v})`;
    // If already hsl(...) or hex or rgb/rgba, return as-is
    if (/^hsl\(/i.test(v) || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) || /^rgb\(/i.test(v)) return v;
    return v;
  };

  const loadJobAndSettings = async () => {
    try {
      // Find job by QR code
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('id, name, address, client, company_id')
        .eq('visitor_qr_code', qrCode)
        .single();

      if (jobError || !jobData) {
        toast({
          title: "Invalid QR Code",
          description: "This QR code is not valid. Please scan a valid QR code from the job site.",
          variant: "destructive",
        });
        return;
      }

      setJob(jobData);

      // Load subcontractors using RPC function
      (async () => {
        try {
          const result = await supabase.rpc('get_job_subcontractors', { p_job_id: jobData.id });
          if (result.data) {
            setSubcontractors(result.data as Subcontractor[]);
          }
        } catch (err) {
          console.error('Error loading subcontractors:', err);
        }
      })();

      // Load visitor login settings
      if (jobData.company_id) {
        const { data: settingsData } = await supabase
          .from('visitor_login_settings')
          .select('*')
          .eq('company_id', jobData.company_id)
          .maybeSingle();

        if (settingsData) {
          setSettings({
            ...settingsData,
            theme: (settingsData as any).theme === 'dark' ? 'dark' : 'light',
          });
        } else {
          // Use default settings
          setSettings({
            background_color: '#3b82f6',
            primary_color: '#3b82f6',
            button_color: '#10b981',
            text_color: '#000000',
            confirmation_title: 'Welcome to the Job Site!',
            confirmation_message: 'Thank you for checking in. Please follow all safety protocols.',
            require_company_name: true,
            require_purpose_visit: false,
            enable_checkout: true,
            theme: 'light',
            require_photo: false,
          });
        }
      }

    } catch (error) {
      console.error('Error loading job and settings:', error);
      toast({
        title: "Error",
        description: "Failed to load job information.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setPhotoDataUrl(dataUrl);
        stopCamera();
      }
    }
  };

  const retakePhoto = () => {
    setPhotoDataUrl(null);
    startCamera();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    // Validate required fields
    if (!formData.visitor_name.trim() || !formData.visitor_phone.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter your name and phone number.",
        variant: "destructive",
      });
      return;
    }

    if (settings?.require_company_name && !formData.company_name.trim() && !formData.vendor_id) {
      toast({
        title: "Missing Company",
        description: "Please select a vendor or enter your company name.",
        variant: "destructive",
      });
      return;
    }

    // Check if photo is required
    if (settings?.require_photo && !photoDataUrl) {
      toast({
        title: "Photo Required",
        description: "Please take a photo before checking in.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      let photoUrl: string | null = null;

      // Upload photo if captured
      if (photoDataUrl) {
        const blob = await fetch(photoDataUrl).then(r => r.blob());
        const fileName = `visitor-${Date.now()}.jpg`;
        const filePath = `${job.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('punch-photos')
          .upload(filePath, blob);

        if (uploadError) {
          console.error('Error uploading photo:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('punch-photos')
            .getPublicUrl(filePath);
          photoUrl = publicUrl;
        }
      }

      const visitorLogData = {
        job_id: job.id,
        visitor_name: formData.visitor_name.trim(),
        visitor_phone: formData.visitor_phone.trim(),
        company_name: formData.vendor_id ? 
          subcontractors.find(s => s.vendor_id === formData.vendor_id)?.vendor_name : 
          formData.company_name.trim(),
        vendor_id: formData.vendor_id || null,
        purpose_of_visit: formData.purpose_of_visit.trim() || null,
        notes: formData.notes.trim() || null,
        company_id: (job as any).company_id,
        ...(photoUrl && { photo_url: photoUrl })
      };

      const { data: insertedLog, error } = await supabase
        .from('visitor_logs')
        .insert([visitorLogData])
        .select('id, checkout_token')
        .single();

      if (error) {
        throw error;
      }

      // Send SMS with checkout link if enabled
      if (insertedLog) {
        try {
          await supabase.functions.invoke('send-visitor-sms', {
            body: {
              visitor_log_id: insertedLog.id,
              phone_number: formData.visitor_phone.trim(),
              job_id: job.id,
            }
          });
        } catch (smsError) {
          console.error('Failed to send SMS:', smsError);
          // Don't fail the check-in if SMS fails
        }
      }

      setShowConfirmation(true);

    } catch (error) {
      console.error('Error submitting visitor log:', error);
      toast({
        title: "Check-in Failed",
        description: "Failed to check in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading job site information...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="text-center py-8">
            <div className="text-destructive text-xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold mb-2">Invalid QR Code</h2>
            <p className="text-muted-foreground">
              This QR code is not valid. Please scan a valid QR code from the job site.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const backgroundStyle = settings?.background_image_url ? {
    backgroundImage: `url(${settings.background_image_url})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  } : settings?.background_color ? {
    backgroundColor: resolveColor(settings.background_color),
  } : {};

  const isDark = settings?.theme === 'dark';
  const inputBgClass = isDark ? 'bg-black text-white border-white/20' : 'bg-white text-black border-input';
  const cardBgClass = isDark 
    ? 'bg-black/30 backdrop-blur-md border-white/20' 
    : 'bg-white/30 backdrop-blur-md border-black/20';
  const headerBgClass = isDark ? 'bg-black/95' : 'bg-white/95';
  const textClass = settings?.text_color ? '' : (isDark ? 'text-white' : 'text-foreground');
  const textStyle = settings?.text_color ? { color: resolveColor(settings.text_color) } : {};

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={backgroundStyle}
    >
      {/* Header */}
      <div className={`${headerBgClass} backdrop-blur-sm border-b shadow-sm`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {settings?.header_logo_url ? (
              <img src={settings.header_logo_url} alt="Company Logo" className="h-10 object-contain" />
            ) : (
              <div className="flex items-center space-x-2">
                <Building2 className={`h-8 w-8 ${isDark ? 'text-white' : 'text-primary'}`} />
                <span className={`text-xl font-semibold ${textClass}`} style={textStyle}>Visitor Check-In</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className={`w-full max-w-md ${cardBgClass}`}>
          <CardHeader className="text-center">
            <CardTitle className={`flex items-center justify-center space-x-2 ${textClass}`} style={textStyle}>
              <MapPin className={`h-5 w-5 ${isDark ? 'text-white' : 'text-primary'}`} />
              <span>Job Site Check-In</span>
            </CardTitle>
            <div className={`space-y-1 text-sm ${isDark ? 'text-white/70' : 'text-muted-foreground'}`} style={textStyle}>
              <p className="font-medium">{job.name}</p>
              <p>{job.address}</p>
              {job.client && <p>Client: {job.client}</p>}
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Visitor Name */}
              <div className="space-y-2">
                <Label htmlFor="visitor_name" className={`flex items-center space-x-2 ${textClass}`} style={textStyle}>
                  <Users className="h-4 w-4" />
                  <span>Full Name *</span>
                </Label>
                <Input
                  id="visitor_name"
                  value={formData.visitor_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, visitor_name: e.target.value }))}
                  placeholder="Enter your full name"
                  className={inputBgClass}
                  required
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="visitor_phone" className={`flex items-center space-x-2 ${textClass}`} style={textStyle}>
                  <Phone className="h-4 w-4" />
                  <span>Phone Number *</span>
                </Label>
                <Input
                  id="visitor_phone"
                  type="tel"
                  value={formData.visitor_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, visitor_phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                  className={inputBgClass}
                  required
                />
              </div>

              {/* Vendor Selection */}
              <div className="space-y-2">
                <Label htmlFor="vendor" className={`flex items-center space-x-2 ${textClass}`} style={textStyle}>
                  <Building2 className="h-4 w-4" />
                  <span>Company {settings?.require_company_name ? '*' : ''}</span>
                </Label>
                <Select
                  value={showCustomCompany ? 'not_listed' : formData.vendor_id || ''}
                  onValueChange={(value) => {
                    if (value === 'not_listed') {
                      setShowCustomCompany(true);
                      setFormData(prev => ({ ...prev, vendor_id: '', company_name: '' }));
                    } else {
                      setShowCustomCompany(false);
                      setFormData(prev => ({ ...prev, vendor_id: value, company_name: '' }));
                    }
                  }}
                  required={settings?.require_company_name}
                >
                  <SelectTrigger className={inputBgClass}>
                    <SelectValue placeholder="Select your company" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcontractors.map((sub) => (
                      <SelectItem key={sub.vendor_id} value={sub.vendor_id}>
                        {sub.vendor_name || 'Unknown Vendor'}
                      </SelectItem>
                     ))}
                    <SelectItem value="not_listed">
                      Not Listed - Other
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Company Name Input - shown when "Not Listed" is selected */}
              {showCustomCompany && (
                <div className="space-y-2">
                  <Label htmlFor="custom_company_name" className={textClass} style={textStyle}>Company Name {settings?.require_company_name ? '*' : ''}</Label>
                  <Input
                    id="custom_company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="Enter your company name"
                    className={inputBgClass}
                    required={settings?.require_company_name}
                  />
                </div>
              )}

              {/* Purpose of Visit */}
              {settings?.require_purpose_visit && (
                <div className="space-y-2">
                  <Label htmlFor="purpose_of_visit" className={textClass} style={textStyle}>Purpose of Visit *</Label>
                  <Input
                    id="purpose_of_visit"
                    value={formData.purpose_of_visit}
                    onChange={(e) => setFormData(prev => ({ ...prev, purpose_of_visit: e.target.value }))}
                    placeholder="e.g., Delivery, Inspection, Installation"
                    className={inputBgClass}
                    required
                  />
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes" className={textClass} style={textStyle}>Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional information..."
                  className={inputBgClass}
                  rows={3}
                />
              </div>

              {/* Photo Capture */}
              {settings?.require_photo && (
                <div className="space-y-2">
                  <Label className={`flex items-center space-x-2 ${textClass}`} style={textStyle}>
                    <Camera className="h-4 w-4" />
                    <span>Visitor Photo *</span>
                  </Label>
                  {!photoDataUrl && !showCamera && (
                    <Button
                      type="button"
                      onClick={startCamera}
                      className="w-full"
                      variant="outline"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Take Photo
                    </Button>
                  )}
                  {showCamera && (
                    <div className="space-y-2">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full rounded-lg"
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="flex space-x-2">
                        <Button
                          type="button"
                          onClick={capturePhoto}
                          className="flex-1"
                        >
                          Capture
                        </Button>
                        <Button
                          type="button"
                          onClick={stopCamera}
                          variant="outline"
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {photoDataUrl && (
                    <div className="space-y-2">
                      <img
                        src={photoDataUrl}
                        alt="Visitor"
                        className="w-full rounded-lg"
                      />
                      <Button
                        type="button"
                        onClick={retakePhoto}
                        variant="outline"
                        className="w-full"
                      >
                        Retake Photo
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={submitting}
                style={{ 
                  backgroundColor: resolveColor(settings?.button_color),
                  borderColor: resolveColor(settings?.button_color)
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking In...
                  </>
                ) : (
                  'Check In'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader className="text-center">
            <AlertDialogTitle className="text-xl text-green-600">
              {settings?.confirmation_title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {settings?.confirmation_message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col items-center space-y-4 pt-4">
            <div className="text-4xl">✅</div>
            <p className="text-sm text-muted-foreground text-center">
              You have successfully checked in to {job.name}
            </p>
            <Button
              onClick={() => {
                setShowConfirmation(false);
                // Reset form
                setFormData({
                  visitor_name: '',
                  visitor_phone: '',
                  company_name: '',
                  vendor_id: '',
                  purpose_of_visit: '',
                  notes: ''
                });
                setShowCustomCompany(false);
              }}
              className="w-full"
              style={{ 
                backgroundColor: resolveColor(settings?.button_color),
                borderColor: resolveColor(settings?.button_color) 
              }}
            >
              Check In Another Visitor
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}