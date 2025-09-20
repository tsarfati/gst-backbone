import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import CompanySettings from '@/components/CompanySettings';

export default function CompanySettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();

  const handleSaveSettings = () => {
    toast({
      title: "Company settings saved",
      description: "Your company preferences have been updated successfully.",
    });
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Company Settings</h1>
          <p className="text-muted-foreground">
            Manage your company-specific configurations and preferences
          </p>
        </div>
        
        <div className="flex items-center justify-end">
          <Button onClick={handleSaveSettings}>Save Changes</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Company Configuration</CardTitle>
            <CardDescription>
              Configure company-specific settings and workflows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompanySettings />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}