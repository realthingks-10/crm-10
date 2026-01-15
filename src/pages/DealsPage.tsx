import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Deal, DealStage } from "@/types/deal";
import { DealForm } from "@/components/DealForm";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, LayoutGrid, List, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCRUDAudit } from "@/hooks/useCRUDAudit";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Upload, Download, Columns } from "lucide-react";
import { useDealsImportExport } from "@/hooks/useDealsImportExport";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load heavy view components
const KanbanBoard = lazy(() => import("@/components/KanbanBoard").then(m => ({ default: m.KanbanBoard })));
const ListView = lazy(() => import("@/components/ListView").then(m => ({ default: m.ListView })));

// Loading skeleton for views
const ViewSkeleton = () => (
  <div className="space-y-4 flex-1 p-4">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-64 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

const DealsPage = () => {
  const [searchParams] = useSearchParams();
  const initialStageFilter = searchParams.get('stage') || 'all';
  const {
    user,
    loading: authLoading
  } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    toast
  } = useToast();
  const {
    logCreate,
    logUpdate,
    logBulkDelete
  } = useCRUDAudit();
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [initialStage, setInitialStage] = useState<DealStage>('Lead');
  const [activeView, setActiveView] = useState<'kanban' | 'list'>('list');
  const [selectedDealIds, setSelectedDealIds] = useState<string[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [stageFilterFromUrl, setStageFilterFromUrl] = useState(initialStageFilter);
  
  // Fetch deals with React Query caching
  const { data: deals = [], isLoading: loading, refetch: refetchDeals } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('deals').select('*').order('modified_at', {
        ascending: false
      });
      if (error) throw error;
      return (data || []) as unknown as Deal[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!user, // Only fetch when user is available
  });

  const fetchDeals = async () => {
    await refetchDeals();
  };
  
  // Initialize import/export hook at component level
  const { handleImport, handleExportAll, handleExportSelected } = useDealsImportExport({
    onRefresh: () => fetchDeals()
  });
  
  // Get owner parameter from URL - "me" means filter by current user
  const ownerParam = searchParams.get('owner');

  // Sync stage filter when URL changes
  useEffect(() => {
    const urlStage = searchParams.get('stage');
    if (urlStage) {
      setStageFilterFromUrl(urlStage);
    }
  }, [searchParams]);

  // Handle viewId from URL (from global search)
  useEffect(() => {
    const viewId = searchParams.get('viewId');
    if (viewId && deals.length > 0) {
      const dealToView = deals.find(d => d.id === viewId);
      if (dealToView) {
        setSelectedDeal(dealToView);
        setIsCreating(false);
        setIsFormOpen(true);
        // Clear the viewId from URL after opening
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('viewId');
        navigate(`/deals?${newParams.toString()}`, { replace: true });
      }
    }
  }, [searchParams, deals, navigate]);

  // Filter deals by owner when owner=me
  useEffect(() => {
    if (ownerParam === 'me' && user?.id) {
      setFilteredDeals(deals.filter(deal => deal.created_by === user.id));
    } else {
      setFilteredDeals(deals);
    }
  }, [deals, ownerParam, user?.id]);
  // Old fetchDeals removed - using React Query now
  const handleUpdateDeal = async (dealId: string, updates: Partial<Deal>) => {
    try {
      console.log("=== HANDLE UPDATE DEAL DEBUG ===");
      console.log("Deal ID:", dealId);
      console.log("Updates:", updates);

      // Get the existing deal for audit logging
      const existingDeal = deals.find(deal => deal.id === dealId);

      // Ensure we have all required fields for the update
      const updateData = {
        ...updates,
        modified_at: new Date().toISOString(),
        modified_by: user?.id
      };
      console.log("Final update data:", updateData);
      const {
        data,
        error
      } = await supabase.from('deals').update(updateData).eq('id', dealId).select().single();
      if (error) {
        console.error("Supabase update error:", error);
        throw error;
      }
      console.log("Update successful, data:", data);

      // Log update operation
      await logUpdate('deals', dealId, updates, existingDeal);

      // Invalidate cache instead of setDeals
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({
        title: "Success",
        description: "Deal updated successfully"
      });
    } catch (error: any) {
      console.error("Update deal error:", error);
      toast({
        title: "Error",
        description: `Failed to update deal: ${error.message || 'Unknown error'}`,
        variant: "destructive"
      });
      throw error;
    }
  };
  const handleSaveDeal = async (dealData: Partial<Deal>) => {
    try {
      console.log("=== SAVE DEAL DEBUG ===");
      console.log("Is creating:", isCreating);
      console.log("Deal data:", dealData);
      if (isCreating) {
        const insertData = {
          ...dealData,
          deal_name: dealData.project_name || dealData.deal_name || 'Untitled Deal',
          created_by: user?.id,
          // Ensure created_by is set for RLS
          modified_by: user?.id,
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString()
        };
        console.log("Insert data:", insertData);
        const {
          data,
          error
        } = await supabase.from('deals').insert([insertData]).select().single();
        if (error) {
          console.error("Insert error:", error);

          // Check for RLS policy violation
          if (error.message?.includes('row-level security') || error.message?.includes('permission') || error.code === 'PGRST301' || error.code === '42501') {
            toast({
              title: "Permission Denied",
              description: "You don't have permission to create deals.",
              variant: "destructive"
            });
            return;
          }
          throw error;
        }
        console.log("Insert successful:", data);

        // Log create operation
        await logCreate('deals', data.id, dealData);
        // Invalidate cache to refresh deals
        queryClient.invalidateQueries({ queryKey: ['deals'] });
      } else if (selectedDeal) {
        const updateData = {
          ...dealData,
          deal_name: dealData.project_name || selectedDeal.project_name || selectedDeal.deal_name || 'Untitled Deal',
          modified_at: new Date().toISOString(),
          modified_by: user?.id
        };
        console.log("Update data for existing deal:", updateData);
        await handleUpdateDeal(selectedDeal.id, updateData);
        await fetchDeals();
      }
    } catch (error: any) {
      console.error("Error in handleSaveDeal:", error);
      throw error;
    }
  };
  const handleDeleteDeals = async (dealIds: string[]) => {
    try {
      console.log("Attempting to delete deals:", dealIds);

      // Request the IDs of the rows that were actually deleted (RLS will filter)
      const {
        data,
        error
      } = await supabase.from('deals').delete().in('id', dealIds).select('id');
      if (error) {
        console.error("Delete error:", error);
        toast({
          title: "Error",
          description: "Failed to delete deals",
          variant: "destructive"
        });
        return;
      }
      const deletedIds = (data || []).map((row: {
        id: string;
      }) => row.id);
      const notDeleted = dealIds.filter(id => !deletedIds.includes(id));
      console.log("Deleted IDs:", deletedIds);
      console.log("Not deleted due to RLS/permissions:", notDeleted);

      // Invalidate cache to refresh deals
      if (deletedIds.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['deals'] });

        // Log bulk delete with only the successfully deleted IDs
        await logBulkDelete('deals', deletedIds.length, deletedIds);
        toast({
          title: "Success",
          description: `Deleted ${deletedIds.length} deal(s)`
        });
      }

      // Show a clear permission message for deals that couldn't be deleted
      if (notDeleted.length > 0) {
        toast({
          title: "Permission Denied",
          description: `You don't have permission to delete ${notDeleted.length} deal(s).`,
          variant: "destructive"
        });
      }

      // If nothing was deleted at all, ensure user is informed
      if (deletedIds.length === 0 && notDeleted.length === dealIds.length) {
        console.warn("No deals were deleted due to RLS. User may be non-owner/non-admin.");
      }
    } catch (error) {
      console.error("Unexpected delete error:", error);
      toast({
        title: "Error",
        description: "Failed to delete deals",
        variant: "destructive"
      });
    }
  };
  const handleImportDeals = async (importedDeals: (Partial<Deal> & {
    shouldUpdate?: boolean;
  })[]) => {
    // This function is kept for compatibility but the actual import logic is now handled
    // by the simplified CSV processor in useDealsImportExport hook
    console.log('handleImportDeals called with:', importedDeals.length, 'deals');
    // Refresh data after import
    await fetchDeals();
  };
  const handleCreateDeal = (stage: DealStage) => {
    setInitialStage(stage);
    setIsCreating(true);
    setSelectedDeal(null);
    setIsFormOpen(true);
  };
  const handleDealClick = (deal: Deal) => {
    setSelectedDeal(deal);
    setIsCreating(false);
    setIsFormOpen(true);
  };
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedDeal(null);
    setIsCreating(false);
  };
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);
  useEffect(() => {
    if (user) {
      // Set up real-time subscription - just invalidate cache on changes
      const channel = supabase.channel('deals-changes').on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'deals'
      }, payload => {
        console.log('Real-time deal change:', payload);
        // Invalidate cache to refresh deals - React Query will handle the refetch
        queryClient.invalidateQueries({ queryKey: ['deals'] });
      }).subscribe();

      // Listen for custom import events
      const handleImportEvent = () => {
        console.log('DealsPage: Received deals-data-updated event, refreshing...');
        queryClient.invalidateQueries({ queryKey: ['deals'] });
      };
      window.addEventListener('deals-data-updated', handleImportEvent);
      return () => {
        supabase.removeChannel(channel);
        window.removeEventListener('deals-data-updated', handleImportEvent);
      };
    }
  }, [user, queryClient]);
  // Show skeleton instead of blocking full-screen loader
  const showSkeleton = loading && deals.length === 0;
  
  if (authLoading) {
    return <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>;
  }
  if (!user) {
    return null;
  }
  
  return <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-background">
        <div className="px-6 h-16 flex items-center border-b w-full">
          <div className="flex items-center justify-between w-full">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl text-foreground font-semibold">Deals</h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Bulk action icons when deals are selected */}
              {selectedDealIds.length > 0 && (
                <TooltipProvider>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => setShowBulkDeleteDialog(true)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete Selected ({selectedDealIds.length})</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              )}

              <div className="bg-muted rounded-md p-0.5 flex gap-0.5">
                <Button variant={activeView === 'kanban' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveView('kanban')} className="gap-1.5 h-8 px-2.5 text-xs">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Kanban
                </Button>
                <Button variant={activeView === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveView('list')} className="gap-1.5 h-8 px-2.5 text-xs">
                  <List className="h-3.5 w-3.5" />
                  List
                </Button>
              </div>

              {/* Actions dropdown - Consistent with Accounts pattern */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border z-50">
                  {activeView === 'list' && (
                    <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('open-deal-columns'))}>
                      <Columns className="w-4 h-4 mr-2" />
                      Columns
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.csv';
                    input.onchange = async (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        await handleImport(file);
                      }
                    };
                    input.click();
                  }}>
                    <Upload className="w-4 h-4 mr-2" />
                    Import CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    if (selectedDealIds.length > 0) {
                      handleExportSelected(deals, selectedDealIds);
                    } else {
                      handleExportAll(deals);
                    }
                  }}>
                    <Download className="w-4 h-4 mr-2" />
                    Export {selectedDealIds.length > 0 ? `(${selectedDealIds.length})` : 'CSV'}
                  </DropdownMenuItem>
                  {selectedDealIds.length > 0 && (
                    <DropdownMenuItem 
                      onClick={() => setShowBulkDeleteDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Selected ({selectedDealIds.length})
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button size="sm" onClick={() => handleCreateDeal('Lead')} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Deal
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Takes remaining height */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pt-2 pb-4 overflow-hidden">
        {showSkeleton ? (
          <ViewSkeleton />
        ) : activeView === 'kanban' ? (
          <Suspense fallback={<ViewSkeleton />}>
            <KanbanBoard 
              deals={filteredDeals} 
              onUpdateDeal={handleUpdateDeal} 
              onDealClick={handleDealClick} 
              onCreateDeal={handleCreateDeal} 
              onDeleteDeals={handleDeleteDeals} 
              onImportDeals={handleImportDeals} 
              onRefresh={fetchDeals} 
            />
          </Suspense>
        ) : (
          <Suspense fallback={<ViewSkeleton />}>
            <ListView 
              deals={filteredDeals} 
              onDealClick={handleDealClick} 
              onUpdateDeal={handleUpdateDeal} 
              onDeleteDeals={handleDeleteDeals} 
              onImportDeals={handleImportDeals} 
              initialStageFilter={stageFilterFromUrl}
              onSelectionChange={setSelectedDealIds}
            />
          </Suspense>
        )}
      </div>

      {/* Deal Form Modal */}
      <DealForm deal={selectedDeal} isOpen={isFormOpen} onClose={handleCloseForm} onSave={handleSaveDeal} onRefresh={fetchDeals} isCreating={isCreating} initialStage={initialStage} />

      {/* Bulk Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        onConfirm={() => {
          handleDeleteDeals(selectedDealIds);
          setSelectedDealIds([]);
          setShowBulkDeleteDialog(false);
        }}
        title="Delete Deals"
        itemName={`${selectedDealIds.length} deal${selectedDealIds.length > 1 ? 's' : ''}`}
        itemType="deals"
      />
    </div>;
};
export default DealsPage;