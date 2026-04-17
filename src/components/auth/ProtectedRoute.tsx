import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { AppLoader } from '@/components/ui/AppLoader';

interface ProtectedRouteProps {
  children: ReactNode;
  requireSuperAdmin?: boolean;
}

const ALLOWED_WHEN_BLOCKED = ['/plans', '/settings'];

const ProtectedRoute = ({ children, requireSuperAdmin = false }: ProtectedRouteProps) => {
  const { user, loading, isSuperAdmin } = useAuth();
  const { isBlocked, loading: subLoading } = useSubscription();
  const location = useLocation();

  if (loading) {
    return <AppLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (subLoading) {
    return <AppLoader />;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  // Block access when subscription expired (except /plans and /settings)
  if (isBlocked && !isSuperAdmin && !ALLOWED_WHEN_BLOCKED.some(p => location.pathname.startsWith(p))) {
    return <Navigate to="/plans" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
