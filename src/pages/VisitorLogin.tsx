import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Users, MapPin, Phone, Building2 } from 'lucide-react';
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
  vendors: {
    name: string;
  } | null;
}

interface VisitorSettings {
  background_image_url?: string;
  background_color?: string;
  header_logo_url?: string;
  primary_color: string;
  button_color: string;
  confirmation_title: string;
  confirmation_message: string;
  require_company_name: boolean;
  require_purpose_visit: boolean;
  enable_checkout: boolean;
  theme?: 'light' | 'dark';
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

      // Load subcontractors/vendors for this job  
      fetch(`https://watxvzoolmfjfijrgcvq.supabase.co/rest/v1/subcontracts?job_id=eq.${jobData.id}&is_active=eq.true&select=id,vendor_id,vendors(name)`, {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhdHh2em9vbG1mamZpanJnY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMzYxNzMsImV4cCI6MjA3MzkxMjE3M30.0VEGVyFVxDLkv3yNd31_tPZdeeoQQaGZVT4Jsf0eC8Q',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhdHh2em9vbG1mamZpanJnY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMzYxNzMsImV4cCI6MjA3MzkxMjE3M30.0VEGVyFVxDLkv3yNd31_tPZdeeoQQaGZVT4Jsf0eC8Q'
        }
      }).then(res => res.json()).then(data => {
        if (data) {
          setSubcontractors(data as Subcontractor[]);
        }
      }).catch(err => console.error('Error loading subcontractors:', err));

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
            confirmation_title: 'Welcome to the Job Site!',
            confirmation_message: 'Thank you for checking in. Please follow all safety protocols.',
            require_company_name: true,
            require_purpose_visit: false,
            enable_checkout: true,
            theme: 'light',
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

    setSubmitting(true);

    try {
      const visitorLogData = {
        job_id: job.id,
        visitor_name: formData.visitor_name.trim(),
        visitor_phone: formData.visitor_phone.trim(),
        company_name: formData.vendor_id ? 
          subcontractors.find(s => s.vendor_id === formData.vendor_id)?.vendors?.name : 
          formData.company_name.trim(),
        vendor_id: formData.vendor_id || null,
        purpose_of_visit: formData.purpose_of_visit.trim() || null,
        notes: formData.notes.trim() || null,
        company_id: (job as any).company_id
      };

      const { error } = await supabase
        .from('visitor_logs')
        .insert([visitorLogData]);

      if (error) {
        throw error;
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
    backgroundColor: settings.background_color,
  } : {};

  const isDark = settings?.theme === 'dark';
  const inputBgClass = isDark ? 'bg-black text-white border-white/20' : 'bg-white text-black border-input';
  const cardBgClass = isDark 
    ? 'bg-black/30 backdrop-blur-md border-white/20' 
    : 'bg-white/30 backdrop-blur-md border-black/20';
  const headerBgClass = isDark ? 'bg-black/95' : 'bg-white/95';
  const textClass = isDark ? 'text-white' : 'text-foreground';

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
                <span className={`text-xl font-semibold ${textClass}`}>Visitor Check-In</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className={`w-full max-w-md ${cardBgClass}`}>
          <CardHeader className="text-center">
            <CardTitle className={`flex items-center justify-center space-x-2 ${textClass}`}>
              <MapPin className={`h-5 w-5 ${isDark ? 'text-white' : 'text-primary'}`} />
              <span>Job Site Check-In</span>
            </CardTitle>
            <div className={`space-y-1 text-sm ${isDark ? 'text-white/70' : 'text-muted-foreground'}`}>
              <p className="font-medium">{job.name}</p>
              <p>{job.address}</p>
              {job.client && <p>Client: {job.client}</p>}
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Visitor Name */}
              <div className="space-y-2">
                <Label htmlFor="visitor_name" className={`flex items-center space-x-2 ${textClass}`}>
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
                <Label htmlFor="visitor_phone" className={`flex items-center space-x-2 ${textClass}`}>
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
                <Label htmlFor="vendor" className={`flex items-center space-x-2 ${textClass}`}>
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
                        {sub.vendors?.name || 'Unknown Vendor'}
                      </SelectItem>
                    ))}
                    <SelectItem value="not_listed">
                      Not Listed
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Company Name Input - shown when "Not Listed" is selected */}
              {showCustomCompany && (
                <div className="space-y-2">
                  <Label htmlFor="custom_company_name" className={textClass}>Company Name {settings?.require_company_name ? '*' : ''}</Label>
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
                  <Label htmlFor="purpose_of_visit" className={textClass}>Purpose of Visit *</Label>
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
                <Label htmlFor="notes" className={textClass}>Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional information..."
                  className={inputBgClass}
                  rows={3}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={submitting}
                style={{ 
                  backgroundColor: settings?.button_color,
                  borderColor: settings?.button_color 
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
                backgroundColor: settings?.button_color,
                borderColor: settings?.button_color 
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