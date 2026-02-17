import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireSuperAdmin?: boolean;
}

const ALLOWED_WHEN_BLOCKED = ['/plans', '/settings'];

const ProtectedRoute = ({ children, requireSuperAdmin = false }: ProtectedRouteProps) => {
  const { user, loading, isSuperAdmin } = useAuth();
  const { isBlocked, loading: subLoading } = useSubscription();
  const location = useLocation();

  if (loading || subLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
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
