import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface AccessControlProps {
  children: React.ReactNode;
}

export function AccessControl({ children }: AccessControlProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const { userCompanies, loading: companyLoading } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading || companyLoading) {
      return;
    }

    setChecking(true);

    // If no user, redirect to auth
    if (!user) {
      navigate('/auth');
      return;
    }

    // Allow access to profile completion page regardless of status
    if (location.pathname === '/profile-completion') {
      setChecking(false);
      return;
    }

    // If profile is not completed, redirect to profile completion
    if (!profile?.profile_completed) {
      navigate('/profile-completion');
      return;
    }

    // Allow access to company request page regardless of approval status
    if (location.pathname === '/company-request') {
      setChecking(false);
      return;
    }

    // If user has no approved company access, redirect to company request
    const hasApprovedAccess = userCompanies.length > 0;
    if (!hasApprovedAccess) {
      navigate('/company-request');
      return;
    }

    setChecking(false);
  }, [user, profile, userCompanies, authLoading, companyLoading, navigate, location.pathname]);

  if (authLoading || companyLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}