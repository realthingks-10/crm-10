import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Deal, DealStage, DEAL_STAGES, STAGE_COLORS } from "@/types/deal";
import { Search, Filter, X, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Briefcase, Edit3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RowActionsDropdown, Edit, Trash2, CheckSquare } from "./RowActionsDropdown";
import { format } from "date-fns";
import { formatDateTimeStandard } from "@/utils/formatUtils";
import { DealColumnCustomizer, DealColumnConfig, defaultDealColumns } from "./DealColumnCustomizer";
import { BulkActionsBar } from "./BulkActionsBar";
import { DealsAdvancedFilter, AdvancedFilterState } from "./DealsAdvancedFilter";
import { InlineEditCell } from "./InlineEditCell";

import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { DeleteConfirmDialog } from "./shared/DeleteConfirmDialog";
import { ClearFiltersButton } from "./shared/ClearFiltersButton";
import { HighlightedText } from "./shared/HighlightedText";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import { moveFieldToEnd } from "@/utils/columnOrderUtils";
import { getDealStageColor } from "@/utils/statusBadgeUtils";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface ListViewProps {
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
  onUpdateDeal: (dealId: string, updates: Partial<Deal>) => void;
  onDeleteDeals: (dealIds: string[]) => void;
  onImportDeals: (deals: Partial<Deal>[]) => void;
  initialStageFilter?: string;
  onSelectionChange?: (selectedIds: string[]) => void;
}

export const ListView = ({ 
  deals, 
  onDealClick, 
  onUpdateDeal, 
  onDeleteDeals, 
  onImportDeals,
  initialStageFilter = 'all',
  onSelectionChange
}: ListViewProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [leadOwnerFilter, setLeadOwnerFilter] = useState("all");
  const [filters, setFilters] = useState<AdvancedFilterState>(() => ({
    stages: initialStageFilter !== 'all' ? [initialStageFilter as DealStage] : [],
    regions: [],
    leadOwners: [],
    priorities: [],
    probabilities: [],
    handoffStatuses: [],
    searchTerm: "",
    probabilityRange: [0, 100],
  }));
  const [sortBy, setSortBy] = useState<string>("deal_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Get owner IDs for display names
  const ownerIds = useMemo(() => {
    return [...new Set(deals.map(d => d.lead_owner).filter(Boolean))] as string[];
  }, [deals]);
  const { displayNames } = useUserDisplayNames(ownerIds);

  // Sync stage filter when initialStageFilter prop changes (from URL)
  useEffect(() => {
    if (initialStageFilter !== 'all') {
      setFilters(prev => ({ ...prev, stages: [initialStageFilter as DealStage] }));
    }
  }, [initialStageFilter]);

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.(Array.from(selectedDeals));
  }, [selectedDeals, onSelectionChange]);
  
  const navigate = useNavigate();

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);

  // Column customizer state
  const [columnCustomizerOpen, setColumnCustomizerOpen] = useState(false);

  // Fetch all profiles for lead owner dropdown - use shared cache
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - profiles rarely change
    gcTime: 30 * 60 * 1000,
  });

  // Use column preferences hook for database persistence
  const { 
    columns: savedColumns, 
    saveColumns, 
    isSaving: isSavingColumns,
    isLoading: columnsLoading 
  } = useColumnPreferences({
    moduleName: 'deals',
    defaultColumns: defaultDealColumns,
  });

  // Local state for optimistic updates
  const [localColumns, setLocalColumns] = useState<DealColumnConfig[]>([]);
  const [isColumnsInitialized, setIsColumnsInitialized] = useState(false);

  // Only initialize columns once when they first load from preferences
  useEffect(() => {
    if (savedColumns.length > 0 && !isColumnsInitialized) {
      setLocalColumns(savedColumns);
      setIsColumnsInitialized(true);
    }
  }, [savedColumns, isColumnsInitialized]);

  // Column width state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    'project_name': 200,
    'customer_name': 150,
    'lead_name': 150,
    'lead_owner': 140,
    'stage': 120,
    'priority': 100,
    'total_contract_value': 120,
    'probability': 120,
    'expected_closing_date': 140,
    'region': 120,
    'project_duration': 120,
    'start_date': 120,
    'end_date': 120,
    'proposal_due_date': 140,
    'total_revenue': 120,
  });

  // Resize state
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const tableRef = useRef<HTMLTableElement>(null);

  const { toast } = useToast();

  const formatCurrency = (amount: number | undefined, currency: string = 'EUR') => {
    if (!amount) return '-';
    const symbols = { USD: '$', EUR: '€', INR: '₹' };
    return `${symbols[currency as keyof typeof symbols] || '€'}${amount.toLocaleString()}`;
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return formatDateTimeStandard(date) || '-';
  };

  // Use shared stage badge styling from utilities
  const getStageBadgeClasses = (stage?: string) => getDealStageColor(stage);

  // Generate initials from project name
  const getProjectInitials = (name: string) => {
    return name.split(' ').slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');
  };

  // Generate consistent vibrant color from project name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-amber-600', 
      'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600'
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  // Get priority label
  const getPriorityLabel = (priority?: number) => {
    if (!priority) return '-';
    const labels: Record<number, string> = {
      1: 'Highest',
      2: 'High',
      3: 'Medium',
      4: 'Low',
      5: 'Lowest'
    };
    return labels[priority] || 'Unknown';
  };

  // Handle column resize
  const handleMouseDown = (e: React.MouseEvent, field: string) => {
    setIsResizing(field);
    setStartX(e.clientX);
    setStartWidth(columnWidths[field] || 120);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;
    const newWidth = Math.max(80, startWidth + deltaX); // Minimum width of 80px
    
    setColumnWidths(prev => ({
      ...prev,
      [isResizing]: newWidth
    }));
  };

  const handleMouseUp = () => {
    if (isResizing) {
      // Save to localStorage
      localStorage.setItem('deals-column-widths', JSON.stringify(columnWidths));
      setIsResizing(null);
    }
  };

  // Mouse event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, startX, startWidth, columnWidths]);

  // Load column widths from localStorage
  useEffect(() => {
    const savedWidths = localStorage.getItem('deals-column-widths');
    if (savedWidths) {
      try {
        const parsed = JSON.parse(savedWidths);
        setColumnWidths(parsed);
      } catch (e) {
        console.error('Failed to parse saved column widths:', e);
      }
    }
  }, []);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDeals(new Set(filteredAndSortedDeals.map(deal => deal.id)));
    } else {
      setSelectedDeals(new Set());
    }
  };

  const handleSelectDeal = (dealId: string, checked: boolean) => {
    const newSelected = new Set(selectedDeals);
    if (checked) {
      newSelected.add(dealId);
    } else {
      newSelected.delete(dealId);
    }
    setSelectedDeals(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedDeals.size === 0) return;
    
    onDeleteDeals(Array.from(selectedDeals));
    setSelectedDeals(new Set());
    
    toast({
      title: "Deals deleted",
      description: `Successfully deleted ${selectedDeals.size} deals`,
    });
  };

  const handleBulkExport = () => {
    const selectedDealObjects = deals.filter(deal => selectedDeals.has(deal.id));
    // Export logic handled by DealActionsDropdown
  };

  const handleInlineEdit = async (dealId: string, field: string, value: any) => {
    // Validation
    if (field === 'probability') {
      const numValue = Number(value);
      if (isNaN(numValue) || numValue < 0 || numValue > 100) {
        toast({
          title: "Validation error",
          description: "Probability must be between 0 and 100",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (field === 'priority') {
      const numValue = Number(value);
      if (isNaN(numValue) || numValue < 1 || numValue > 5) {
        toast({
          title: "Validation error",
          description: "Priority must be between 1 and 5",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (['total_contract_value', 'total_revenue'].includes(field)) {
      const numValue = Number(value);
      if (isNaN(numValue) || numValue < 0) {
        toast({
          title: "Validation error",
          description: "Amount must be a positive number",
          variant: "destructive",
        });
        return;
      }
    }
    
    try {
      await onUpdateDeal(dealId, { [field]: value });
      toast({
        title: "Deal updated",
        description: "Field updated successfully",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to update deal field",
        variant: "destructive",
      });
    }
  };

  const getFieldType = (field: string): 'text' | 'number' | 'date' | 'select' | 'textarea' | 'boolean' | 'stage' | 'priority' | 'currency' | 'userSelect' => {
    if (field === 'stage') return 'stage';
    if (field === 'priority') return 'priority';
    if (field === 'lead_owner') return 'userSelect';
    if (['total_contract_value', 'total_revenue', 'quarterly_revenue_q1', 'quarterly_revenue_q2', 'quarterly_revenue_q3', 'quarterly_revenue_q4'].includes(field)) return 'currency';
    if (['expected_closing_date', 'start_date', 'end_date', 'proposal_due_date', 'rfq_received_date', 'signed_contract_date', 'implementation_start_date'].includes(field)) return 'date';
    if (['probability', 'project_duration'].includes(field)) return 'number';
    if (['handoff_status', 'rfq_status', 'is_recurring', 'relationship_strength', 'region', 'decision_maker_level'].includes(field)) return 'select';
    return 'text';
  };

  const getFieldOptions = (field: string): string[] => {
    if (field === 'handoff_status') {
      return ['Not Started', 'In Progress', 'Complete'];
    }
    if (field === 'rfq_status') {
      return ['Drafted', 'Submitted', 'Rejected', 'Accepted'];
    }
    if (field === 'is_recurring') {
      return ['Yes', 'No', 'Unclear'];
    }
    if (field === 'relationship_strength') {
      return ['Low', 'Medium', 'High'];
    }
    if (field === 'decision_maker_level') {
      return ['Executive', 'Director', 'Manager', 'Individual Contributor'];
    }
    if (field === 'region') {
      const regions = [...new Set(deals.map(d => d.region).filter(Boolean))] as string[];
      return regions.length > 0 ? regions : ['North', 'South', 'East', 'West', 'Central'];
    }
    return [];
  };

  const visibleColumns = moveFieldToEnd(
    localColumns.filter((col) => col.visible).sort((a, b) => a.order - b.order),
    "lead_owner",
  );

  // Generate available options for multi-select filters
  const availableOptions = useMemo(() => {
    const regions = Array.from(new Set(deals.map(d => d.region).filter(Boolean)));
    const leadOwners = Array.from(new Set(deals.map(d => d.lead_owner).filter(Boolean)));
    const priorities = Array.from(new Set(deals.map(d => String(d.priority)).filter(p => p !== 'undefined')));
    const probabilities = Array.from(new Set(deals.map(d => String(d.probability)).filter(p => p !== 'undefined')));
    const handoffStatuses = Array.from(new Set(deals.map(d => d.handoff_status).filter(Boolean)));
    
    return {
      regions,
      leadOwners,
      priorities,
      probabilities,
      handoffStatuses,
    };
  }, [deals]);

  useEffect(() => {
    const savedFilters = localStorage.getItem('deals-filters');
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        setFilters(parsed);
        setSearchTerm(parsed.searchTerm || "");
      } catch (e) {
        console.error('Failed to parse saved filters:', e);
      }
    }
  }, []);

  useEffect(() => {
    const filtersWithSearch = { ...filters, searchTerm };
    localStorage.setItem('deals-filters', JSON.stringify(filtersWithSearch));
  }, [filters, searchTerm]);

  const filteredAndSortedDeals = deals
    .filter(deal => {
      // Combine search from both searchTerm and filters.searchTerm
      const allSearchTerms = [searchTerm, filters.searchTerm].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !allSearchTerms || 
        deal.deal_name?.toLowerCase().includes(allSearchTerms) ||
        deal.project_name?.toLowerCase().includes(allSearchTerms) ||
        deal.lead_name?.toLowerCase().includes(allSearchTerms) ||
        deal.customer_name?.toLowerCase().includes(allSearchTerms) ||
        deal.region?.toLowerCase().includes(allSearchTerms);
      
      // Apply lead owner filter (standalone dropdown)
      const matchesLeadOwnerDropdown = leadOwnerFilter === "all" || deal.lead_owner === leadOwnerFilter;
      
      // Apply multi-select filters
      const matchesStages = filters.stages.length === 0 || filters.stages.includes(deal.stage);
      const matchesRegions = filters.regions.length === 0 || filters.regions.includes(deal.region || '');
      const matchesLeadOwners = filters.leadOwners.length === 0 || filters.leadOwners.includes(deal.lead_owner || '');
      const matchesPriorities = filters.priorities.length === 0 || filters.priorities.includes(String(deal.priority || ''));
      const matchesProbabilities = filters.probabilities.length === 0 || filters.probabilities.includes(String(deal.probability || ''));
      const matchesHandoffStatuses = filters.handoffStatuses.length === 0 || filters.handoffStatuses.includes(deal.handoff_status || '');
      
      // Probability range filter
      const dealProbability = deal.probability || 0;
      const matchesProbabilityRange = dealProbability >= filters.probabilityRange[0] && dealProbability <= filters.probabilityRange[1];
      
      return matchesSearch && matchesLeadOwnerDropdown && matchesStages && matchesRegions && matchesLeadOwners && 
             matchesPriorities && matchesProbabilities && matchesHandoffStatuses && matchesProbabilityRange;
    })
    .sort((a, b) => {
      const aValue = a[sortBy as keyof Deal];
      const bValue = b[sortBy as keyof Deal];

      // Handle null/undefined - push to end
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortOrder === 'asc' ? 1 : -1;
      if (bValue == null) return sortOrder === 'asc' ? -1 : 1;

      // Numeric fields
      if (['priority', 'probability', 'project_duration', 'total_contract_value', 'total_revenue', 'quarterly_revenue_q1', 'quarterly_revenue_q2', 'quarterly_revenue_q3', 'quarterly_revenue_q4'].includes(sortBy)) {
        const numA = Number(aValue) || 0;
        const numB = Number(bValue) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }

      // Date fields
      if (['expected_closing_date', 'start_date', 'end_date', 'created_at', 'modified_at', 'proposal_due_date', 'rfq_received_date', 'signed_contract_date', 'implementation_start_date'].includes(sortBy)) {
        const dateA = new Date(String(aValue)).getTime();
        const dateB = new Date(String(bValue)).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }

      // String fields - use localeCompare for proper sorting
      const strA = String(aValue);
      const strB = String(bValue);
      const comparison = strA.localeCompare(strB, undefined, { sensitivity: 'base' });
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedDeals.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDeals = filteredAndSortedDeals.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchTerm, leadOwnerFilter]);

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.stages.length > 0) count++;
    if (filters.regions.length > 0) count++;
    if (filters.leadOwners.length > 0) count++;
    if (filters.priorities.length > 0) count++;
    if (filters.probabilities.length > 0) count++;
    if (filters.handoffStatuses.length > 0) count++;
    if (filters.searchTerm) count++;
    if (filters.probabilityRange[0] > 0 || filters.probabilityRange[1] < 100) count++;
    return count;
  };

  const clearAllFilters = () => {
    setFilters({
      stages: [],
      regions: [],
      leadOwners: [],
      priorities: [],
      probabilities: [],
      handoffStatuses: [],
      searchTerm: "",
      probabilityRange: [0, 100],
    });
    setSearchTerm("");
  };

  const activeFiltersCount = getActiveFiltersCount();
  const hasActiveFilters = activeFiltersCount > 0 || searchTerm !== "";

  // Get selected deal objects for export
  const selectedDealObjects = deals.filter(deal => selectedDeals.has(deal.id));

  const handleCreateTask = (deal: Deal) => {
    const params = new URLSearchParams({
      create: '1',
      module: 'deals',
      recordId: deal.id,
      recordName: encodeURIComponent(deal.project_name || deal.deal_name || 'Deal'),
      return: '/deals',
      returnViewId: deal.id,
    });
    navigate(`/tasks?${params.toString()}`);
  };

  // Listen for column customizer open event from header
  useEffect(() => {
    const handleOpenColumns = () => setColumnCustomizerOpen(true);
    window.addEventListener('open-deal-columns', handleOpenColumns);
    return () => window.removeEventListener('open-deal-columns', handleOpenColumns);
  }, []);

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Header and Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
            <Input
              placeholder="Search deals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              inputSize="control"
            />
          </div>
          
          <Select value={leadOwnerFilter} onValueChange={setLeadOwnerFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Lead Owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lead Owners</SelectItem>
              {availableOptions.leadOwners.map((ownerId) => (
                <SelectItem key={ownerId} value={ownerId}>
                  {displayNames[ownerId] || ownerId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <DealsAdvancedFilter 
            filters={filters} 
            onFiltersChange={setFilters}
            availableRegions={availableOptions.regions}
            availableLeadOwners={availableOptions.leadOwners}
            availablePriorities={availableOptions.priorities}
            availableProbabilities={availableOptions.probabilities}
            availableHandoffStatuses={availableOptions.handoffStatuses}
          />

          <ClearFiltersButton hasActiveFilters={hasActiveFilters} onClear={clearAllFilters} />
        </div>
        
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show:</span>
          <Select value={itemsPerPage.toString()} onValueChange={val => setItemsPerPage(Number(val))}>
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map(size => <SelectItem key={size} value={size.toString()}>{size}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col">
        <div className="relative overflow-auto flex-1 min-h-0">
        <Table ref={tableRef} className="w-full">
          <TableHeader>
            <TableRow className="sticky top-0 z-20 bg-muted border-b-2 shadow-sm">
              <TableHead className="w-12 min-w-12 text-center font-bold text-foreground bg-muted">
                <Checkbox
                  checked={selectedDeals.size === paginatedDeals.length && paginatedDeals.length > 0}
                  onCheckedChange={handleSelectAll}
                  className="transition-all hover:scale-110"
                />
              </TableHead>
              {visibleColumns.map(column => (
                <TableHead 
                  key={column.field} 
                  className="font-bold text-foreground px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors relative whitespace-nowrap bg-muted"
                  style={{ 
                    width: `${columnWidths[column.field] || 120}px`,
                    minWidth: `${columnWidths[column.field] || 120}px`,
                    maxWidth: `${columnWidths[column.field] || 120}px`
                  }}
                  onClick={() => {
                    if (sortBy === column.field) {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy(column.field);
                      setSortOrder("desc");
                    }
                  }}
                >
                  <div className="flex items-center justify-center gap-1 pr-4 text-foreground font-bold">
                    {column.label}
                    {sortBy === column.field && (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 flex-shrink-0" /> : <ArrowDown className="w-3 h-3 flex-shrink-0" />
                    )}
                  </div>
                  <div
                    className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/40 bg-transparent"
                    onMouseDown={(e) => handleMouseDown(e, column.field)}
                    style={{
                      background: isResizing === column.field ? 'hsl(var(--primary) / 0.5)' : undefined
                    }}
                  />
                </TableHead>
              ))}
              <TableHead className="w-32 text-center font-bold text-foreground px-4 py-3 bg-muted">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedDeals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + 2} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Briefcase className="w-10 h-10 opacity-50" />
                    <p>No deals found</p>
                    {hasActiveFilters && (
                      <Button variant="link" size="sm" onClick={clearAllFilters}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedDeals.map((deal) => (
                <TableRow 
                  key={deal.id} 
                  className={`hover:bg-muted/30 border-b group transition-colors ${selectedDeals.has(deal.id) ? 'bg-primary/5' : ''}`}
                  data-state={selectedDeals.has(deal.id) ? "selected" : undefined}
                >
                  <TableCell onClick={(e) => e.stopPropagation()} className="text-center px-4 py-3">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={selectedDeals.has(deal.id)}
                        onCheckedChange={(checked) => handleSelectDeal(deal.id, Boolean(checked))}
                      />
                    </div>
                  </TableCell>
                  {visibleColumns.map(column => (
                    <TableCell 
                      key={column.field} 
                      className="text-center px-2 py-1 align-middle whitespace-nowrap overflow-hidden"
                      style={{ 
                        width: `${columnWidths[column.field] || 120}px`,
                        minWidth: `${columnWidths[column.field] || 120}px`,
                        maxWidth: `${columnWidths[column.field] || 120}px`
                      }}
                    >
                      {column.field === 'project_name' || column.field === 'deal_name' ? (
                        <div className="group flex items-center gap-1">
                          <button 
                            onClick={() => onDealClick(deal)}
                            className="text-primary hover:underline font-medium text-left truncate"
                            title={deal[column.field as keyof Deal]?.toString() || 'Click to view'}
                          >
                            <HighlightedText text={deal[column.field as keyof Deal]?.toString() || '-'} highlight={searchTerm} />
                          </button>
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 hover:bg-muted rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDealClick(deal);
                            }}
                            title="Edit"
                          >
                            <Edit3 className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                      ) : (
                        <InlineEditCell
                          value={deal[column.field as keyof Deal]}
                          field={column.field}
                          dealId={deal.id}
                          onSave={handleInlineEdit}
                          type={getFieldType(column.field)}
                          options={getFieldOptions(column.field)}
                          userOptions={allProfiles}
                          currencyType={deal.currency_type}
                        />
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="w-20 px-4 py-3">
                    <div className="flex items-center justify-center">
                      <RowActionsDropdown
                        actions={[
                          {
                            label: "Create Task",
                            icon: <CheckSquare className="w-4 h-4" />,
                            onClick: () => handleCreateTask(deal)
                          },
                          {
                            label: "Edit",
                            icon: <Edit className="w-4 h-4" />,
                            onClick: () => onDealClick(deal)
                          },
                          {
                            label: "Delete",
                            icon: <Trash2 className="w-4 h-4" />,
                            onClick: () => {
                              setDealToDelete(deal);
                              setDeleteDialogOpen(true);
                            },
                            destructive: true,
                            separator: true
                          }
                        ]}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          </Table>
        </div>
        
        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Showing {filteredAndSortedDeals.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedDeals.length)} of {filteredAndSortedDeals.length} deals
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
              disabled={currentPage === 1 || totalPages === 0}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Bulk Actions */}
      {selectedDeals.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedDeals.size}
          onDelete={handleBulkDelete}
          onExport={handleBulkExport}
          onClearSelection={() => setSelectedDeals(new Set())}
        />
      )}

      <DealColumnCustomizer
        open={columnCustomizerOpen}
        onOpenChange={setColumnCustomizerOpen}
        columns={localColumns}
        onColumnsChange={setLocalColumns}
        onSave={saveColumns}
        isSaving={isSavingColumns}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (dealToDelete) {
            onDeleteDeals([dealToDelete.id]);
            toast({
              title: "Deal deleted",
              description: `Successfully deleted ${dealToDelete.project_name || 'deal'}`,
            });
            setDealToDelete(null);
          }
        }}
        title="Delete Deal"
        itemName={dealToDelete?.project_name || 'this deal'}
        itemType="deal"
      />
    </div>
  );
};
