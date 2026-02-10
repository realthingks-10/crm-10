import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCRUDAudit } from "@/hooks/useCRUDAudit";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { useLeadColumnWidths } from "@/hooks/useLeadColumnWidths";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreHorizontal, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, ListTodo } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { LeadModal } from "./LeadModal";
import { LeadColumnCustomizer, LeadColumnConfig } from "./LeadColumnCustomizer";
import { ConvertToDealModal } from "./ConvertToDealModal";
import { LeadActionItemsModal } from "./LeadActionItemsModal";
import { LeadDeleteConfirmDialog } from "./LeadDeleteConfirmDialog";
import { StandardPagination } from "./shared/StandardPagination";
import { fetchPaginatedData } from "@/utils/supabasePagination";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  lead_name: string;
  company_name?: string;
  position?: string;
  email?: string;
  phone_no?: string;
  country?: string;
  contact_owner?: string;
  created_time?: string;
  modified_time?: string;
  lead_status?: string;
  industry?: string;
  contact_source?: string;
  linkedin?: string;
  website?: string;
  description?: string;
  created_by?: string;
  modified_by?: string;
}

const defaultColumns: LeadColumnConfig[] = [
  { field: 'lead_name', label: 'Lead Name', visible: true, order: 0 },
  { field: 'company_name', label: 'Account', visible: true, order: 1 },
  { field: 'position', label: 'Position', visible: true, order: 2 },
  { field: 'email', label: 'Email', visible: true, order: 3 },
  { field: 'phone_no', label: 'Phone', visible: true, order: 4 },
  { field: 'country', label: 'Region', visible: true, order: 5 },
  { field: 'contact_owner', label: 'Lead Owner', visible: true, order: 6 },
  { field: 'lead_status', label: 'Lead Status', visible: true, order: 7 },
  { field: 'industry', label: 'Industry', visible: true, order: 8 },
  { field: 'contact_source', label: 'Source', visible: true, order: 9 },
];

interface LeadTableProps {
  showColumnCustomizer: boolean;
  setShowColumnCustomizer: (show: boolean) => void;
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  selectedLeads: string[];
  setSelectedLeads: React.Dispatch<React.SetStateAction<string[]>>;
  searchTerm?: string;
  setSearchTerm?: (term: string) => void;
  statusFilter?: string;
  setStatusFilter?: (status: string) => void;
  highlightId?: string | null;
  clearHighlight?: () => void;
}

const LeadTable = ({
  showColumnCustomizer,
  setShowColumnCustomizer,
  showModal,
  setShowModal,
  selectedLeads,
  setSelectedLeads,
  searchTerm = "",
  setSearchTerm,
  statusFilter = "New",
  setStatusFilter,
  highlightId,
  clearHighlight
}: LeadTableProps) => {
  const { toast } = useToast();
  const { logDelete } = useCRUDAudit();
  const [pageLeads, setPageLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const { columns, setColumns } = useColumnPreferences<LeadColumnConfig>('leads', defaultColumns);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showActionItemsModal, setShowActionItemsModal] = useState(false);
  const [selectedLeadForActions, setSelectedLeadForActions] = useState<Lead | null>(null);
  const [highlightProcessed, setHighlightProcessed] = useState(false);
  const { columnWidths, updateColumnWidth } = useLeadColumnWidths();

  // Column resize state
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  // Column resize handlers
  const handleMouseDown = (e: React.MouseEvent, field: string) => {
    setIsResizing(field);
    setStartX(e.clientX);
    setStartWidth(columnWidths[field] || 120);
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(60, startWidth + deltaX);
    updateColumnWidth(isResizing, newWidth);
  }, [isResizing, startX, startWidth, updateColumnWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(null);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  // Reset page when status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);

      const filters: Record<string, string> = {};
      if (statusFilter && statusFilter !== 'all') {
        filters.lead_status = statusFilter;
      }

      const result = await fetchPaginatedData<Lead>('leads', {
        page: currentPage,
        pageSize: itemsPerPage,
        sortField: sortField || undefined,
        sortDirection,
        searchTerm: debouncedSearch || undefined,
        searchFields: ['lead_name', 'company_name', 'email'],
        filters,
      });

      setPageLeads(result.data);
      setTotalCount(result.totalCount);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch leads",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, sortField, sortDirection, debouncedSearch, statusFilter, toast]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Handle highlight from notification click
  useEffect(() => {
    if (highlightId && pageLeads.length > 0 && !loading && !highlightProcessed) {
      const lead = pageLeads.find(l => l.id === highlightId);
      if (lead) {
        setEditingLead(lead);
        setShowModal(true);
      } else {
        toast({
          title: "Lead not found",
          description: "The lead you're looking for may have been deleted.",
        });
      }
      clearHighlight?.();
      setHighlightProcessed(true);
    }
  }, [highlightId, pageLeads, loading, highlightProcessed, clearHighlight, setShowModal, toast]);

  useEffect(() => {
    if (highlightId) {
      setHighlightProcessed(false);
    }
  }, [highlightId]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-muted-foreground/60" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-foreground" /> 
      : <ArrowDown className="w-3 h-3 text-foreground" />;
  };

  const handleDelete = async (deleteLinkedRecords: boolean = true) => {
    if (!leadToDelete || !leadToDelete.id) {
      toast({
        title: "Error",
        description: "No lead selected for deletion",
        variant: "destructive"
      });
      return;
    }
    
    try {
      if (deleteLinkedRecords) {
        await supabase.from('notifications').delete().eq('lead_id', leadToDelete.id);
        const { data: actionItems } = await supabase.from('lead_action_items').select('id').eq('lead_id', leadToDelete.id);
        if (actionItems && actionItems.length > 0) {
          const actionItemIds = actionItems.map(item => item.id);
          await supabase.from('notifications').delete().in('action_item_id', actionItemIds);
        }
        await supabase.from('lead_action_items').delete().eq('lead_id', leadToDelete.id);
      }

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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
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

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const createdByIds = useMemo(() => {
    return [...new Set(pageLeads.map(l => l.created_by).filter(Boolean))];
  }, [pageLeads]);

  const { displayNames } = useUserDisplayNames(createdByIds);
  const visibleColumns = columns.filter(col => col.visible);

  const handleConvertToDeal = (lead: Lead) => {
    setLeadToConvert(lead);
    setShowConvertModal(true);
  };

  const handleConvertSuccess = async () => {
    if (leadToConvert) {
      try {
        const { error } = await supabase.from('leads').update({ lead_status: 'Converted' }).eq('id', leadToConvert.id);
        if (!error) {
          setPageLeads(prevLeads => prevLeads.map(lead => 
            lead.id === leadToConvert.id ? { ...lead, lead_status: 'Converted' } : lead
          ));
        }
      } catch (error) {
        console.error("Error updating lead status:", error);
      }
    }
    fetchLeads();
    setLeadToConvert(null);
  };

  const handleActionItems = (lead: Lead) => {
    setSelectedLeadForActions(lead);
    setShowActionItemsModal(true);
  };

  const getLeadStatusDotColor = (status: string | undefined) => {
    switch (status) {
      case 'New': return 'bg-blue-500';
      case 'Contacted': return 'bg-yellow-500';
      case 'Converted': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Table Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className={cn("overflow-auto", isResizing && "select-none")}>
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="bg-muted/50 hover:bg-muted/60 border-b-2">
                <TableHead className="w-12 text-center font-bold text-foreground bg-muted/50 py-3">
                  <div className="flex justify-center">
                    <Checkbox 
                      checked={selectedLeads.length > 0 && selectedLeads.length === pageLeads.length} 
                      onCheckedChange={handleSelectAll} 
                    />
                  </div>
                </TableHead>
                {visibleColumns.map(column => (
                  <TableHead 
                    key={column.field} 
                    className={cn(
                      "relative text-left font-bold text-foreground bg-muted/50 px-4 py-3 whitespace-nowrap",
                      sortField === column.field && "bg-accent"
                    )}
                    style={{ width: `${columnWidths[column.field] || 120}px`, minWidth: column.field === 'lead_name' ? '150px' : '60px' }}
                  >
                    <div 
                      className="flex items-center gap-2 cursor-pointer hover:text-primary" 
                      onClick={() => handleSort(column.field)}
                    >
                      {column.label}
                      {getSortIcon(column.field)}
                    </div>
                    {/* Resize handle */}
                    <div 
                      className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/40 active:bg-primary/60" 
                      onMouseDown={e => handleMouseDown(e, column.field)} 
                    />
                  </TableHead>
                ))}
                <TableHead className="w-20 bg-muted/50 py-3"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && pageLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 2} className="text-center py-8">
                    Loading leads...
                  </TableCell>
                </TableRow>
              ) : pageLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + 2} className="text-center py-8">
                    No leads found
                  </TableCell>
                </TableRow>
              ) : (
                pageLeads.map(lead => (
                  <TableRow key={lead.id} className="group hover:bg-muted/30 border-b">
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
                        style={{ width: `${columnWidths[column.field] || 120}px`, maxWidth: `${columnWidths[column.field] || 200}px` }}
                      >
                        {column.field === 'lead_name' ? (
                          <button 
                            onClick={() => { setEditingLead(lead); setShowModal(true); }} 
                            className="text-[#2e538e] hover:underline font-normal text-left truncate block w-full"
                          >
                            {lead[column.field as keyof Lead] || '-'}
                          </button>
                        ) : column.field === 'contact_owner' ? (
                          <span className="truncate block">
                            {lead.created_by ? displayNames[lead.created_by] || "Loading..." : '-'}
                          </span>
                        ) : column.field === 'lead_status' && lead.lead_status ? (
                          <div className="flex items-center gap-1.5">
                            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', getLeadStatusDotColor(lead.lead_status))} />
                            <span>{lead.lead_status}</span>
                          </div>
                        ) : (
                          <span className="truncate block" title={lead[column.field as keyof Lead]?.toString() || '-'}>
                            {lead[column.field as keyof Lead] || '-'}
                          </span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="py-3 px-2">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingLead(lead); setShowModal(true); }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setLeadToConvert(lead); setShowConvertModal(true); }}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Convert to Deal
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedLeadForActions(lead); setShowActionItemsModal(true); }}>
                              <ListTodo className="h-4 w-4 mr-2" />
                              Action Items
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setLeadToDelete(lead); setShowDeleteDialog(true); }} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Always show pagination */}
      <StandardPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalCount}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => { setItemsPerPage(size); setCurrentPage(1); }}
        entityName="leads"
      />

      {/* Modals */}
      <LeadModal 
        open={showModal} 
        onOpenChange={(open) => { setShowModal(open); if (!open) setEditingLead(null); }} 
        lead={editingLead} 
        onSuccess={fetchLeads} 
      />

      <LeadColumnCustomizer 
        open={showColumnCustomizer} 
        onOpenChange={setShowColumnCustomizer} 
        columns={columns} 
        onColumnsChange={setColumns} 
      />

      <ConvertToDealModal 
        open={showConvertModal} 
        onOpenChange={setShowConvertModal} 
        lead={leadToConvert} 
        onSuccess={handleConvertSuccess} 
      />

      <LeadDeleteConfirmDialog
        open={showDeleteDialog}
        onCancel={() => { setShowDeleteDialog(false); setLeadToDelete(null); }}
        leadName={leadToDelete?.lead_name || ''}
        onConfirm={handleDelete}
      />

      <LeadActionItemsModal 
        open={showActionItemsModal} 
        onOpenChange={setShowActionItemsModal} 
        lead={selectedLeadForActions} 
      />
    </div>
  );
};

export default LeadTable;
