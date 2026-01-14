// RT-CRM Application
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import SecurityEnhancedApp from "@/components/SecurityEnhancedApp";
import { AppSidebar } from "@/components/AppSidebar";
import PageAccessGuard from "@/components/PageAccessGuard";
import { useState, lazy, Suspense, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeSync } from "@/components/RealtimeSync";
import { BounceCheckWorker } from "@/components/email/BounceCheckWorker";

// Lazy load all page components for code-splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Leads = lazy(() => import("./pages/Leads"));
const Meetings = lazy(() => import("./pages/Meetings"));
const DealsPage = lazy(() => import("./pages/DealsPage"));
const Settings = lazy(() => import("./pages/Settings"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Tasks = lazy(() => import("./pages/Tasks"));


// Build version for cache busting on deployments
const CACHE_BUSTER = 'v1.0.0';

// QueryClient with optimized defaults - now with realtime sync
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
      gcTime: 24 * 60 * 60 * 1000, // 24 hours cache
      refetchOnWindowFocus: true, // Refetch when user returns to tab (only if stale)
      refetchOnMount: true, // Refetch on navigation (only if stale)
      retry: 1,
    },
  },
});

// Create persister for localStorage caching across page refreshes
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'rt-crm-cache',
});

// Loading fallback for auth page (full screen)
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

// Lightweight content loader - shows skeleton in content area only
const ContentLoader = () => (
  <div className="h-screen flex flex-col bg-background p-6">
    <Skeleton className="h-8 w-48 mb-6" />
    <div className="space-y-4 flex-1">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  </div>
);

// Layout Component for all pages with fixed sidebar
const FixedSidebarLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start collapsed
  
  return (
    <div className="min-h-screen flex w-full">
      <div className="fixed top-0 left-0 z-50 h-full">
        <AppSidebar isFixed={true} isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      </div>
      <main 
        className="flex-1 bg-background min-h-screen"
        style={{ 
          marginLeft: sidebarOpen ? '12.5rem' : '4rem',
          transition: 'margin-left 300ms ease-in-out',
          width: `calc(100vw - ${sidebarOpen ? '12.5rem' : '4rem'})`
        }}
      >
        <div className="w-full h-full overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

// Hook to clear cache on logout and prefetch routes
const useAppSetup = (isAuthenticated: boolean) => {
  const hasPrefetched = useRef(false);
  const prevUserId = useRef<string | null>(null);
  
  // Clear cache on logout
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Clear all cached data when user signs out
        localStorage.removeItem('rt-crm-cache');
        queryClient.clear();
      }
      
      // Clear cache if user changed (different user logged in)
      const newUserId = session?.user?.id || null;
      if (prevUserId.current && newUserId && prevUserId.current !== newUserId) {
        localStorage.removeItem('rt-crm-cache');
        queryClient.clear();
      }
      prevUserId.current = newUserId;
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // Prefetch route chunks after authentication
  useEffect(() => {
    if (isAuthenticated && !hasPrefetched.current) {
      hasPrefetched.current = true;
      
      // Prefetch route chunks in background after a short delay
      const prefetch = () => {
        // Use requestIdleCallback if available, otherwise setTimeout
        const scheduleImport = (importFn: () => Promise<any>) => {
          if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => importFn().catch(() => {}));
          } else {
            setTimeout(() => importFn().catch(() => {}), 100);
          }
        };
        
        // Prefetch main route chunks
        scheduleImport(() => import("./pages/Accounts"));
        scheduleImport(() => import("./pages/Contacts"));
        scheduleImport(() => import("./pages/Leads"));
        scheduleImport(() => import("./pages/Meetings"));
        scheduleImport(() => import("./pages/DealsPage"));
        scheduleImport(() => import("./pages/Tasks"));
        scheduleImport(() => import("./pages/Settings"));
        scheduleImport(() => import("./pages/Notifications"));
      };
      
      // Start prefetching after initial render settles
      setTimeout(prefetch, 1000);
    }
  }, [isAuthenticated]);
};

// Protected Route Component with Page Access Control
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  // Setup app (cache clearing, route prefetch)
  useAppSetup(!!user);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Use FixedSidebarLayout for all protected routes with Page Access Guard
  // Suspense is inside layout so sidebar stays visible while content loads
  // RealtimeSync enables live updates across all users
  return (
    <FixedSidebarLayout>
      <RealtimeSync />
      <BounceCheckWorker />
      <PageAccessGuard>
        <Suspense fallback={<ContentLoader />}>
          {children}
        </Suspense>
      </PageAccessGuard>
    </FixedSidebarLayout>
  );
};

// Auth Route Component (redirects if already authenticated)
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// App Router Component - Suspense moved inside ProtectedRoute for instant sidebar
const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/auth" element={
        <Suspense fallback={<PageLoader />}>
          <AuthRoute>
            <Auth />
          </AuthRoute>
        </Suspense>
      } />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/accounts" element={
        <ProtectedRoute>
          <Accounts />
        </ProtectedRoute>
      } />
      <Route path="/contacts" element={
        <ProtectedRoute>
          <Contacts />
        </ProtectedRoute>
      } />
      <Route path="/leads" element={
        <ProtectedRoute>
          <Leads />
        </ProtectedRoute>
      } />
      <Route path="/meetings" element={
        <ProtectedRoute>
          <Meetings />
        </ProtectedRoute>
      } />
      <Route path="/deals" element={
        <ProtectedRoute>
          <DealsPage />
        </ProtectedRoute>
      } />
      <Route path="/notifications" element={
        <ProtectedRoute>
          <Notifications />
        </ProtectedRoute>
      } />
      <Route path="/tasks" element={
        <ProtectedRoute>
          <Tasks />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="*" element={
        <ProtectedRoute>
          <NotFound />
        </ProtectedRoute>
      } />
    </Routes>
  </BrowserRouter>
);

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      buster: CACHE_BUSTER,
    }}
  >
    <SecurityEnhancedApp>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppRouter />
      </TooltipProvider>
    </SecurityEnhancedApp>
  </PersistQueryClientProvider>
);

export default App;
