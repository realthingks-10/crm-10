import { Navigate, useLocation, Link } from 'react-router-dom';
import { usePermissions } from '@/contexts/PermissionsContext';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface PageAccessGuardProps {
  children: React.ReactNode;
}

const PageAccessGuard = ({ children }: PageAccessGuardProps) => {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { hasPageAccess, loading: permissionsLoading, permissions } = usePermissions();

  // Only show full loading on initial app load when we have NO cached data at all
  // If we have cached permissions (from React Query persistence), render immediately
  const hasCachedData = permissions.length > 0;
  const showLoader = authLoading || (permissionsLoading && !hasCachedData);

  if (showLoader) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Synchronous access check - no additional loading
  const canAccess = hasPageAccess(location.pathname);

  if (!canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8">
          <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access this page. Please contact your administrator if you believe this is an error.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default PageAccessGuard;
