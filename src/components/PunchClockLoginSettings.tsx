import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ColorPicker from '@/components/ColorPicker';
import { Upload, Trash2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export function PunchClockLoginSettings() {
  const [settings, setSettings] = useState({
    header_image_url: '',
    background_color: '#f8fafc',
    primary_color: '#3b82f6',
    logo_url: '',
    welcome_message: 'Welcome to Punch Clock'
  });
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('punch_clock_login_settings')
        .select('*')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading settings:', error);
        return;
      }

      if (data) {
        setSettings({
          header_image_url: data.header_image_url || '',
          background_color: data.background_color || '#f8fafc',
          primary_color: data.primary_color || '#3b82f6',
          logo_url: data.logo_url || '',
          welcome_message: data.welcome_message || 'Welcome to Punch Clock'
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleImageUpload = async (file: File, type: 'header' | 'logo') => {
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${type}_${Date.now()}.${fileExt}`;
    const filePath = `punch-clock-login/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      const fieldName = type === 'header' ? 'header_image_url' : 'logo_url';
      setSettings(prev => ({
        ...prev,
        [fieldName]: urlData.publicUrl
      }));

      toast({
        title: "Image uploaded",
        description: `${type === 'header' ? 'Header' : 'Logo'} image uploaded successfully`,
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!profile?.user_id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Use user_id as company_id as fallback, or get the first company from user_company_access
      let companyId = profile.current_company_id;
      
      if (!companyId) {
        // Try to get company from user_company_access table  
        const { data: companyAccess, error: accessError } = await supabase
          .from('user_company_access')
          .select('company_id')
          .eq('user_id', profile.user_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        
        if (accessError && accessError.code !== 'PGRST116') {
          console.error('Error fetching company access:', accessError);
        }
        
        companyId = companyAccess?.company_id || profile.user_id; // fallback to user_id
      }

      console.log('Saving punch clock settings with company_id:', companyId);

      const { error } = await supabase
        .from('punch_clock_login_settings')
        .upsert({
          company_id: companyId,
          ...settings,
          created_by: profile.user_id
        }, {
          onConflict: 'company_id'
        });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      toast({
        title: "Settings saved",
        description: "Punch clock login settings updated successfully",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    window.open('/punch-clock-login', '_blank');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Punch Clock Login Customization
          <Button onClick={handlePreview} variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Header Image Upload */}
        <div className="space-y-2">
          <Label>Header Image</Label>
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file, 'header');
              }}
              className="flex-1"
            />
            {settings.header_image_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettings(prev => ({ ...prev, header_image_url: '' }))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {settings.header_image_url && (
            <img 
              src={settings.header_image_url} 
              alt="Header preview" 
              className="max-h-20 object-contain"
            />
          )}
        </div>

        {/* Logo Upload */}
        <div className="space-y-2">
          <Label>Company Logo</Label>
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file, 'logo');
              }}
              className="flex-1"
            />
            {settings.logo_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettings(prev => ({ ...prev, logo_url: '' }))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {settings.logo_url && (
            <img 
              src={settings.logo_url} 
              alt="Logo preview" 
              className="h-16 w-16 object-contain"
            />
          )}
        </div>

        {/* Welcome Message */}
        <div className="space-y-2">
          <Label htmlFor="welcome-message">Welcome Message</Label>
          <Input
            id="welcome-message"
            value={settings.welcome_message}
            onChange={(e) => setSettings(prev => ({ ...prev, welcome_message: e.target.value }))}
            placeholder="Welcome to Punch Clock"
          />
        </div>

        {/* Background Color */}
        <div className="space-y-2">
          <ColorPicker
            label="Background Color"
            value={settings.background_color}
            onChange={(color) => setSettings(prev => ({ ...prev, background_color: color }))}
          />
        </div>

        {/* Primary Color */}
        <div className="space-y-2">
          <ColorPicker
            label="Primary Color (Buttons)"
            value={settings.primary_color}
            onChange={(color) => setSettings(prev => ({ ...prev, primary_color: color }))}
          />
        </div>

        <Button onClick={handleSave} disabled={loading} className="w-full">
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}