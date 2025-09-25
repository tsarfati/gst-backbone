import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, MapPin, Save, ArrowLeft, Loader2, Package, Calendar, Building2, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import DeliveryTicketDetailView from '@/components/DeliveryTicketDetailView';

interface Job {
  id: string;
  name: string;
  address?: string;
}

interface DeliveryTicket {
  id: string;
  job_id: string;
  ticket_number?: string;
  delivery_date: string;
  vendor_name: string;
  description?: string;
  photo_url?: string;
  delivery_slip_photo_url?: string;
  material_photo_url?: string;
  notes?: string;
  created_at: string;
  created_by: string;
  received_by?: string;
}

export default function DeliveryTickets() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [job, setJob] = useState<Job | null>(null);
  const [deliveryTickets, setDeliveryTickets] = useState<DeliveryTicket[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showDetailView, setShowDetailView] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<DeliveryTicket | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [ticketNumber, setTicketNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorName, setVendorName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [deliverySlipBlob, setDeliverySlipBlob] = useState<Blob | null>(null);
  const [deliverySlipPreview, setDeliverySlipPreview] = useState<string | null>(null);
  const [materialPhotoBlob, setMaterialPhotoBlob] = useState<Blob | null>(null);
  const [materialPhotoPreview, setMaterialPhotoPreview] = useState<string | null>(null);
  const [showDeliverySlipCamera, setShowDeliverySlipCamera] = useState(false);
  const [showMaterialCamera, setShowMaterialCamera] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const isProjectManager = profile?.role === 'admin' || profile?.role === 'controller' || profile?.role === 'project_manager';

  useEffect(() => {
    loadJobs();
    if (jobId) {
      setSelectedJobId(jobId);
      loadJob();
      loadDeliveryTickets();
    }
  }, [jobId]);

  useEffect(() => {
    if (selectedJobId && !jobId) {
      loadDeliveryTickets();
    }
  }, [selectedJobId]);

  const loadJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name, address')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load jobs',
        variant: 'destructive',
      });
    }
  };

  const loadJob = async () => {
    if (!jobId) return;
    
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name, address')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      setJob(data);
    } catch (error) {
      console.error('Error loading job:', error);
      toast({
        title: 'Error',
        description: 'Failed to load job details',
        variant: 'destructive',
      });
    }
  };

  const loadDeliveryTickets = async () => {
    const targetJobId = jobId || selectedJobId;
    if (!targetJobId) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('delivery_tickets')
        .select('*')
        .eq('job_id', targetJobId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeliveryTickets(data || []);
    } catch (error) {
      console.error('Error loading delivery tickets:', error);
      toast({
        title: 'Error',
        description: 'Failed to load delivery tickets',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera for delivery photos
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setCameraStream(stream);
      setShowCamera(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error: any) {
      console.error('Error starting camera:', error);
      toast({
        title: 'Camera Error',
        description: 'Could not access camera. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const startCameraForType = async (type: 'delivery-slip' | 'material') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setCameraStream(stream);
      
      if (type === 'delivery-slip') {
        setShowDeliverySlipCamera(true);
      } else {
        setShowMaterialCamera(true);
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error: any) {
      console.error('Error starting camera:', error);
      toast({
        title: 'Camera Error',
        description: 'Could not access camera. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    capturePhotoType('general');
  };

  const capturePhotoType = (type: 'general' | 'delivery-slip' | 'material') => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          switch (type) {
            case 'general':
              setPhotoBlob(blob);
              setPhotoPreview(URL.createObjectURL(blob));
              break;
            case 'delivery-slip':
              setDeliverySlipBlob(blob);
              setDeliverySlipPreview(URL.createObjectURL(blob));
              setShowDeliverySlipCamera(false);
              break;
            case 'material':
              setMaterialPhotoBlob(blob);
              setMaterialPhotoPreview(URL.createObjectURL(blob));
              setShowMaterialCamera(false);
              break;
          }
          stopCamera();
        }
      }, 'image/jpeg', 0.8);
    }
  };

  const uploadPhoto = async (blob: Blob, type: string = 'general'): Promise<string | null> => {
    if (!user) return null;

    try {
      const fileName = `${Date.now()}-delivery-${type}.jpg`;
      const filePath = `${user.id}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('receipts') // Use receipts bucket which is public
        .upload(filePath, blob);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
  };

  const saveDeliveryTicket = async () => {
    const targetJobId = jobId || selectedJobId;
    if (!user || !targetJobId || !vendorName.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in required fields (vendor name).',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      
      let photoUrl = null;
      let deliverySlipUrl = null;
      let materialPhotoUrl = null;
      
      if (photoBlob) {
        photoUrl = await uploadPhoto(photoBlob, 'general');
      }
      if (deliverySlipBlob) {
        deliverySlipUrl = await uploadPhoto(deliverySlipBlob, 'delivery-slip');
      }
      if (materialPhotoBlob) {
        materialPhotoUrl = await uploadPhoto(materialPhotoBlob, 'material');
      }

      const ticketData = {
        job_id: targetJobId,
        ticket_number: ticketNumber.trim() || null,
        delivery_date: deliveryDate,
        vendor_name: vendorName.trim(),
        description: description.trim() || null,
        photo_url: photoUrl,
        delivery_slip_photo_url: deliverySlipUrl,
        material_photo_url: materialPhotoUrl,
        notes: notes.trim() || null,
        created_by: user.id,
        received_by: user.id
      };

      const { error } = await supabase
        .from('delivery_tickets')
        .insert(ticketData);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Delivery ticket saved successfully.',
      });

      // Reset form
      setTicketNumber('');
      setDeliveryDate(new Date().toISOString().split('T')[0]);
      setVendorName('');
      setDescription('');
      setNotes('');
      setPhotoBlob(null);
      setPhotoPreview(null);
      setDeliverySlipBlob(null);
      setDeliverySlipPreview(null);
      setMaterialPhotoBlob(null);
      setMaterialPhotoPreview(null);
      setShowAddDialog(false);
      
      // Reload tickets
      loadDeliveryTickets();
    } catch (error) {
      console.error('Error saving delivery ticket:', error);
      toast({
        title: 'Error',
        description: 'Failed to save delivery ticket.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTicketClick = (ticket: DeliveryTicket) => {
    setSelectedTicket(ticket);
    setShowDetailView(true);
  };

  const handleCloseDetailView = () => {
    setShowDetailView(false);
    setSelectedTicket(null);
  };

  const handleTicketUpdated = () => {
    loadDeliveryTickets();
  };

  if (!isProjectManager) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground">Only project managers can access delivery tickets.</p>
            <Button onClick={() => navigate('/jobs')} className="mt-4">
              Back to Jobs
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          {jobId ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/jobs/${jobId}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Job
            </Button>
          ) : (
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <Label htmlFor="job-select">Select Job</Label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Choose a job" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold">Delivery Tickets</h1>
            {job && (
              <p className="text-muted-foreground">
                {job.name} {job.address && `• ${job.address}`}
              </p>
            )}
            {!jobId && selectedJobId && (
              <p className="text-muted-foreground">
                {jobs.find(j => j.id === selectedJobId)?.name}
              </p>
            )}
          </div>
          <Button 
            onClick={() => setShowAddDialog(true)}
            disabled={!selectedJobId && !jobId}
          >
            <Package className="h-4 w-4 mr-2" />
            Add Ticket
          </Button>
        </div>

        {/* Delivery Tickets List */}
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground">Loading delivery tickets...</p>
              </CardContent>
            </Card>
          ) : deliveryTickets.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Delivery Tickets</h3>
                <p className="text-muted-foreground mb-4">No delivery tickets have been recorded for this job yet.</p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Package className="h-4 w-4 mr-2" />
                  Add First Ticket
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {deliveryTickets.map((ticket) => (
                <Card 
                  key={ticket.id} 
                  className="hover-card cursor-pointer transition-all hover:shadow-md"
                  onClick={() => handleTicketClick(ticket)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* Photo */}
                      {ticket.photo_url && (
                        <div className="md:w-32 md:h-32 w-full h-48 flex-shrink-0">
                          <img
                            src={ticket.photo_url}
                            alt="Delivery"
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                      )}
                      
                      {/* Content */}
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-lg">{ticket.vendor_name}</h3>
                            {ticket.ticket_number && (
                              <Badge variant="outline" className="mt-1">
                                #{ticket.ticket_number}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(ticket.delivery_date).toLocaleDateString()}
                          </div>
                        </div>
                        
                        {ticket.description && (
                          <p className="text-sm">{ticket.description}</p>
                        )}
                        
                        {ticket.notes && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <p className="text-sm">{ticket.notes}</p>
                          </div>
                        )}
                        
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(ticket.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Add Delivery Ticket Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Delivery Ticket</DialogTitle>
              <DialogDescription>
                Record a new delivery with photo and details
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Vendor Name - Required */}
              <div className="space-y-2">
                <Label htmlFor="vendor-name">Vendor Name *</Label>
                <Input
                  id="vendor-name"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Enter vendor/supplier name"
                />
              </div>
              
              {/* Ticket Number */}
              <div className="space-y-2">
                <Label htmlFor="ticket-number">Ticket Number</Label>
                <Input
                  id="ticket-number"
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  placeholder="Enter delivery ticket number"
                />
              </div>
              
              {/* Delivery Date */}
              <div className="space-y-2">
                <Label htmlFor="delivery-date">Delivery Date</Label>
                <Input
                  id="delivery-date"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
              
              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what was delivered..."
                  rows={3}
                />
              </div>
              
              {/* General Photo */}
              <div className="space-y-2">
                <Label>General Delivery Photo (Optional)</Label>
                {!photoPreview ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={startCamera}
                    className="w-full"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Take General Photo
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <img
                      src={photoPreview}
                      alt="General delivery"
                      className="w-full max-h-48 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setPhotoPreview(null);
                        setPhotoBlob(null);
                        startCamera();
                      }}
                      size="sm"
                    >
                      Retake Photo
                    </Button>
                  </div>
                )}
              </div>

              {/* Delivery Slip Photo */}
              <div className="space-y-2">
                <Label>Delivery Slip Photo</Label>
                {!deliverySlipPreview ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDeliverySlipCamera(true)}
                    className="w-full"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Photo of Delivery Slip
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <img
                      src={deliverySlipPreview}
                      alt="Delivery slip"
                      className="w-full max-h-48 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setDeliverySlipPreview(null);
                        setDeliverySlipBlob(null);
                        startCameraForType('delivery-slip');
                      }}
                      size="sm"
                    >
                      Retake Photo
                    </Button>
                  </div>
                )}
              </div>

              {/* Material Photo */}
              <div className="space-y-2">
                <Label>Material On-Site Photo</Label>
                {!materialPhotoPreview ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowMaterialCamera(true)}
                    className="w-full"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Photo of Materials
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <img
                      src={materialPhotoPreview}
                      alt="Materials"
                      className="w-full max-h-48 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setMaterialPhotoPreview(null);
                        setMaterialPhotoBlob(null);
                        setShowMaterialCamera(true);
                      }}
                      size="sm"
                    >
                      Retake Photo
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={saveDeliveryTicket}
                  disabled={!vendorName.trim() || isSaving}
                  className="flex-1"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Ticket
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddDialog(false);
                    setPhotoPreview(null);
                    setPhotoBlob(null);
                    setDeliverySlipPreview(null);
                    setDeliverySlipBlob(null);
                    setMaterialPhotoPreview(null);
                    setMaterialPhotoBlob(null);
                    stopCamera();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Camera Dialog */}
        <Dialog open={showCamera} onOpenChange={setShowCamera}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Take Delivery Photo</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg"
              />
              <div className="flex gap-2">
                <Button onClick={capturePhoto} className="flex-1">
                  <Camera className="h-4 w-4 mr-2" />
                  Capture
                </Button>
                <Button variant="outline" onClick={stopCamera}>
                  Cancel
                </Button>
              </div>
            </div>
            
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </DialogContent>
      </Dialog>

      {/* Delivery Slip Camera Dialog */}
      <Dialog open={showDeliverySlipCamera} onOpenChange={setShowDeliverySlipCamera}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Photo of Delivery Slip</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg"
            />
            <div className="flex gap-2">
              <Button onClick={() => capturePhotoType('delivery-slip')} className="flex-1">
                <Camera className="h-4 w-4 mr-2" />
                Capture
              </Button>
              <Button variant="outline" onClick={() => {
                stopCamera();
                setShowDeliverySlipCamera(false);
              }}>
                Cancel
              </Button>
            </div>
          </div>
          
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </DialogContent>
      </Dialog>

      {/* Material Camera Dialog */}
      <Dialog open={showMaterialCamera} onOpenChange={setShowMaterialCamera}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Photo of Materials On Site</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg"
            />
            <div className="flex gap-2">
              <Button onClick={() => capturePhotoType('material')} className="flex-1">
                <Camera className="h-4 w-4 mr-2" />
                Capture
              </Button>
              <Button variant="outline" onClick={() => {
                stopCamera();
                setShowMaterialCamera(false);
              }}>
                Cancel
              </Button>
            </div>
          </div>
          
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </DialogContent>
      </Dialog>

        {/* Delivery Ticket Detail View */}
        <DeliveryTicketDetailView
          ticket={selectedTicket}
          isOpen={showDetailView}
          onClose={handleCloseDetailView}
          onTicketUpdated={handleTicketUpdated}
        />
      </div>
    </div>
  );
}