import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Trash2, X, FolderPlus, MapPin, MessageSquare, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

interface JobPhoto {
  id: string;
  photo_url: string;
  note?: string;
  uploaded_by: string;
  created_at: string;
  album_id?: string;
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

interface PhotoAlbum {
  id: string;
  name: string;
  description?: string;
  is_auto_employee_album: boolean;
  created_at: string;
}

interface PhotoComment {
  id: string;
  photo_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

interface JobPhotoAlbumProps {
  jobId: string;
}

export default function JobPhotoAlbum({ jobId }: JobPhotoAlbumProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showCreateAlbumDialog, setShowCreateAlbumDialog] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null);
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDescription, setNewAlbumDescription] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    loadPhotos();
    loadAlbums();

    // Subscribe to realtime updates
    const photosChannel = supabase
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

    const albumsChannel = supabase
      .channel('photo-albums-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'photo_albums',
        filter: `job_id=eq.${jobId}`,
      }, () => {
        loadAlbums();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(photosChannel);
      supabase.removeChannel(albumsChannel);
      stopCamera();
    };
  }, [jobId]);

  useEffect(() => {
    if (selectedPhoto) {
      loadComments(selectedPhoto.id);
    }
  }, [selectedPhoto]);

  const loadPhotos = async () => {
    try {
      let query = supabase
        .from('job_photos')
        .select(`
          *,
          profiles(first_name, last_name, avatar_url)
        `)
        .eq('job_id', jobId);

      if (selectedAlbumId !== 'all') {
        query = query.eq('album_id', selectedAlbumId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

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

  const loadAlbums = async () => {
    try {
      const { data, error } = await supabase
        .from('photo_albums')
        .select('*')
        .eq('job_id', jobId)
        .order('is_auto_employee_album', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAlbums(data || []);
    } catch (error) {
      console.error('Error loading albums:', error);
    }
  };

  const loadComments = async (photoId: string) => {
    try {
      const { data, error } = await supabase
        .from('photo_comments')
        .select(`
          *,
          profiles(first_name, last_name, avatar_url)
        `)
        .eq('photo_id', photoId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error loading comments:', error);
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
      // Get or create employee uploads album
      const { data: albumId, error: albumError } = await supabase
        .rpc('get_or_create_employee_album', {
          p_job_id: jobId,
          p_user_id: user.id
        });

      if (albumError) throw albumError;

      // Get location
      let locationData = {};
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        locationData = {
          location_lat: position.coords.latitude,
          location_lng: position.coords.longitude,
        };
      } catch (error) {
        console.log('Location not available');
      }

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
          album_id: albumId,
          ...locationData,
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

  const handleCreateAlbum = async () => {
    if (!user || !newAlbumName.trim()) return;

    try {
      const { error } = await supabase
        .from('photo_albums')
        .insert({
          job_id: jobId,
          name: newAlbumName.trim(),
          description: newAlbumDescription.trim() || null,
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Album created successfully',
      });

      setShowCreateAlbumDialog(false);
      setNewAlbumName('');
      setNewAlbumDescription('');
      loadAlbums();
    } catch (error) {
      console.error('Error creating album:', error);
      toast({
        title: 'Error',
        description: 'Failed to create album',
        variant: 'destructive',
      });
    }
  };

  const handleAddComment = async () => {
    if (!user || !selectedPhoto || !newComment.trim()) return;

    try {
      const { error } = await supabase
        .from('photo_comments')
        .insert({
          photo_id: selectedPhoto.id,
          user_id: user.id,
          comment: newComment.trim(),
        });

      if (error) throw error;

      setNewComment('');
      loadComments(selectedPhoto.id);
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive',
      });
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Job Photo Album</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCreateAlbumDialog(true)}>
            <FolderPlus className="h-4 w-4 mr-2" />
            Create Album
          </Button>
          <Button onClick={handleOpenUpload}>
            <Camera className="h-4 w-4 mr-2" />
            Add Photo
          </Button>
        </div>
      </div>

      {/* Album Filter */}
      <div className="flex gap-2 items-center">
        <label className="text-sm font-medium">Album:</label>
        <Select value={selectedAlbumId} onValueChange={(value) => {
          setSelectedAlbumId(value);
          setLoading(true);
          loadPhotos();
        }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Photos</SelectItem>
            {albums.map((album) => (
              <SelectItem key={album.id} value={album.id}>
                {album.name} {album.is_auto_employee_album && '(Auto)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={photo.profiles?.avatar_url} />
                    <AvatarFallback>
                      {photo.profiles?.first_name?.[0]}{photo.profiles?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {photo.profiles?.first_name} {photo.profiles?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(photo.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>
                {photo.note && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{photo.note}</p>
                )}
                {photo.location_lat && photo.location_lng && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>Location captured</span>
                  </div>
                )}
              </CardContent>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Photo Details</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="space-y-6">
              <img
                src={selectedPhoto.photo_url}
                alt="Job photo"
                className="w-full rounded-lg"
              />
              
              {/* Uploader Info */}
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedPhoto.profiles?.avatar_url} />
                  <AvatarFallback>
                    {selectedPhoto.profiles?.first_name?.[0]}{selectedPhoto.profiles?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {selectedPhoto.profiles?.first_name} {selectedPhoto.profiles?.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedPhoto.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>

              {/* Location */}
              {selectedPhoto.location_lat && selectedPhoto.location_lng && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Location</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedPhoto.location_address || `${selectedPhoto.location_lat.toFixed(6)}, ${selectedPhoto.location_lng.toFixed(6)}`}
                    </p>
                  </div>
                </div>
              )}

              {/* Note */}
              {selectedPhoto.note && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Note</label>
                  <p className="text-muted-foreground">{selectedPhoto.note}</p>
                </div>
              )}

              <Separator />

              {/* Comments Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  <h3 className="font-semibold">Comments</h3>
                </div>

                {/* Comments List */}
                <div className="space-y-4 max-h-60 overflow-y-auto">
                  {comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No comments yet. Be the first to comment!
                    </p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={comment.profiles?.avatar_url} />
                          <AvatarFallback>
                            {comment.profiles?.first_name?.[0]}{comment.profiles?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <p className="text-sm font-medium">
                              {comment.profiles?.first_name} {comment.profiles?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                            </p>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{comment.comment}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment */}
                <div className="flex gap-2">
                  <Input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Album Dialog */}
      <Dialog open={showCreateAlbumDialog} onOpenChange={setShowCreateAlbumDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Photo Album</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Album Name</label>
              <Input
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="Enter album name..."
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description (optional)</label>
              <Textarea
                value={newAlbumDescription}
                onChange={(e) => setNewAlbumDescription(e.target.value)}
                placeholder="Describe this album..."
                rows={3}
              />
            </div>
            <Button onClick={handleCreateAlbum} disabled={!newAlbumName.trim()} className="w-full">
              Create Album
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
