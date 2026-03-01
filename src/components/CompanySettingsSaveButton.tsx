import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/SettingsContext';

interface CompanySettingsSaveButtonProps {
  onSave?: () => Promise<void> | void;
}

export default function CompanySettingsSaveButton({ onSave }: CompanySettingsSaveButtonProps) {
  const { toast } = useToast();
  const { settings } = useSettings();
  const [saving, setSaving] = useState(false);

  if (settings.autoSave) {
    return null;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      if (onSave) {
        await onSave();
      }
      toast({
        title: "Settings saved",
        description: "Your company settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button onClick={handleSave} disabled={saving} className="ml-auto">
      <Save className="h-4 w-4 mr-2" />
      {saving ? 'Saving...' : 'Save All Changes'}
    </Button>
  );
}
