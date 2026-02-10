import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Camera, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import builderlynkShield from '@/assets/builderlynk-icon-shield.png';

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
  const [uploadProgress, setUploadProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Animate progress during upload
  useEffect(() => {
    if (!uploading) {
      setUploadProgress(0);
      return;
    }
    
    // Simulate progress animation (since Supabase doesn't provide real progress)
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev; // Cap at 90% until complete
        return prev + Math.random() * 15;
      });
    }, 200);
    
    return () => clearInterval(interval);
  }, [uploading]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          // Request maximum resolution (4K) for highest quality photos
          width: { ideal: 4096 },
          height: { ideal: 2160 }
        }
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
          // Don't stop camera - keep stream alive for next photo
        }
      }, 'image/jpeg', 1.0);
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
        // Foreign key violation OR RLS violation means PIN mode. Use server-side helper.
        if (msg.includes('foreign key') || msg.includes('job_photos_uploaded_by_fkey') || 
            msg.includes('row-level security') || msg.includes('row level security') ||
            msg.includes('violates row-level security policy')) {
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

      // Complete progress animation
      setUploadProgress(100);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Clear photo preview - camera stream is still alive, so just go back to camera view
      setPhotoPreview(null);
      setPhotoBlob(null);
      setNote('');
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to upload photo',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
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
        <DialogContent className="w-screen h-screen max-w-none max-h-none m-0 p-0 rounded-none sm:max-w-2xl sm:max-h-[90vh] sm:m-auto sm:p-6 sm:rounded-lg flex flex-col">
          {/* Exit Camera button - always visible at top */}
          <div className="absolute top-3 right-3 z-50">
            <Button
              onClick={handleClose}
              className="bg-[#E88A2D] hover:bg-[#E88A2D]/90 text-white font-semibold px-4 py-2 shadow-lg"
            >
              <X className="h-5 w-5 mr-2" />
              Exit Camera
            </Button>
          </div>

          <DialogHeader className="p-4 sm:p-0 flex-shrink-0 pr-36">
            <DialogTitle>Add Photo to Job Album</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 flex flex-col min-h-0 p-4 pt-0 sm:p-0 space-y-4 relative">
            {/* Upload Progress Overlay */}
            {uploading && (
              <div className="absolute inset-0 z-40 bg-background/95 flex flex-col items-center justify-center rounded-lg">
                <div className="flex flex-col items-center space-y-6 p-8">
                  {/* Circular progress with BuilderLynk shield logo */}
                  <div className="relative w-36 h-36">
                    {/* SVG Circular Progress */}
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      {/* Background circle */}
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        className="text-muted/30"
                      />
                      {/* Progress circle with gradient */}
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="url(#progressGradient)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 45}
                        strokeDashoffset={2 * Math.PI * 45 * (1 - uploadProgress / 100)}
                        className="transition-all duration-300 ease-out"
                      />
                      {/* Gradient definition */}
                      <defs>
                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#E88A2D" />
                          <stop offset="50%" stopColor="#F5A623" />
                          <stop offset="100%" stopColor="#3B82F6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    {/* Logo in center with pulse animation */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <img 
                        src={builderlynkShield} 
                        alt="BuilderLynk" 
                        className="h-20 w-20 object-contain animate-pulse"
                      />
                    </div>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <p className="text-lg font-semibold text-foreground">
                      Uploading Photo... {Math.round(uploadProgress)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Building your job album</p>
                  </div>
                </div>
              </div>
            )}

            {!photoPreview ? (
              <div className="flex-1 flex flex-col min-h-0 space-y-4">
                <div className="relative flex-1 min-h-0 bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                <Button onClick={capturePhoto} className="w-full flex-shrink-0" size="lg">
                  <Camera className="h-5 w-5 mr-2" />
                  Take Photo
                </Button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 space-y-4">
                <div className="relative flex-1 min-h-0 rounded-lg overflow-hidden">
                  <img src={photoPreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                </div>
                <div className="flex-shrink-0">
                  <label className="text-sm font-medium mb-2 block">Add a note (optional)</label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Describe what's in this photo..."
                    rows={2}
                  />
                </div>
                <div className="flex gap-3 flex-shrink-0">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setPhotoPreview(null);
                      setPhotoBlob(null);
                      setNote('');
                      // Camera stream is still alive, no need to restart
                    }}
                    disabled={uploading}
                    className="flex-1"
                    size="lg"
                  >
                    Retake
                  </Button>
                  <Button 
                    onClick={handleUpload} 
                    disabled={uploading} 
                    className="flex-1"
                    size="lg"
                  >
                    Upload to Job Album
                  </Button>
                </div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </DialogContent>
      </Dialog>
    </>
  );
}
