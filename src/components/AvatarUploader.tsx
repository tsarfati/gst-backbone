import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AvatarUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  userId: string;
}

export default function AvatarUploader({ value, onChange, disabled, userId }: AvatarUploaderProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      const ext = file.name.split('.').pop();
      const filePath = `users/${userId}/${Date.now()}.${ext || 'jpg'}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      onChange(publicUrl);
      toast({ title: 'Avatar updated', description: 'Your photo has been uploaded.' });
    } catch (err) {
      console.error('Avatar upload error:', err);
      toast({ title: 'Upload failed', description: 'Could not upload avatar.', variant: 'destructive' });
    } finally {
      setUploading(false);
      // reset input so same file can be re-selected
      e.currentTarget.value = '';
    }
  };

  const inputId = `avatar-input-${userId}`;

  const initials = 'U';

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-14 w-14">
        {value ? <AvatarImage src={value} alt="User avatar" /> : <AvatarFallback>{initials}</AvatarFallback>}
      </Avatar>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || uploading}
        />
        <label htmlFor={inputId}>
          <Button variant="outline" type="button" disabled={disabled || uploading}>
            {uploading ? 'Uploading...' : 'Take/Upload Photo'}
          </Button>
        </label>
        {value && (
          <Button
            variant="secondary"
            type="button"
            onClick={() => onChange('')}
            disabled={disabled || uploading}
          >
            Remove Photo
          </Button>
        )}
      </div>
    </div>
  );
}
