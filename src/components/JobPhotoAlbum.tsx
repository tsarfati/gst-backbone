import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface JobPhoto {
  id: string;
  photo_url: string;
  note?: string;
  uploaded_by: string;
  created_at: string;
}

interface JobPhotoAlbumProps {
  jobId: string;
}

export default function JobPhotoAlbum({ jobId }: JobPhotoAlbumProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    loadPhotos();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('job-photos-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'job_photos',
        filter: `job_id=eq.${jobId}`,
      }, () => {
        loadPhotos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopCamera();
    };
  }, [jobId]);

  const loadPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('job_photos')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error('Error loading photos:', error);
      toast({
        title: 'Error',
        description: 'Failed to load photos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

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
    if (!photoBlob || !user) return;

    setUploading(true);
    try {
      // Upload photo to storage
      const fileName = `job-${jobId}/${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('punch-photos')
        .upload(fileName, photoBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('punch-photos')
        .getPublicUrl(fileName);

      // Save to database
      const { error: insertError } = await supabase
        .from('job_photos')
        .insert({
          job_id: jobId,
          uploaded_by: user.id,
          photo_url: publicUrl,
          note: note.trim() || null,
        });

      if (insertError) throw insertError;

      toast({
        title: 'Success',
        description: 'Photo uploaded successfully',
      });

      setShowUploadDialog(false);
      setPhotoPreview(null);
      setPhotoBlob(null);
      setNote('');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload photo',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      const { error } = await supabase
        .from('job_photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Photo deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete photo',
        variant: 'destructive',
      });
    }
  };

  const handleOpenUpload = () => {
    setShowUploadDialog(true);
    setPhotoPreview(null);
    setPhotoBlob(null);
    setNote('');
    setTimeout(() => startCamera(), 100);
  };

  const handleCloseUpload = () => {
    setShowUploadDialog(false);
    stopCamera();
    setPhotoPreview(null);
    setPhotoBlob(null);
    setNote('');
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading photos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Job Photo Album</h2>
        <Button onClick={handleOpenUpload}>
          <Camera className="h-4 w-4 mr-2" />
          Add Photo
        </Button>
      </div>

      {photos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Camera className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No Photos Yet</h3>
            <p className="text-muted-foreground mb-4">
              Start building your job photo album by taking photos.
            </p>
            <Button onClick={handleOpenUpload}>
              <Camera className="h-4 w-4 mr-2" />
              Take First Photo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <Card key={photo.id} className="overflow-hidden">
              <div className="relative aspect-video">
                <img
                  src={photo.photo_url}
                  alt="Job photo"
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setSelectedPhoto(photo)}
                />
                {user?.id === photo.uploaded_by && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(photo.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {photo.note && (
                <CardContent className="p-3">
                  <p className="text-sm text-muted-foreground">{photo.note}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => !open && handleCloseUpload()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Photo to Album</DialogTitle>
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
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </Button>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </DialogContent>
      </Dialog>

      {/* Photo Detail Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Photo Details</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="space-y-4">
              <img
                src={selectedPhoto.photo_url}
                alt="Job photo"
                className="w-full rounded-lg"
              />
              {selectedPhoto.note && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Note</label>
                  <p className="text-muted-foreground">{selectedPhoto.note}</p>
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                {new Date(selectedPhoto.created_at).toLocaleString()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
