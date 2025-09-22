import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Lock, Unlock, AlertTriangle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PageLock {
  id: string;
  name: string;
  path: string;
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: string;
}

const APP_PAGES = [
  { id: '1', name: 'Dashboard', path: '/dashboard' },
  { id: '2', name: 'Jobs', path: '/jobs' },
  { id: '3', name: 'Vendors', path: '/vendors' },
  { id: '4', name: 'Bills', path: '/bills' },
  { id: '5', name: 'Coded Receipts', path: '/coded-receipts' },
  { id: '6', name: 'Uncoded Receipts', path: '/uncoded-receipts' },
  { id: '7', name: 'Upload Receipts', path: '/upload-receipts' },
  { id: '8', name: 'Time Sheets', path: '/timesheets' },
  { id: '9', name: 'Punch Clock', path: '/time-tracking' },
  { id: '10', name: 'All Employees', path: '/employees' },
  { id: '11', name: 'Add Employee', path: '/add-employee' },
  { id: '12', name: 'Team Chat', path: '/team-chat' },
  { id: '13', name: 'All Messages', path: '/messages' },
  { id: '14', name: 'Announcements', path: '/announcements' },
  { id: '15', name: 'Cost Codes', path: '/cost-codes' },
  { id: '16', name: 'Payment History', path: '/payment-history' },
  { id: '17', name: 'Payment Reports', path: '/payment-reports' },
  { id: '18', name: 'Bill Status', path: '/bill-status' },
  { id: '19', name: 'User Settings', path: '/settings/user' },
  { id: '20', name: 'App Settings', path: '/settings/app' },
  { id: '21', name: 'Company Settings', path: '/settings/company' },
  { id: '22', name: 'Theme Settings', path: '/settings/theme' },
  { id: '23', name: 'Security Settings', path: '/settings/security' },
  { id: '24', name: 'Notification Settings', path: '/settings/notifications' },
];

export default function DevelopmentFreeze() {
  const [pageLocks, setPageLocks] = useState<PageLock[]>(
    APP_PAGES.map(page => ({
      id: page.id,
      name: page.name,
      path: page.path,
      isLocked: false
    }))
  );
  const { toast } = useToast();

  const handleToggleLock = (pageId: string, currentLocked: boolean) => {
    setPageLocks(prev => 
      prev.map(page => 
        page.id === pageId 
          ? {
              ...page,
              isLocked: !currentLocked,
              lockedBy: !currentLocked ? 'Current User' : undefined,
              lockedAt: !currentLocked ? new Date().toISOString() : undefined
            }
          : page
      )
    );

    toast({
      title: `Page ${!currentLocked ? 'locked' : 'unlocked'}`,
      description: `Development has been ${!currentLocked ? 'frozen' : 'unfrozen'} for this page.`,
    });
  };

  const handleLockAll = () => {
    setPageLocks(prev => 
      prev.map(page => ({
        ...page,
        isLocked: true,
        lockedBy: 'Current User',
        lockedAt: new Date().toISOString()
      }))
    );

    toast({
      title: "All pages locked",
      description: "Development freeze has been applied to all pages.",
    });
  };

  const handleUnlockAll = () => {
    setPageLocks(prev => 
      prev.map(page => ({
        ...page,
        isLocked: false,
        lockedBy: undefined,
        lockedAt: undefined
      }))
    );

    toast({
      title: "All pages unlocked",
      description: "Development freeze has been removed from all pages.",
    });
  };

  const handleSaveSettings = () => {
    // In a real app, this would save to backend/localStorage
    localStorage.setItem('developmentFreeze', JSON.stringify(pageLocks));
    
    toast({
      title: "Settings saved",
      description: "Development freeze settings have been saved successfully.",
    });
  };

  const lockedCount = pageLocks.filter(page => page.isLocked).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Development Freeze</h2>
          <p className="text-muted-foreground">
            Lock specific pages to prevent code changes during stable periods.
          </p>
        </div>
        <Button onClick={handleSaveSettings} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          Save Settings
        </Button>
      </div>

      {lockedCount > 0 && (
        <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <span className="text-sm text-yellow-800">
            {lockedCount} page{lockedCount !== 1 ? 's' : ''} currently locked for development changes.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Page Lock Status</CardTitle>
          <CardDescription>
            Toggle development freeze for individual pages. Locked pages cannot be modified.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pageLocks.map((lock) => (
              <div
                key={lock.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {lock.isLocked ? (
                      <Lock className="h-4 w-4 text-destructive" />
                    ) : (
                      <Unlock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{lock.name}</span>
                  </div>
                  <code className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                    {lock.path}
                  </code>
                  <Badge variant={lock.isLocked ? "destructive" : "secondary"}>
                    {lock.isLocked ? "Locked" : "Unlocked"}
                  </Badge>
                </div>

                <div className="flex items-center space-x-4">
                  {lock.isLocked && lock.lockedBy && (
                    <div className="text-sm text-muted-foreground">
                      <span>by {lock.lockedBy}</span>
                      {lock.lockedAt && (
                        <span className="ml-2">
                          on {new Date(lock.lockedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <Switch
                    checked={lock.isLocked}
                    onCheckedChange={() => handleToggleLock(lock.id, lock.isLocked)}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Actions</CardTitle>
          <CardDescription>
            Apply freeze settings to multiple pages at once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Button
              variant="outline"
              onClick={handleLockAll}
              disabled={lockedCount === pageLocks.length}
            >
              <Lock className="h-4 w-4 mr-2" />
              Lock All
            </Button>
            
            <Button
              variant="outline"
              onClick={handleUnlockAll}
              disabled={lockedCount === 0}
            >
              <Unlock className="h-4 w-4 mr-2" />
              Unlock All
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}