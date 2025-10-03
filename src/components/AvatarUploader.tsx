import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

interface AvatarUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  userId: string;
}

export default function AvatarUploader({ value, onChange, disabled, userId }: AvatarUploaderProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const isMobile = useIsMobile();

  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);

      // PIN-authenticated flow: upload via Edge Function
      const pinUserStr = localStorage.getItem('punch_clock_user');
      if (pinUserStr) {
        const { pin } = JSON.parse(pinUserStr);
        const base64 = await fileToBase64(file);
        const res = await fetch('https://watxvzoolmfjfijrgcvq.supabase.co/functions/v1/punch-clock/upload-photo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhdHh2em9vbG1mamZpanJnY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMzYxNzMsImV4cCI6MjA3MzkxMjE3M30.0VEGVyFVxDLkv3yNd31_tPZdeeoQQaGZVT4Jsf0eC8Q',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhdHh2em9vbG1mamZpanJnY3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMzYxNzMsImV4cCI6MjA3MzkxMjE3M30.0VEGVyFVxDLkv3yNd31_tPZdeeoQQaGZVT4Jsf0eC8Q'
          },
          body: JSON.stringify({ pin, image: base64 })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Upload failed');
        onChange(data.publicUrl);
        toast({ title: 'Avatar updated', description: 'Your photo has been uploaded.' });
      } else {
        // Regular authenticated flow: upload to avatars bucket
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
      }
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
          accept="image/*;capture=camera"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || uploading}
          capture={isMobile ? 'environment' : undefined as any}
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
