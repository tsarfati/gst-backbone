import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Settings, Save, RotateCcw, Monitor, Sun, Moon, Navigation, Bell, Eye, Database, Shield } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { useToast } from "@/hooks/use-toast";

export default function AppSettings() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");

  const handleSaveSettings = () => {
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated successfully.",
    });
  };

  const handleResetSettings = () => {
    resetSettings();
    toast({
      title: "Settings Reset",
      description: "All settings have been restored to defaults.",
      variant: "destructive",
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">App Settings</h1>
            <p className="text-muted-foreground">Customize your application preferences</p>
          </div>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset All Settings?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will restore all settings to their default values. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetSettings}>Reset Settings</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={handleSaveSettings}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="navigation">Navigation</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="data">Data & Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Theme & Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Theme</Label>
                <Select 
                  value={settings.theme} 
                  onValueChange={(value: 'light' | 'dark' | 'system') => updateSettings({ theme: value })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Compact Mode</Label>
                  <p className="text-sm text-muted-foreground">Reduce spacing and padding for smaller screens</p>
                </div>
                <Switch
                  checked={settings.compactMode}
                  onCheckedChange={(checked) => updateSettings({ compactMode: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Regional Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date Format</Label>
                  <Select 
                    value={settings.dateFormat} 
                    onValueChange={(value: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD') => updateSettings({ dateFormat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (UK)</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select 
                    value={settings.currencyFormat} 
                    onValueChange={(value: 'USD' | 'EUR' | 'GBP') => updateSettings({ currencyFormat: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
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
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                Navigation Behavior
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">Sidebar Categories</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Choose how navigation categories behave in the sidebar
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="multiple"
                        name="navigationMode"
                        value="multiple"
                        checked={settings.navigationMode === 'multiple'}
                        onChange={(e) => updateSettings({ navigationMode: e.target.value as 'multiple' | 'single' })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="multiple" className="flex-1 cursor-pointer">
                        <div>
                          <div className="font-medium">Multiple Categories Open</div>
                          <div className="text-sm text-muted-foreground">
                            Allow multiple navigation categories to be expanded simultaneously
                          </div>
                        </div>
                      </Label>
                      {settings.navigationMode === 'multiple' && (
                        <Badge variant="secondary">Current</Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="single"
                        name="navigationMode"
                        value="single"
                        checked={settings.navigationMode === 'single'}
                        onChange={(e) => updateSettings({ navigationMode: e.target.value as 'multiple' | 'single' })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="single" className="flex-1 cursor-pointer">
                        <div>
                          <div className="font-medium">Single Category Open</div>
                          <div className="text-sm text-muted-foreground">
                            Only one navigation category can be open at a time (accordion style)
                          </div>
                        </div>
                      </Label>
                      {settings.navigationMode === 'single' && (
                        <Badge variant="secondary">Current</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="display" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Display Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default View Mode</Label>
                  <Select 
                    value={settings.defaultView} 
                    onValueChange={(value: 'tiles' | 'list' | 'compact') => updateSettings({ defaultView: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tiles">Tiles View</SelectItem>
                      <SelectItem value="list">List View</SelectItem>
                      <SelectItem value="compact">Compact View</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Default view mode for jobs, vendors, and other listings
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Items Per Page</Label>
                  <Select 
                    value={settings.itemsPerPage.toString()} 
                    onValueChange={(value) => updateSettings({ itemsPerPage: parseInt(value) as 10 | 25 | 50 | 100 })}
                  >
                    <SelectTrigger>
                      <SelectValue />
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
                <div>
                  <Label>Auto-save Forms</Label>
                  <p className="text-sm text-muted-foreground">Automatically save form data as you type</p>
                </div>
                <Switch
                  checked={settings.autoSave}
                  onCheckedChange={(checked) => updateSettings({ autoSave: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={settings.notifications.email}
                    onCheckedChange={(checked) => 
                      updateSettings({ notifications: { ...settings.notifications, email: checked } })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive browser notifications</p>
                  </div>
                  <Switch
                    checked={settings.notifications.push}
                    onCheckedChange={(checked) => 
                      updateSettings({ notifications: { ...settings.notifications, push: checked } })
                    }
                  />
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Specific Notifications</h4>
                  <div className="space-y-3">
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 border border-border rounded-lg">
                  <h4 className="font-medium mb-2">Export Data</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Download your data in various formats for backup or migration
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Export Jobs</Button>
                    <Button variant="outline" size="sm">Export Vendors</Button>
                    <Button variant="outline" size="sm">Export Receipts</Button>
                  </div>
                </div>

                <div className="p-4 border border-border rounded-lg">
                  <h4 className="font-medium mb-2">Import Data</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Import data from CSV files or other systems
                  </p>
                  <Button variant="outline" size="sm">Import from CSV</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security & Privacy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 border border-border rounded-lg">
                  <h4 className="font-medium mb-2">Change Password</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Update your account password for better security
                  </p>
                  <Button variant="outline" size="sm">Change Password</Button>
                </div>

                <div className="p-4 border border-border rounded-lg">
                  <h4 className="font-medium mb-2">Two-Factor Authentication</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Add an extra layer of security to your account
                  </p>
                  <Button variant="outline" size="sm">Setup 2FA</Button>
                </div>

                <div className="p-4 border border-destructive/20 rounded-lg">
                  <h4 className="font-medium mb-2 text-destructive">Danger Zone</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Irreversible and destructive actions
                  </p>
                  <Button variant="destructive" size="sm">Delete Account</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}