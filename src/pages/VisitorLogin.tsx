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

interface JobSubcontractor {
  id: string;
  company_name: string;
  contact_person: string;
  phone: string;
}

interface VisitorSettings {
  background_image_url?: string;
  header_logo_url?: string;
  primary_color: string;
  button_color: string;
  confirmation_title: string;
  confirmation_message: string;
  require_company_name: boolean;
  require_purpose_visit: boolean;
  enable_checkout: boolean;
}

export default function VisitorLogin() {
  const { qrCode } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [subcontractors, setSubcontractors] = useState<JobSubcontractor[]>([]);
  const [settings, setSettings] = useState<VisitorSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    visitor_name: '',
    visitor_phone: '',
    company_name: '',
    subcontractor_id: '',
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
          description: "This QR code is not valid or has expired.",
          variant: "destructive",
        });
        return;
      }

      setJob(jobData);

      // Load subcontractors for this job
      const { data: subcontractorData } = await supabase
        .from('job_subcontractors')
        .select('id, company_name, contact_person, phone')
        .eq('job_id', jobData.id)
        .eq('is_active', true);

      if (subcontractorData) {
        setSubcontractors(subcontractorData);
      }

      // Load visitor login settings - we need to get company_id from job
      // For now, we'll use default settings as we don't have company_id in jobs table
      setSettings({
        primary_color: '#3b82f6',
        button_color: '#10b981',
        confirmation_title: 'Welcome to the Job Site!',
        confirmation_message: 'Thank you for checking in. Please follow all safety protocols.',
        require_company_name: true,
        require_purpose_visit: false,
        enable_checkout: true,
      });

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

    if (settings?.require_company_name && !formData.company_name.trim() && !formData.subcontractor_id) {
      toast({
        title: "Missing Company",
        description: "Please select a subcontractor or enter your company name.",
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
        company_name: formData.subcontractor_id ? 
          subcontractors.find(s => s.id === formData.subcontractor_id)?.company_name : 
          formData.company_name.trim(),
        subcontractor_id: formData.subcontractor_id || null,
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
              This QR code is not valid or has expired. Please scan a valid QR code from the job site.
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
  } : {};

  return (
    <div 
      className="min-h-screen flex flex-col bg-gradient-to-br from-primary/10 via-background to-secondary/10"
      style={backgroundStyle}
    >
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-sm border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {settings?.header_logo_url ? (
              <img src={settings.header_logo_url} alt="Company Logo" className="h-10 object-contain" />
            ) : (
              <div className="flex items-center space-x-2">
                <Building2 className="h-8 w-8 text-primary" />
                <span className="text-xl font-semibold">Visitor Check-In</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center space-x-2">
              <MapPin className="h-5 w-5 text-primary" />
              <span>Job Site Check-In</span>
            </CardTitle>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="font-medium">{job.name}</p>
              <p>{job.address}</p>
              {job.client && <p>Client: {job.client}</p>}
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Visitor Name */}
              <div className="space-y-2">
                <Label htmlFor="visitor_name" className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>Full Name *</span>
                </Label>
                <Input
                  id="visitor_name"
                  value={formData.visitor_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, visitor_name: e.target.value }))}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="visitor_phone" className="flex items-center space-x-2">
                  <Phone className="h-4 w-4" />
                  <span>Phone Number *</span>
                </Label>
                <Input
                  id="visitor_phone"
                  type="tel"
                  value={formData.visitor_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, visitor_phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                  required
                />
              </div>

              {/* Subcontractor Selection */}
              {subcontractors.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="subcontractor">Subcontractor</Label>
                  <Select
                    value={formData.subcontractor_id}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      subcontractor_id: value,
                      company_name: value ? '' : prev.company_name 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your subcontractor" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcontractors.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>
                          {sub.company_name}
                          {sub.contact_person && ` - ${sub.contact_person}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Company Name (if not subcontractor) */}
              {!formData.subcontractor_id && (
                <div className="space-y-2">
                  <Label htmlFor="company_name" className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4" />
                    <span>Company Name {settings?.require_company_name ? '*' : ''}</span>
                  </Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="Enter your company name"
                    required={settings?.require_company_name}
                  />
                </div>
              )}

              {/* Purpose of Visit */}
              {settings?.require_purpose_visit && (
                <div className="space-y-2">
                  <Label htmlFor="purpose_of_visit">Purpose of Visit *</Label>
                  <Input
                    id="purpose_of_visit"
                    value={formData.purpose_of_visit}
                    onChange={(e) => setFormData(prev => ({ ...prev, purpose_of_visit: e.target.value }))}
                    placeholder="e.g., Delivery, Inspection, Installation"
                    required
                  />
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional information..."
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
                  subcontractor_id: '',
                  purpose_of_visit: '',
                  notes: ''
                });
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