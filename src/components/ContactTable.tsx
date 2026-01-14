import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCRUDAudit } from "@/hooks/useCRUDAudit";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, X, Eye, User, CalendarPlus, Pencil, CheckSquare } from "lucide-react";
import { RowActionsDropdown, Edit, Trash2, Mail, UserPlus } from "./RowActionsDropdown";
import { ContactDeleteConfirmDialog } from "./ContactDeleteConfirmDialog";

import { ContactModal } from "./ContactModal";
import { ContactColumnCustomizer, ContactColumnConfig, defaultContactColumns } from "./ContactColumnCustomizer";
import { ContactDetailModal } from "./contacts/ContactDetailModal";
import { AccountDetailModalById } from "./accounts/AccountDetailModalById";
import { SendEmailModal } from "./SendEmailModal";
import { MeetingModal } from "./MeetingModal";
import { ConvertContactToLeadModal } from "./contacts/ConvertContactToLeadModal";
import { MergeRecordsModal } from "./shared/MergeRecordsModal";
import { HighlightedText } from "./shared/HighlightedText";
import { ClearFiltersButton } from "./shared/ClearFiltersButton";
import { TableSkeleton } from "./shared/Skeletons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moveFieldToEnd } from "@/utils/columnOrderUtils";
import { formatDateTimeStandard } from "@/utils/formatUtils";

// Export ref interface for parent component
export interface ContactTableRef {
  handleBulkDelete: () => Promise<void>;
  getSelectedContactsForEmail: () => Contact[];
}

interface Contact {
  id: string;
  contact_name: string;
  company_name?: string;
  account_id?: string;
  account_company_name?: string;
  position?: string;
  email?: string;
  phone_no?: string;
  mobile_no?: string;
  city?: string;
  state?: string;
  contact_owner?: string;
  created_time?: string;
  modified_time?: string;
  lead_status?: string;
  contact_source?: string;
  linkedin?: string;
  description?: string;
  annual_revenue?: number;
  no_of_employees?: number;
  created_by?: string;
  modified_by?: string;
  tags?: string[];
  email_opens?: number;
  engagement_score?: number;
  last_contacted_at?: string;
}

interface ContactTableProps {
  showColumnCustomizer: boolean;
  setShowColumnCustomizer: (show: boolean) => void;
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  selectedContacts: string[];
  setSelectedContacts: React.Dispatch<React.SetStateAction<string[]>>;
  refreshTrigger?: number;
  onBulkDeleteComplete?: () => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const ContactTable = forwardRef<ContactTableRef, ContactTableProps>(({
  showColumnCustomizer,
  setShowColumnCustomizer,
  showModal,
  setShowModal,
  selectedContacts,
  setSelectedContacts,
  refreshTrigger,
  onBulkDeleteComplete
}, ref) => {
  const { toast } = useToast();
  const { logDelete, logBulkDelete } = useCRUDAudit();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Column preferences hook
  const { columns, saveColumns, isSaving } = useColumnPreferences({
    moduleName: 'contacts',
    defaultColumns: defaultContactColumns,
  });
  const [localColumns, setLocalColumns] = useState<ContactColumnConfig[]>([]);
  const [isColumnsInitialized, setIsColumnsInitialized] = useState(false);

  // Only initialize columns once when they first load from preferences
  useEffect(() => {
    if (columns.length > 0 && !isColumnsInitialized) {
      setLocalColumns(columns);
      setIsColumnsInitialized(true);
    }
  }, [columns, isColumnsInitialized]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Get parameters from URL
  const sourceParam = searchParams.get('source');
  const ownerParam = searchParams.get('owner');
  
  const [sourceFilter, setSourceFilter] = useState<string>(() => sourceParam || "all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  
  const [tagFilter, setTagFilter] = useState<string | null>(null);

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

  // Sync filters when URL changes
  useEffect(() => {
    if (sourceParam) setSourceFilter(sourceParam);
  }, [sourceParam]);

  useEffect(() => {
    if (ownerParam === 'me' && currentUserId) {
      setOwnerFilter(currentUserId);
    } else if (!ownerParam) {
      setOwnerFilter('all');
    }
  }, [ownerParam, currentUserId]);

  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  
  // viewId effect is moved below the contacts query
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortField, setSortField] = useState<string | null>('contact_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
  // Modal states
  const [viewAccountId, setViewAccountId] = useState<string | null>(null);
  const [accountViewOpen, setAccountViewOpen] = useState(false);
  const [emailContact, setEmailContact] = useState<Contact | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [meetingContact, setMeetingContact] = useState<Contact | null>(null);
  
  // Convert to Lead modal states
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [contactToConvert, setContactToConvert] = useState<Contact | null>(null);
  
  // Merge modal states
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState<string>("");
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  
  const navigate = useNavigate();

  const handleCreateTask = (contact: Contact) => {
    const params = new URLSearchParams({
      create: '1',
      module: 'contacts',
      recordId: contact.id,
      recordName: encodeURIComponent(contact.contact_name || 'Contact'),
      return: '/contacts',
      returnViewId: contact.id,
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

  // Fetch contacts with React Query caching
  const { data: contacts = [], isLoading: loading, refetch: refetchContacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          accounts:account_id (
            company_name,
            industry,
            region
          )
        `)
        .order('created_time', { ascending: false });

      if (error) throw error;

      // Transform data to include account fields
      return (data || []).map(contact => ({
        ...contact,
        account_company_name: contact.accounts?.company_name || contact.company_name || null,
        account_industry: contact.accounts?.industry,
        account_region: contact.accounts?.region,
      })) as Contact[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const fetchContacts = () => {
    refetchContacts();
  };

  // Handle viewId from URL (from global search)
  const viewId = searchParams.get('viewId');
  useEffect(() => {
    if (viewId && contacts.length > 0) {
      const contactToView = contacts.find(c => c.id === viewId);
      if (contactToView) {
        setViewingContact(contactToView);
        setShowDetailModal(true);
        // Clear the viewId from URL after opening
        setSearchParams(prev => {
          prev.delete('viewId');
          return prev;
        }, { replace: true });
      }
    }
  }, [viewId, contacts, setSearchParams]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    handleBulkDelete,
    getSelectedContactsForEmail: () => {
      return contacts.filter(
        contact => selectedContacts.includes(contact.id) && contact.email
      );
    }
  }), [selectedContacts, contacts]);

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchContacts();
    }
  }, [refreshTrigger]);

  // Filter and sort contacts
  useEffect(() => {
    const searchLower = debouncedSearchTerm.toLowerCase();
    let filtered = contacts.filter(contact =>
      contact.contact_name?.toLowerCase().includes(searchLower) ||
      contact.company_name?.toLowerCase().includes(searchLower) ||
      contact.account_company_name?.toLowerCase().includes(searchLower) ||
      contact.email?.toLowerCase().includes(searchLower) ||
      contact.phone_no?.toLowerCase().includes(searchLower) ||
      contact.linkedin?.toLowerCase().includes(searchLower) ||
      contact.description?.toLowerCase().includes(searchLower) ||
      contact.position?.toLowerCase().includes(searchLower) ||
      contact.tags?.some(tag => tag.toLowerCase().includes(searchLower))
    );

    // Apply source filter
    if (sourceFilter && sourceFilter !== "all") {
      filtered = filtered.filter(contact =>
        contact.contact_source?.toLowerCase() === sourceFilter.toLowerCase()
      );
    }

    // Apply owner filter
    if (ownerFilter && ownerFilter !== "all") {
      filtered = filtered.filter(contact => contact.contact_owner === ownerFilter);
    }


    // Apply tag filter
    if (tagFilter) {
      filtered = filtered.filter(contact => contact.tags?.includes(tagFilter));
    }

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        const aValue = a[sortField as keyof Contact] || '';
        const bValue = b[sortField as keyof Contact] || '';

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const comparison = aValue.toString().localeCompare(bValue.toString());
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    setFilteredContacts(filtered);
    setCurrentPage(1);
  }, [contacts, debouncedSearchTerm, sourceFilter, ownerFilter, tagFilter, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    return null; // Hide sort icons but keep sorting on click
  };

  const handleDelete = async (id: string) => {
    try {
      const contactToDelete = contacts.find(c => c.id === id);

      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await logDelete('contacts', id, contactToDelete);

      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });

      fetchContacts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive",
      });
    }
  };

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedContacts.length === 0) return;

    setIsBulkDeleting(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', selectedContacts);

      if (error) throw error;

      await logBulkDelete('contacts', selectedContacts.length, selectedContacts);

      toast({
        title: "Success",
        description: `Deleted ${selectedContacts.length} contacts successfully`
      });

      setSelectedContacts([]);
      fetchContacts();
      onBulkDeleteComplete?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contacts",
        variant: "destructive"
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleConvertToLead = (contact: Contact) => {
    setContactToConvert(contact);
    setConvertModalOpen(true);
  };

  const handleMergeLeads = (contactId: string, leadId: string) => {
    // For now, we'll just show a toast - full merge functionality would require more complex handling
    // since we're merging contact -> lead (different entities)
    toast({
      title: "Merge Feature",
      description: "Contact-to-Lead merge functionality will open the lead for review.",
    });
    // Navigate to lead or open lead detail
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pageContactIds = pageContacts.slice(0, 50).map(c => c.id);
      setSelectedContacts(pageContactIds);
    } else {
      setSelectedContacts([]);
    }
  };

  const handleSelectContact = (contactId: string, checked: boolean) => {
    if (checked) {
      setSelectedContacts(prev => [...prev, contactId]);
    } else {
      setSelectedContacts(prev => prev.filter(id => id !== contactId));
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setShowModal(true);
  };

  const handleViewContact = (contact: Contact) => {
    setViewingContact(contact);
    setShowDetailModal(true);
  };

  const visibleColumns = moveFieldToEnd(
    localColumns.filter((col) => col.visible).sort((a, b) => a.order - b.order),
    "contact_owner",
  );
  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const pageContacts = filteredContacts.slice(startIndex, startIndex + itemsPerPage);

  // Get owner IDs for display names
  const ownerIds = useMemo(() => {
    return [...new Set([
      ...contacts.map(c => c.contact_owner).filter(Boolean),
      ...contacts.map(c => c.created_by).filter(Boolean)
    ])];
  }, [contacts]);

  const { displayNames } = useUserDisplayNames(ownerIds);

  // Check if any filters are active
  const hasActiveFilters = debouncedSearchTerm !== "" || sourceFilter !== "all" || ownerFilter !== "all" || tagFilter !== null;

  const clearAllFilters = () => {
    setSearchTerm("");
    setSourceFilter("all");
    setOwnerFilter("all");
    setTagFilter(null);
  };

  // Generate initials from contact name
  const getContactInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join('');
  };

  // Generate consistent color from name
  // Generate consistent vibrant color from name (matching Accounts pattern)
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-amber-600', 
      'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600'
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  const getDisplayValue = (contact: Contact, columnField: string) => {
    if (columnField === 'contact_owner') {
      if (!contact.contact_owner) return '-';
      return displayNames[contact.contact_owner] || "Loading...";
    } else if (columnField === 'created_by') {
      if (!contact.created_by) return '-';
      return displayNames[contact.created_by] || "Loading...";
    } else if (columnField === 'created_time' || columnField === 'modified_time') {
      const dateValue = contact[columnField as keyof Contact];
      if (!dateValue) return '-';
      return formatDateTimeStandard(dateValue as string);
    }
    return contact[columnField as keyof Contact] || '-';
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Header and Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
            <Input
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
              inputSize="control"
            />
          </div>

          <Select value={sourceFilter || "all"} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="Website">Website</SelectItem>
              <SelectItem value="Referral">Referral</SelectItem>
              <SelectItem value="LinkedIn">LinkedIn</SelectItem>
              <SelectItem value="Cold Call">Cold Call</SelectItem>
              <SelectItem value="Trade Show">Trade Show</SelectItem>
              <SelectItem value="Email Campaign">Email Campaign</SelectItem>
              <SelectItem value="Social Media">Social Media</SelectItem>
              <SelectItem value="Partner">Partner</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {allProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.full_name || 'Unknown'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          

          {tagFilter && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Tag: {tagFilter}
              <button onClick={() => setTagFilter(null)} className="ml-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          <ClearFiltersButton hasActiveFilters={hasActiveFilters} onClear={clearAllFilters} />
        </div>

        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show:</span>
          <Select value={itemsPerPage.toString()} onValueChange={(val) => setItemsPerPage(Number(val))}>
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map(size => (
                <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
              ))}
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
                    <Checkbox
                      checked={selectedContacts.length > 0 && selectedContacts.length === Math.min(pageContacts.length, 50)}
                      onCheckedChange={handleSelectAll}
                    />
                  </div>
                </TableHead>
                {visibleColumns.map(column => (
                  <TableHead
                    key={column.field}
                    className={`font-bold text-foreground px-4 py-3 whitespace-nowrap bg-muted ${column.field === 'contact_name' ? 'text-left' : 'text-center'}`}
                  >
                    <div
                      className={`group flex items-center gap-2 cursor-pointer hover:text-primary ${column.field === 'contact_name' ? 'justify-start' : 'justify-center'}`}
                      onClick={() => handleSort(column.field)}
                    >
                      {column.label}
                      {getSortIcon(column.field)}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold text-foreground w-32 px-4 py-3 bg-muted">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 2} className="p-0">
                    <TableSkeleton columns={visibleColumns.length + 2} rows={10} />
                  </TableCell>
                </TableRow>
              ) : pageContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 2} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <User className="w-10 h-10 opacity-50" />
                      <p>No contacts found</p>
                      {hasActiveFilters && (
                        <Button variant="link" size="sm" onClick={clearAllFilters}>
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pageContacts.map(contact => (
                  <TableRow
                    key={contact.id}
                    className={`hover:bg-muted/30 border-b group transition-colors ${selectedContacts.includes(contact.id) ? 'bg-primary/5' : ''}`}
                    data-state={selectedContacts.includes(contact.id) ? "selected" : undefined}
                  >
                    <TableCell className="text-center px-4 py-3">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={checked => handleSelectContact(contact.id, checked as boolean)}
                        />
                      </div>
                    </TableCell>
                    {visibleColumns.map(column => (
                      <TableCell
                        key={column.field}
                        className={`px-4 py-3 align-middle whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] ${column.field === 'contact_name' ? 'text-left' : 'text-center'}`}
                      >
                        {column.field === 'contact_name' ? (
                          <button
                            onClick={() => {
                              setViewingContact(contact);
                              setShowDetailModal(true);
                            }}
                            className="text-primary hover:underline font-medium text-left truncate"
                          >
                            <HighlightedText text={contact.contact_name} highlight={debouncedSearchTerm} />
                          </button>
                        ) : column.field === 'company_name' || column.field === 'account_company_name' ? (
                          contact.account_company_name ? (
                            <button
                              onClick={() => {
                                if (contact.account_id) {
                                  setViewAccountId(contact.account_id);
                                  setAccountViewOpen(true);
                                }
                              }}
                              className="text-primary hover:underline font-medium text-left truncate max-w-[200px]"
                              title={contact.account_company_name}
                            >
                              <HighlightedText text={contact.account_company_name} highlight={debouncedSearchTerm} />
                            </button>
                          ) : (
                            <HighlightedText text={contact.company_name} highlight={debouncedSearchTerm} />
                          )
                        ) : column.field === 'email' ? (
                          <HighlightedText text={contact.email} highlight={debouncedSearchTerm} />
                        ) : column.field === 'contact_owner' ? (
                          contact.contact_owner ? (
                            <span className="truncate block">
                              {displayNames[contact.contact_owner] || "Loading..."}
                            </span>
                          ) : (
                            <span className="text-center text-muted-foreground w-full block">-</span>
                          )
                        ) : column.field === 'tags' && contact.tags && contact.tags.length > 0 ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1">
                                  <Badge
                                    variant="outline"
                                    className="text-xs truncate max-w-[100px] cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                    onClick={() => setTagFilter(contact.tags![0])}
                                  >
                                    {contact.tags[0]}
                                  </Badge>
                                  {contact.tags.length > 1 && (
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      +{contact.tags.length - 1}
                                    </Badge>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="z-50">
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium text-xs">All tags:</span>
                                  <div className="flex flex-wrap gap-1 max-w-[280px]">
                                    {contact.tags.map((tag, idx) => (
                                      <Badge
                                        key={idx}
                                        variant="secondary"
                                        className="text-xs cursor-pointer"
                                        onClick={() => setTagFilter(tag)}
                                      >
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : column.field === 'engagement_score' ? (
                          contact.engagement_score != null ? (
                            <span className={`font-medium ${contact.engagement_score >= 70 ? 'text-green-600 dark:text-green-400' : contact.engagement_score >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                              {contact.engagement_score}
                            </span>
                          ) : (
                            <span className="text-center text-muted-foreground w-full block">-</span>
                          )
                        ) : column.field === 'email_opens' ? (
                          <span className="text-center w-full block">{contact.email_opens ?? 0}</span>
                        ) : column.field === 'last_contacted_at' ? (
                          contact.last_contacted_at ? (
                            <span className="text-sm">{formatDateTimeStandard(contact.last_contacted_at)}</span>
                          ) : (
                            <span className="text-center text-muted-foreground w-full block">-</span>
                          )
                        ) : (
                          getDisplayValue(contact, column.field) && getDisplayValue(contact, column.field) !== '-' ? (
                            <span className="truncate block" title={String(getDisplayValue(contact, column.field))}>
                              {getDisplayValue(contact, column.field)}
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
                              label: "View",
                              icon: <Eye className="w-4 h-4" />,
                              onClick: () => handleViewContact(contact)
                            },
                            {
                              label: "Edit",
                              icon: <Pencil className="w-4 h-4" />,
                              onClick: () => handleEditContact(contact)
                            },
                            {
                              label: "Send Email",
                              icon: <Mail className="w-4 h-4" />,
                              onClick: () => {
                                setEmailContact(contact);
                                setEmailModalOpen(true);
                              },
                              disabled: !contact.email
                            },
                            {
                              label: "Create Meeting",
                              icon: <CalendarPlus className="w-4 h-4" />,
                              onClick: () => {
                                setMeetingContact(contact);
                                setMeetingModalOpen(true);
                              }
                            },
                            {
                              label: "Create Task",
                              icon: <CheckSquare className="w-4 h-4" />,
                              onClick: () => handleCreateTask(contact),
                              separator: true
                            },
                            {
                              label: "Convert to Lead",
                              icon: <UserPlus className="w-4 h-4" />,
                              onClick: () => handleConvertToLead(contact)
                            },
                            {
                              label: "Delete",
                              icon: <Trash2 className="w-4 h-4" />,
                              onClick: () => {
                                setContactToDelete(contact.id);
                                setShowDeleteDialog(true);
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
              Showing {filteredContacts.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredContacts.length)} of {filteredContacts.length} contacts
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

      {/* Modals */}
      <ContactModal
        open={showModal}
        onOpenChange={open => {
          setShowModal(open);
          if (!open) setEditingContact(null);
        }}
        contact={editingContact}
        onSuccess={() => {
          fetchContacts();
          setEditingContact(null);
        }}
      />

      <ContactDetailModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        contact={viewingContact as any}
        onUpdate={fetchContacts}
        onEdit={(contact) => {
          setShowDetailModal(false);
          setEditingContact(contact);
          setShowModal(true);
        }}
      />

      <ContactColumnCustomizer
        open={showColumnCustomizer}
        onOpenChange={setShowColumnCustomizer}
        columns={localColumns}
        onColumnsChange={setLocalColumns}
        onSave={saveColumns}
        isSaving={isSaving}
      />

      <ContactDeleteConfirmDialog
        open={showDeleteDialog}
        onConfirm={() => {
          if (contactToDelete) {
            handleDelete(contactToDelete);
            setContactToDelete(null);
          }
          setShowDeleteDialog(false);
        }}
        onCancel={() => {
          setShowDeleteDialog(false);
          setContactToDelete(null);
        }}
      />

      {/* Account View Modal */}
      <AccountDetailModalById open={accountViewOpen} onOpenChange={setAccountViewOpen} accountId={viewAccountId} />

      {/* Send Email Modal */}
      <SendEmailModal
        open={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        recipient={emailContact ? {
          name: emailContact.contact_name,
          email: emailContact.email,
          company_name: emailContact.company_name,
          position: emailContact.position
        } : null}
        contactId={emailContact?.id}
        onEmailSent={fetchContacts}
      />

      {/* Meeting Modal */}
      <MeetingModal
        open={meetingModalOpen}
        onOpenChange={setMeetingModalOpen}
        meeting={meetingContact ? {
          id: '',
          subject: `Meeting with ${meetingContact.contact_name}`,
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          contact_id: meetingContact.id,
          status: 'scheduled'
        } : null}
        onSuccess={() => {
          setMeetingModalOpen(false);
          setMeetingContact(null);
          fetchContacts();
        }}
      />

      {/* Convert to Lead Modal */}
      <ConvertContactToLeadModal
        open={convertModalOpen}
        onOpenChange={setConvertModalOpen}
        contact={contactToConvert}
        onSuccess={() => {
          fetchContacts();
          setContactToConvert(null);
        }}
        onMergeLead={handleMergeLeads}
      />

      {/* Merge Records Modal */}
      <MergeRecordsModal
        open={mergeModalOpen}
        onOpenChange={setMergeModalOpen}
        entityType="contacts"
        sourceId={mergeSourceId}
        targetId={mergeTargetId}
        onSuccess={fetchContacts}
      />
    </div>
  );
});

ContactTable.displayName = "ContactTable";
