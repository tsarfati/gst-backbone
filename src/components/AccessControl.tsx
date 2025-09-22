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

    // Wait for profile to load to avoid false redirects
    if (profile === null) {
      return;
    }

    // Handle profile completion route
    if (location.pathname === '/profile-completion') {
      if (profile?.profile_completed) {
        navigate('/');
        return;
      }
      setChecking(false);
      return;
    }

    // If profile is not completed, redirect to profile completion
    if (!profile?.profile_completed) {
      navigate('/profile-completion');
      return;
    }

    // Determine if user has approved company access
    const hasApprovedAccess = userCompanies.length > 0;

    // If on company-request and user already has access, send to home
    if (location.pathname === '/company-request') {
      if (hasApprovedAccess) {
        navigate('/');
        return;
      }
      setChecking(false);
      return;
    }

    // If user lacks access, force them to company-request
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