import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallPromptProps {
  showButton?: boolean;
}

export default function PWAInstallPrompt({ showButton = false }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Check if install prompt is enabled in settings
    const checkSettings = async () => {
      // Get first active company's settings
      const { data: companies } = await supabase
        .from('companies')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      
      if (!companies) {
        console.log('No active company found for PWA settings');
        return;
      }

      const { data } = await supabase
        .from('job_punch_clock_settings')
        .select('*')
        .eq('company_id', companies.id)
        .is('job_id', null)
        .maybeSingle();
      
      console.log('PWA install prompt settings:', data);
      
      if (!data) return;
      
      // For button mode, check show_install_button
      if (showButton && (data as any).show_install_button === false) {
        setIsEnabled(false);
        return;
      }
      
      // For auto-prompt mode, check enable_install_prompt
      if (!showButton && (data as any).enable_install_prompt === false) {
        setIsEnabled(false);
        return;
      }
    };

    checkSettings();

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if user has previously dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed === 'true' && !showButton) {
      return;
    }

    // Listen for the beforeinstallprompt event
    // Only set up handler if this is the punchclock app type
    const appType = import.meta.env.VITE_APP_TYPE || 'main';
    if (appType !== 'punchclock') {
      console.log('PWA install prompt disabled for non-punchclock app');
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      console.log('beforeinstallprompt event fired');
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after a short delay (only if not showing button)
      if (!showButton) {
        setTimeout(() => {
          console.log('Showing PWA install prompt');
          setShowPrompt(true);
        }, 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if app was installed
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed');
      setIsInstalled(true);
      setShowPrompt(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [showButton]);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) {
      setShowIOSInstructions(true);
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if disabled, installed, or not enabled
  if (!isEnabled || isInstalled) {
    return null;
  }

  // Manual install button
  if (showButton) {
    return (
      <>
        <Button 
          onClick={handleInstall}
          variant="outline"
          className="w-full"
        >
          <Download className="h-4 w-4 mr-2" />
          Install App
        </Button>

        {/* iOS Instructions Dialog */}
        <AlertDialog open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Install on your device
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3 text-left">
                <div className="space-y-2">
                  <p className="font-medium">On Android (Chrome):</p>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Tap the menu button (⋮) in the top-right</li>
                    <li>Select "Install app" or "Add to Home screen"</li>
                    <li>Confirm by tapping "Install"</li>
                  </ol>
                </div>
                <div className="space-y-2 mt-4">
                  <p className="font-medium">On iPhone/iPad (Safari):</p>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Tap the Share button at the bottom of Safari</li>
                    <li>Scroll down and tap "Add to Home Screen"</li>
                    <li>Tap "Add" in the top right corner</li>
                  </ol>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Tip: If you don't see the Install option, ensure you're using Chrome (Android) or Safari (iOS), not in Incognito/Private mode.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button onClick={() => setShowIOSInstructions(false)}>
                Got it
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Auto-prompt dialog
  if (!showPrompt) {
    return null;
  }

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Add to Home Screen
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>Install the Punch Clock app for quick access from your home screen!</p>
            <ul className="list-disc list-inside text-sm space-y-1 mt-2">
              <li>Faster access</li>
              <li>Works offline</li>
              <li>App-like experience</li>
            </ul>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleDismiss} className="w-full sm:w-auto">
            <X className="h-4 w-4 mr-2" />
            Not Now
          </Button>
          <Button onClick={handleInstall} className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Install
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
