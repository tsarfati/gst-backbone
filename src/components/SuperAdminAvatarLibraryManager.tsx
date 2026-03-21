import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FolderOpen, ImagePlus, Loader2, Move, Plus, Search, Trash2 } from 'lucide-react';
import MultiFileUploadDropzone from '@/components/MultiFileUploadDropzone';
import { AVATAR_LIBRARY, AVATAR_LIBRARY_CATEGORY_LABELS, type AvatarLibraryCategory } from '@/components/avatarLibrary';

const supabaseAny = supabase as any;

interface CompanyOption {
  id: string;
  name: string;
}

interface LibraryItem {
  id: string;
  library_id: string;
  name: string;
  image_url: string;
  sort_order: number;
}

interface AvatarLibraryRecord {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  is_global: boolean;
  is_active: boolean;
  items: LibraryItem[];
  company_ids: string[];
}

interface CropSessionFile {
  fileName: string;
  name: string;
  url: string;
  width: number;
  height: number;
  itemId?: string;
  sortOrder: number;
}

const CROP_VIEWPORT_SIZE = 320;
const CROP_OUTPUT_SIZE = 512;

export default function SuperAdminAvatarLibraryManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [libraries, setLibraries] = useState<AvatarLibraryRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
  const [cropQueue, setCropQueue] = useState<CropSessionFile[]>([]);
  const [cropCurrentIndex, setCropCurrentIndex] = useState(0);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  const selectedLibrary = useMemo(
    () => libraries.find((library) => library.id === selectedLibraryId) || null,
    [libraries, selectedLibraryId]
  );
  const currentCropFile = cropQueue[cropCurrentIndex] || null;
  const cropBaseScale = currentCropFile
    ? Math.max(CROP_VIEWPORT_SIZE / currentCropFile.width, CROP_VIEWPORT_SIZE / currentCropFile.height)
    : 1;
  const cropDisplayWidth = currentCropFile ? currentCropFile.width * cropBaseScale * cropZoom : CROP_VIEWPORT_SIZE;
  const cropDisplayHeight = currentCropFile ? currentCropFile.height * cropBaseScale * cropZoom : CROP_VIEWPORT_SIZE;

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    return () => {
      cropQueue.forEach((entry) => URL.revokeObjectURL(entry.url));
    };
  }, [cropQueue]);

  const clampCropOffset = (x: number, y: number, width = cropDisplayWidth, height = cropDisplayHeight) => {
    const maxX = Math.max(0, (width - CROP_VIEWPORT_SIZE) / 2);
    const maxY = Math.max(0, (height - CROP_VIEWPORT_SIZE) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const resetCropState = () => {
    setCropCurrentIndex(0);
    setCropQueue([]);
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    setIsDraggingCrop(false);
    dragStartRef.current = null;
  };

  const loadCropFiles = async (files: File[]) => {
    const prepared = await Promise.all(
      files.map(async (file, index) => {
        const url = URL.createObjectURL(file);
        const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = reject;
          image.src = url;
        });
        return {
          fileName: file.name,
          name: file.name.replace(/\.[^.]+$/, ''),
          url,
          width: dimensions.width,
          height: dimensions.height,
          sortOrder: (selectedLibrary?.items.length || 0) + index,
        };
      })
    );

    setCropQueue(prepared);
    setCropCurrentIndex(0);
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
  };

  const seedDefaultSystemLibraries = async () => {
    if (!user) return;

    const defaultCategories: AvatarLibraryCategory[] = ['nintendo', 'generic', 'sports', 'construction'];

    for (const category of defaultCategories) {
      const albumName = AVATAR_LIBRARY_CATEGORY_LABELS[category];
      const itemsForCategory = AVATAR_LIBRARY.filter((avatar) => avatar.category === category);

      const { data: insertedLibrary, error: libraryError } = await supabaseAny
        .from('super_admin_avatar_libraries')
        .insert({
          name: albumName,
          description: `System avatar library for ${albumName.toLowerCase()}.`,
          cover_image_url: itemsForCategory[0]?.avatarUrl || null,
          is_global: true,
          is_active: true,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (libraryError) throw libraryError;

      if (itemsForCategory.length > 0) {
        const { error: itemsError } = await supabaseAny
          .from('super_admin_avatar_library_items')
          .insert(
            itemsForCategory.map((item, index) => ({
              library_id: insertedLibrary.id,
              name: item.name,
              image_url: item.avatarUrl,
              sort_order: index,
            }))
          );

        if (itemsError) throw itemsError;
      }
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [{ data: librariesData, error: librariesError }, { data: itemsData, error: itemsError }, { data: assignmentsData, error: assignmentsError }, { data: companiesData, error: companiesError }] = await Promise.all([
        supabaseAny
          .from('super_admin_avatar_libraries')
          .select('id, name, description, cover_image_url, is_global, is_active')
          .order('name'),
        supabaseAny
          .from('super_admin_avatar_library_items')
          .select('id, library_id, name, image_url, sort_order')
          .order('sort_order')
          .order('created_at'),
        supabaseAny
          .from('super_admin_avatar_library_companies')
          .select('library_id, company_id'),
        supabase
          .from('companies')
          .select('id, name, display_name')
          .order('display_name', { ascending: true }),
      ]);

      if (librariesError) throw librariesError;
      if (itemsError) throw itemsError;
      if (assignmentsError) throw assignmentsError;
      if (companiesError) throw companiesError;

      if ((librariesData || []).length === 0 && user) {
        await seedDefaultSystemLibraries();
        return await loadData();
      }

      const itemMap = new Map<string, LibraryItem[]>();
      (itemsData || []).forEach((item: LibraryItem) => {
        const existing = itemMap.get(item.library_id) || [];
        existing.push(item);
        itemMap.set(item.library_id, existing);
      });

      const assignmentMap = new Map<string, string[]>();
      (assignmentsData || []).forEach((row: any) => {
        const existing = assignmentMap.get(row.library_id) || [];
        existing.push(row.company_id);
        assignmentMap.set(row.library_id, existing);
      });

      const nextLibraries = (librariesData || []).map((library: any) => ({
        ...library,
        items: itemMap.get(library.id) || [],
        company_ids: assignmentMap.get(library.id) || [],
      }));

      setLibraries(nextLibraries);
      setCompanies(
        (companiesData || []).map((company: any) => ({
          id: company.id,
          name: company.display_name || company.name,
        }))
      );
      setSelectedLibraryId((current) => current || nextLibraries[0]?.id || null);
    } catch (error) {
      console.error('Error loading avatar libraries:', error);
      toast({
        title: 'Error',
        description: 'Failed to load avatar libraries.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSelectedLibrary = (updates: Partial<AvatarLibraryRecord>) => {
    if (!selectedLibrary) return;
    setLibraries((prev) =>
      prev.map((library) =>
        library.id === selectedLibrary.id
          ? { ...library, ...updates }
          : library
      )
    );
  };

  const updateSelectedLibraryItem = (itemId: string, updates: Partial<LibraryItem>) => {
    if (!selectedLibrary) return;
    setLibraries((prev) =>
      prev.map((library) =>
        library.id === selectedLibrary.id
          ? {
              ...library,
              items: library.items.map((item) =>
                item.id === itemId ? { ...item, ...updates } : item
              ),
            }
          : library
      )
    );
  };

  const createLibrary = async () => {
    if (!user) return;

    try {
      setSaving(true);
      const { data, error } = await supabaseAny
        .from('super_admin_avatar_libraries')
        .insert({
          name: 'New Avatar Album',
          description: 'Add a description for this shared avatar album.',
          is_global: true,
          is_active: true,
          created_by: user.id,
        })
        .select('id, name, description, cover_image_url, is_global, is_active')
        .single();

      if (error) throw error;

      const newLibrary: AvatarLibraryRecord = {
        ...data,
        items: [],
        company_ids: [],
      };

      setLibraries((prev) => [newLibrary, ...prev]);
      setSelectedLibraryId(newLibrary.id);
      toast({
        title: 'Album created',
        description: 'New shared avatar album is ready to configure.',
      });
    } catch (error) {
      console.error('Error creating avatar library:', error);
      toast({
        title: 'Error',
        description: 'Could not create avatar album.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveLibrary = async () => {
    if (!selectedLibrary) return;

    try {
      setSaving(true);

      const { error: updateError } = await supabaseAny
        .from('super_admin_avatar_libraries')
        .update({
          name: selectedLibrary.name,
          description: selectedLibrary.description,
          cover_image_url: selectedLibrary.cover_image_url,
          is_global: selectedLibrary.is_global,
          is_active: selectedLibrary.is_active,
        })
        .eq('id', selectedLibrary.id);

      if (updateError) throw updateError;

      const { error: deleteAssignmentsError } = await supabaseAny
        .from('super_admin_avatar_library_companies')
        .delete()
        .eq('library_id', selectedLibrary.id);

      if (deleteAssignmentsError) throw deleteAssignmentsError;

      if (!selectedLibrary.is_global && selectedLibrary.company_ids.length > 0) {
        const { error: insertAssignmentsError } = await supabaseAny
          .from('super_admin_avatar_library_companies')
          .insert(
            selectedLibrary.company_ids.map((companyId) => ({
              library_id: selectedLibrary.id,
              company_id: companyId,
            }))
          );

        if (insertAssignmentsError) throw insertAssignmentsError;
      }

      for (const item of selectedLibrary.items) {
        const { error: itemUpdateError } = await supabaseAny
          .from('super_admin_avatar_library_items')
          .update({
            name: item.name,
            sort_order: item.sort_order,
          })
          .eq('id', item.id);

        if (itemUpdateError) throw itemUpdateError;
      }

      toast({
        title: 'Album saved',
        description: 'Shared avatar album settings have been updated.',
      });
      await loadData();
    } catch (error) {
      console.error('Error saving avatar library:', error);
      toast({
        title: 'Error',
        description: 'Could not save avatar album.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const uploadLibraryImage = async (file: File, sortOrder: number, name: string, itemId?: string) => {
    if (!selectedLibrary) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${selectedLibrary.id}/${Date.now()}-${sortOrder}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(`system-avatar-libraries/${fileName}`, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('company-logos')
      .getPublicUrl(`system-avatar-libraries/${fileName}`);

    if (itemId) {
      const { error: itemUpdateError } = await supabaseAny
        .from('super_admin_avatar_library_items')
        .update({
          name,
          image_url: data.publicUrl,
          sort_order: sortOrder,
        })
        .eq('id', itemId);

      if (itemUpdateError) throw itemUpdateError;
    } else {
      const { error: itemInsertError } = await supabaseAny
        .from('super_admin_avatar_library_items')
        .insert({
          library_id: selectedLibrary.id,
          name,
          image_url: data.publicUrl,
          sort_order: sortOrder,
        });

      if (itemInsertError) throw itemInsertError;
    }

    if (!selectedLibrary.cover_image_url) {
      await supabaseAny
        .from('super_admin_avatar_libraries')
        .update({ cover_image_url: data.publicUrl })
        .eq('id', selectedLibrary.id);
    }
  };

  const handleFilesSelected = async (files: File[]) => {
    if (!selectedLibrary) return;

    try {
      await loadCropFiles(files);
    } catch (error) {
      console.error('Error preparing avatar crop files:', error);
      toast({
        title: 'Error',
        description: 'Could not prepare those images for cropping.',
        variant: 'destructive',
      });
    }
  };

  const openEditCrop = async (item: LibraryItem) => {
    try {
      const response = await fetch(item.image_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch avatar image: ${response.status}`);
      }

      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);

      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = reject;
        image.src = localUrl;
      });

      setCropQueue([
        {
          fileName: `${item.name}.png`,
          name: item.name,
          url: localUrl,
          width: dimensions.width,
          height: dimensions.height,
          itemId: item.id,
          sortOrder: item.sort_order,
        },
      ]);
      setCropCurrentIndex(0);
      setCropZoom(1);
      setCropOffset({ x: 0, y: 0 });
    } catch (error) {
      console.error('Error opening crop editor for avatar item:', error);
      toast({
        title: 'Error',
        description: 'Could not open the avatar editor.',
        variant: 'destructive',
      });
    }
  };

  const confirmCrop = async () => {
    if (!selectedLibrary || !currentCropFile) return;

    try {
      setUploading(true);
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = currentCropFile.url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = CROP_OUTPUT_SIZE;
      canvas.height = CROP_OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Unable to create crop canvas');

      const outputBaseScale = Math.max(CROP_OUTPUT_SIZE / image.naturalWidth, CROP_OUTPUT_SIZE / image.naturalHeight);
      const drawWidth = image.naturalWidth * outputBaseScale * cropZoom;
      const drawHeight = image.naturalHeight * outputBaseScale * cropZoom;
      const offsetRatio = CROP_OUTPUT_SIZE / CROP_VIEWPORT_SIZE;
      const drawX = (CROP_OUTPUT_SIZE - drawWidth) / 2 + cropOffset.x * offsetRatio;
      const drawY = (CROP_OUTPUT_SIZE - drawHeight) / 2 + cropOffset.y * offsetRatio;

      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error('Failed to export cropped image.'));
        }, 'image/png');
      });

      const croppedFile = new File(
        [blob],
        currentCropFile.name.replace(/\.[^.]+$/, '') + '.png',
        { type: 'image/png' }
      );

      await uploadLibraryImage(
        croppedFile,
        currentCropFile.sortOrder,
        currentCropFile.name,
        currentCropFile.itemId,
      );

      const isLastFile = cropCurrentIndex >= cropQueue.length - 1;
      if (isLastFile) {
        cropQueue.forEach((entry) => URL.revokeObjectURL(entry.url));
        resetCropState();
        toast({
          title: 'Images added',
          description: 'The avatar album has been updated with your cropped uploads.',
        });
        await loadData();
      } else {
        setCropCurrentIndex((prev) => prev + 1);
        setCropZoom(1);
        setCropOffset({ x: 0, y: 0 });
      }
    } catch (error) {
      console.error('Error uploading cropped avatar image:', error);
      toast({
        title: 'Error',
        description: 'Could not save the cropped avatar image.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!selectedLibrary) return;

    try {
      const { error } = await supabaseAny
        .from('super_admin_avatar_library_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: 'Avatar removed',
        description: 'Image removed from the shared avatar album.',
      });
      await loadData();
    } catch (error) {
      console.error('Error removing avatar item:', error);
      toast({
        title: 'Error',
        description: 'Could not remove avatar image.',
        variant: 'destructive',
      });
    }
  };

  const toggleCompanyAssignment = (companyId: string, enabled: boolean) => {
    if (!selectedLibrary) return;
    const nextCompanyIds = enabled
      ? Array.from(new Set([...selectedLibrary.company_ids, companyId]))
      : selectedLibrary.company_ids.filter((id) => id !== companyId);
    updateSelectedLibrary({ company_ids: nextCompanyIds });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
    <Dialog
      open={!!currentCropFile}
      onOpenChange={(open) => {
        if (!open) {
          cropQueue.forEach((entry) => URL.revokeObjectURL(entry.url));
          resetCropState();
        }
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Crop Avatar Image</DialogTitle>
          <DialogDescription>
            Drag to position the image and use zoom to choose the crop before saving it to the avatar library.
          </DialogDescription>
        </DialogHeader>
        {currentCropFile ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{currentCropFile.fileName}</span>
              <span>{cropCurrentIndex + 1} of {cropQueue.length}</span>
            </div>

            <div className="space-y-2">
              <Label>Avatar Name</Label>
              <Input
                value={currentCropFile.name}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setCropQueue((prev) =>
                    prev.map((entry, index) =>
                      index === cropCurrentIndex ? { ...entry, name: nextName } : entry
                    )
                  );
                }}
                placeholder="Avatar name"
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="flex items-center justify-center">
                <div
                  className="relative overflow-hidden rounded-2xl border bg-muted/20 shadow-sm"
                  style={{ width: CROP_VIEWPORT_SIZE, height: CROP_VIEWPORT_SIZE }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    dragStartRef.current = {
                      x: event.clientX,
                      y: event.clientY,
                      offsetX: cropOffset.x,
                      offsetY: cropOffset.y,
                    };
                    setIsDraggingCrop(true);
                  }}
                  onPointerMove={(event) => {
                    if (!dragStartRef.current) return;
                    const nextOffset = clampCropOffset(
                      dragStartRef.current.offsetX + (event.clientX - dragStartRef.current.x),
                      dragStartRef.current.offsetY + (event.clientY - dragStartRef.current.y)
                    );
                    setCropOffset(nextOffset);
                  }}
                  onPointerUp={() => {
                    dragStartRef.current = null;
                    setIsDraggingCrop(false);
                  }}
                  onPointerLeave={() => {
                    dragStartRef.current = null;
                    setIsDraggingCrop(false);
                  }}
                >
                  <img
                    src={currentCropFile.url}
                    alt={currentCropFile.fileName}
                    draggable={false}
                    className={`absolute max-w-none select-none ${isDraggingCrop ? 'cursor-grabbing' : 'cursor-grab'}`}
                    style={{
                      width: cropDisplayWidth,
                      height: cropDisplayHeight,
                      left: `calc(50% - ${cropDisplayWidth / 2}px + ${cropOffset.x}px)`,
                      top: `calc(50% - ${cropDisplayHeight / 2}px + ${cropOffset.y}px)`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <Search className="h-4 w-4" />
                    Zoom
                  </div>
                  <Slider
                    value={[cropZoom]}
                    min={1}
                    max={3}
                    step={0.01}
                    onValueChange={([value]) => {
                      const nextZoom = value || 1;
                      setCropZoom(nextZoom);
                      setCropOffset((prev) =>
                        clampCropOffset(
                          prev.x,
                          prev.y,
                          currentCropFile.width * cropBaseScale * nextZoom,
                          currentCropFile.height * cropBaseScale * nextZoom
                        )
                      );
                    }}
                  />
                  <div className="mt-2 text-xs text-muted-foreground">
                    {Math.round(cropZoom * 100)}%
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                    <Move className="h-4 w-4" />
                    Position
                  </div>
                  Drag the image inside the frame to choose exactly what shows in the avatar.
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              cropQueue.forEach((entry) => URL.revokeObjectURL(entry.url));
              resetCropState();
            }}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void confirmCrop()} disabled={uploading || !currentCropFile}>
            {uploading ? 'Saving...' : 'Use Crop'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">System Avatar Libraries</h3>
          <p className="text-sm text-muted-foreground">
            Build shared image-based avatar albums once, then assign them to all companies or selected companies.
          </p>
        </div>
        <Button onClick={() => void createLibrary()} disabled={saving}>
          <Plus className="mr-2 h-4 w-4" />
          New Album
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Albums</CardTitle>
            <CardDescription>Select a shared album to edit its images and company assignments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {libraries.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No shared avatar albums yet.
              </div>
            ) : (
              libraries.map((library) => (
                <button
                  key={library.id}
                  type="button"
                  onClick={() => setSelectedLibraryId(library.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    selectedLibraryId === library.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                      {library.cover_image_url ? (
                        <img src={library.cover_image_url} alt={library.name} className="h-full w-full object-cover" />
                      ) : (
                        <FolderOpen className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{library.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {library.items.length} avatar{library.items.length === 1 ? '' : 's'} · {library.is_global ? 'Global' : `${library.company_ids.length} companies`}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedLibrary?.name || 'Shared Album'}</CardTitle>
            <CardDescription>
              Upload real image assets, choose where the album is available, and manage the preview pack.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!selectedLibrary ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Select an album on the left to start editing.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Album Name</Label>
                    <Input
                      value={selectedLibrary.name}
                      onChange={(event) => updateSelectedLibrary({ name: event.target.value })}
                      placeholder="Nintendo Favorites"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Availability</Label>
                    <div className="flex h-10 items-center gap-3 rounded-md border px-3">
                      <Switch
                        checked={selectedLibrary.is_global}
                        onCheckedChange={(checked) => updateSelectedLibrary({ is_global: checked })}
                      />
                      <span className="text-sm text-muted-foreground">
                        {selectedLibrary.is_global ? 'Available to all companies' : 'Assigned to selected companies only'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={selectedLibrary.description || ''}
                    onChange={(event) => updateSelectedLibrary({ description: event.target.value })}
                    rows={3}
                    placeholder="Example: Nintendo character avatars shared across all companies."
                  />
                </div>

                <div className="flex items-center gap-3 rounded-xl border p-3">
                  <Switch
                    checked={selectedLibrary.is_active}
                    onCheckedChange={(checked) => updateSelectedLibrary({ is_active: checked })}
                  />
                  <div>
                    <div className="text-sm font-medium">Album active</div>
                    <div className="text-xs text-muted-foreground">
                      Inactive albums stay in super admin but disappear from company avatar pickers.
                    </div>
                  </div>
                </div>

                {!selectedLibrary.is_global && (
                  <div className="space-y-3">
                    <Label>Assigned Companies</Label>
                    <div className="grid max-h-56 gap-3 overflow-y-auto rounded-xl border p-4 md:grid-cols-2">
                      {companies.map((company) => (
                        <label key={company.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                          <Checkbox
                            checked={selectedLibrary.company_ids.includes(company.id)}
                            onCheckedChange={(checked) => toggleCompanyAssignment(company.id, checked === true)}
                          />
                          <span className="text-sm">{company.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ImagePlus className="h-4 w-4" />
                    Album Images
                  </div>
                  <MultiFileUploadDropzone
                    onFilesSelected={handleFilesSelected}
                    accept="image/*"
                    disabled={uploading}
                    buttonLabel={uploading ? 'Uploading...' : 'Choose Images to Add'}
                    dragLabel="Drag Images Here"
                    compact
                    className="max-w-3xl"
                  />
                  {selectedLibrary.items.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {selectedLibrary.items.map((item) => (
                        <div key={item.id} className="rounded-xl border p-4">
                          <div className="flex items-center gap-3">
                            <img src={item.image_url} alt={item.name} className="h-16 w-16 rounded-full object-cover ring-1 ring-border" />
                            <div className="min-w-0 flex-1">
                              <Input
                                value={item.name}
                                onChange={(event) => updateSelectedLibraryItem(item.id, { name: event.target.value })}
                                className="h-8"
                              />
                              <div className="text-xs text-muted-foreground">Shared system avatar</div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-4 w-full"
                            onClick={() => void openEditCrop(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full"
                            onClick={() => void removeItem(item.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      No images in this album yet. Upload a few and they&apos;ll become available in company avatar settings.
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => void saveLibrary()} disabled={saving || !selectedLibrary.name.trim()}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Album
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}
