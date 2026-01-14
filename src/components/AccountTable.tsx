import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCRUDAudit } from "@/hooks/useCRUDAudit";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, X, Eye, Building2, Pencil, CheckSquare } from "lucide-react";
import { RowActionsDropdown, Edit, Trash2 } from "./RowActionsDropdown";
import { AccountModal } from "./AccountModal";
import { AccountColumnCustomizer, AccountColumnConfig, defaultAccountColumns } from "./AccountColumnCustomizer";
import { AccountStatusFilter } from "./AccountStatusFilter";
import { AccountDeleteConfirmDialog } from "./AccountDeleteConfirmDialog";
import { AccountDetailModal } from "./accounts/AccountDetailModal";
import { HighlightedText } from "./shared/HighlightedText";
import { getAccountStatusColor } from "@/utils/accountStatusUtils";
import { moveFieldToEnd } from "@/utils/columnOrderUtils";
import { formatDateTimeStandard } from "@/utils/formatUtils";
import { ClearFiltersButton } from "./shared/ClearFiltersButton";
import { TableSkeleton } from "./shared/Skeletons";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Export ref interface for parent component
export interface AccountTableRef {
  handleBulkDelete: () => Promise<void>;
}
export interface Account {
  id: string;
  company_name: string;
  region?: string;
  country?: string;
  website?: string;
  company_type?: string;
  tags?: string[];
  status?: string;
  notes?: string;
  account_owner?: string;
  industry?: string;
  phone?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  modified_by?: string;
  deal_count?: number;
  contact_count?: number;
  lead_count?: number;
}
interface AccountTableProps {
  showColumnCustomizer: boolean;
  setShowColumnCustomizer: (show: boolean) => void;
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  selectedAccounts: string[];
  setSelectedAccounts: React.Dispatch<React.SetStateAction<string[]>>;
  onBulkDeleteComplete?: () => void;
  initialStatus?: string;
}
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const AccountTable = forwardRef<AccountTableRef, AccountTableProps>(({
  showColumnCustomizer,
  setShowColumnCustomizer,
  showModal,
  setShowModal,
  selectedAccounts,
  setSelectedAccounts,
  onBulkDeleteComplete,
  initialStatus = "all"
}, ref) => {
  const {
    toast
  } = useToast();
  const {
    logDelete
  } = useCRUDAudit();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Column preferences hook
  const {
    columns,
    saveColumns,
    isSaving
  } = useColumnPreferences({
    moduleName: 'accounts',
    defaultColumns: defaultAccountColumns
  });
  const [localColumns, setLocalColumns] = useState<AccountColumnConfig[]>([]);
  const [isColumnsInitialized, setIsColumnsInitialized] = useState(false);

  // Only initialize columns once when they first load from preferences
  useEffect(() => {
    if (columns.length > 0 && !isColumnsInitialized) {
      setLocalColumns(columns);
      setIsColumnsInitialized(true);
    }
  }, [columns, isColumnsInitialized]);

  // Get owner parameter from URL - "me" means filter by current user
  const ownerParam = searchParams.get('owner');
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Use cached auth instead of fetching user each time
  const { data: authData } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - user rarely changes
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
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortField, setSortField] = useState<string | null>('company_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewingAccount, setViewingAccount] = useState<Account | null>(null);
  const [detailModalDefaultTab, setDetailModalDefaultTab] = useState("overview");
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const navigate = useNavigate();

  const handleCreateTask = (account: Account) => {
    const params = new URLSearchParams({
      create: '1',
      module: 'accounts',
      recordId: account.id,
      recordName: encodeURIComponent(account.company_name || 'Account'),
      return: '/accounts',
      returnViewId: account.id,
    });
    navigate(`/tasks?${params.toString()}`);
  };

  // viewId effect is moved below the accounts query

  // Fetch all profiles for owner dropdown
  const {
    data: allProfiles = []
  } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const {
        data
      } = await supabase.from('profiles').select('id, full_name');
      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch accounts with React Query caching - PARALLELIZED counts
  const { data: accounts = [], isLoading: loading, refetch: refetchAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      // Run all queries in parallel for faster loading
      const [accountsResult, contactCountsResult, dealCountsResult, leadCountsResult] = await Promise.all([
        supabase.from('accounts').select('*').order('created_at', { ascending: false }),
        supabase.from('contacts').select('account_id').not('account_id', 'is', null),
        supabase.from('deals').select('account_id').not('account_id', 'is', null),
        supabase.from('leads').select('account_id').not('account_id', 'is', null),
      ]);

      if (accountsResult.error) throw accountsResult.error;

      // Calculate counts from parallel results
      const contactCountMap = (contactCountsResult.data || []).reduce((acc, c) => {
        if (c.account_id) acc[c.account_id] = (acc[c.account_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const dealCountMap = (dealCountsResult.data || []).reduce((acc, d) => {
        if (d.account_id) acc[d.account_id] = (acc[d.account_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const leadCountMap = (leadCountsResult.data || []).reduce((acc, l) => {
        if (l.account_id) acc[l.account_id] = (acc[l.account_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Merge counts into accounts
      return (accountsResult.data || []).map(account => ({
        ...account,
        contact_count: account.contact_count || contactCountMap[account.id] || 0,
        deal_count: account.deal_count || dealCountMap[account.id] || 0,
        lead_count: leadCountMap[account.id] || 0,
      })) as Account[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const fetchAccounts = () => {
    refetchAccounts();
  };

  // Handle viewId and tab from URL (from global search or return from Tasks)
  const viewId = searchParams.get('viewId');
  const tabParam = searchParams.get('tab');
  useEffect(() => {
    if (viewId && accounts.length > 0) {
      const accountToView = accounts.find(a => a.id === viewId);
      if (accountToView) {
        setViewingAccount(accountToView);
        // Set the tab if provided (e.g., returning from Tasks module)
        if (tabParam) {
          setDetailModalDefaultTab(tabParam);
        }
        setShowDetailModal(true);
        // Clear the viewId and tab from URL after opening
        setSearchParams(prev => {
          prev.delete('viewId');
          prev.delete('tab');
          return prev;
        }, {
          replace: true
        });
      }
    }
  }, [viewId, tabParam, accounts, setSearchParams]);

  // Expose handleBulkDelete to parent via ref
  useImperativeHandle(ref, () => ({
    handleBulkDelete
  }), [selectedAccounts, accounts]);

  useEffect(() => {
    const searchLower = searchTerm.toLowerCase();
    let filtered = accounts.filter(account => account.company_name?.toLowerCase().includes(searchLower) || account.industry?.toLowerCase().includes(searchLower) || account.country?.toLowerCase().includes(searchLower) || account.email?.toLowerCase().includes(searchLower) || account.phone?.toLowerCase().includes(searchLower) || account.website?.toLowerCase().includes(searchLower) || account.notes?.toLowerCase().includes(searchLower) || account.company_type?.toLowerCase().includes(searchLower) || account.region?.toLowerCase().includes(searchLower) || account.tags?.some(tag => tag.toLowerCase().includes(searchLower)));
    if (statusFilter !== "all") {
      filtered = filtered.filter(account => account.status === statusFilter);
    }

    // FIX: Use account_owner instead of created_by for owner filtering
    if (ownerFilter !== "all") {
      filtered = filtered.filter(account => account.account_owner === ownerFilter);
    }
    if (tagFilter) {
      filtered = filtered.filter(account => account.tags?.includes(tagFilter));
    }
    if (sortField) {
      filtered.sort((a, b) => {
        const aValue = a[sortField as keyof Account] || '';
        const bValue = b[sortField as keyof Account] || '';

        // Handle numeric sorting for counts
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        const comparison = aValue.toString().localeCompare(bValue.toString());
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    setFilteredAccounts(filtered);
    setCurrentPage(1);
  }, [accounts, searchTerm, statusFilter, ownerFilter, tagFilter, sortField, sortDirection]);
  
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
  const handleDelete = async () => {
    if (!accountToDelete?.id) return;
    try {
      // Check for linked contacts/leads
      const {
        data: linkedContacts
      } = await supabase.from('contacts').select('id').eq('account_id', accountToDelete.id).limit(1);
      const {
        data: linkedLeads
      } = await supabase.from('leads').select('id').eq('account_id', accountToDelete.id).limit(1);
      if (linkedContacts && linkedContacts.length > 0 || linkedLeads && linkedLeads.length > 0) {
        toast({
          title: "Cannot Delete",
          description: "This account has linked contacts or leads. Please unlink them first.",
          variant: "destructive"
        });
        setShowDeleteDialog(false);
        return;
      }
      const {
        error
      } = await supabase.from('accounts').delete().eq('id', accountToDelete.id);
      if (error) throw error;
      await logDelete('accounts', accountToDelete.id, accountToDelete);
      toast({
        title: "Success",
        description: "Account deleted successfully"
      });
      fetchAccounts();
      setAccountToDelete(null);
      setShowDeleteDialog(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
        variant: "destructive"
      });
    }
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedAccounts.length === 0) return;
    setIsBulkDeleting(true);
    try {
      // Check for linked entities for all selected accounts
      const {
        data: linkedContacts
      } = await supabase.from('contacts').select('account_id').in('account_id', selectedAccounts);
      const {
        data: linkedLeads
      } = await supabase.from('leads').select('account_id').in('account_id', selectedAccounts);
      const accountsWithLinks = new Set([...(linkedContacts || []).map(c => c.account_id), ...(linkedLeads || []).map(l => l.account_id)]);
      const deletableAccounts = selectedAccounts.filter(id => !accountsWithLinks.has(id));
      const skippedCount = selectedAccounts.length - deletableAccounts.length;
      if (deletableAccounts.length === 0) {
        toast({
          title: "Cannot Delete",
          description: "All selected accounts have linked contacts or leads.",
          variant: "destructive"
        });
        setIsBulkDeleting(false);
        return;
      }
      const {
        error
      } = await supabase.from('accounts').delete().in('id', deletableAccounts);
      if (error) throw error;

      // Log deletions
      for (const id of deletableAccounts) {
        const account = accounts.find(a => a.id === id);
        if (account) {
          await logDelete('accounts', id, account);
        }
      }
      toast({
        title: "Success",
        description: skippedCount > 0 ? `Deleted ${deletableAccounts.length} accounts. ${skippedCount} skipped (have linked records).` : `Deleted ${deletableAccounts.length} accounts successfully`
      });
      setSelectedAccounts([]);
      fetchAccounts();
      onBulkDeleteComplete?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete accounts",
        variant: "destructive"
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pageAccounts = getCurrentPageAccounts().slice(0, 50);
      setSelectedAccounts(pageAccounts.map(a => a.id));
    } else {
      setSelectedAccounts([]);
    }
  };
  const handleSelectAccount = (accountId: string, checked: boolean) => {
    if (checked) {
      setSelectedAccounts(prev => [...prev, accountId]);
    } else {
      setSelectedAccounts(prev => prev.filter(id => id !== accountId));
    }
  };
  const getCurrentPageAccounts = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAccounts.slice(startIndex, startIndex + itemsPerPage);
  };
  const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);

  // Get owner IDs for display names - use account_owner instead of created_by
  const ownerIds = useMemo(() => {
    return [...new Set(accounts.map(a => a.account_owner).filter(Boolean))];
  }, [accounts]);
  const {
    displayNames
  } = useUserDisplayNames(ownerIds);
  const visibleColumns = moveFieldToEnd(
    localColumns.filter((col) => col.visible).sort((a, b) => a.order - b.order),
    "account_owner",
  );
  const pageAccounts = getCurrentPageAccounts();

  // Check if any filters are active
  const hasActiveFilters = searchTerm !== "" || statusFilter !== "all" || ownerFilter !== "all" || tagFilter !== null;
  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setOwnerFilter("all");
    setTagFilter(null);
  };

  // Generate initials from company name
  const getCompanyInitials = (name: string) => {
    return name.split(' ').slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');
  };

  // Generate consistent vibrant color from company name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-amber-600', 
      'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600'
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };
  const formatCurrency = (value?: number): React.ReactNode => {
    if (!value) return <span className="block text-center w-full">-</span>;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value);
  };
  return <div className="flex flex-col h-full space-y-3">
      {/* Header and Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
            <Input placeholder="Search accounts..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" inputSize="control" />
          </div>
          <AccountStatusFilter value={statusFilter} onValueChange={setStatusFilter} />
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {allProfiles.map(profile => <SelectItem key={profile.id} value={profile.id}>
                  {profile.full_name || 'Unknown'}
                </SelectItem>)}
            </SelectContent>
          </Select>
          
          {tagFilter && <Badge variant="secondary" className="flex items-center gap-1">
              Tag: {tagFilter}
              <button onClick={() => setTagFilter(null)} className="ml-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>}
          
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
          <Table>
            <TableHeader>
              <TableRow className="sticky top-0 z-20 bg-muted border-b-2 shadow-sm">
                <TableHead className="w-12 text-center font-bold text-foreground bg-muted">
                  <div className="flex justify-center">
                    <Checkbox checked={selectedAccounts.length > 0 && selectedAccounts.length === Math.min(pageAccounts.length, 50)} onCheckedChange={handleSelectAll} />
                  </div>
                </TableHead>
                {visibleColumns.map(column => <TableHead key={column.field} className={`${column.field === 'company_name' || column.field === 'email' ? 'text-left' : 'text-center'} font-bold text-foreground px-4 py-3 whitespace-nowrap bg-muted`}>
                    <div onClick={() => handleSort(column.field)} className={`group gap-2 cursor-pointer hover:text-primary flex items-center ${column.field === 'company_name' || column.field === 'email' ? 'justify-start' : 'justify-center'}`}>
                      {column.label}
                      {getSortIcon(column.field)}
                    </div>
                  </TableHead>)}
                <TableHead className="text-center font-bold text-foreground w-32 px-4 py-3 bg-muted">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow>
                  <TableCell colSpan={visibleColumns.length + 2} className="p-0">
                    <TableSkeleton columns={visibleColumns.length + 2} rows={10} />
                  </TableCell>
                </TableRow> : pageAccounts.length === 0 ? <TableRow>
                  <TableCell colSpan={visibleColumns.length + 2} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Building2 className="w-10 h-10 opacity-50" />
                      <p>No accounts found</p>
                      {hasActiveFilters && <Button variant="link" size="sm" onClick={clearAllFilters}>
                          Clear filters
                        </Button>}
                    </div>
                  </TableCell>
                </TableRow> : pageAccounts.map(account => <TableRow key={account.id} className={`hover:bg-muted/30 border-b group transition-colors ${selectedAccounts.includes(account.id) ? 'bg-primary/5' : ''}`} data-state={selectedAccounts.includes(account.id) ? "selected" : undefined}>
                    <TableCell className="text-center px-4 py-3">
                      <div className="flex justify-center">
                        <Checkbox checked={selectedAccounts.includes(account.id)} onCheckedChange={checked => handleSelectAccount(account.id, checked as boolean)} />
                      </div>
                    </TableCell>
                    {visibleColumns.map(column => <TableCell key={column.field} className={`${column.field === 'company_name' || column.field === 'email' ? 'text-left' : 'text-center'} px-4 py-3 align-middle whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]`}>
                        {column.field === 'company_name' ? <button onClick={() => {
                    setViewingAccount(account);
                    setDetailModalDefaultTab("overview");
                    setShowDetailModal(true);
                  }} className="text-primary hover:underline font-medium text-left truncate">
                              <HighlightedText text={account.company_name} highlight={searchTerm} />
                            </button> : column.field === 'account_owner' ? (
                            account.account_owner ? (
                              <span className="truncate block">{displayNames[account.account_owner] || "Loading..."}</span>
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )
                          ) : column.field === 'status' ? (
                            account.status ? (
                              <Badge variant="outline" className={`whitespace-nowrap ${getAccountStatusColor(account.status)}`}>{account.status}</Badge>
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )
                          ) : column.field === 'deal_count' ? (
                            <button 
                              onClick={() => {
                                setViewingAccount(account);
                                setDetailModalDefaultTab("associations");
                                setShowDetailModal(true);
                              }}
                              className="text-center w-full block text-primary hover:underline cursor-pointer"
                            >
                              {account.deal_count ?? 0}
                            </button>
                          ) : column.field === 'contact_count' ? (
                            <button 
                              onClick={() => {
                                setViewingAccount(account);
                                setDetailModalDefaultTab("associations");
                                setShowDetailModal(true);
                              }}
                              className="text-center w-full block text-primary hover:underline cursor-pointer"
                            >
                              {account.contact_count ?? 0}
                            </button>
                          ) : column.field === 'lead_count' ? (
                            <button 
                              onClick={() => {
                                setViewingAccount(account);
                                setDetailModalDefaultTab("associations");
                                setShowDetailModal(true);
                              }}
                              className="text-center w-full block text-primary hover:underline cursor-pointer"
                            >
                              {account.lead_count ?? 0}
                            </button>
                          ) : column.field === 'tags' ? (account.tags && account.tags.length > 0 ? <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-xs truncate max-w-[100px] cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors" onClick={() => setTagFilter(account.tags![0])}>
                                    {account.tags[0]}
                                  </Badge>
                                  {account.tags.length > 1 && <Badge variant="outline" className="text-xs shrink-0">
                                      +{account.tags.length - 1}
                                    </Badge>}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="z-50">
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium text-xs">All tags:</span>
                                  <div className="flex flex-wrap gap-1 max-w-[280px]">
                                    {account.tags.map((tag, idx) => <Badge key={idx} variant="secondary" className="text-xs cursor-pointer" onClick={() => setTagFilter(tag)}>
                                        {tag}
                                      </Badge>)}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider> : <span className="text-center text-muted-foreground w-full block">-</span>) : column.field === 'website' ? (
                            account.website ? (
                              <a href={account.website.startsWith('http') ? account.website : `https://${account.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                <span className="truncate max-w-[150px]">{account.website.replace(/^https?:\/\//, '')}</span>
                              </a>
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )
                          ) : column.field === 'industry' ? (
                            account.industry ? (
                              <HighlightedText text={account.industry} highlight={searchTerm} />
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )
                          ) : column.field === 'country' ? (
                            account.country ? (
                              <HighlightedText text={account.country} highlight={searchTerm} />
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )
                          ) : column.field === 'email' ? (
                            account.email ? (
                              <HighlightedText text={account.email} highlight={searchTerm} />
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )
                          ) : column.field === 'created_at' || column.field === 'updated_at' ? (
                            account[column.field as keyof Account] ? (
                              <span className="text-sm">{formatDateTimeStandard(account[column.field as keyof Account] as string)}</span>
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )
                          ) : (
                            account[column.field as keyof Account] ? (
                              <span title={account[column.field as keyof Account]?.toString()} className="truncate block">{account[column.field as keyof Account]?.toString()}</span>
                            ) : (
                              <span className="text-center text-muted-foreground w-full block">-</span>
                            )
                          )}
                      </TableCell>)}
                    <TableCell className="w-20 px-4 py-3">
                      <div className="flex items-center justify-center">
                        <RowActionsDropdown actions={[
                          {
                            label: "View",
                            icon: <Eye className="w-4 h-4" />,
                            onClick: () => {
                              setViewingAccount(account);
                              setShowDetailModal(true);
                            }
                          },
                          {
                            label: "Edit",
                            icon: <Edit className="w-4 h-4" />,
                            onClick: () => {
                              setEditingAccount(account);
                              setShowModal(true);
                            }
                          },
                          {
                            label: "Create Task",
                            icon: <CheckSquare className="w-4 h-4" />,
                            onClick: () => handleCreateTask(account)
                          },
                          {
                            label: "Delete",
                            icon: <Trash2 className="w-4 h-4" />,
                            onClick: () => {
                              setAccountToDelete(account);
                              setShowDeleteDialog(true);
                            },
                            destructive: true,
                            separator: true
                          }
                        ]} />
                      </div>
                    </TableCell>
                  </TableRow>)}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Showing {filteredAccounts.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAccounts.length)} of {filteredAccounts.length} accounts
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
      <AccountModal open={showModal} onOpenChange={open => {
      setShowModal(open);
      if (!open) setEditingAccount(null);
    }} account={editingAccount} onSuccess={() => {
      fetchAccounts();
      setEditingAccount(null);
    }} />

      <AccountColumnCustomizer open={showColumnCustomizer} onOpenChange={setShowColumnCustomizer} columns={localColumns} onColumnsChange={setLocalColumns} onSave={saveColumns} isSaving={isSaving} />

      <AccountDeleteConfirmDialog open={showDeleteDialog} onConfirm={handleDelete} onCancel={() => {
      setShowDeleteDialog(false);
      setAccountToDelete(null);
    }} isMultiple={false} count={1} />

      <AccountDetailModal 
        open={showDetailModal} 
        onOpenChange={(open) => {
          setShowDetailModal(open);
          if (!open) setDetailModalDefaultTab("overview");
        }} 
        account={viewingAccount} 
        onUpdate={fetchAccounts} 
        onEdit={account => {
          setShowDetailModal(false);
          setEditingAccount(account);
          setShowModal(true);
        }}
        defaultTab={detailModalDefaultTab}
      />

    </div>;
});
AccountTable.displayName = "AccountTable";
export default AccountTable;