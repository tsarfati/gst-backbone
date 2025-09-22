import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, User, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProfileCompletion() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    nickname: profile?.nickname || '',
    birthday: profile?.birthday || '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url || null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: 'Error',
          description: 'Image must be less than 5MB',
          variant: 'destructive'
        });
        return;
      }

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !user) return null;

    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `avatar-${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, avatarFile);

    if (uploadError) {
      console.error('Error uploading avatar:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    // Validate required fields
    if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.birthday || !avatarFile) {
      toast({
        title: 'Required Fields Missing',
        description: 'Please fill in first name, last name, birthday, and profile picture.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      let avatar_url = profile?.avatar_url || null;
      
      // Upload avatar if selected
      if (avatarFile) {
        avatar_url = await uploadAvatar();
      }

      // Update profile with complete information
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          nickname: formData.nickname.trim() || null,
          birthday: formData.birthday,
          avatar_url,
          display_name: formData.nickname.trim() || `${formData.first_name} ${formData.last_name}`,
          profile_completed: true,
          profile_completed_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Profile Completed',
        description: 'Your profile has been completed successfully!',
      });

      // Refresh profile data
      await refreshProfile();
      
      // Navigate to company request page
      navigate('/company-request');
    } catch (error: any) {
      console.error('Error completing profile:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete profile',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    const firstName = formData.first_name || profile?.first_name || '';
    const lastName = formData.last_name || profile?.last_name || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Complete Your Profile</CardTitle>
          <p className="text-muted-foreground">
            Please provide your information to continue
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={avatarPreview || undefined} />
                  <AvatarFallback className="text-lg">
                    {getInitials() || <User className="h-8 w-8" />}
                  </AvatarFallback>
                </Avatar>
                <Button
                  type="button"
                  size="sm"
                  className="absolute -bottom-2 -right-2 rounded-full h-8 w-8 p-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <p className="text-sm text-muted-foreground text-center">
                Click the upload button to add a profile picture *
              </p>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname (Optional)</Label>
              <Input
                id="nickname"
                value={formData.nickname}
                onChange={(e) => handleInputChange('nickname', e.target.value)}
                placeholder="What would you like to be called?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthday">Birthday *</Label>
              <Input
                id="birthday"
                type="date"
                value={formData.birthday}
                onChange={(e) => handleInputChange('birthday', e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Profile
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}