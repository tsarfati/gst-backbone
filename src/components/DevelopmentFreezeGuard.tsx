import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Lock, AlertTriangle } from 'lucide-react';
import { useDevelopmentFreeze } from '@/hooks/useDevelopmentFreeze';
import { useNavigate } from 'react-router-dom';

interface DevelopmentFreezeGuardProps {
  children: React.ReactNode;
  showAlert?: boolean;
}

export function DevelopmentFreezeGuard({ children, showAlert = true }: DevelopmentFreezeGuardProps) {
  const { isCurrentPageFrozen, getCurrentPageFreezeInfo, isLoaded } = useDevelopmentFreeze();
  const navigate = useNavigate();

  if (!isLoaded) {
    return <>{children}</>;
  }

  const freezeInfo = getCurrentPageFreezeInfo();
  const isFrozen = isCurrentPageFrozen();

  if (isFrozen && showAlert) {
    return (
      <div className="space-y-4">
        <Alert className="border-yellow-200 bg-yellow-50">
          <Lock className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Page Development Frozen</AlertTitle>
          <AlertDescription className="text-yellow-700">
            This page is currently locked for development changes.
            {freezeInfo?.lockedBy && (
              <span className="block mt-1">
                Locked by {freezeInfo.lockedBy}
                {freezeInfo.lockedAt && (
                  <span className="ml-2">
                    on {new Date(freezeInfo.lockedAt).toLocaleDateString()}
                  </span>
                )}
              </span>
            )}
          </AlertDescription>
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings/security')}
              className="border-yellow-300 text-yellow-800 hover:bg-yellow-100"
            >
              Go to Development Freeze Settings
            </Button>
          </div>
        </Alert>
        {children}
      </div>
    );
  }

  return <>{children}</>;
}

export function useDevelopmentFreezeCheck() {
  const { isCurrentPageFrozen, getCurrentPageFreezeInfo } = useDevelopmentFreeze();

  const checkAndWarn = (): boolean => {
    if (isCurrentPageFrozen()) {
      const freezeInfo = getCurrentPageFreezeInfo();
      console.warn('Development changes blocked: Page is frozen for development changes.', {
        path: window.location.pathname,
        freezeInfo
      });
      return true;
    }
    return false;
  };

  return { checkAndWarn, isCurrentPageFrozen, getCurrentPageFreezeInfo };
}