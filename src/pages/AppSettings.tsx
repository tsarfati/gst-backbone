import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useTheme } from 'next-themes';
import ColorPicker from '@/components/ColorPicker';

export default function AppSettings() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { toast } = useToast();
  const { setTheme } = useTheme();
  const [showResetDialog, setShowResetDialog] = useState(false);

  const handleSaveSettings = () => {
    setTheme(settings.theme);
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated successfully.",
    });
  };

  const handleResetSettings = () => {
    resetSettings();
    setShowResetDialog(false);
    toast({
      title: "Settings reset",
      description: "All settings have been restored to their default values.",
      variant: "destructive",
    });
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        updateSettings({ customLogo: result });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your application preferences and settings.
          </p>
        </div>
        
        <div className="flex items-center justify-end gap-2">
          <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="outline">Reset All</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset all settings to their default values. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetSettings}>
                  Reset Settings
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          <Button onClick={handleSaveSettings}>Save Changes</Button>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="navigation">Navigation</TabsTrigger>
            <TabsTrigger value="display">Display</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="data">Data & Security</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Theme & Appearance</CardTitle>
                <CardDescription>
                  Customize the look and feel of your application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={settings.theme}
                    onValueChange={(value: 'light' | 'dark' | 'system') => 
                      updateSettings({ theme: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label>Logo Upload</Label>
                  <div className="flex items-center gap-4">
                    {settings.customLogo && (
                      <div className="flex items-center gap-2">
                        <img 
                          src={settings.customLogo} 
                          alt="Custom Logo" 
                          className="h-8 w-8 object-contain border rounded"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateSettings({ customLogo: undefined })}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="w-auto"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Upload a logo to replace the default icon in the sidebar header
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label>Color Customization</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ColorPicker
                      label="Primary Color"
                      value={settings.customColors.primary}
                      onChange={(value) => updateSettings({ 
                        customColors: { ...settings.customColors, primary: value }
                      })}
                    />
                    <ColorPicker
                      label="Secondary Color"
                      value={settings.customColors.secondary}
                      onChange={(value) => updateSettings({ 
                        customColors: { ...settings.customColors, secondary: value }
                      })}
                    />
                    <ColorPicker
                      label="Accent Color"
                      value={settings.customColors.accent}
                      onChange={(value) => updateSettings({ 
                        customColors: { ...settings.customColors, accent: value }
                      })}
                    />
                    <ColorPicker
                      label="Success Color"
                      value={settings.customColors.success}
                      onChange={(value) => updateSettings({ 
                        customColors: { ...settings.customColors, success: value }
                      })}
                    />
                    <ColorPicker
                      label="Warning Color"
                      value={settings.customColors.warning}
                      onChange={(value) => updateSettings({ 
                        customColors: { ...settings.customColors, warning: value }
                      })}
                    />
                    <ColorPicker
                      label="Destructive Color"
                      value={settings.customColors.destructive}
                      onChange={(value) => updateSettings({ 
                        customColors: { ...settings.customColors, destructive: value }
                      })}
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="compact-mode">Compact Mode</Label>
                    <div className="text-sm text-muted-foreground">
                      Use a more condensed interface layout
                    </div>
                  </div>
                  <Switch
                    id="compact-mode"
                    checked={settings.compactMode}
                    onCheckedChange={(checked) => 
                      updateSettings({ compactMode: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Regional Settings</CardTitle>
                <CardDescription>
                  Configure date, time, and currency formats
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date-format">Date Format</Label>
                    <Select
                      value={settings.dateFormat}
                      onValueChange={(value: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD') => 
                        updateSettings({ dateFormat: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select date format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency-format">Currency Format</Label>
                    <Select
                      value={settings.currencyFormat}
                      onValueChange={(value: 'USD' | 'EUR' | 'GBP') => 
                        updateSettings({ currencyFormat: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="navigation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Navigation Behavior</CardTitle>
                <CardDescription>
                  Configure how the sidebar navigation behaves
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label>Sidebar Categories</Label>
                  <RadioGroup
                    value={settings.navigationMode}
                    onValueChange={(value: 'single' | 'multiple') => 
                      updateSettings({ navigationMode: value })
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="multiple" id="multiple" />
                      <Label htmlFor="multiple" className="flex-1">
                        <div>
                          <div className="font-medium">Multiple Categories Open</div>
                          <div className="text-sm text-muted-foreground">
                            Allow multiple navigation categories to be expanded simultaneously
                          </div>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="single" id="single" />
                      <Label htmlFor="single" className="flex-1">
                        <div>
                          <div className="font-medium">Single Category Open</div>
                          <div className="text-sm text-muted-foreground">
                            Only one navigation category can be open at a time (accordion style)
                          </div>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="display" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Display Preferences</CardTitle>
                <CardDescription>
                  Customize how content is displayed across the application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="default-view">Default View</Label>
                    <Select
                      value={settings.defaultView}
                      onValueChange={(value: 'tiles' | 'list' | 'compact') => 
                        updateSettings({ defaultView: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select default view" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tiles">Tiles</SelectItem>
                        <SelectItem value="list">List</SelectItem>
                        <SelectItem value="compact">Compact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="items-per-page">Items Per Page</Label>
                    <Select
                      value={settings.itemsPerPage.toString()}
                      onValueChange={(value) => 
                        updateSettings({ itemsPerPage: parseInt(value) as 10 | 25 | 50 | 100 })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select items per page" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 items</SelectItem>
                        <SelectItem value="25">25 items</SelectItem>
                        <SelectItem value="50">50 items</SelectItem>
                        <SelectItem value="100">100 items</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-save">Auto-save Forms</Label>
                    <div className="text-sm text-muted-foreground">
                      Automatically save form data while typing
                    </div>
                  </div>
                  <Switch
                    id="auto-save"
                    checked={settings.autoSave}
                    onCheckedChange={(checked) => 
                      updateSettings({ autoSave: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose which notifications you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Notifications</Label>
                      <div className="text-sm text-muted-foreground">
                        Receive notifications via email
                      </div>
                    </div>
                    <Switch
                      checked={settings.notifications.email}
                      onCheckedChange={(checked) => 
                        updateSettings({ notifications: { ...settings.notifications, email: checked } })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Push Notifications</Label>
                      <div className="text-sm text-muted-foreground">
                        Receive browser push notifications
                      </div>
                    </div>
                    <Switch
                      checked={settings.notifications.push}
                      onCheckedChange={(checked) => 
                        updateSettings({ notifications: { ...settings.notifications, push: checked } })
                      }
                    />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label>Specific Notifications</Label>
                    
                    <div className="flex items-center justify-between">
                      <Label>Receipt Uploads</Label>
                      <Switch
                        checked={settings.notifications.receiptUploads}
                        onCheckedChange={(checked) => 
                          updateSettings({ notifications: { ...settings.notifications, receiptUploads: checked } })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Job Updates</Label>
                      <Switch
                        checked={settings.notifications.jobUpdates}
                        onCheckedChange={(checked) => 
                          updateSettings({ notifications: { ...settings.notifications, jobUpdates: checked } })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Invoice Reminders</Label>
                      <Switch
                        checked={settings.notifications.invoiceReminders}
                        onCheckedChange={(checked) => 
                          updateSettings({ notifications: { ...settings.notifications, invoiceReminders: checked } })
                        }
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>
                  Export, import, and manage your application data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label>Export Data</Label>
                    <div className="text-sm text-muted-foreground mb-3">
                      Download your data for backup or migration purposes
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm">Export Jobs</Button>
                      <Button variant="outline" size="sm">Export Vendors</Button>
                      <Button variant="outline" size="sm">Export Receipts</Button>
                      <Button variant="outline" size="sm">Export All Data</Button>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label>Import Data</Label>
                    <div className="text-sm text-muted-foreground mb-3">
                      Upload data from backup files or other systems
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm">Import Jobs</Button>
                      <Button variant="outline" size="sm">Import Vendors</Button>
                      <Button variant="outline" size="sm">Import Receipts</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>
                  Manage your account security and data privacy
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <Button variant="outline" size="sm">Change Password</Button>
                  <Button variant="outline" size="sm">Enable Two-Factor Authentication</Button>
                  <Button variant="outline" size="sm">Download Account Data</Button>
                  
                  <Separator />
                  
                  <div>
                    <Label className="text-destructive">Danger Zone</Label>
                    <div className="text-sm text-muted-foreground mb-3">
                      These actions cannot be undone
                    </div>
                    <Button variant="destructive" size="sm">Delete Account</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}