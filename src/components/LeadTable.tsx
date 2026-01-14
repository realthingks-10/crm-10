import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCRUDAudit } from "@/hooks/useCRUDAudit";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import { useUserRole } from "@/hooks/useUserRole";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, CalendarPlus, CheckSquare, FileText, Plus, Eye, User } from "lucide-react";
import { RowActionsDropdown, Edit, Trash2, Mail, RefreshCw } from "./RowActionsDropdown";
import { LeadModal } from "./LeadModal";
import { LeadColumnCustomizer, LeadColumnConfig, defaultLeadColumns } from "./LeadColumnCustomizer";
import { LeadStatusFilter } from "./LeadStatusFilter";
import { ConvertToDealModal } from "./ConvertToDealModal";
import { LeadDeleteConfirmDialog } from "./LeadDeleteConfirmDialog";
import { AccountDetailModalById } from "./accounts/AccountDetailModalById";
import { SendEmailModal, EmailRecipient } from "./SendEmailModal";
import { MeetingModal } from "./MeetingModal";
import { LeadDetailModal } from "./leads/LeadDetailModal";
import { HighlightedText } from "./shared/HighlightedText";
import { ClearFiltersButton } from "./shared/ClearFiltersButton";
import { TableSkeleton } from "./shared/Skeletons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moveFieldToEnd } from "@/utils/columnOrderUtils";
import { formatDateTimeStandard } from "@/utils/formatUtils";
import { getLeadStatusColor } from "@/utils/statusBadgeUtils";

// Export ref interface for parent component
export interface LeadTableRef {
  handleBulkDelete: (deleteLinkedRecords?: boolean) => Promise<void>;
  getSelectedLeadsForEmail: () => { id: string; name: string; email: string }[];
}

interface Lead {
  id: string;
  lead_name: string;
  company_name?: string | null;
  account_company_name?: string | null;
  account_id?: string;
  position?: string | null;
  email?: string | null;
  phone_no?: string | null;
  contact_owner?: string;
  created_time?: string | null;
  modified_time?: string;
  lead_status?: string | null;
  contact_source?: string | null;
  linkedin?: string | null;
  website?: string | null;
  description?: string | null;
  created_by?: string;
  modified_by?: string;
  country?: string | null;
  industry?: string | null;
  last_contacted_at?: string | null;
}

// Use defaultLeadColumns from LeadColumnCustomizer (imported above)

interface LeadTableProps {
  showColumnCustomizer: boolean;
  setShowColumnCustomizer: (show: boolean) => void;
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  selectedLeads: string[];
  setSelectedLeads: React.Dispatch<React.SetStateAction<string[]>>;
  initialStatus?: string;
  onBulkDeleteComplete?: () => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const LeadTable = forwardRef<LeadTableRef, LeadTableProps>(({
  showColumnCustomizer,
  setShowColumnCustomizer,
  showModal,
  setShowModal,
  selectedLeads,
  setSelectedLeads,
  initialStatus = "all",
  onBulkDeleteComplete
}, ref) => {
  const { toast } = useToast();
  const { logDelete, logBulkDelete } = useCRUDAudit();
  const { userRole } = useUserRole();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
  // Get owner parameter from URL - "me" means filter by current user
  const ownerParam = searchParams.get('owner');
  const fromDateParam = searchParams.get('from');
  const toDateParam = searchParams.get('to');
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [dateFromFilter, setDateFromFilter] = useState<string | null>(fromDateParam);
  const [dateToFilter, setDateToFilter] = useState<string | null>(toDateParam);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Use cached auth instead of fetching user each time
  const { data: authData } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Set current user ID from cached auth
  useEffect(() => {
    if (authData) {
      setCurrentUserId(authData.id);
      if (ownerParam === 'me') {
        setOwnerFilter(authData.id);
      }
    }
  }, [authData, ownerParam]);

  // Sync statusFilter when initialStatus prop changes (from URL)
  useEffect(() => {
    setStatusFilter(initialStatus);
  }, [initialStatus]);

  // Sync ownerFilter when ownerParam changes
  useEffect(() => {
    if (ownerParam === 'me' && currentUserId) {
      setOwnerFilter(currentUserId);
    } else if (!ownerParam) {
      setOwnerFilter('all');
    }
  }, [ownerParam, currentUserId]);

  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  
  // viewId effect is moved below the leads query
  
  // Column preferences hook
  const { columns, saveColumns, isSaving } = useColumnPreferences({
    moduleName: 'leads',
    defaultColumns: defaultLeadColumns,
  });
  const [localColumns, setLocalColumns] = useState<LeadColumnConfig[]>([]);
  const [isColumnsInitialized, setIsColumnsInitialized] = useState(false);
  
  // Only initialize columns once when they first load from preferences
  useEffect(() => {
    if (columns.length > 0 && !isColumnsInitialized) {
      setLocalColumns(columns);
      setIsColumnsInitialized(true);
    }
  }, [columns, isColumnsInitialized]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [sortField, setSortField] = useState<string | null>('lead_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewAccountId, setViewAccountId] = useState<string | null>(null);
  const [accountViewOpen, setAccountViewOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState<EmailRecipient | null>(null);
  const [emailLead, setEmailLead] = useState<Lead | null>(null);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [meetingLead, setMeetingLead] = useState<Lead | null>(null);
  const navigate = useNavigate();

  const handleCreateTask = (lead: Lead) => {
    const params = new URLSearchParams({
      create: '1',
      module: 'leads',
      recordId: lead.id,
      recordName: encodeURIComponent(lead.lead_name || 'Lead'),
      return: '/leads',
      returnViewId: lead.id,
    });
    navigate(`/tasks?${params.toString()}`);
  };

  // Fetch all profiles for owner dropdown with caching
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch leads with React Query caching
  const { data: leads = [], isLoading: loading, refetch: refetchLeads } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select(`
        *,
        accounts:account_id (
          company_name
        )
      `).order('created_time', { ascending: false });
      
      if (error) throw error;
      
      // Transform data to include account_company_name
      return (data || []).map(lead => ({
        ...lead,
        account_company_name: lead.accounts?.company_name || lead.company_name || null
      })) as Lead[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - balance freshness with performance
  });

  const fetchLeads = () => {
    refetchLeads();
  };

  // Handle viewId from URL (from global search)
  const viewId = searchParams.get('viewId');
  useEffect(() => {
    if (viewId && leads.length > 0) {
      const leadToView = leads.find(l => l.id === viewId);
      if (leadToView) {
        setViewingLead(leadToView);
        setShowDetailModal(true);
        // Clear the viewId from URL after opening
        setSearchParams(prev => {
          prev.delete('viewId');
          return prev;
        }, { replace: true });
      }
    }
  }, [viewId, leads, setSearchParams]);

  useEffect(() => {
    const searchLower = debouncedSearchTerm.toLowerCase();
    let filtered = leads.filter(lead => 
      lead.lead_name?.toLowerCase().includes(searchLower) || 
      lead.company_name?.toLowerCase().includes(searchLower) || 
      lead.account_company_name?.toLowerCase().includes(searchLower) ||
      lead.email?.toLowerCase().includes(searchLower) ||
      lead.phone_no?.toLowerCase().includes(searchLower) ||
      lead.position?.toLowerCase().includes(searchLower) ||
      lead.linkedin?.toLowerCase().includes(searchLower) ||
      lead.website?.toLowerCase().includes(searchLower)
    );
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(lead => lead.lead_status === statusFilter);
    }
    
    // FIX: Use contact_owner instead of created_by for owner filtering
    if (ownerFilter !== "all") {
      filtered = filtered.filter(lead => lead.contact_owner === ownerFilter);
    }
    
    // Apply date range filtering
    if (dateFromFilter) {
      const fromDate = new Date(dateFromFilter);
      filtered = filtered.filter(lead => {
        if (!lead.created_time) return false;
        return new Date(lead.created_time) >= fromDate;
      });
    }
    if (dateToFilter) {
      const toDate = new Date(dateToFilter);
      filtered = filtered.filter(lead => {
        if (!lead.created_time) return false;
        return new Date(lead.created_time) <= toDate;
      });
    }

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        const aValue = a[sortField as keyof Lead] || '';
        const bValue = b[sortField as keyof Lead] || '';
        const comparison = aValue.toString().localeCompare(bValue.toString());
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    setFilteredLeads(filtered);
    setCurrentPage(1);
  }, [leads, debouncedSearchTerm, statusFilter, ownerFilter, dateFromFilter, dateToFilter, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    return null; // Hide sort icons but keep sorting on click
  };

  const handleDelete = async (deleteLinkedRecords: boolean = true) => {
    if (!leadToDelete?.id) {
      toast({
        title: "Error",
        description: "No lead selected for deletion",
        variant: "destructive"
      });
      return;
    }
    
    try {
      if (deleteLinkedRecords) {
        // Delete notifications by lead_id
        await supabase.from('notifications').delete().eq('lead_id', leadToDelete.id);

        // Unlink tasks from this lead (tasks can exist independently)
        await supabase.from('tasks').update({ lead_id: null }).eq('lead_id', leadToDelete.id);
      }

      // Delete the lead
      const { error } = await supabase.from('leads').delete().eq('id', leadToDelete.id);
      if (error) throw error;

      await logDelete('leads', leadToDelete.id, leadToDelete);
      
      toast({
        title: "Success",
        description: "Lead deleted successfully"
      });
      
      fetchLeads();
      setLeadToDelete(null);
      setShowDeleteDialog(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete lead",
        variant: "destructive"
      });
    }
  };

  // Bulk delete handler exposed via ref
  const handleBulkDelete = async (deleteLinkedRecords: boolean = true) => {
    if (selectedLeads.length === 0) return;
    
    setIsBulkDeleting(true);
    try {
      if (deleteLinkedRecords) {
        // Delete notifications for all selected leads
        await supabase.from('notifications').delete().in('lead_id', selectedLeads);
        
        // Unlink tasks from these leads
        await supabase.from('tasks').update({ lead_id: null }).in('lead_id', selectedLeads);
      }
      
      const { error } = await supabase.from('leads').delete().in('id', selectedLeads);
      if (error) throw error;
      
      await logBulkDelete('leads', selectedLeads.length, selectedLeads);
      
      toast({
        title: "Success",
        description: `Deleted ${selectedLeads.length} leads successfully`
      });
      
      setSelectedLeads([]);
      fetchLeads();
      onBulkDeleteComplete?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete leads",
        variant: "destructive"
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Get selected leads for email
  const getSelectedLeadsForEmail = () => {
    return leads
      .filter(lead => selectedLeads.includes(lead.id) && lead.email)
      .map(lead => ({
        id: lead.id,
        name: lead.lead_name,
        email: lead.email!,
      }));
  };

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    handleBulkDelete,
    getSelectedLeadsForEmail
  }), [selectedLeads, leads]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pageLeads = getCurrentPageLeads().slice(0, 50);
      setSelectedLeads(pageLeads.map(l => l.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    if (checked) {
      setSelectedLeads(prev => [...prev, leadId]);
    } else {
      setSelectedLeads(prev => prev.filter(id => id !== leadId));
    }
  };

  const getCurrentPageLeads = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(startIndex, startIndex + itemsPerPage);
  };

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);

  // Get owner IDs for display names - use contact_owner
  const ownerIds = useMemo(() => {
    return [...new Set([
      ...leads.map(l => l.contact_owner).filter(Boolean),
      ...leads.map(l => l.created_by).filter(Boolean)
    ])];
  }, [leads]);

  const { displayNames } = useUserDisplayNames(ownerIds);
  
  // Memoize visible columns to prevent position changes on re-render
  const visibleColumns = useMemo(() => moveFieldToEnd(
    localColumns.filter((col) => col.visible).sort((a, b) => a.order - b.order),
    "contact_owner",
  ), [localColumns]);
  const pageLeads = getCurrentPageLeads();

  // Check if any filters are active
  const hasActiveFilters = debouncedSearchTerm !== "" || statusFilter !== "all" || ownerFilter !== "all" || dateFromFilter !== null || dateToFilter !== null;

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setOwnerFilter("all");
    setDateFromFilter(null);
    setDateToFilter(null);
    setSearchParams({});
  };

  const handleConvertToDeal = (lead: Lead) => {
    setLeadToConvert(lead);
    setShowConvertModal(true);
  };

  const handleConvertSuccess = async () => {
    if (leadToConvert) {
      try {
        const { error } = await supabase.from('leads').update({
          lead_status: 'Converted'
        }).eq('id', leadToConvert.id);
        
        if (!error) {
          // Invalidate cache to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['leads'] });
        }
      } catch (error) {
        // Silent fail for status update
      }
    }
    fetchLeads();
    setLeadToConvert(null);
  };


  const handleViewLead = (lead: Lead) => {
    setViewingLead(lead);
    setShowDetailModal(true);
  };

  // Generate initials from lead name
  const getLeadInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join('');
  };

  // Generate consistent vibrant color from name (matching Accounts pattern)
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-amber-600', 
      'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600'
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Header and Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
            <Input 
              placeholder="Search leads..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="pl-9" 
              inputSize="control" 
            />
          </div>
          <LeadStatusFilter value={statusFilter} onValueChange={setStatusFilter} />
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Lead Owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lead Owners</SelectItem>
              {allProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.full_name || 'Unknown'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {/* Table */}
      <Card className="flex-1 min-h-0 flex flex-col">
        <div className="relative overflow-auto flex-1 min-h-0">
          {loading ? (
            <TableSkeleton columns={visibleColumns.length + 2} rows={10} />
          ) : (
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow className="sticky top-0 z-20 bg-muted border-b-2 shadow-sm">
                  <TableHead className="w-[50px] text-center font-bold text-foreground bg-muted">
                    <div className="flex justify-center">
                      <Checkbox 
                        checked={selectedLeads.length > 0 && selectedLeads.length === Math.min(pageLeads.length, 50)} 
                        onCheckedChange={handleSelectAll} 
                      />
                    </div>
                  </TableHead>
                  {visibleColumns.map(column => {
                    // Define fixed widths for each column type
                    const getColumnWidth = (field: string) => {
                      switch (field) {
                        case 'lead_name': return 'w-[150px]';
                        case 'account_company_name': return 'w-[140px]';
                        case 'position': return 'w-[130px]';
                        case 'email': return 'w-[180px]';
                        case 'phone_no': return 'w-[120px]';
                        case 'lead_status': return 'w-[100px]';
                        case 'contact_source': return 'w-[100px]';
                        case 'linkedin': return 'w-[100px]';
                        case 'created_time': return 'w-[150px]';
                        case 'last_contacted_at': return 'w-[150px]';
                        case 'contact_owner': return 'w-[150px]';
                        default: return 'w-[120px]';
                      }
                    };
                    return (
                      <TableHead 
                        key={column.field} 
                        className={`${getColumnWidth(column.field)} text-left font-bold text-foreground px-4 py-3 whitespace-nowrap bg-muted`}
                      >
                        <div 
                          className="group flex items-center gap-2 cursor-pointer hover:text-primary" 
                          onClick={() => handleSort(column.field)}
                        >
                          {column.label}
                          {getSortIcon(column.field)}
                        </div>
                      </TableHead>
                    );
                  })}
                  <TableHead className="w-[100px] text-center font-bold text-foreground px-4 py-3 bg-muted">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length + 2} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <FileText className="w-10 h-10 text-muted-foreground/50" />
                        <div>
                          <p className="font-medium text-foreground">No leads found</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {hasActiveFilters ? "Try adjusting your search or filter criteria" : "Get started by adding your first lead"}
                          </p>
                        </div>
                        {hasActiveFilters ? (
                          <Button size="sm" variant="outline" onClick={clearAllFilters} className="mt-2">
                            Clear filters
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => setShowModal(true)} className="mt-2">
                            <Plus className="w-4 h-4 mr-1" />
                            Add First Lead
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pageLeads.map(lead => (
                    <TableRow 
                      key={lead.id} 
                      className={`group hover:bg-muted/30 border-b transition-colors ${selectedLeads.includes(lead.id) ? 'bg-primary/5' : ''}`}
                      data-state={selectedLeads.includes(lead.id) ? "selected" : undefined}
                    >
                      <TableCell className="text-center px-4 py-3">
                        <div className="flex justify-center">
                          <Checkbox 
                            checked={selectedLeads.includes(lead.id)} 
                            onCheckedChange={checked => handleSelectLead(lead.id, checked as boolean)} 
                          />
                        </div>
                      </TableCell>
                      {visibleColumns.map(column => (
                        <TableCell 
                          key={column.field} 
                          className="text-left px-4 py-3 align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                        >
                          {column.field === 'lead_name' ? (
                            <button 
                              onClick={() => handleViewLead(lead)} 
                              className="text-primary hover:underline font-medium text-left truncate"
                            >
                              <HighlightedText text={lead.lead_name} highlight={debouncedSearchTerm} />
                            </button>
                          ) : column.field === 'account_company_name' ? (
                            <button 
                              onClick={() => {
                                if (lead.account_id) {
                                  setViewAccountId(lead.account_id);
                                  setAccountViewOpen(true);
                                }
                              }} 
                              className="text-primary hover:underline font-medium text-left truncate block w-full"
                              title={lead.account_company_name || undefined}
                            >
                              <HighlightedText text={lead.account_company_name} highlight={debouncedSearchTerm} />
                            </button>
                          ) : column.field === 'contact_owner' ? (
                            lead.contact_owner ? (
                              <span className="truncate block">
                                {displayNames[lead.contact_owner] || "Loading..."}
                              </span>
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )
                          ) : column.field === 'lead_status' ? (
                            lead.lead_status ? (
                              <Badge variant="outline" className={getLeadStatusColor(lead.lead_status)}>
                                {lead.lead_status}
                              </Badge>
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )
                          ) : column.field === 'email' ? (
                            lead.email ? (
                              <HighlightedText text={lead.email} highlight={debouncedSearchTerm} />
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )
                          ) : column.field === 'phone_no' ? (
                            lead.phone_no ? (
                              <HighlightedText text={lead.phone_no} highlight={debouncedSearchTerm} />
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )
                          ) : column.field === 'position' ? (
                            lead.position ? (
                              <HighlightedText text={lead.position} highlight={debouncedSearchTerm} />
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )
                          ) : column.field === 'created_time' || column.field === 'modified_time' || column.field === 'last_contacted_at' ? (
                            lead[column.field as keyof Lead] ? (
                              <span className="text-sm">{formatDateTimeStandard(lead[column.field as keyof Lead] as string)}</span>
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )
                          ) : (
                            lead[column.field as keyof Lead] ? (
                              <span className="truncate block" title={lead[column.field as keyof Lead]?.toString()}>
                                {lead[column.field as keyof Lead]}
                              </span>
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="w-20 px-4 py-3">
                        <div className="flex items-center justify-center">
                          <RowActionsDropdown
                            actions={[
                              {
                                label: "View Details",
                                icon: <Eye className="w-4 h-4" />,
                                onClick: () => handleViewLead(lead)
                              },
                              {
                                label: "Edit",
                                icon: <Edit className="w-4 h-4" />,
                                onClick: () => {
                                  setEditingLead(lead);
                                  setShowModal(true);
                                }
                              },
                              {
                                label: "Send Email",
                                icon: <Mail className="w-4 h-4" />,
                                onClick: () => {
                                  setEmailLead(lead);
                                  setEmailRecipient({
                                    name: lead.lead_name,
                                    email: lead.email,
                                    company_name: lead.company_name || lead.account_company_name,
                                    position: lead.position,
                                  });
                                  setEmailModalOpen(true);
                                },
                                disabled: !lead.email
                              },
                              {
                                label: "Create Meeting",
                                icon: <CalendarPlus className="w-4 h-4" />,
                                onClick: () => {
                                  setMeetingLead(lead);
                                  setMeetingModalOpen(true);
                                }
                              },
                              {
                                label: "Create Task",
                                icon: <CheckSquare className="w-4 h-4" />,
                                onClick: () => handleCreateTask(lead)
                              },
                              ...(userRole !== 'user' ? [{
                                label: "Convert to Deal",
                                icon: <RefreshCw className="w-4 h-4" />,
                                onClick: () => handleConvertToDeal(lead),
                                disabled: lead.lead_status === 'Converted',
                                separator: true
                              }] : []),
                              {
                                label: "Delete",
                                icon: <Trash2 className="w-4 h-4" />,
                                onClick: () => {
                                  setLeadToDelete(lead);
                                  setShowDeleteDialog(true);
                                },
                                destructive: true,
                                separator: userRole === 'user'
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
          )}
        </div>
        
        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Showing {filteredLeads.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredLeads.length)} of {filteredLeads.length} leads
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1 || totalPages === 0}>
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0}>
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Modals */}
      <LeadModal 
        open={showModal} 
        onOpenChange={setShowModal} 
        lead={editingLead} 
        onSuccess={() => {
          fetchLeads();
          setEditingLead(null);
        }} 
      />

      <LeadDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        lead={viewingLead}
        onUpdate={fetchLeads}
        onEdit={(lead) => {
          setShowDetailModal(false);
          setEditingLead(lead);
          setShowModal(true);
        }}
      />

      <LeadColumnCustomizer 
        open={showColumnCustomizer} 
        onOpenChange={setShowColumnCustomizer} 
        columns={localColumns} 
        onColumnsChange={setLocalColumns} 
        onSave={saveColumns} 
        isSaving={isSaving} 
      />

      <ConvertToDealModal 
        open={showConvertModal} 
        onOpenChange={setShowConvertModal} 
        lead={leadToConvert} 
        onSuccess={handleConvertSuccess} 
      />

      <LeadDeleteConfirmDialog
        open={showDeleteDialog} 
        onConfirm={handleDelete} 
        onCancel={() => {
          setShowDeleteDialog(false);
          setLeadToDelete(null);
        }} 
        leadName={leadToDelete?.lead_name} 
      />

      <AccountDetailModalById 
        open={accountViewOpen} 
        onOpenChange={setAccountViewOpen} 
        accountId={viewAccountId} 
      />

      <SendEmailModal
        open={emailModalOpen}
        onOpenChange={(open) => {
          setEmailModalOpen(open);
          if (!open) setEmailLead(null);
        }}
        recipient={emailRecipient}
        leadId={emailLead?.id}
      />

      <MeetingModal
        open={meetingModalOpen}
        onOpenChange={setMeetingModalOpen}
        meeting={meetingLead ? {
          id: '',
          subject: `Meeting with ${meetingLead.lead_name}`,
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          lead_id: meetingLead.id,
          status: 'scheduled'
        } : null}
        onSuccess={() => {
          setMeetingModalOpen(false);
          setMeetingLead(null);
        }}
      />
    </div>
  );
});

LeadTable.displayName = 'LeadTable';

export default LeadTable;
