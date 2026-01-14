import { lazy, Suspense, useState, useEffect } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { NotificationBell } from "@/components/NotificationBell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BarChart3, LayoutDashboard, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load heavy components with recharts and complex UI
const YearlyRevenueSummary = lazy(() => import("@/components/YearlyRevenueSummary"));
const UserDashboard = lazy(() => import("@/components/dashboard/UserDashboard"));

// Loading skeleton for dashboard content
const DashboardContentSkeleton = () => (
  <div className="p-6 space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-lg" />
      ))}
    </div>
  </div>
);

type DashboardView = "analytics" | "overview";

const getTimeBasedGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const Dashboard = () => {
  const { isAdmin, loading } = useUserRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const availableYears = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];
  const currentYear = new Date().getFullYear();
  const defaultYear = availableYears.includes(currentYear) ? currentYear : 2025;
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch user's profile name
  const { data: userName } = useQuery({
    queryKey: ['dashboard-user-name', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      const name = data?.full_name;
      if (!name || name.includes('@')) {
        return user.email?.split('@')[0] || null;
      }
      return name;
    },
    enabled: !!user?.id,
  });

  // Fetch admin's dashboard preference (uses dedicated dashboard_view column)
  const { data: dashboardPreference, isLoading: prefLoading } = useQuery({
    queryKey: ['dashboard-preference', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('dashboard_preferences')
        .select('dashboard_view, layout_view')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      // Prefer new dashboard_view column, fallback to layout_view for legacy
      const view = (data as any)?.dashboard_view || data?.layout_view;
      return (view === 'analytics' ? 'analytics' : 'overview') as DashboardView;
    },
    enabled: !!user?.id && isAdmin,
  });

  const [currentView, setCurrentView] = useState<DashboardView>("overview");

  // Update local state when preference is loaded
  useEffect(() => {
    if (dashboardPreference) {
      setCurrentView(dashboardPreference);
    }
  }, [dashboardPreference]);

  // Mutation to save dashboard preference (uses dedicated dashboard_view column)
  const savePreferenceMutation = useMutation({
    mutationFn: async (view: DashboardView) => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('dashboard_preferences')
        .upsert({
          user_id: user.id,
          dashboard_view: view,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-preference', user?.id] });
    },
  });

  const handleViewChange = (value: string) => {
    if (value && (value === "analytics" || value === "overview")) {
      setCurrentView(value);
      savePreferenceMutation.mutate(value);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Invalidate all dashboard-related queries using predicate function
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          if (typeof key !== 'string') return false;
          return key.startsWith('user-') || 
                 key.startsWith('dashboard-') || 
                 key === 'all-user-profiles';
        }
      });
      toast.success("Dashboard refreshed");
    } catch {
      toast.error("Failed to refresh");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading || (isAdmin && prefLoading)) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 rounded-md skeleton-shimmer" />
          <div className="h-9 w-24 rounded-md skeleton-shimmer" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 rounded-lg skeleton-shimmer" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    );
  }

  const greeting = getTimeBasedGreeting();

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Fixed Header - Unified for all users */}
      <div className="flex-shrink-0 bg-background">
        <div className="px-6 h-16 flex items-center border-b w-full">
          <div className="flex items-center justify-between w-full gap-4">
            {/* Left side: View toggle and greeting */}
            <div className="flex items-center gap-4 min-w-0 flex-1">
              {/* Admin-only view toggle - positioned first/left */}
              {isAdmin && (
                <ToggleGroup 
                  type="single" 
                  value={currentView} 
                  onValueChange={handleViewChange}
                  className="bg-muted/60 border border-border rounded-lg p-1 hidden sm:flex flex-shrink-0"
                >
                  <ToggleGroupItem 
                    value="overview" 
                    aria-label="Dashboard Overview"
                    className="px-3 py-1.5 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=off]:text-muted-foreground"
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="analytics" 
                    aria-label="Revenue Analytics"
                    className="px-3 py-1.5 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm data-[state=off]:text-muted-foreground"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Revenue
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
              
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground truncate">
                  {greeting}{userName ? `, ${userName}` : ''}!
                </h1>
              </div>
            </div>
            
            {/* Right side: Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Refresh Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-9 w-9"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              
              {/* Notification Bell */}
              <NotificationBell placement="down" size="small" />
              
              {/* Year selector for analytics view */}
              {isAdmin && currentView === "analytics" && (
                <Select value={selectedYear.toString()} onValueChange={value => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isAdmin && currentView === "analytics" ? (
          <Suspense fallback={<DashboardContentSkeleton />}>
            <div className="p-6 space-y-8">
              <YearlyRevenueSummary selectedYear={selectedYear} />
              <div className="border-t border-border" />
            </div>
          </Suspense>
        ) : (
          <Suspense fallback={<DashboardContentSkeleton />}>
            <UserDashboard hideHeader />
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default Dashboard;