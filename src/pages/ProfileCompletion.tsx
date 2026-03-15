import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProfileCompletion() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    first_name: profile?.first_name || (user?.user_metadata as any)?.first_name || (user?.user_metadata as any)?.firstName || '',
    last_name: profile?.last_name || (user?.user_metadata as any)?.last_name || (user?.user_metadata as any)?.lastName || '',
    phone: profile?.phone || (user?.user_metadata as any)?.phone || '',
    nickname: profile?.nickname || '',
    birthday: profile?.birthday || '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url || null);
  const [isAvatarDragOver, setIsAvatarDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const allowedRoles = new Set([
    'admin',
    'controller',
    'project_manager',
    'design_professional',
    'employee',
    'view_only',
    'company_admin',
    'vendor',
  ]);
  const allowedStatuses = new Set([
    'active',
    'pending',
    'approved',
    'rejected',
    'suspended',
    'inactive',
  ]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      first_name:
        prev.first_name ||
        profile?.first_name ||
        (user?.user_metadata as any)?.first_name ||
        (user?.user_metadata as any)?.firstName ||
        '',
      last_name:
        prev.last_name ||
        profile?.last_name ||
        (user?.user_metadata as any)?.last_name ||
        (user?.user_metadata as any)?.lastName ||
        '',
      phone:
        prev.phone ||
        profile?.phone ||
        (user?.user_metadata as any)?.phone ||
        '',
      nickname: prev.nickname || profile?.nickname || '',
      birthday: prev.birthday || profile?.birthday || '',
    }));
  }, [profile?.first_name, profile?.last_name, profile?.phone, profile?.nickname, profile?.birthday, user?.user_metadata]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvatarChange = (eventOrFile: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = eventOrFile instanceof File ? eventOrFile : eventOrFile.target.files?.[0];
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

    if (!(eventOrFile instanceof File)) {
      eventOrFile.target.value = '';
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
    const hasExistingAvatar = Boolean(profile?.avatar_url || avatarPreview);
    if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.phone.trim() || !formData.birthday || (!avatarFile && !hasExistingAvatar)) {
      toast({
        title: 'Required Fields Missing',
        description: 'Please fill in first name, last name, phone number, birthday, and profile picture.',
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

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('user_id', user.id)
        .maybeSingle();

      const metadata = (user?.user_metadata || {}) as Record<string, any>;
      const candidateRoles = [
        existingProfile?.role,
        profile?.role,
        metadata.requested_role,
        metadata.requestedRole,
        metadata.role,
      ]
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean);
      const resolvedRole = candidateRoles.find((r) => allowedRoles.has(r)) || 'employee';

      const candidateStatuses = [
        existingProfile?.status,
        profile?.status,
        metadata.status,
      ]
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean);
      const resolvedStatus = candidateStatuses.find((s) => allowedStatuses.has(s)) || 'active';

      // Create-or-update profile so first-time users do not get stuck if trigger/profile creation failed.
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          email: user.email || profile?.email || null,
          role: resolvedRole as any,
          status: resolvedStatus,
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          phone: formData.phone.trim(),
          nickname: formData.nickname.trim() || null,
          birthday: formData.birthday,
          avatar_url,
          display_name: formData.nickname.trim() || `${formData.first_name} ${formData.last_name}`,
          profile_completed: true,
          profile_completed_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast({
        title: 'Profile Completed',
        description: 'Your profile has been completed successfully!',
      });

      // Refresh profile data
      await refreshProfile();

      const targetPath = resolvedRole === 'design_professional'
        ? '/design-professional/dashboard'
        : resolvedRole === 'vendor'
          ? '/vendor/dashboard'
          : '/company-request';
      navigate(targetPath, { replace: true });
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
            <div className="flex flex-col items-center space-y-3">
              <div
                className="flex flex-col items-center text-center"
              >
                <div
                  className={`rounded-full border-2 border-dashed p-2 transition-colors cursor-pointer ${
                    isAvatarDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsAvatarDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsAvatarDragOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsAvatarDragOver(false);
                    const droppedFile = e.dataTransfer.files?.[0];
                    if (droppedFile) {
                      handleAvatarChange(droppedFile);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={avatarPreview || undefined} />
                    <AvatarFallback className="text-lg">
                      {getInitials() || <User className="h-8 w-8" />}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium">
                    {isAvatarDragOver ? 'Drop your photo here' : 'Drag your photo here or click here to choose a file'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Required photo (max 5MB)
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            {/* Form Fields */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                readOnly
                className="bg-muted/40"
              />
              <p className="text-xs text-muted-foreground">Email is locked to the account you signed up with.</p>
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 555-5555"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
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
