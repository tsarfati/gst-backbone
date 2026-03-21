import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';
import { AVATAR_LIBRARY, AVATAR_LIBRARY_CATEGORY_LABELS, type AvatarLibraryAlbumId, type AvatarLibraryCategory, type CustomAvatarEntry, type SystemAvatarLibrary } from '@/components/avatarLibrary';

interface AvatarLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: AvatarLibraryAlbumId;
  onCategoryChange: (category: AvatarLibraryAlbumId) => void;
  availableCategories?: AvatarLibraryCategory[];
  customAvatars?: CustomAvatarEntry[];
  systemLibraries?: SystemAvatarLibrary[];
  enabledSystemLibraryIds?: string[];
  selectedAvatarUrl?: string | null;
  onSelect: (avatarUrl: string) => void;
  disabled?: boolean;
  title?: string;
  description?: string;
  actions?: ReactNode;
}

const CATEGORY_ORDER: AvatarLibraryCategory[] = ['nintendo', 'generic', 'sports', 'construction', 'custom'];

export default function AvatarLibraryDialog({
  open,
  onOpenChange,
  category,
  onCategoryChange,
  availableCategories,
  customAvatars = [],
  systemLibraries = [],
  enabledSystemLibraryIds,
  selectedAvatarUrl,
  onSelect,
  disabled = false,
  title = 'Choose an Avatar',
  description,
  actions,
}: AvatarLibraryDialogProps) {
  const resolvedCategories = CATEGORY_ORDER.filter((option) => {
    if (option === 'custom') return customAvatars.length > 0;
    return availableCategories ? availableCategories.includes(option) : true;
  });

  const resolvedSystemLibraries = systemLibraries.filter((library) =>
    enabledSystemLibraryIds && enabledSystemLibraryIds.length > 0
      ? enabledSystemLibraryIds.includes(library.id)
      : true
  );

  const visibleAvatars = category === 'custom'
    ? customAvatars
    : category.startsWith('system:')
      ? (resolvedSystemLibraries.find((library) => library.id === category.replace('system:', ''))?.items || []).map((item) => ({
          id: item.id,
          name: item.name,
          avatarUrl: item.image_url,
        }))
      : AVATAR_LIBRARY.filter((avatar) => avatar.category === category);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {(description || actions) && (
            <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : (
                <div />
              )}
              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {resolvedCategories.map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={category === option ? 'default' : 'outline'}
                onClick={() => onCategoryChange(option)}
              >
                {AVATAR_LIBRARY_CATEGORY_LABELS[option]}
              </Button>
            ))}
            {resolvedSystemLibraries.map((library) => {
              const albumId = `system:${library.id}` as AvatarLibraryAlbumId;
              return (
                <Button
                  key={library.id}
                  type="button"
                  size="sm"
                  variant={category === albumId ? 'default' : 'outline'}
                  onClick={() => onCategoryChange(albumId)}
                >
                  {library.name}
                </Button>
              );
            })}
          </div>

          <div className="max-h-[440px] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {visibleAvatars.map((avatar) => {
                  const selected = selectedAvatarUrl === avatar.avatarUrl;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      className={`rounded-lg border p-2 text-left transition-colors ${
                        selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60'
                      }`}
                      onClick={() => onSelect(avatar.avatarUrl)}
                      disabled={disabled}
                    >
                      <img
                        src={avatar.avatarUrl}
                        alt={avatar.name}
                        className="mx-auto h-20 w-20 rounded-full object-cover"
                      />
                      <div className="mt-2 text-center text-xs font-medium">{avatar.name}</div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
