import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Upload, Shield, Key, Trash2, Lock } from 'lucide-react';
import DevelopmentFreeze from '@/components/DevelopmentFreeze';

export default function SecuritySettings() {
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const handleExportData = () => {
    toast({
      title: "Data Export Started",
      description: "Your data export will be ready for download shortly.",
    });
  };

  const handleImportData = () => {
    toast({
      title: "Data Import",
      description: "Please select a valid backup file to import.",
    });
  };

  const handleChangePassword = () => {
    toast({
      title: "Password Change",
      description: "Please check your email for password reset instructions.",
    });
  };

  const handleDeleteAccount = () => {
    setShowDeleteDialog(false);
    toast({
      title: "Account Deletion",
      description: "Your account deletion request has been submitted.",
      variant: "destructive",
    });
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Data & Security</h1>
          <p className="text-muted-foreground">
            Manage your account security and data preferences
          </p>
        </div>

        <Tabs defaultValue="security" className="space-y-6">
          <TabsList>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="data">Data & Privacy</TabsTrigger>
            <TabsTrigger value="development">Development Freeze</TabsTrigger>
          </TabsList>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Configure your account security preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      placeholder="Enter current password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Enter new password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm new password"
                    />
                  </div>
                  <Button onClick={handleChangePassword} className="w-full">
                    <Key className="h-4 w-4 mr-2" />
                    Change Password
                  </Button>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Two-Factor Authentication</Label>
                    <div className="text-sm text-muted-foreground">
                      Add an extra layer of security to your account
                    </div>
                  </div>
                  <Switch
                    checked={twoFactorEnabled}
                    onCheckedChange={setTwoFactorEnabled}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>
                  Export, import, or manage your application data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" onClick={handleExportData}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                  </Button>
                  <Button variant="outline" onClick={handleImportData}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Data
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  Export your data for backup purposes or import data from a previous backup
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>
                  Irreversible and destructive actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your
                        account and remove all your data from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <div className="text-sm text-muted-foreground mt-2">
                  Once you delete your account, there is no going back. Please be certain.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="development" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Development Freeze
                </CardTitle>
                <CardDescription>
                  Lock specific pages to prevent code changes during stable periods
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DevelopmentFreeze />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}