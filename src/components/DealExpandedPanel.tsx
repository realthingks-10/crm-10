import { useState, useMemo } from "react";
import { X, Plus, Clock, History, ListTodo, ChevronDown, ChevronRight, Eye, Pencil, ArrowRight, RefreshCw, Check, ArrowUpDown, ArrowUp, ArrowDown, MessageSquarePlus, Phone, Mail, Calendar, FileText, User, MoreHorizontal, Trash2, CheckCircle, Handshake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
// Checkbox import removed - using serial numbers instead
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAllUsers } from "@/hooks/useUserDisplayNames";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Deal } from "@/types/deal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
  import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import { useAuth } from "@/hooks/useAuth";

interface DealExpandedPanelProps {
  deal: Deal;
  onClose: () => void;
   onOpenActionItemModal?: (actionItem?: any) => void;
}

 interface AuditLog {
   id: string;
   action: string;
   details: Record<string, unknown> | null;
   created_at: string;
   user_id: string | null;
 }
 
 interface ActionItem {
   id: string;
   title: string;
   status: string;
   priority: string;
   due_date: string | null;
   assigned_to: string | null;
   created_at: string;
   module_type: string;
   module_id: string | null;
 }
 
// Log types with icons
const LOG_TYPES = [
  { value: 'Note', label: 'Note', icon: FileText },
  { value: 'Call', label: 'Call', icon: Phone },
  { value: 'Meeting', label: 'Meeting', icon: Calendar },
  { value: 'Email', label: 'Email', icon: Mail },
] as const;

type LogType = typeof LOG_TYPES[number]['value'];

// Format date/time for table display: HH:mm dd-MM-yy
const formatHistoryDateTime = (date: Date): string => {
  return format(date, 'HH:mm dd-MM-yy');
};

// Format a value for display
const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') {
    // Don't stringify objects - they should be rendered by renderFormattedDetails
    return '[See details]';
   }
  return String(value);
};

// Parse field_changes from audit log details
interface FieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

const parseFieldChanges = (details: Record<string, unknown> | null): FieldChange[] => {
  if (!details) return [];
  
  const fieldChanges = details.field_changes as Record<string, { old: unknown; new: unknown }> | undefined;
  if (fieldChanges && typeof fieldChanges === 'object') {
    return Object.entries(fieldChanges)
      .filter(([key]) => !['modified_at', 'modified_by', 'id'].includes(key))
      .map(([field, change]) => ({
        field: field.replace(/_/g, ' '),
        oldValue: formatValue(change?.old),
        newValue: formatValue(change?.new),
      }));
  }
  
  // Fallback: parse updated_fields or old_data if field_changes not available
  const oldData = details.old_data as Record<string, unknown> | undefined;
  const updatedFields = details.updated_fields as Record<string, unknown> | undefined;
  
  if (updatedFields && oldData) {
    return Object.keys(updatedFields)
      .filter(key => !['modified_at', 'modified_by', 'id'].includes(key))
      .map(field => ({
        field: field.replace(/_/g, ' '),
        oldValue: formatValue(oldData[field]),
        newValue: formatValue(updatedFields[field]),
      }));
  }
  
  // Final fallback: only show scalar values, skip nested objects (handled by renderFormattedDetails)
  return Object.entries(details)
    .filter(([key, value]) => 
      !['modified_at', 'modified_by', 'id', 'field_changes', 'old_data', 'updated_fields', 'record_data', 'timestamp'].includes(key) &&
      (typeof value !== 'object' || value === null)
    )
    .map(([field, value]) => ({
      field: field.replace(/_/g, ' '),
      oldValue: '-',
      newValue: formatValue(value),
    }));
};

// Parse audit log details to show human-readable summary
const parseChangeSummary = (action: string, details: Record<string, unknown> | null): string => {
  if (!details || typeof details !== 'object') return action === 'create' ? 'Created deal' : action;
  
  const changes = parseFieldChanges(details);
  if (changes.length === 0) return action === 'create' ? 'Created deal' : 'Updated';
  
  // For stage changes, show old → new
  const stageChange = changes.find(c => c.field === 'stage');
  if (stageChange) {
    return `${stageChange.oldValue} → ${stageChange.newValue}`;
  }
  
  // Show first change with arrow
  const first = changes[0];
  if (changes.length === 1) {
    return `${first.field}: ${first.oldValue} → ${first.newValue}`;
  }
  return `${first.field} +${changes.length - 1}`;
 };
 
 export const DealExpandedPanel = ({ deal, onClose, onOpenActionItemModal }: DealExpandedPanelProps) => {
  const { user } = useAuth();
   const [historyOpen, setHistoryOpen] = useState(true);
   const [actionsOpen, setActionsOpen] = useState(true);
    const [detailLogId, setDetailLogId] = useState<string | null>(null);
    const [actionItemSortField, setActionItemSortField] = useState<string>('status');
    const [actionItemSortDirection, setActionItemSortDirection] = useState<'asc' | 'desc'>('asc');
    const queryClient = useQueryClient();
    
    // Add Log dialog state
    const [addLogOpen, setAddLogOpen] = useState(false);
    const [logType, setLogType] = useState<LogType>('Note');
    const [logMessage, setLogMessage] = useState('');
    const [isSavingLog, setIsSavingLog] = useState(false);

    // Action items inline editing state
    // selectedActionIds removed - using serial numbers instead
    const [editingDateId, setEditingDateId] = useState<string | null>(null);

    // History section state
    const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('All');
    const [historySortField, setHistorySortField] = useState<string>('created_at');
    const [historySortDirection, setHistorySortDirection] = useState<'desc' | 'asc'>('asc');

    const { users, getUserDisplayName } = useAllUsers();

  // Fetch audit logs for the deal
   const { data: auditLogs = [], isLoading: logsLoading } = useQuery({
     queryKey: ['deal-audit-logs', deal.id],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('security_audit_log')
         .select('*')
         .eq('resource_type', 'deals')
         .eq('resource_id', deal.id)
         .order('created_at', { ascending: false })
         .limit(50);
       
       if (error) {
         console.error('Error fetching deal audit logs:', error);
         return [];
       }
       
       return (data || []) as AuditLog[];
     },
     enabled: !!deal.id,
   });
 
   // Fetch action items from unified action_items table
   const { data: actionItems = [], isLoading: itemsLoading } = useQuery({
     queryKey: ['deal-action-items-unified', deal.id],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('action_items')
         .select('*')
         .eq('module_type', 'deals')
         .eq('module_id', deal.id)
         .order('due_date', { ascending: true, nullsFirst: false });
       
       if (error) {
         console.error('Error fetching deal action items:', error);
         return [];
       }
       
       return (data || []) as ActionItem[];
     },
     enabled: !!deal.id,
   });
 
  // Extract unique user IDs from audit logs and action items
  const userIds = useMemo(() => {
    const logUserIds = auditLogs.map(log => log.user_id).filter((id): id is string => !!id);
    const actionUserIds = actionItems.map(item => item.assigned_to).filter((id): id is string => !!id);
    const ids = [...logUserIds, ...actionUserIds];
    return [...new Set(ids)];
  }, [auditLogs, actionItems]);
 
  // Fetch display names for users
  const { displayNames } = useUserDisplayNames(userIds);
 
   const isLoading = logsLoading || itemsLoading;

   // Refresh history logs
   const handleRefreshHistory = () => {
     queryClient.invalidateQueries({ queryKey: ['deal-audit-logs', deal.id] });
   };
   
   // Handle adding a manual log entry
   const handleAddLog = async () => {
     if (!logMessage.trim() || !user) return;
     
     setIsSavingLog(true);
     try {
       const { error } = await supabase
         .from('security_audit_log')
         .insert({
           action: logType.toUpperCase(),
           resource_type: 'deals',
           resource_id: deal.id,
           user_id: user.id,
           details: {
             message: logMessage.trim(),
             log_type: logType,
             manual_entry: true,
           }
         });
       
       if (error) throw error;
       
       // Refresh history
       queryClient.invalidateQueries({ queryKey: ['deal-audit-logs', deal.id] });
       
       // Reset form
       setLogMessage('');
       setLogType('Note');
       setAddLogOpen(false);
     } catch (error) {
       console.error('Error adding log:', error);
     } finally {
       setIsSavingLog(false);
     }
   };


     // History filtering and sorting
     const filteredSortedLogs = useMemo(() => {
       let logs = [...auditLogs];
       if (historyTypeFilter !== 'All') {
         logs = logs.filter(log => {
           const action = log.action.toUpperCase();
           if (historyTypeFilter === 'System') return !['NOTE', 'CALL', 'MEETING', 'EMAIL'].includes(action);
           return action === historyTypeFilter.toUpperCase();
         });
       }
       logs.sort((a, b) => {
         let aVal: any, bVal: any;
         if (historySortField === 'created_at') {
           aVal = new Date(a.created_at).getTime();
           bVal = new Date(b.created_at).getTime();
         } else if (historySortField === 'action') {
           aVal = a.action.toLowerCase();
           bVal = b.action.toLowerCase();
         } else if (historySortField === 'user_id') {
           aVal = (a.user_id ? (displayNames[a.user_id] || '') : '').toLowerCase();
           bVal = (b.user_id ? (displayNames[b.user_id] || '') : '').toLowerCase();
         } else if (historySortField === 'changes') {
           aVal = ((a.details as any)?.message || parseChangeSummary(a.action, a.details)).toLowerCase();
           bVal = ((b.details as any)?.message || parseChangeSummary(b.action, b.details)).toLowerCase();
         } else {
           aVal = new Date(a.created_at).getTime();
           bVal = new Date(b.created_at).getTime();
         }
         const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
         return historySortDirection === 'asc' ? comparison : -comparison;
       });
       return logs;
     }, [auditLogs, historyTypeFilter, historySortField, historySortDirection, displayNames]);

    const typeDotColor: Record<string, string> = {
      'NOTE': 'bg-yellow-500',
      'CALL': 'bg-blue-500',
      'MEETING': 'bg-purple-500',
      'EMAIL': 'bg-green-500',
      'update': 'bg-gray-400',
      'create': 'bg-emerald-500',
    };

    const getTypeDotColor = (action: string) => {
      return typeDotColor[action.toUpperCase()] || typeDotColor[action.toLowerCase()] || 'bg-muted-foreground';
    };

     // Sort helpers
     const handleHistorySort = (field: string) => {
       if (historySortField === field) {
         setHistorySortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
       } else {
         setHistorySortField(field);
         setHistorySortDirection('asc');
       }
     };

     const getHistorySortIcon = (field: string) => {
       if (historySortField !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/60" />;
       return historySortDirection === 'asc' 
         ? <ArrowUp className="w-3 h-3 text-foreground" /> 
         : <ArrowDown className="w-3 h-3 text-foreground" />;
     };

     const handleActionItemSort = (field: string) => {
       if (actionItemSortField === field) {
         setActionItemSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
       } else {
         setActionItemSortField(field);
         setActionItemSortDirection('asc');
       }
     };

     const getActionItemSortIcon = (field: string) => {
       if (actionItemSortField !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/60" />;
       return actionItemSortDirection === 'asc' 
         ? <ArrowUp className="w-3 h-3 text-foreground" /> 
         : <ArrowDown className="w-3 h-3 text-foreground" />;
     };

    // Sort action items
    const sortedActionItems = useMemo(() => {
      const priorityOrder: Record<string, number> = { 'High': 0, 'Medium': 1, 'Low': 2 };
      const statusOrder: Record<string, number> = { 'Open': 0, 'In Progress': 1, 'Completed': 2, 'Cancelled': 3 };
      return [...actionItems].sort((a, b) => {
        let aVal: any, bVal: any;
        if (actionItemSortField === 'due_date') {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          aVal = new Date(a.due_date).getTime();
          bVal = new Date(b.due_date).getTime();
        } else if (actionItemSortField === 'priority') {
          aVal = priorityOrder[a.priority] ?? 2;
          bVal = priorityOrder[b.priority] ?? 2;
        } else if (actionItemSortField === 'status') {
          aVal = statusOrder[a.status] ?? 99;
          bVal = statusOrder[b.status] ?? 99;
        } else if (actionItemSortField === 'title') {
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
        } else if (actionItemSortField === 'assigned_to') {
          aVal = (a.assigned_to ? (getUserDisplayName(a.assigned_to) || '') : '').toLowerCase();
          bVal = (b.assigned_to ? (getUserDisplayName(b.assigned_to) || '') : '').toLowerCase();
        } else {
          aVal = a[actionItemSortField as keyof ActionItem] || '';
          bVal = b[actionItemSortField as keyof ActionItem] || '';
        }
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return actionItemSortDirection === 'asc' ? comparison : -comparison;
      });
    }, [actionItems, actionItemSortField, actionItemSortDirection, getUserDisplayName]);
 
   const handleAddActionClick = (e: React.MouseEvent) => {
     e.stopPropagation();
     if (onOpenActionItemModal) {
       onOpenActionItemModal();
    }
  };

    const handleActionItemClick = (actionItem: ActionItem) => {
      if (onOpenActionItemModal) {
        onOpenActionItemModal(actionItem);
     }
   };

    // Inline update handlers for action items
    const invalidateActionItems = () => {
      queryClient.invalidateQueries({ queryKey: ['deal-action-items-unified', deal.id] });
    };

     const handleStatusChange = async (id: string, status: string) => {
       const item = actionItems.find(i => i.id === id);
       const oldStatus = item?.status || 'Unknown';
       await supabase.from('action_items').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
       
       // Log status change in history
       try {
         await supabase.from('security_audit_log').insert({
           action: 'update',
           resource_type: 'deals',
           resource_id: deal.id,
           user_id: user?.id,
           details: {
             message: `Action item status changed: ${oldStatus} → ${status}`,
             field_changes: { status: { old: oldStatus, new: status } },
             action_item_id: id,
             action_item_title: item?.title
           }
         });
       } catch (e) {
         console.error('Failed to log status change:', e);
       }
       
       invalidateActionItems();
       queryClient.invalidateQueries({ queryKey: ['deal-audit-logs', deal.id] });
     };

    const handlePriorityChange = async (id: string, priority: string) => {
      await supabase.from('action_items').update({ priority, updated_at: new Date().toISOString() }).eq('id', id);
      invalidateActionItems();
    };

    const handleAssignedToChange = async (id: string, userId: string | null) => {
      await supabase.from('action_items').update({ assigned_to: userId, updated_at: new Date().toISOString() }).eq('id', id);
      invalidateActionItems();
    };

    const handleDueDateChange = async (id: string, date: string | null) => {
      await supabase.from('action_items').update({ due_date: date, updated_at: new Date().toISOString() }).eq('id', id);
      invalidateActionItems();
    };

    const handleDeleteActionItem = async (id: string) => {
      await supabase.from('action_items').delete().eq('id', id);
      invalidateActionItems();
    };

    const handleDueDateBlur = (itemId: string, value: string) => {
      handleDueDateChange(itemId, value || null);
      setEditingDateId(null);
    };

     // Checkbox selection logic removed - using serial numbers

    const statusDotColor: Record<string, string> = {
      'Open': 'bg-blue-500',
      'In Progress': 'bg-yellow-500',
      'Completed': 'bg-green-500',
      'Cancelled': 'bg-muted-foreground',
    };

    const priorityDotColor: Record<string, string> = {
      'High': 'bg-red-500',
      'Medium': 'bg-yellow-500',
      'Low': 'bg-blue-500',
    };

    // Hidden internal fields
    const HIDDEN_FIELDS = new Set(['id', 'created_by', 'modified_by', 'account_id']);

    const toTitleCase = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const isUUID = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    const formatDetailValue = (key: string, val: any): string => {
      if (val === null || val === undefined) return '--';
      if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}(T|\s)/)) {
        try { return format(new Date(val), 'MMM d, yyyy h:mm a'); } catch { return val; }
      }
      if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
        try { return format(new Date(val + 'T00:00:00'), 'MMM d, yyyy'); } catch { return val; }
      }
      if (typeof val === 'string' && isUUID(val)) return val.slice(0, 8) + '…';
      if (typeof val === 'number' && (key.includes('revenue') || key.includes('contract_value') || key === 'budget')) return val.toLocaleString();
      if (typeof val === 'number' && key === 'probability') return `${val}%`;
      return String(val);
    };

    const renderFormattedDetails = (details: any) => {
      if (!details || typeof details !== 'object') return null;

      const { module, status, operation, timestamp, field_changes, old_data, updated_fields, record_data, ...rest } = details;

      // Collect record data from record_data, old_data, updated_fields, or remaining object keys
      const remainingObjectData = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
      );
      const recordData = record_data || old_data || updated_fields || (Object.keys(remainingObjectData).length > 0 ? remainingObjectData : null);

      return (
        <div className="space-y-3">
          {/* Summary badges */}
          {(module || status || operation) && (
            <div className="flex flex-wrap gap-2 items-center">
              {module && <Badge variant="outline" className="text-xs">{module}</Badge>}
              {operation && <Badge variant="secondary" className="text-xs">{operation}</Badge>}
              {status && (
                <Badge variant={status === 'Success' ? 'default' : 'destructive'} className="text-xs">
                  {status}
                </Badge>
              )}
              {timestamp && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {(() => { try { return format(new Date(timestamp), 'MMM d, yyyy h:mm a'); } catch { return timestamp; } })()}
                </span>
              )}
            </div>
          )}

          {/* Field changes table */}
          {field_changes && typeof field_changes === 'object' && Object.keys(field_changes).length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground block mb-1">Field Changes</span>
              <div className="rounded-md border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="py-1.5 px-2 text-xs h-auto">Field</TableHead>
                      <TableHead className="py-1.5 px-2 text-xs h-auto">Old Value</TableHead>
                      <TableHead className="py-1.5 px-2 text-xs h-auto w-[20px]"></TableHead>
                      <TableHead className="py-1.5 px-2 text-xs h-auto">New Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(field_changes)
                      .filter(([key]) => !HIDDEN_FIELDS.has(key))
                      .map(([key, change]: [string, any]) => (
                        <TableRow key={key}>
                          <TableCell className="py-1.5 px-2 text-xs text-muted-foreground">{toTitleCase(key)}</TableCell>
                          <TableCell className="py-1.5 px-2 text-xs">{formatDetailValue(key, change?.old)}</TableCell>
                          <TableCell className="py-1.5 px-1 w-[20px]">
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </TableCell>
                          <TableCell className="py-1.5 px-2 text-xs font-medium">{formatDetailValue(key, change?.new)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Record snapshot */}
          {recordData && typeof recordData === 'object' && (
            <div>
              <span className="text-xs font-medium text-muted-foreground block mb-1">Record Snapshot</span>
              <div className="rounded-md border border-border/50 bg-muted/10 p-2 space-y-1 max-h-48 overflow-auto">
                {Object.entries(recordData)
                  .filter(([key, val]) => !HIDDEN_FIELDS.has(key) && val !== null && val !== undefined)
                  .map(([key, val]) => (
                    <div key={key} className="flex items-start gap-2 text-xs">
                      <span className="text-muted-foreground min-w-[120px] flex-shrink-0">{toTitleCase(key)}</span>
                      <span className="text-foreground break-all">{formatDetailValue(key, val)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      );
    };

    const selectedLog = detailLogId ? auditLogs.find(l => l.id === detailLogId) : null;

  return (
     <>
      <div 
         className="h-full w-full bg-card border border-border/50 rounded-lg shadow-lg flex flex-col overflow-hidden"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
         {/* Header - Simple title only */}
         <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-muted/30 flex-shrink-0 sticky top-0 z-20">
           <span className="text-sm font-medium text-muted-foreground">Details</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
             className="h-6 w-6 p-0 hover:bg-muted"
          >
             <X className="h-4 w-4" />
          </Button>
        </div>

         {/* Content */}
         <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-1">
            {/* History Section - Collapsible with flex-1 for equal height */}
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen} className={`flex flex-col ${historyOpen ? 'flex-1' : ''} min-h-0`}>
              <CollapsibleTrigger asChild>
               <button className="w-full flex items-center gap-1.5 px-3 py-2 bg-muted/20 hover:bg-muted/40 transition-colors border-b border-border/20 group">
                  {historyOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">History</span>
                  <span className="text-xs text-muted-foreground ml-1">({filteredSortedLogs.length})</span>
                  {/* Type filter */}
                  <div onClick={e => e.stopPropagation()} className="ml-auto">
                    <Select value={historyTypeFilter} onValueChange={setHistoryTypeFilter}>
                      <SelectTrigger className="h-5 w-auto min-w-0 text-[10px] border-0 bg-transparent hover:bg-muted/50 px-1.5 gap-1 [&>svg]:h-3 [&>svg]:w-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All</SelectItem>
                        <SelectItem value="Note">Note</SelectItem>
                        <SelectItem value="Call">Call</SelectItem>
                        <SelectItem value="Meeting">Meeting</SelectItem>
                        <SelectItem value="Email">Email</SelectItem>
                        <SelectItem value="System">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddLogOpen(true);
                    }}
                  >
                    <MessageSquarePlus className="h-3 w-3" />
                    Add Log
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRefreshHistory();
                    }}
                  >
                    <RefreshCw className={`h-3 w-3 text-muted-foreground ${logsLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </button>
              </CollapsibleTrigger>
             <CollapsibleContent className="flex-1 min-h-0 collapsible-content data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                <div className="h-[280px] overflow-y-auto">
                     {isLoading ? (
                       <div className="flex items-center justify-center py-6">
                         <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                       </div>
                     ) : filteredSortedLogs.length === 0 ? (
                       <div className="flex items-center justify-center py-6 text-muted-foreground">
                         <History className="h-4 w-4 mr-2" />
                         <span className="text-xs">{historyTypeFilter !== 'All' ? 'No matching logs' : 'No history yet'}</span>
                       </div>
                     ) : (
                        <Table>
                          <TableHeader className="sticky top-0 z-10 bg-card">
                            <TableRow className="text-[11px] bg-muted/50">
                              <TableHead className="h-7 px-1 text-[11px] font-bold w-8 text-center">#</TableHead>
                              <TableHead className="h-7 px-2 text-[11px] font-bold">
                                <button className="flex items-center gap-1" onClick={() => handleHistorySort('changes')}>
                                  Changes {getHistorySortIcon('changes')}
                                </button>
                              </TableHead>
                              <TableHead className="h-7 px-2 text-[11px] font-bold w-24">
                                <button className="flex items-center gap-1" onClick={() => handleHistorySort('user_id')}>
                                  By {getHistorySortIcon('user_id')}
                                </button>
                              </TableHead>
                              <TableHead className="h-7 px-2 text-[11px] font-bold w-20">
                                <button className="flex items-center gap-1" onClick={() => handleHistorySort('action')}>
                                  Type {getHistorySortIcon('action')}
                                </button>
                              </TableHead>
                              <TableHead className="h-7 px-2 text-[11px] font-bold w-24">
                                <button className="flex items-center gap-1" onClick={() => handleHistorySort('created_at')}>
                                  Time {getHistorySortIcon('created_at')}
                                </button>
                              </TableHead>
                              <TableHead className="h-7 px-1 w-8"></TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                            {filteredSortedLogs.map((log, index) => (
                              <TableRow key={log.id} className="text-xs group cursor-pointer hover:bg-muted/30">
                                {/* Serial # */}
                                <TableCell className="py-1.5 px-1 text-[10px] text-muted-foreground text-center w-8">{index + 1}</TableCell>

                                {/* Changes - full width */}
                                <TableCell className="py-1.5 px-2">
                                  <button 
                                    onClick={() => setDetailLogId(log.id)}
                                    className="hover:underline text-left whitespace-normal break-words text-[#2e538e] font-normal text-xs"
                                  >
                                    {(log.details as any)?.message || parseChangeSummary(log.action, log.details)}
                                  </button>
                                </TableCell>

                                {/* By */}
                                <TableCell className="py-1.5 px-2 text-muted-foreground whitespace-nowrap text-[10px]">
                                  {log.user_id ? (displayNames[log.user_id] || '...') : '-'}
                                </TableCell>

                                {/* Type - colored dot + label */}
                                <TableCell className="py-1.5 px-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn('w-2 h-2 rounded-full inline-block flex-shrink-0', getTypeDotColor(log.action))} />
                                    <span className="capitalize text-[10px] text-muted-foreground">{log.action.toLowerCase()}</span>
                                  </div>
                                </TableCell>

                                {/* Time */}
                                <TableCell className="py-1.5 px-2 text-[10px] text-muted-foreground whitespace-nowrap w-24">
                                  {formatHistoryDateTime(new Date(log.created_at))}
                                </TableCell>

                                {/* Eye icon */}
                                <TableCell onClick={e => e.stopPropagation()} className="py-1.5 px-1 w-8">
                                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDetailLogId(log.id)}>
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                           ))}
                         </TableBody>
                       </Table>
                     )}
                 </div>
              </CollapsibleContent>
            </Collapsible>
 
           {/* Action Items Section - Collapsible with flex-1 for equal height */}
           <Collapsible open={actionsOpen} onOpenChange={setActionsOpen} className={`flex flex-col ${actionsOpen ? 'flex-1' : ''} min-h-0`}>
             <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-1.5 px-3 py-2 bg-muted/20 hover:bg-muted/40 transition-colors border-b border-border/20 group">
                 {actionsOpen ? (
                   <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                 ) : (
                   <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                 )}
                 <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
                 <span className="text-xs font-medium text-foreground">Action Items</span>
                 <span className="text-xs text-muted-foreground ml-1">({actionItems.length})</span>
                 <span
                   role="button"
                   tabIndex={0}
                   onClick={handleAddActionClick}
                   onKeyDown={(e) => {
                     if (e.key === "Enter" || e.key === " ") {
                       e.preventDefault();
                       handleAddActionClick(e as unknown as React.MouseEvent);
                     }
                   }}
                   className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
                   aria-label="Add action item"
                 >
                   <Plus className="h-3 w-3 text-muted-foreground" />
                 </span>
               </button>
             </CollapsibleTrigger>
            <CollapsibleContent className="flex-1 min-h-0 collapsible-content data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
               <div className="h-[280px] overflow-y-auto">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                      </div>
                    ) : actionItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                        <ListTodo className="h-4 w-4 mb-1" />
                        <span className="text-xs">No action items</span>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-xs h-6 mt-1"
                          onClick={() => onOpenActionItemModal?.()}
                        >
                          Add one
                        </Button>
                      </div>
                    ) : (
                       <Table>
                         <TableHeader className="sticky top-0 z-10 bg-card">
                           <TableRow className="text-[11px] bg-muted/50">
                             <TableHead className="h-7 px-1 text-[11px] font-bold w-8 text-center">#</TableHead>
                             <TableHead className="h-7 px-2 text-[11px] font-bold">
                                <button className="flex items-center gap-1" onClick={() => handleActionItemSort('title')}>
                                  Task {getActionItemSortIcon('title')}
                                </button>
                              </TableHead>
                              <TableHead className="h-7 px-2 text-[11px] font-bold w-20">
                                <button className="flex items-center gap-1" onClick={() => handleActionItemSort('assigned_to')}>
                                  Assigned To {getActionItemSortIcon('assigned_to')}
                                </button>
                              </TableHead>
                              <TableHead className="h-7 px-2 text-[11px] font-bold w-16">
                                <button className="flex items-center gap-1" onClick={() => handleActionItemSort('due_date')}>
                                  Due {getActionItemSortIcon('due_date')}
                                </button>
                              </TableHead>
                              <TableHead className="h-7 px-1 text-[11px] font-bold text-center" style={{ width: '6.67%', maxWidth: '6.67%' }}>
                                <button className="flex items-center gap-1 mx-auto" onClick={() => handleActionItemSort('status')}>
                                  Status {getActionItemSortIcon('status')}
                                </button>
                              </TableHead>
                              <TableHead className="h-7 px-1 text-[11px] font-bold text-center" style={{ width: '6.67%', maxWidth: '6.67%' }}>
                                <button className="flex items-center gap-1 mx-auto" onClick={() => handleActionItemSort('priority')}>
                                  Priority {getActionItemSortIcon('priority')}
                                </button>
                              </TableHead>
                              <TableHead className="h-7 px-1 text-[11px] font-bold text-center" style={{ width: '6.67%', maxWidth: '6.67%' }}>Module</TableHead>
                              <TableHead className="h-7 px-1 w-8"></TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                           {sortedActionItems.map((item, index) => (
                             <TableRow 
                               key={item.id} 
                               className="text-xs group cursor-pointer hover:bg-muted/30"
                               onClick={() => handleActionItemClick(item)}
                             >
                               {/* Serial # */}
                               <TableCell className="py-1.5 px-1 text-[10px] text-muted-foreground text-center w-8">{index + 1}</TableCell>

                              {/* Task */}
                              <TableCell className="py-1.5 px-2">
                                <button onClick={e => { e.stopPropagation(); handleActionItemClick(item); }} className="hover:underline text-left whitespace-normal break-words text-[#2e538e] font-normal text-xs">
                                  {item.title}
                                </button>
                              </TableCell>

                              {/* Assigned To */}
                              <TableCell onClick={e => e.stopPropagation()} className="py-1.5 px-2 text-xs">
                                <Select value={item.assigned_to || 'unassigned'} onValueChange={value => handleAssignedToChange(item.id, value === 'unassigned' ? null : value)}>
                                  <SelectTrigger className="h-6 w-auto min-w-0 text-[11px] border-0 bg-transparent hover:bg-muted/50 px-0 [&>svg]:hidden">
                                    <SelectValue>
                                      <span className="truncate">{item.assigned_to ? getUserDisplayName(item.assigned_to) : 'Unassigned'}</span>
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </TableCell>

                              {/* Due Date */}
                              <TableCell onClick={e => e.stopPropagation()} className="py-1.5 px-2 text-xs">
                                {editingDateId === item.id ? (
                                  <Input type="date" defaultValue={item.due_date || ''} onBlur={e => handleDueDateBlur(item.id, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleDueDateBlur(item.id, (e.target as HTMLInputElement).value); else if (e.key === 'Escape') setEditingDateId(null); }} autoFocus className="h-6 w-[110px] text-[11px]" />
                                ) : (
                                  <button onClick={() => setEditingDateId(item.id)} className="hover:underline text-[11px]">
                                    {item.due_date ? format(new Date(item.due_date), 'dd-MM-yy') : '—'}
                                  </button>
                                )}
                              </TableCell>

                              {/* Status - dot only */}
                              <TableCell onClick={e => e.stopPropagation()} className="py-1.5 px-1 text-center" style={{ width: '6.67%', maxWidth: '6.67%' }}>
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex justify-center">
                                        <Select value={item.status} onValueChange={value => handleStatusChange(item.id, value)}>
                                          <SelectTrigger className="h-6 w-6 min-w-0 border-0 bg-transparent hover:bg-muted/50 px-0 justify-center [&>svg]:hidden">
                                            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusDotColor[item.status] || 'bg-muted-foreground')} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="Open"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" />Open</div></SelectItem>
                                            <SelectItem value="In Progress"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500" />In Progress</div></SelectItem>
                                            <SelectItem value="Completed"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" />Completed</div></SelectItem>
                                            <SelectItem value="Cancelled"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-muted-foreground" />Cancelled</div></SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">{item.status}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>

                              {/* Priority - dot only */}
                              <TableCell onClick={e => e.stopPropagation()} className="py-1.5 px-1 text-center" style={{ width: '6.67%', maxWidth: '6.67%' }}>
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex justify-center">
                                        <Select value={item.priority} onValueChange={value => handlePriorityChange(item.id, value)}>
                                          <SelectTrigger className="h-6 w-6 min-w-0 border-0 bg-transparent hover:bg-muted/50 px-0 justify-center [&>svg]:hidden">
                                            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', priorityDotColor[item.priority] || 'bg-muted-foreground')} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="High"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" />High</div></SelectItem>
                                            <SelectItem value="Medium"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500" />Medium</div></SelectItem>
                                            <SelectItem value="Low"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" />Low</div></SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">{item.priority}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>

                              {/* Module - deal icon */}
                              <TableCell className="py-1.5 px-1 text-center" style={{ width: '6.67%', maxWidth: '6.67%' }}>
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex justify-center">
                                        <Handshake className="h-3.5 w-3.5 text-[#2e538e]" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Deal</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>

                              {/* Actions */}
                              <TableCell onClick={e => e.stopPropagation()} className="py-1.5 px-1">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleActionItemClick(item)}>
                                        <Pencil className="h-3.5 w-3.5 mr-2" />Edit
                                      </DropdownMenuItem>
                                      {item.status !== 'Completed' && (
                                        <DropdownMenuItem onClick={() => handleStatusChange(item.id, 'Completed')}>
                                          <CheckCircle className="h-3.5 w-3.5 mr-2" />Mark Complete
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleDeleteActionItem(item.id)} className="text-destructive focus:text-destructive">
                                        <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
       </div>
 
       {/* Detail Log Dialog - With proper field changes table */}
       <Dialog open={!!detailLogId} onOpenChange={() => setDetailLogId(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-sm">History Details</DialogTitle>
            </DialogHeader>
            {selectedLog && (() => {
              const details = selectedLog.details as Record<string, any> | null;
              const isManualEntry = details?.manual_entry === true;
              const changes = parseFieldChanges(selectedLog.details);
              const updaterName = selectedLog.user_id ? (displayNames[selectedLog.user_id] || 'Unknown') : '-';
              
              return (
                <ScrollArea className="flex-1 max-h-[calc(85vh-80px)]">
                <div className="space-y-4 text-sm pr-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-muted-foreground text-xs">Action / Type</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn('w-2 h-2 rounded-full inline-block', getTypeDotColor(selectedLog.action))} />
                        <p className="capitalize font-medium">{selectedLog.action.toLowerCase()}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Updated By</span>
                      <p className="font-medium">{updaterName}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground text-xs">Time</span>
                      <p>{format(new Date(selectedLog.created_at), 'PPpp')}</p>
                    </div>
                  </div>
                  
                  {/* Manual entry details (Note, Call, Meeting, Email) */}
                  {isManualEntry && details?.message && (
                    <div>
                      <span className="text-muted-foreground text-xs block mb-1">Message</span>
                      <p className="text-sm bg-muted/30 rounded-md p-2 whitespace-pre-wrap break-words">{String(details.message)}</p>
                    </div>
                  )}

                  {/* Action item status change details */}
                  {details?.action_item_title && (
                    <div>
                      <span className="text-muted-foreground text-xs block mb-1">Action Item</span>
                      <p className="text-sm font-medium">{String(details.action_item_title)}</p>
                    </div>
                  )}
                  
                  {/* Field changes table */}
                  {changes.length > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs block mb-2">Field Changes</span>
                      <div className="border rounded-lg overflow-hidden">
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="h-8 px-3 text-xs font-medium w-[25%]">Field</TableHead>
                              <TableHead className="h-8 px-3 text-xs font-medium w-[30%]">Old Value</TableHead>
                              <TableHead className="h-8 px-1 text-xs font-medium w-[20px]"></TableHead>
                              <TableHead className="h-8 px-3 text-xs font-medium">New Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {changes.map((change, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="py-2 px-3 text-xs font-medium capitalize break-words">
                                  {change.field}
                                </TableCell>
                                <TableCell className="py-2 px-3 text-xs text-muted-foreground whitespace-normal break-all overflow-hidden">
                                  {change.oldValue}
                                </TableCell>
                                <TableCell className="py-2 px-1 w-[20px]">
                                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                </TableCell>
                                <TableCell className="py-2 px-3 text-xs font-medium whitespace-normal break-all overflow-hidden">
                                  {change.newValue}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Show formatted details - always render when details has nested data */}
                  {!isManualEntry && details && (details.record_data || details.old_data || details.updated_fields || (selectedLog.action === 'create')) && (
                    <div>{renderFormattedDetails(details)}</div>
                  )}
                  {!isManualEntry && selectedLog.action === 'create' && !details && (
                    <p className="text-muted-foreground text-xs italic">Deal was created</p>
                  )}
                  {changes.length === 0 && !isManualEntry && selectedLog.action !== 'create' && details && !details.action_item_title && !details.record_data && !details.old_data && !details.updated_fields && (
                    <div>{renderFormattedDetails(details)}</div>
                  )}
                </div>
                </ScrollArea>
              );
            })()}
          </DialogContent>
       </Dialog>
       
       {/* Add Log Dialog */}
       <Dialog open={addLogOpen} onOpenChange={setAddLogOpen}>
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle className="text-sm flex items-center gap-2">
               <MessageSquarePlus className="h-4 w-4" />
               Add Log Entry
             </DialogTitle>
           </DialogHeader>
           <div className="space-y-4">
             <div className="space-y-2">
               <Label className="text-xs">Log Type</Label>
               <Select value={logType} onValueChange={(v) => setLogType(v as LogType)}>
                 <SelectTrigger className="h-9">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   {LOG_TYPES.map((type) => (
                     <SelectItem key={type.value} value={type.value}>
                       <div className="flex items-center gap-2">
                         <type.icon className="h-3.5 w-3.5" />
                         {type.label}
                       </div>
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-2">
               <Label className="text-xs">Description</Label>
               <Textarea
                 value={logMessage}
                 onChange={(e) => setLogMessage(e.target.value)}
                 placeholder="Enter log details..."
                 className="min-h-[100px] text-sm"
               />
             </div>
             <div className="flex justify-end gap-2">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => setAddLogOpen(false)}
               >
                 Cancel
               </Button>
               <Button
                 size="sm"
                 onClick={handleAddLog}
                 disabled={!logMessage.trim() || isSavingLog}
               >
                 {isSavingLog ? 'Saving...' : 'Add Log'}
               </Button>
             </div>
           </div>
         </DialogContent>
       </Dialog>
     </>
  );
};
