import { useState, useRef, useCallback, useEffect } from 'react';
import { getStoragePathForDb } from '@/utils/storageUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Upload, CheckCircle, X, Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

interface Job {
  id: string;
  name: string;
  address?: string;
}

interface DeliveryPhoto {
  id: string;
  type: 'material' | 'slip' | 'general';
  blob: Blob;
  preview: string;
}

export function DeliveryTicketForm() {
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<DeliveryPhoto[]>([]);
  
  const [showCamera, setShowCamera] = useState(false);
  const [currentPhotoType, setCurrentPhotoType] = useState<'material' | 'slip' | 'general'>('material');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load jobs when component mounts
  const loadJobs = useCallback(async () => {
    try {
      if (!currentCompany?.id) {
        console.log('Delivery Ticket Form - No company selected');
        return;
      }

      console.log('Delivery Ticket Form - Loading jobs for company:', currentCompany.id);

      const { data: jobsData, error } = await supabase
        .from('jobs')
        .select('id, name, address')
        .eq('company_id', currentCompany.id)
        .eq('status', 'active')
        .order('name');
      
      console.log('Delivery Ticket Form - Jobs loaded:', { 
        count: jobsData?.length || 0, 
        companyId: currentCompany.id,
        error,
        jobs: jobsData 
      });
      
      if (jobsData) setJobs(jobsData);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const startCamera = async (photoType: 'material' | 'slip' | 'general') => {
    setCurrentPhotoType(photoType);
    setShowCamera(true);
    
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setShowCamera(false);
        toast({
          title: 'Camera Error',
          description: 'Could not access camera. Please enable camera permissions.',
          variant: 'destructive'
        });
      }
    }, 100);
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const preview = canvas.toDataURL('image/jpeg', 0.8);
        const newPhoto: DeliveryPhoto = {
          id: Date.now().toString(),
          type: currentPhotoType,
          blob,
          preview
        };
        
        setPhotos(prev => [...prev, newPhoto]);
        stopCamera();
        
        toast({
          title: 'Photo Captured',
          description: `${currentPhotoType.charAt(0).toUpperCase() + currentPhotoType.slice(1)} photo added successfully.`,
        });
      }
    }, 'image/jpeg', 0.8);
  };

  const handleFileUpload = (photoType: 'material' | 'slip' | 'general') => {
    setCurrentPhotoType(photoType);
    fileInputRef.current?.click();
  };

  const onFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      
      // Convert to blob
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const newPhoto: DeliveryPhoto = {
              id: Date.now().toString(),
              type: currentPhotoType,
              blob,
              preview
            };
            
            setPhotos(prev => [...prev, newPhoto]);
          }
        }, 'image/jpeg', 0.8);
      };
      
      img.src = preview;
    };
    reader.readAsDataURL(file);
    
    // Reset input
    event.target.value = '';
  };

  const removePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const submitDeliveryTicket = async () => {
    if (!selectedJob || !vendorName || !description) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in job, vendor name, and description.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload photos first
      const photoUrls: { [key: string]: string | null } = {
        material_photo_url: null,
        delivery_slip_photo_url: null,
        photo_url: null
      };

      for (const photo of photos) {
        const fileName = `delivery-${Date.now()}-${photo.type}.jpg`;
        const filePath = `${user?.id}/delivery-tickets/${fileName}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts') // Using receipts bucket for now
          .upload(filePath, photo.blob);

        if (uploadError) throw uploadError;

        const storedPath = getStoragePathForDb('receipts', filePath);

        // Map photo types to database fields
        if (photo.type === 'material') {
          photoUrls.material_photo_url = storedPath;
        } else if (photo.type === 'slip') {
          photoUrls.delivery_slip_photo_url = storedPath;
        } else if (photo.type === 'general') {
          photoUrls.photo_url = storedPath;
        }
      }

      // Create delivery ticket
      const ticketData = {
        job_id: selectedJob,
        vendor_name: vendorName,
        ticket_number: ticketNumber || null,
        delivery_date: deliveryDate,
        description,
        notes: notes || null,
        material_photo_url: photoUrls.material_photo_url,
        delivery_slip_photo_url: photoUrls.delivery_slip_photo_url,
        photo_url: photoUrls.photo_url,
        created_by: user?.id,
        received_by: user?.id,
        company_id: currentCompany?.id
      };

      const { error: insertError } = await supabase
        .from('delivery_tickets')
        .insert(ticketData);

      if (insertError) throw insertError;

      toast({
        title: 'Delivery Ticket Created',
        description: 'Delivery ticket has been successfully recorded.',
      });

      // Reset form
      resetForm();
      
    } catch (error) {
      console.error('Error saving delivery ticket:', error);
      toast({
        title: 'Save Error',
        description: 'Failed to save delivery ticket. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedJob('');
    setVendorName('');
    setTicketNumber('');
    setDeliveryDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setNotes('');
    setPhotos([]);
  };

  const getPhotoTypeLabel = (type: 'material' | 'slip' | 'general') => {
    switch (type) {
      case 'material': return 'Material';
      case 'slip': return 'Delivery Slip';
      case 'general': return 'General';
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <Label htmlFor="job">Job *</Label>
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger>
              <SelectValue placeholder="Select job" />
            </SelectTrigger>
            <SelectContent>
              {jobs.map(job => (
                <SelectItem key={job.id} value={job.id}>
                  {job.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="vendor">Vendor Name *</Label>
          <Input
            id="vendor"
            placeholder="Enter vendor name"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="ticket">Ticket Number</Label>
          <Input
            id="ticket"
            placeholder="Optional ticket number"
            value={ticketNumber}
            onChange={(e) => setTicketNumber(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="date">Delivery Date</Label>
          <Input
            id="date"
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            placeholder="Describe the materials delivered..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            placeholder="Additional notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      {/* Photo Section */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Photos</Label>
              <span className="text-xs text-muted-foreground">{photos.length} photos</span>
            </div>

            {/* Photo Grid */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {photos.map(photo => (
                  <div key={photo.id} className="relative">
                    <img 
                      src={photo.preview} 
                      alt={`${photo.type} photo`}
                      className="w-full h-24 object-cover rounded border"
                    />
                    <div className="absolute top-1 left-1">
                      <span className="bg-black/70 text-white text-xs px-2 py-1 rounded">
                        {getPhotoTypeLabel(photo.type)}
                      </span>
                    </div>
                    <Button
                      onClick={() => removePhoto(photo.id)}
                      size="sm"
                      variant="destructive"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Photo Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button 
                onClick={() => startCamera('material')} 
                variant="outline" 
                size="sm"
                className="h-16 flex-col"
              >
                <Camera className="h-4 w-4 mb-1" />
                <span className="text-xs">Material</span>
              </Button>
              
              <Button 
                onClick={() => startCamera('slip')} 
                variant="outline" 
                size="sm"
                className="h-16 flex-col"
              >
                <Camera className="h-4 w-4 mb-1" />
                <span className="text-xs">Slip</span>
              </Button>
              
              <Button 
                onClick={() => startCamera('general')} 
                variant="outline" 
                size="sm"
                className="h-16 flex-col"
              >
                <Camera className="h-4 w-4 mb-1" />
                <span className="text-xs">General</span>
              </Button>
            </div>

            <Button 
              onClick={() => handleFileUpload('general')} 
              variant="ghost" 
              size="sm"
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload from Gallery
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Button 
        onClick={submitDeliveryTicket}
        disabled={isSubmitting}
        className="w-full h-14 text-base"
        size="lg"
      >
        {isSubmitting ? (
          <Loader2 className="h-5 w-5 animate-spin mr-3" />
        ) : (
          <CheckCircle className="h-5 w-5 mr-3" />
        )}
        {isSubmitting ? 'Creating Ticket...' : 'Create Delivery Ticket'}
      </Button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileSelected}
        className="hidden"
      />

      {/* Camera Dialog */}
      <Dialog open={showCamera} onOpenChange={() => stopCamera()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Capture {getPhotoTypeLabel(currentPhotoType)} Photo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg"
            />
            <canvas ref={canvasRef} className="hidden" />
            <Button onClick={capturePhoto} className="w-full">
              <Camera className="h-4 w-4 mr-2" />
              Capture Photo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}