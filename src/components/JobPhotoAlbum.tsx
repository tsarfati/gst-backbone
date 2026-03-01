import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getStoragePathForDb, resolveStorageUrl } from '@/utils/storageUtils';
import { syncFileToGoogleDrive } from '@/utils/googleDriveSync';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Trash2, X, FolderPlus, MapPin, MessageSquare, Send, CheckSquare, Square, Plus, Pencil, ExternalLink, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import PhotoLocationMap from './PhotoLocationMap';
import { ChevronDown, Star } from 'lucide-react';

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
    display_name?: string;
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

/** Lazily resolves a signed URL for a private-bucket image */
function ResolvedImage({ src, alt, className, onClick }: { src: string; alt: string; className?: string; onClick?: () => void }) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveStorageUrl('punch-photos', src).then((url) => {
      if (!cancelled) setResolvedSrc(url || src);
    });
    return () => { cancelled = true; };
  }, [src]);

  if (!resolvedSrc) {
    return <div className={className + ' bg-muted animate-pulse'} />;
  }

  return <img src={resolvedSrc} alt={alt} className={className} onClick={onClick} />;
}

interface JobPhotoAlbumProps {
  jobId: string;
}

export default function JobPhotoAlbum({ jobId }: JobPhotoAlbumProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOverAlbumId, setDragOverAlbumId] = useState<string | null>(null);
  const [isDraggingOverPhotos, setIsDraggingOverPhotos] = useState(false);
  const [albumViewMode, setAlbumViewMode] = useState<'regular' | 'small'>('regular');
  const [photoViewMode, setPhotoViewMode] = useState<'cards' | 'compact' | 'super-compact'>('cards');
  const [photoDateFrom, setPhotoDateFrom] = useState('');
  const [photoDateTo, setPhotoDateTo] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState<'all' | string>('all');
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [savedDefaultPhotoView, setSavedDefaultPhotoView] = useState<'cards' | 'compact' | 'super-compact'>('cards');
  const [photoViewPickerOpen, setPhotoViewPickerOpen] = useState(false);
  const timelineRailRef = useRef<HTMLDivElement | null>(null);
  const scrubVirtualIndexRef = useRef<number>(0);
  const scrubLastYRef = useRef<number | null>(null);

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
    const storageKey = `job-photo-view-mode:${currentCompany?.id || 'default'}:${user?.id || 'anon'}`;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === 'cards' || stored === 'compact' || stored === 'super-compact') {
      setPhotoViewMode(stored);
      setSavedDefaultPhotoView(stored);
    } else {
      setSavedDefaultPhotoView('cards');
    }
  }, [currentCompany?.id, user?.id]);

  const [resolvedDetailUrl, setResolvedDetailUrl] = useState<string | null>(null);

  useEffect(() => {
    if (selectedPhoto) {
      loadComments(selectedPhoto.id);
      setResolvedDetailUrl(null);
      resolveStorageUrl('punch-photos', selectedPhoto.photo_url).then((url) => {
        setResolvedDetailUrl(url || selectedPhoto.photo_url);
      });
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
          profiles(first_name, last_name, display_name, avatar_url)
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

      const photoPath = getStoragePathForDb('punch-photos', fileName);

      // Save to database
      const { error: insertError } = await supabase
        .from('job_photos')
        .insert({
          job_id: jobId,
          uploaded_by: user.id,
          photo_url: photoPath,
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

  const uploadFilesToAlbum = async (files: File[], albumId: string) => {
    if (!user) return;

    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast({ title: 'Invalid files', description: 'Only image files are supported.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    let successCount = 0;

    // Get location once for all photos
    let locationData: Record<string, number> = {};
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
      });
      locationData = { location_lat: position.coords.latitude, location_lng: position.coords.longitude };
    } catch { /* location not available */ }

    for (const file of imageFiles) {
      try {
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `job-${jobId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('punch-photos').upload(fileName, file);
        if (uploadError) throw uploadError;

        const photoPath = getStoragePathForDb('punch-photos', fileName);
        const { error: insertError } = await supabase.from('job_photos').insert({
          job_id: jobId,
          uploaded_by: user.id,
          photo_url: photoPath,
          album_id: albumId,
          ...locationData,
        });
        if (insertError) throw insertError;
        successCount++;

        // Sync to Google Drive
        if (currentCompany) {
          const { data: urlData } = supabase.storage.from('punch-photos').getPublicUrl(fileName);
          syncFileToGoogleDrive({
            companyId: currentCompany.id,
            jobId,
            category: 'photos',
            fileUrl: urlData.publicUrl,
            fileName: file.name,
            subfolder: `Photos`,
          });
        }
      } catch (error) {
        console.error('Error uploading file:', file.name, error);
      }
    }

    setUploading(false);
    if (successCount > 0) {
      toast({ title: 'Photos uploaded', description: `${successCount} photo(s) added successfully.` });
      loadPhotos();
      loadAlbums();
    }
  };

  const handleDropOnAlbum = (e: React.DragEvent, albumId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverAlbumId(null);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      uploadFilesToAlbum(files, albumId);
    }
  };

  const handleDropOnPhotoArea = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverPhotos(false);
    if (!selectedAlbumId) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      uploadFilesToAlbum(files, selectedAlbumId);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !selectedAlbumId) return;
    uploadFilesToAlbum(Array.from(e.target.files), selectedAlbumId);
    e.target.value = '';
  };

  const getUploaderName = (photo: JobPhoto) =>
    photo.profiles?.display_name ||
    `${photo.profiles?.first_name || ''} ${photo.profiles?.last_name || ''}`.trim() ||
    'Unknown User';

  const uploaderOptions = useMemo(() => {
    const unique = new Map<string, string>();
    photos.forEach((photo) => {
      unique.set(photo.uploaded_by, getUploaderName(photo));
    });
    return Array.from(unique.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      const photoDate = new Date(photo.created_at);
      if (photoDateFrom) {
        const from = new Date(`${photoDateFrom}T00:00:00`);
        if (photoDate < from) return false;
      }
      if (photoDateTo) {
        const to = new Date(`${photoDateTo}T23:59:59`);
        if (photoDate > to) return false;
      }
      if (uploaderFilter !== 'all' && photo.uploaded_by !== uploaderFilter) {
        return false;
      }
      return true;
    });
  }, [photos, photoDateFrom, photoDateTo, uploaderFilter]);

  const groupedPhotos = useMemo(() => {
    const groups = new Map<string, { label: string; photos: JobPhoto[]; sortDate: Date }>();
    filteredPhotos.forEach((photo) => {
      const d = new Date(photo.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = format(d, 'MMMM yyyy');
      if (!groups.has(key)) {
        groups.set(key, { label, photos: [], sortDate: new Date(d.getFullYear(), d.getMonth(), 1) });
      }
      groups.get(key)!.photos.push(photo);
    });
    return Array.from(groups.entries())
      .sort((a, b) => b[1].sortDate.getTime() - a[1].sortDate.getTime())
      .map(([key, value]) => ({ key, ...value }));
  }, [filteredPhotos]);

  const timelineMarkers = useMemo(() => {
    if (groupedPhotos.length === 0) return [] as { key: string; label: string; sortDate: Date }[];

    const newest = groupedPhotos[0].sortDate;
    const oldest = groupedPhotos[groupedPhotos.length - 1].sortDate;
    const spanDays = Math.max(
      1,
      Math.round((newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24))
    );

    let labelFormat = 'MMM yyyy';
    if (spanDays <= 31) labelFormat = 'MMM d';
    else if (spanDays <= 180) labelFormat = 'MMM';
    else if (spanDays <= 730) labelFormat = 'MMM yy';
    else labelFormat = 'yyyy';

    const maxMarkers = 12;
    if (groupedPhotos.length <= maxMarkers) {
      return groupedPhotos.map((g) => ({
        key: g.key,
        sortDate: g.sortDate,
        label: format(g.sortDate, labelFormat),
      }));
    }

    const sampled: { key: string; label: string; sortDate: Date }[] = [];
    for (let i = 0; i < maxMarkers; i++) {
      const idx = Math.round((i * (groupedPhotos.length - 1)) / (maxMarkers - 1));
      const g = groupedPhotos[idx];
      if (!sampled.some((m) => m.key === g.key)) {
        sampled.push({
          key: g.key,
          sortDate: g.sortDate,
          label: format(g.sortDate, labelFormat),
        });
      }
    }
    return sampled;
  }, [groupedPhotos]);

  useEffect(() => {
    if (groupedPhotos.length === 0) {
      setActiveGroupKey(null);
      return;
    }

    const updateActiveGroup = () => {
      let bestKey = groupedPhotos[0].key;
      let bestDistance = Number.POSITIVE_INFINITY;

      groupedPhotos.forEach((group) => {
        const el = document.getElementById(`photos-month-${group.key}`);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top - 180);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestKey = group.key;
        }
      });

      setActiveGroupKey(bestKey);
    };

    updateActiveGroup();
    window.addEventListener('scroll', updateActiveGroup, { passive: true });
    window.addEventListener('resize', updateActiveGroup);
    return () => {
      window.removeEventListener('scroll', updateActiveGroup);
      window.removeEventListener('resize', updateActiveGroup);
    };
  }, [groupedPhotos]);

  const saveDefaultPhotoView = () => {
    const storageKey = `job-photo-view-mode:${currentCompany?.id || 'default'}:${user?.id || 'anon'}`;
    window.localStorage.setItem(storageKey, photoViewMode);
    setSavedDefaultPhotoView(photoViewMode);
    toast({
      title: 'Default view saved',
      description: `Photo view default set to ${photoViewMode}.`,
    });
  };

  const photoViewOptions: Array<{ value: 'cards' | 'compact' | 'super-compact'; label: string }> = [
    { value: 'cards', label: 'Cards' },
    { value: 'compact', label: 'Compact Grid' },
    { value: 'super-compact', label: 'Super Compact Grid' },
  ];

  const scrubTimelineToClientPoint = useCallback((clientX: number, clientY: number, smooth = false) => {
    if (!timelineRailRef.current || groupedPhotos.length === 0) return;
    const rect = timelineRailRef.current.getBoundingClientRect();
    const clamped = Math.max(rect.top, Math.min(clientY, rect.bottom));
    const ratio = rect.height <= 0 ? 0 : (clamped - rect.top) / rect.height;
    const absoluteIndex = Math.max(0, Math.min(groupedPhotos.length - 1, ratio * (groupedPhotos.length - 1)));

    // Google Photos-like variable scrub precision:
    // - close to rail => faster / direct jumping
    // - drag finger/mouse left away from rail => finer control
    const horizontalDistance = Math.max(0, rect.left - clientX);
    const precision = Math.max(0, Math.min(1, horizontalDistance / 280)); // 0 near rail, 1 far left
    const directThreshold = 20;

    if (horizontalDistance <= directThreshold || scrubLastYRef.current === null) {
      scrubVirtualIndexRef.current = absoluteIndex;
      scrubLastYRef.current = clamped;
    } else {
      const lastY = scrubLastYRef.current;
      const deltaY = clamped - lastY;
      scrubLastYRef.current = clamped;

      // Speed scales down as pointer moves left (fine scrub)
      const speedMultiplier = 1 - precision * 0.88; // ~1.0 near rail -> ~0.12 far left
      const deltaIndex = rect.height <= 0
        ? 0
        : (deltaY / rect.height) * (groupedPhotos.length - 1) * speedMultiplier;

      scrubVirtualIndexRef.current = Math.max(
        0,
        Math.min(groupedPhotos.length - 1, scrubVirtualIndexRef.current + deltaIndex)
      );

      // Keep some attraction to absolute position to avoid drift getting stale.
      const attraction = Math.max(0.03, 0.18 - precision * 0.12);
      scrubVirtualIndexRef.current =
        scrubVirtualIndexRef.current * (1 - attraction) + absoluteIndex * attraction;
    }

    const index = Math.max(0, Math.min(groupedPhotos.length - 1, Math.round(scrubVirtualIndexRef.current)));
    const target = groupedPhotos[index];
    setActiveGroupKey(target.key);
    document
      .getElementById(`photos-month-${target.key}`)
      ?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }, [groupedPhotos]);

  useEffect(() => {
    if (!isScrubbing) return;

    const handleMouseMove = (e: MouseEvent) => {
      scrubTimelineToClientPoint(e.clientX, e.clientY, false);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      e.preventDefault();
      scrubTimelineToClientPoint(e.touches[0].clientX, e.touches[0].clientY, false);
    };
    const endScrub = () => {
      setIsScrubbing(false);
      scrubLastYRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', endScrub);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', endScrub);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', endScrub);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', endScrub);
    };
  }, [isScrubbing, scrubTimelineToClientPoint]);

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
            <>
              <Select
                value={albumViewMode}
                onValueChange={(v: 'regular' | 'small') => setAlbumViewMode(v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Album view" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular Grid</SelectItem>
                  <SelectItem value="small">Small Grid</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setShowCreateAlbumDialog(true)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                Create Album
              </Button>
            </>
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
        <div className={`grid ${albumViewMode === 'small' ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4'}`}>
          {albums.map((album) => (
            <Card 
              key={album.id} 
              className={`cursor-pointer hover:border-primary transition-colors group ${dragOverAlbumId === album.id ? 'border-primary ring-2 ring-primary bg-primary/5' : ''}`}
              onClick={() => {
                setSelectedAlbumId(album.id);
                setLoading(true);
              }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverAlbumId(album.id); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverAlbumId(null); }}
              onDrop={(e) => handleDropOnAlbum(e, album.id)}
            >
              <CardContent className={`${albumViewMode === 'small' ? 'p-2' : 'p-3'} flex flex-col items-center text-center`}>
                <div className={`w-full aspect-square rounded-lg bg-muted flex items-center justify-center ${albumViewMode === 'small' ? 'mb-1' : 'mb-2'} overflow-hidden group-hover:ring-2 ring-primary transition-all relative`}>
                  {dragOverAlbumId === album.id ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/10 z-10">
                      <Upload className="h-8 w-8 text-primary animate-bounce" />
                    </div>
                  ) : null}
                  {album.cover_photo_url ? (
                    <ResolvedImage 
                      src={album.cover_photo_url} 
                      alt={album.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FolderPlus className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <p className={`${albumViewMode === 'small' ? 'text-xs' : 'text-sm'} font-medium line-clamp-2`}>{album.name}</p>
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
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDraggingOverPhotos(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDraggingOverPhotos(false); }}
          onDrop={handleDropOnPhotoArea}
          className="relative"
        >
          <Card className="mb-4">
            <CardContent className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date from</label>
                  <Input type="date" value={photoDateFrom} onChange={(e) => setPhotoDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date to</label>
                  <Input type="date" value={photoDateTo} onChange={(e) => setPhotoDateTo(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Uploader</label>
                  <Select value={uploaderFilter} onValueChange={(v) => setUploaderFilter(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All uploaders" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All uploaders</SelectItem>
                      {uploaderOptions.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Photo view</label>
                  <Popover open={photoViewPickerOpen} onOpenChange={setPhotoViewPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        <span>{photoViewOptions.find((opt) => opt.value === photoViewMode)?.label || 'Photo view'}</span>
                        <ChevronDown className="h-4 w-4 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[260px] p-1" align="start">
                      <div className="space-y-1">
                        {photoViewOptions.map((opt) => (
                          <div key={opt.value} className="flex items-center gap-1 rounded-md hover:bg-muted">
                            <button
                              type="button"
                              className={`flex-1 text-left px-2 py-1.5 text-sm rounded-md ${photoViewMode === opt.value ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
                              onClick={() => {
                                setPhotoViewMode(opt.value);
                                setPhotoViewPickerOpen(false);
                              }}
                            >
                              {opt.label}
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 mr-1"
                              onClick={() => {
                                setPhotoViewMode(opt.value);
                                const storageKey = `job-photo-view-mode:${currentCompany?.id || 'default'}:${user?.id || 'anon'}`;
                                window.localStorage.setItem(storageKey, opt.value);
                                setSavedDefaultPhotoView(opt.value);
                                toast({
                                  title: 'Default view saved',
                                  description: `${opt.label} is now your default.`,
                                });
                              }}
                              title={`Set ${opt.label} as default`}
                            >
                              <Star
                                className={`h-4 w-4 ${savedDefaultPhotoView === opt.value ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                              />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-end">
                  <div className="flex w-full gap-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setPhotoDateFrom('');
                        setPhotoDateTo('');
                        setUploaderFilter('all');
                      }}
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {isDraggingOverPhotos && (
            <div className="absolute inset-0 z-20 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <Upload className="h-12 w-12 text-primary mx-auto mb-2 animate-bounce" />
                <p className="text-lg font-medium text-primary">Drop photos here to upload</p>
              </div>
            </div>
          )}

          {/* Upload bar */}
          <div className="flex items-center gap-2 mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload Photos'}
            </Button>
            <span className="text-sm text-muted-foreground">or drag & drop images here</span>
          </div>

      {filteredPhotos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Camera className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No Photos Found</h3>
            <p className="text-muted-foreground mb-4">
              Drag & drop photos here or click Upload to add them. If filters are active, clear filters to see all photos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_96px] gap-3">
          <div className="space-y-5">
            {groupedPhotos.map((group) => (
              <div key={group.key} id={`photos-month-${group.key}`} className="space-y-3">
                <div className="sticky top-0 z-10 bg-background/90 backdrop-blur px-1 py-1 border-b">
                  <p className="text-sm font-semibold">{group.label}</p>
                </div>
                <div
                  className={
                    photoViewMode === 'super-compact'
                      ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-1.5'
                      : photoViewMode === 'compact'
                      ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2'
                      : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
                  }
                >
                  {group.photos.map((photo) => (
            <Card key={photo.id} className="overflow-hidden">
              <div className={`relative ${photoViewMode === 'super-compact' ? 'aspect-square' : 'aspect-video'}`}>
                <ResolvedImage
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
              <CardContent className={`${photoViewMode === 'super-compact' ? 'p-1 space-y-1' : photoViewMode === 'compact' ? 'p-2 space-y-1' : 'p-3 space-y-2'}`}>
                {photoViewMode !== 'super-compact' && (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={photo.profiles?.avatar_url} />
                      <AvatarFallback>
                        {`${photo.profiles?.first_name?.[0] || ''}${photo.profiles?.last_name?.[0] || ''}`}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className={`${photoViewMode === 'compact' ? 'text-xs' : 'text-sm'} font-medium truncate`}>
                        {getUploaderName(photo)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(photo.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                )}
                {photo.note && photoViewMode !== 'super-compact' && (
                  <p className={`${photoViewMode === 'compact' ? 'text-xs' : 'text-sm'} text-muted-foreground line-clamp-2`}>{photo.note}</p>
                )}
                {photo.location_lat && photo.location_lng && photoViewMode !== 'super-compact' && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>Location captured</span>
                  </div>
                )}
              </CardContent>
            </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="sticky top-4 h-[calc(100vh-132px)]">
            <div className="h-full rounded-2xl border bg-card/80 backdrop-blur-sm px-2 py-2 flex flex-col">
              <div className="min-h-[48px] px-1 py-1">
                {activeGroupKey && (
                  <div className="text-right">
                    <div className="text-xl leading-none font-semibold tabular-nums">
                      {format(
                        groupedPhotos.find((g) => g.key === activeGroupKey)?.sortDate || new Date(),
                        'MMM yyyy'
                      )}
                    </div>
                    <div className="mt-1 h-0.5 bg-primary rounded-full ml-4" />
                  </div>
                )}
              </div>
              <div
                ref={timelineRailRef}
                className={`relative flex-1 grid gap-0.5 ${isScrubbing ? 'cursor-ns-resize select-none' : 'cursor-ns-resize'}`}
                style={{ gridTemplateRows: `repeat(${Math.max(timelineMarkers.length, 1)}, minmax(0, 1fr))` }}
                onMouseDown={(e) => {
                  setIsScrubbing(true);
                  scrubLastYRef.current = null;
                  scrubTimelineToClientPoint(e.clientX, e.clientY, false);
                }}
                onTouchStart={(e) => {
                  if (!e.touches[0]) return;
                  setIsScrubbing(true);
                  scrubLastYRef.current = null;
                  scrubTimelineToClientPoint(e.touches[0].clientX, e.touches[0].clientY, false);
                }}
              >
                <div className="absolute right-[7px] top-0 bottom-0 w-px bg-border/70" />
                {timelineMarkers.map((marker) => {
                  const activeDate = groupedPhotos.find((g) => g.key === activeGroupKey)?.sortDate;
                  const isActiveMarker =
                    !!activeDate && marker.key === activeGroupKey;
                  return (
                    <button
                      key={`timeline-${marker.key}`}
                      type="button"
                      className="relative w-full h-full flex items-center justify-end gap-2 rounded-md px-1 hover:bg-muted/60 transition-colors"
                      onClick={() => {
                        document.getElementById(`photos-month-${marker.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      <span className={`text-sm tabular-nums ${isActiveMarker ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                        {marker.label}
                      </span>
                      <span className={`h-2 w-2 rounded-full ${isActiveMarker ? 'bg-primary' : 'bg-muted-foreground/50'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
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
        <DialogContent className="max-w-[96vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Photo Details</span>
              {selectedPhoto && (
                <a
                  href={resolvedDetailUrl || '#'}
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
              {/* Full resolution image - render at native size inside a scrollable viewport */}
              <a 
                href={resolvedDetailUrl || '#'} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block cursor-zoom-in"
              >
                <div className="w-full max-h-[72vh] overflow-auto rounded-lg border bg-black/5">
                  {resolvedDetailUrl ? (
                    <img
                      src={resolvedDetailUrl}
                      alt="Job photo"
                      className="block max-w-none h-auto rounded-lg"
                    />
                  ) : (
                    <div className="w-full rounded-lg bg-muted animate-pulse" style={{ height: '40vh' }} />
                  )}
                </div>
              </a>
              
              {/* Uploader Info */}
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedPhoto.profiles?.avatar_url} />
                  <AvatarFallback>
                    {`${selectedPhoto.profiles?.first_name?.[0] || ''}${selectedPhoto.profiles?.last_name?.[0] || ''}`}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {selectedPhoto.profiles?.display_name || `${selectedPhoto.profiles?.first_name || ''} ${selectedPhoto.profiles?.last_name || ''}`}
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
