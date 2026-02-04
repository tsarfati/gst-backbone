import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Trash2, X, FolderPlus, MapPin, MessageSquare, Send, CheckSquare, Square, Plus, Pencil, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import PhotoLocationMap from './PhotoLocationMap';

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
  pin_employee_id?: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
  pin_employees?: {
    first_name?: string;
    last_name?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

interface PhotoAlbum {
  id: string;
  name: string;
  description?: string;
  is_auto_employee_album: boolean;
  created_at: string;
  cover_photo_url?: string;
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
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [showAddToAlbumDialog, setShowAddToAlbumDialog] = useState(false);
  const [targetAlbumId, setTargetAlbumId] = useState<string>('');
  const [createNewAlbumFromSelection, setCreateNewAlbumFromSelection] = useState(false);
  const [showEditAlbumDialog, setShowEditAlbumDialog] = useState(false);
  const [editAlbumName, setEditAlbumName] = useState('');
  const [editAlbumDescription, setEditAlbumDescription] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ensuredEmployeeAlbumRef = useRef(false);

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

  // Reload photos when selectedAlbumId changes
  useEffect(() => {
    if (selectedAlbumId) {
      setLoading(true);
      loadPhotos();
    }
  }, [selectedAlbumId]);

  const loadPhotos = async () => {
    try {
      let query = supabase
        .from('job_photos')
        .select(`
          *,
          profiles(first_name, last_name, avatar_url),
          pin_employees(first_name, last_name, display_name, avatar_url)
        `)
        .eq('job_id', jobId);

      if (selectedAlbumId) {
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
      
      // Fetch cover photo for each album (latest photo)
      const albumsWithCovers = await Promise.all(
        (data || []).map(async (album) => {
          const { data: latestPhoto } = await supabase
            .from('job_photos')
            .select('photo_url')
            .eq('album_id', album.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          return {
            ...album,
            cover_photo_url: latestPhoto?.photo_url || null
          };
        })
      );
      
      setAlbums(albumsWithCovers);

      // Ensure the auto employee album exists once per mount
      if (!ensuredEmployeeAlbumRef.current && user?.id) {
        const hasEmployeeAlbum = (data || []).some(a => a.is_auto_employee_album);
        if (!hasEmployeeAlbum) {
          const { error: rpcError } = await supabase.rpc('get_or_create_employee_album', {
            p_job_id: jobId,
            p_user_id: user.id,
          });
          if (!rpcError) {
            ensuredEmployeeAlbumRef.current = true;
            // Reload albums to include the newly created one
            loadAlbums();
            toast({ title: 'Employee album ready', description: 'Created Employee Uploads album for this job.' });
          } else {
            console.error('Error creating employee album:', rpcError);
          }
        } else {
          ensuredEmployeeAlbumRef.current = true;
        }
      }
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
          stopCamera();
        }
      }, 'image/jpeg', 1.0);
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

  const handleUpdateAlbum = async () => {
    if (!user || !selectedAlbumId || !editAlbumName.trim()) return;

    try {
      const { error } = await supabase
        .from('photo_albums')
        .update({
          name: editAlbumName.trim(),
          description: editAlbumDescription.trim() || null,
        })
        .eq('id', selectedAlbumId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Album updated successfully',
      });

      setShowEditAlbumDialog(false);
      loadAlbums();
    } catch (error) {
      console.error('Error updating album:', error);
      toast({
        title: 'Error',
        description: 'Failed to update album',
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

      // Immediately update local state
      setPhotos(prev => prev.filter(p => p.id !== photoId));

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

  const handleBulkDelete = async () => {
    if (selectedPhotos.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedPhotos.size} photo(s)?`)) return;

    try {
      const { error } = await supabase
        .from('job_photos')
        .delete()
        .in('id', Array.from(selectedPhotos));

      if (error) throw error;

      // Immediately update local state
      setPhotos(prev => prev.filter(p => !selectedPhotos.has(p.id)));

      toast({
        title: 'Success',
        description: `${selectedPhotos.size} photo(s) deleted successfully`,
      });
      
      setSelectedPhotos(new Set());
      setSelectionMode(false);
    } catch (error) {
      console.error('Error deleting photos:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete photos',
        variant: 'destructive',
      });
    }
  };

  const handleAddToAlbum = async () => {
    if (selectedPhotos.size === 0) return;

    if (createNewAlbumFromSelection) {
      if (!newAlbumName.trim()) return;
      
      try {
        // Create new album
        const { data: newAlbum, error: albumError } = await supabase
          .from('photo_albums')
          .insert({
            job_id: jobId,
            name: newAlbumName.trim(),
            description: newAlbumDescription.trim() || null,
            created_by: user!.id,
          })
          .select()
          .single();

        if (albumError) throw albumError;

        // Add photos to album
        const { error: updateError } = await supabase
          .from('job_photos')
          .update({ album_id: newAlbum.id })
          .in('id', Array.from(selectedPhotos));

        if (updateError) throw updateError;

        toast({
          title: 'Success',
          description: `Created album and added ${selectedPhotos.size} photo(s)`,
        });

        setShowAddToAlbumDialog(false);
        setNewAlbumName('');
        setNewAlbumDescription('');
        setCreateNewAlbumFromSelection(false);
        setSelectedPhotos(new Set());
        setSelectionMode(false);
        loadAlbums();
      } catch (error) {
        console.error('Error creating album and adding photos:', error);
        toast({
          title: 'Error',
          description: 'Failed to create album',
          variant: 'destructive',
        });
      }
    } else {
      if (!targetAlbumId) return;

      try {
        const { error } = await supabase
          .from('job_photos')
          .update({ album_id: targetAlbumId })
          .in('id', Array.from(selectedPhotos));

        if (error) throw error;

        toast({
          title: 'Success',
          description: `${selectedPhotos.size} photo(s) added to album`,
        });

        setShowAddToAlbumDialog(false);
        setTargetAlbumId('');
        setSelectedPhotos(new Set());
        setSelectionMode(false);
      } catch (error) {
        console.error('Error adding photos to album:', error);
        toast({
          title: 'Error',
          description: 'Failed to add photos to album',
          variant: 'destructive',
        });
      }
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    const newSelection = new Set(selectedPhotos);
    if (newSelection.has(photoId)) {
      newSelection.delete(photoId);
    } else {
      newSelection.add(photoId);
    }
    setSelectedPhotos(newSelection);
  };

  const selectAll = () => {
    setSelectedPhotos(new Set(photos.map(p => p.id)));
  };

  const deselectAll = () => {
    setSelectedPhotos(new Set());
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
        {selectedAlbumId ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => {
              setSelectedAlbumId('');
              setSelectionMode(false);
              setSelectedPhotos(new Set());
            }}>
              <X className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h2 className="text-2xl font-bold">
              {albums.find(a => a.id === selectedAlbumId)?.name || 'Album'}
            </h2>
          </div>
        ) : (
          <h2 className="text-2xl font-bold">Job Photo Album</h2>
        )}
        <div className="flex gap-2">
          {selectedAlbumId ? (
            // Inside an album - show Edit Album button and selection controls
            !selectionMode ? (
              <Button variant="outline" onClick={() => {
                const album = albums.find(a => a.id === selectedAlbumId);
                if (album) {
                  setEditAlbumName(album.name);
                  setEditAlbumDescription(album.description || '');
                  setShowEditAlbumDialog(true);
                }
              }}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Album
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" onClick={deselectAll}>
                  Deselect All
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedPhotos(new Set());
                  }}
                >
                  Cancel
                </Button>
              </>
            )
          ) : (
            // Album list view - only show Create Album
            <Button variant="outline" onClick={() => setShowCreateAlbumDialog(true)}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Create Album
            </Button>
          )}
        </div>
      </div>

      {/* Selection Toolbar */}
      {selectionMode && selectedPhotos.size > 0 && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="flex items-center justify-between p-4">
            <span className="font-medium">
              {selectedPhotos.size} photo(s) selected
            </span>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Album Icons Grid */}
      {!selectedAlbumId || selectedAlbumId === 'all' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {albums.map((album) => (
            <Card 
              key={album.id} 
              className="cursor-pointer hover:border-primary transition-colors group"
              onClick={() => {
                setSelectedAlbumId(album.id);
                setLoading(true);
              }}
            >
              <CardContent className="p-3 flex flex-col items-center text-center">
                <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center mb-2 overflow-hidden group-hover:ring-2 ring-primary transition-all">
                  {album.cover_photo_url ? (
                    <img 
                      src={album.cover_photo_url} 
                      alt={album.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FolderPlus className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm font-medium line-clamp-2">{album.name}</p>
                {album.is_auto_employee_album && (
                  <span className="text-xs text-muted-foreground mt-1">Employee Uploads</span>
                )}
              </CardContent>
            </Card>
          ))}
          {albums.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No albums yet. Create one to get started.
            </div>
          )}
        </div>
      ) : (
        <>
      {photos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Camera className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No Photos Yet</h3>
            <p className="text-muted-foreground mb-4">
              Photos will appear here when employees upload them.
            </p>
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
                  onClick={() => {
                    if (selectionMode) {
                      togglePhotoSelection(photo.id);
                    } else {
                      setSelectedPhoto(photo);
                    }
                  }}
                />
                {selectionMode && (
                  <div className="absolute top-2 left-2">
                    <Checkbox
                      checked={selectedPhotos.has(photo.id)}
                      onCheckedChange={() => togglePhotoSelection(photo.id)}
                      className="h-6 w-6 bg-background border-2"
                    />
                  </div>
                )}
              </div>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={photo.pin_employee_id && photo.pin_employees?.avatar_url ? photo.pin_employees.avatar_url : photo.profiles?.avatar_url} />
                    <AvatarFallback>
                      {photo.pin_employee_id && photo.pin_employees 
                        ? `${photo.pin_employees.first_name?.[0] || ''}${photo.pin_employees.last_name?.[0] || ''}`
                        : `${photo.profiles?.first_name?.[0] || ''}${photo.profiles?.last_name?.[0] || ''}`
                      }
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {photo.pin_employee_id && photo.pin_employees 
                        ? (photo.pin_employees.display_name || `${photo.pin_employees.first_name} ${photo.pin_employees.last_name}`)
                        : `${photo.profiles?.first_name || ''} ${photo.profiles?.last_name || ''}`
                      }
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
        </>
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Photo Details</span>
              {selectedPhoto && (
                <a
                  href={selectedPhoto.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-normal text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Full Resolution
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="space-y-6">
              {/* Full resolution image - no max constraints, natural size up to container */}
              <a 
                href={selectedPhoto.photo_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block cursor-zoom-in"
              >
                <img
                  src={selectedPhoto.photo_url}
                  alt="Job photo"
                  className="w-full rounded-lg"
                  style={{ maxHeight: '60vh', objectFit: 'contain' }}
                />
              </a>
              
              {/* Uploader Info */}
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedPhoto.pin_employee_id && selectedPhoto.pin_employees?.avatar_url ? selectedPhoto.pin_employees.avatar_url : selectedPhoto.profiles?.avatar_url} />
                  <AvatarFallback>
                    {selectedPhoto.pin_employee_id && selectedPhoto.pin_employees 
                      ? `${selectedPhoto.pin_employees.first_name?.[0] || ''}${selectedPhoto.pin_employees.last_name?.[0] || ''}`
                      : `${selectedPhoto.profiles?.first_name?.[0] || ''}${selectedPhoto.profiles?.last_name?.[0] || ''}`
                    }
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {selectedPhoto.pin_employee_id && selectedPhoto.pin_employees 
                      ? (selectedPhoto.pin_employees.display_name || `${selectedPhoto.pin_employees.first_name} ${selectedPhoto.pin_employees.last_name}`)
                      : `${selectedPhoto.profiles?.first_name || ''} ${selectedPhoto.profiles?.last_name || ''}`
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedPhoto.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>

              {/* Location with Map */}
              {selectedPhoto.location_lat && selectedPhoto.location_lng && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">Photo Location</p>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${selectedPhoto.location_lat},${selectedPhoto.location_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open in Google Maps
                    </a>
                  </div>
                  <PhotoLocationMap 
                    latitude={selectedPhoto.location_lat} 
                    longitude={selectedPhoto.location_lng}
                    className="h-48 w-full"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    {selectedPhoto.location_address || `${selectedPhoto.location_lat.toFixed(6)}, ${selectedPhoto.location_lng.toFixed(6)}`}
                  </p>
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

      {/* Add to Album Dialog */}
      <Dialog open={showAddToAlbumDialog} onOpenChange={setShowAddToAlbumDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {selectedPhotos.size} Photo(s) to Album</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={!createNewAlbumFromSelection ? "default" : "outline"}
                onClick={() => setCreateNewAlbumFromSelection(false)}
                className="flex-1"
              >
                Existing Album
              </Button>
              <Button
                variant={createNewAlbumFromSelection ? "default" : "outline"}
                onClick={() => setCreateNewAlbumFromSelection(true)}
                className="flex-1"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Album
              </Button>
            </div>

            {!createNewAlbumFromSelection ? (
              <div>
                <label className="text-sm font-medium mb-2 block">Select Album</label>
                <Select value={targetAlbumId} onValueChange={setTargetAlbumId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an album..." />
                  </SelectTrigger>
                  <SelectContent>
                    {albums.map((album) => (
                      <SelectItem key={album.id} value={album.id}>
                        {album.name} {album.is_auto_employee_album && '(Auto)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
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
              </>
            )}

            <Button 
              onClick={handleAddToAlbum} 
              disabled={
                createNewAlbumFromSelection ? !newAlbumName.trim() : !targetAlbumId
              } 
              className="w-full"
            >
              {createNewAlbumFromSelection ? 'Create & Add Photos' : 'Add to Album'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Album Dialog */}
      <Dialog open={showEditAlbumDialog} onOpenChange={setShowEditAlbumDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Album</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Album Name</label>
              <Input
                value={editAlbumName}
                onChange={(e) => setEditAlbumName(e.target.value)}
                placeholder="Enter album name..."
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description (optional)</label>
              <Textarea
                value={editAlbumDescription}
                onChange={(e) => setEditAlbumDescription(e.target.value)}
                placeholder="Describe this album..."
                rows={3}
              />
            </div>
            <Separator />
            <div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setSelectionMode(true);
                  setShowEditAlbumDialog(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Select Photos to Delete
              </Button>
            </div>
            <Button onClick={handleUpdateAlbum} disabled={!editAlbumName.trim()} className="w-full">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
