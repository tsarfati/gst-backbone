import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
}

export function RoleGuard({ 
  children, 
  allowedRoles = ['admin', 'controller', 'project_manager', 'manager'],
  redirectTo = '/' 
}: RoleGuardProps) {
  const { profile, loading, user } = useAuth();

  // Show loading while authentication is in progress
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If no user is authenticated, redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If profile is not loaded yet, show loading
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Debug logging for development
  console.log('RoleGuard - User role:', profile.role);
  console.log('RoleGuard - Allowed roles:', allowedRoles);
  console.log('RoleGuard - Has access:', allowedRoles.includes(profile.role));

  // If user role is not in allowed roles, redirect
  if (!profile.role || !allowedRoles.includes(profile.role)) {
    console.warn('Access denied - User role:', profile.role, 'Allowed roles:', allowedRoles);
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}