import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Camera, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PunchClockPhotoUploadProps {
  jobId: string;
  userId: string;
}

export default function PunchClockPhotoUpload({ jobId, userId }: PunchClockPhotoUploadProps) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: 'Camera Error',
        description: 'Could not access camera',
        variant: 'destructive',
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
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
          setPhotoBlob(blob);
          setPhotoPreview(URL.createObjectURL(blob));
          stopCamera();
        }
      }, 'image/jpeg', 0.95);
    }
  };

  const handleUpload = async () => {
    if (!photoBlob) return;

    setUploading(true);
    try {
      // Get or create employee uploads album
      const { data: albumId, error: albumError } = await supabase
        .rpc('get_or_create_employee_album', {
          p_job_id: jobId,
          p_user_id: userId
        });

      if (albumError || !albumId) {
        console.error('Album error:', albumError);
        toast({
          title: 'Album Error',
          description: albumError?.message || 'Failed to get album',
          variant: 'destructive',
        });
        return;
      }

      // Get location
      let locationData = {};
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        locationData = {
          location_lat: position.coords.latitude,
          location_lng: position.coords.longitude,
        };
      } catch (error) {
        console.log('Location not available');
      }

      // Use userId as first folder segment to satisfy storage policies
      const timestamp = Date.now();
      const filePath = `${userId}/job-${jobId}/${timestamp}.jpg`;

      // Upload photo to storage with explicit content type
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('punch-photos')
        .upload(filePath, photoBlob, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('punch-photos')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // Get current authenticated user - if not available, use the passed userId (for PIN mode)
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const uploadedByUserId = currentUser?.id || userId;
      
      if (!uploadedByUserId) {
        throw new Error('User not authenticated');
      }

      // Save to database; fall back to RPC in PIN mode when FK fails
      const { error: insertError } = await supabase
        .from('job_photos')
        .insert({
          job_id: jobId,
          uploaded_by: uploadedByUserId,
          photo_url: publicUrl,
          note: note.trim() || null,
          album_id: albumId,
          ...locationData,
        });

      if (insertError) {
        const msg = String(insertError.message || '').toLowerCase();
        // Foreign key violation means uploaded_by is not a profiles.user_id (likely PIN mode). Use server-side helper.
        if (msg.includes('foreign key') || msg.includes('job_photos_uploaded_by_fkey')) {
          const { error: rpcError } = await supabase.rpc('pin_insert_job_photo', {
            p_job_id: jobId,
            p_uploader_hint: uploadedByUserId,
            p_photo_url: publicUrl,
            p_note: note.trim() || null,
            p_location_lat: (locationData as any).location_lat ?? null,
            p_location_lng: (locationData as any).location_lng ?? null,
          });
          if (rpcError) throw rpcError;
        } else {
          throw insertError;
        }
      }

      toast({ 
        title: 'Success', 
        description: 'Photo uploaded to job album! You can take another photo.',
      });
      
      // Clear photo and restart camera so user can take another photo
      setPhotoPreview(null);
      setPhotoBlob(null);
      setNote('');
      setTimeout(() => startCamera(), 100);
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to upload photo',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleOpen = () => {
    setShowDialog(true);
    setPhotoPreview(null);
    setPhotoBlob(null);
    setNote('');
    setTimeout(() => startCamera(), 100);
  };

  const handleClose = () => {
    setShowDialog(false);
    stopCamera();
    setPhotoPreview(null);
    setPhotoBlob(null);
    setNote('');
  };

  return (
    <>
      <Button onClick={handleOpen} variant="outline" className="w-full">
        <Camera className="h-5 w-5 mr-2" />
        Take Job Photo
      </Button>

      <Dialog open={showDialog} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Photo to Job Album</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!photoPreview ? (
              <div className="space-y-4">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button onClick={capturePhoto} className="w-full">
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative aspect-video rounded-lg overflow-hidden">
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setPhotoPreview(null);
                      setPhotoBlob(null);
                      startCamera();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Add a note (optional)</label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Describe what's in this photo..."
                    rows={3}
                  />
                </div>
                <Button onClick={handleUpload} disabled={uploading} className="w-full">
                  {uploading ? 'Uploading...' : 'Upload to Job Album'}
                </Button>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </DialogContent>
      </Dialog>
    </>
  );
}
