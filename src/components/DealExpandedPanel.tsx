import { useState, useMemo, useEffect, useRef } from "react";
import { X, Plus, Clock, History, ListTodo, ChevronDown, ChevronRight, Eye, ArrowRight, Check, MessageSquarePlus, Phone, Mail, Calendar, FileText, User, MoreHorizontal, Handshake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  addDetailOpen?: boolean;
  onAddDetailOpenChange?: (open: boolean) => void;
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
{ value: 'Note', label: 'Note', icon: FileText }] as
const;

type LogType = typeof LOG_TYPES[number]['value'];

// Format date/time for table display: HH:mm dd-MM-yy
const formatHistoryDateTime = (date: Date): string => {
  return format(date, 'HH:mm dd-MM-yy');
};

// Format a value for display
const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') {
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

  const fieldChanges = details.field_changes as Record<string, {old: unknown;new: unknown;}> | undefined;
  if (fieldChanges && typeof fieldChanges === 'object') {
    return Object.entries(fieldChanges).
    filter(([key]) => !['modified_at', 'modified_by', 'id'].includes(key)).
    map(([field, change]) => ({
      field: field.replace(/_/g, ' '),
      oldValue: formatValue(change?.old),
      newValue: formatValue(change?.new)
    }));
  }

  const oldData = details.old_data as Record<string, unknown> | undefined;
  const updatedFields = details.updated_fields as Record<string, unknown> | undefined;

  if (updatedFields && oldData) {
    return Object.keys(updatedFields).
    filter((key) => !['modified_at', 'modified_by', 'id'].includes(key)).
    map((field) => ({
      field: field.replace(/_/g, ' '),
      oldValue: formatValue(oldData[field]),
      newValue: formatValue(updatedFields[field])
    }));
  }

  return Object.entries(details).
  filter(([key, value]) =>
  !['modified_at', 'modified_by', 'id', 'field_changes', 'old_data', 'updated_fields', 'record_data', 'timestamp'].includes(key) && (
  typeof value !== 'object' || value === null)
  ).
  map(([field, value]) => ({
    field: field.replace(/_/g, ' '),
    oldValue: '-',
    newValue: formatValue(value)
  }));
};

// Parse audit log details to show human-readable summary
const parseChangeSummary = (action: string, details: Record<string, unknown> | null): string => {
  if (!details || typeof details !== 'object') return action === 'create' ? 'Created deal' : action;

  // If there's already a formatted message (from manual action item logs), use it
  if (details.message && typeof details.message === 'string') {
    return details.message;
  }

  const changes = parseFieldChanges(details);
  if (changes.length === 0) return action === 'create' ? 'Created deal' : 'Updated';

  const stageChange = changes.find((c) => c.field === 'stage');
  if (stageChange) {
    return `${stageChange.oldValue} → ${stageChange.newValue}`;
  }

  const first = changes[0];
  if (changes.length === 1) {
    return `${first.field}: ${first.oldValue} → ${first.newValue}`;
  }
  return `${first.field} +${changes.length - 1}`;
};

export const DealExpandedPanel = ({ deal, onClose, onOpenActionItemModal, addDetailOpen: externalAddDetailOpen, onAddDetailOpenChange }: DealExpandedPanelProps) => {
  const { user } = useAuth();
  const [detailLogId, setDetailLogId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Unified Add Detail modal state
  const [internalAddDetailOpen, setInternalAddDetailOpen] = useState(false);
  const addDetailOpen = externalAddDetailOpen !== undefined ? externalAddDetailOpen : internalAddDetailOpen;
  const setAddDetailOpen = (open: boolean) => {
    if (!open) setAddDetailFromSection(null);
    if (onAddDetailOpenChange) onAddDetailOpenChange(open);else
    setInternalAddDetailOpen(open);
  };
  const [addDetailType, setAddDetailType] = useState<'log' | 'action_item'>('log');
  const [addDetailFromSection, setAddDetailFromSection] = useState<null | 'log' | 'action_item'>(null);
  const [logType, setLogType] = useState<LogType>('Note');
  const [logMessage, setLogMessage] = useState('');
  const [isSavingLog, setIsSavingLog] = useState(false);

  // Action item fields for unified modal
  const [actionTitle, setActionTitle] = useState('');
  const [actionAssignedTo, setActionAssignedTo] = useState<string>('unassigned');
  const [actionDueDate, setActionDueDate] = useState('');
  const [actionPriority, setActionPriority] = useState('Medium');
  const [actionStatus, setActionStatus] = useState('Open');
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);

  // Action items inline editing state
  const [editingDateId, setEditingDateId] = useState<string | null>(null);

  // Auto-scroll refs
  const historyScrollRef = useRef<HTMLDivElement>(null);
  const actionItemsScrollRef = useRef<HTMLDivElement>(null);

  const { users, getUserDisplayName } = useAllUsers();

  // Fetch audit logs for the deal - ascending order (newest at bottom)
  const { data: auditLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['deal-audit-logs', deal.id],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('security_audit_log').
      select('*').
      eq('resource_type', 'deals').
      eq('resource_id', deal.id).
      order('created_at', { ascending: true }).
      limit(50);

      if (error) {
        console.error('Error fetching deal audit logs:', error);
        return [];
      }

      return (data || []) as AuditLog[];
    },
    enabled: !!deal.id
  });

  // Fetch action items from unified action_items table
  const { data: actionItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['deal-action-items-unified', deal.id],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('action_items').
      select('*').
      eq('module_type', 'deals').
      eq('module_id', deal.id).
      order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching deal action items:', error);
        return [];
      }

      return (data || []) as ActionItem[];
    },
    enabled: !!deal.id
  });

  // Extract unique user IDs from audit logs and action items
  const userIds = useMemo(() => {
    const logUserIds = auditLogs.map((log) => log.user_id).filter((id): id is string => !!id);
    const actionUserIds = actionItems.map((item) => item.assigned_to).filter((id): id is string => !!id);
    const ids = [...logUserIds, ...actionUserIds];
    return [...new Set(ids)];
  }, [auditLogs, actionItems]);

  // Fetch display names for users
  const { displayNames } = useUserDisplayNames(userIds);

  const isLoading = logsLoading || itemsLoading;

  // Auto-refresh history logs when panel opens
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['deal-audit-logs', deal.id] });
  }, [deal.id, queryClient]);

  // Filter history: only manual logs and action item status changes
  const manualAndStatusLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const details = log.details as any;
      return details?.manual_entry === true || details?.action_item_title;
    });
  }, [auditLogs]);

  // Split action items: active vs completed
  const activeActionItems = useMemo(() => {
    return actionItems.filter((item) => item.status === 'Open' || item.status === 'In Progress');
  }, [actionItems]);

  const completedActionItems = useMemo(() => {
    return actionItems.filter((item) => item.status === 'Completed' || item.status === 'Cancelled');
  }, [actionItems]);

  // Merged history: manual logs + completed action items, sorted ascending
  const mergedHistory = useMemo(() => {
    const mappedLogs = manualAndStatusLogs.map((log) => {
      const details = log.details as any;
      let message = details?.message || parseChangeSummary(log.action, log.details);

      // Override with action item title + new status for both old and new format logs
      if (details?.action_item_title && details?.field_changes?.status) {
        message = `${details.action_item_title} → ${details.field_changes.status.new}`;
      }

      return {
        id: log.id,
        message,
        user_id: log.user_id,
        created_at: log.created_at,
        isCompletedAction: false,
        originalLog: log
      };
    });

    return [...mappedLogs].
    sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [manualAndStatusLogs]);

  // Auto-scroll both sections to bottom when data changes
  useEffect(() => {
    setTimeout(() => {
      if (historyScrollRef.current) {
        historyScrollRef.current.scrollTop = historyScrollRef.current.scrollHeight;
      }
      if (actionItemsScrollRef.current) {
        actionItemsScrollRef.current.scrollTop = actionItemsScrollRef.current.scrollHeight;
      }
    }, 100);
  }, [mergedHistory, activeActionItems]);

  // Handle adding a manual log entry
  const handleAddLog = async () => {
    if (!logMessage.trim() || !user) return;

    setIsSavingLog(true);
    try {
      const { error } = await supabase.
      from('security_audit_log').
      insert({
        action: logType.toUpperCase(),
        resource_type: 'deals',
        resource_id: deal.id,
        user_id: user.id,
        details: {
          message: logMessage.trim(),
          log_type: logType,
          manual_entry: true
        }
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['deal-audit-logs', deal.id] });

      setLogMessage('');
      setLogType('Note');
      setAddDetailOpen(false);
    } catch (error) {
      console.error('Error adding log:', error);
    } finally {
      setIsSavingLog(false);
    }
  };

  // Handle adding action item from unified modal
  const handleAddActionItem = async () => {
    if (!actionTitle.trim() || !user) return;

    setIsSavingLog(true);
    try {
      const { error } = await supabase.
      from('action_items').
      insert({
        title: actionTitle.trim(),
        module_type: 'deals',
        module_id: deal.id,
        created_by: user.id,
        assigned_to: actionAssignedTo === 'unassigned' ? null : actionAssignedTo,
        due_date: actionDueDate || null,
        priority: actionPriority,
        status: actionStatus
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['deal-action-items-unified', deal.id] });

      // Reset form
      setActionTitle('');
      setActionAssignedTo('unassigned');
      setActionDueDate('');
      setActionPriority('Medium');
      setActionStatus('Open');
      setMoreOptionsOpen(false);
      setAddDetailOpen(false);
    } catch (error) {
      console.error('Error adding action item:', error);
    } finally {
      setIsSavingLog(false);
    }
  };

  const handleSaveDetail = () => {
    if (addDetailType === 'log') {
      handleAddLog();
    } else {
      handleAddActionItem();
    }
  };

  const statusDotColor: Record<string, string> = {
    'Open': 'bg-blue-500',
    'In Progress': 'bg-yellow-500',
    'Completed': 'bg-green-500',
    'Cancelled': 'bg-muted-foreground'
  };

  // Hidden internal fields
  const HIDDEN_FIELDS = new Set(['id', 'created_by', 'modified_by', 'account_id']);

  const toTitleCase = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const isUUID = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const formatDetailValue = (key: string, val: any): string => {
    if (val === null || val === undefined) return '--';
    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}(T|\s)/)) {
      try {return format(new Date(val), 'MMM d, yyyy h:mm a');} catch {return val;}
    }
    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
      try {return format(new Date(val + 'T00:00:00'), 'MMM d, yyyy');} catch {return val;}
    }
    if (typeof val === 'string' && isUUID(val)) return val.slice(0, 8) + '…';
    if (typeof val === 'number' && (key.includes('revenue') || key.includes('contract_value') || key === 'budget')) return val.toLocaleString();
    if (typeof val === 'number' && key === 'probability') return `${val}%`;
    return String(val);
  };

  const renderFormattedDetails = (details: any) => {
    if (!details || typeof details !== 'object') return null;

    const { module, status, operation, timestamp, field_changes, old_data, updated_fields, record_data, ...rest } = details;

    const remainingObjectData = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
    );
    const recordData = record_data || old_data || updated_fields || (Object.keys(remainingObjectData).length > 0 ? remainingObjectData : null);

    return (
      <div className="space-y-3">
        {(module || status || operation) &&
        <div className="flex flex-wrap gap-2 items-center">
            {module && <Badge variant="outline" className="text-xs">{module}</Badge>}
            {operation && <Badge variant="secondary" className="text-xs">{operation}</Badge>}
            {status &&
          <Badge variant={status === 'Success' ? 'default' : 'destructive'} className="text-xs">
                {status}
              </Badge>
          }
            {timestamp &&
          <span className="text-xs text-muted-foreground ml-auto">
                {(() => {try {return format(new Date(timestamp), 'MMM d, yyyy h:mm a');} catch {return timestamp;}})()}
              </span>
          }
          </div>
        }

        {field_changes && typeof field_changes === 'object' && Object.keys(field_changes).length > 0 &&
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
                  {Object.entries(field_changes).
                filter(([key]) => !HIDDEN_FIELDS.has(key)).
                map(([key, change]: [string, any]) =>
                <TableRow key={key}>
                        <TableCell className="py-1.5 px-2 text-xs text-muted-foreground">{toTitleCase(key)}</TableCell>
                        <TableCell className="py-1.5 px-2 text-xs">{formatDetailValue(key, change?.old)}</TableCell>
                        <TableCell className="py-1.5 px-1 w-[20px]">
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-xs font-medium">{formatDetailValue(key, change?.new)}</TableCell>
                      </TableRow>
                )}
                </TableBody>
              </Table>
            </div>
          </div>
        }

        {recordData && typeof recordData === 'object' &&
        <div>
            <span className="text-xs font-medium text-muted-foreground block mb-1">Record Snapshot</span>
            <div className="rounded-md border border-border/50 bg-muted/10 p-2 space-y-1 max-h-48 overflow-auto">
              {Object.entries(recordData).
            filter(([key, val]) => !HIDDEN_FIELDS.has(key) && val !== null && val !== undefined).
            map(([key, val]) =>
            <div key={key} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground min-w-[120px] flex-shrink-0">{toTitleCase(key)}</span>
                    <span className="text-foreground break-all">{formatDetailValue(key, val)}</span>
                  </div>
            )}
            </div>
          </div>
        }
      </div>);

  };

  const selectedLog = detailLogId ? auditLogs.find((l) => l.id === detailLogId) : null;

  // Inline update handlers for action items
  const invalidateActionItems = () => {
    queryClient.invalidateQueries({ queryKey: ['deal-action-items-unified', deal.id] });
  };

  const handleStatusChange = async (id: string, status: string) => {
    const item = actionItems.find((i) => i.id === id);
    await supabase.from('action_items').update({ status, updated_at: new Date().toISOString() }).eq('id', id);

    // Only log to history when completed or cancelled
    if (status === 'Completed' || status === 'Cancelled') {
      try {
        await supabase.from('security_audit_log').insert({
          action: 'update',
          resource_type: 'deals',
          resource_id: deal.id,
          user_id: user?.id,
          details: {
            message: `${item?.title} → ${status}`,
            field_changes: { status: { old: item?.status, new: status } },
            action_item_id: id,
            action_item_title: item?.title
          }
        });
      } catch (e) {
        console.error('Failed to log status change:', e);
      }
      queryClient.invalidateQueries({ queryKey: ['deal-audit-logs', deal.id] });
    }

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

  const handleActionItemClick = (actionItem: ActionItem) => {
    if (onOpenActionItemModal) {
      onOpenActionItemModal(actionItem);
    }
  };

  return (
    <>
      <div
        className="h-full w-full bg-card border border-border/50 rounded-lg shadow-lg flex flex-col overflow-hidden"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}>

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-1">
          {/* History Section */}
          <div className="flex flex-col flex-1 min-h-0 relative">
            <div className="h-[280px] overflow-y-auto relative" ref={historyScrollRef}>
              {isLoading ?
              <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                </div> :

              <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className="text-[11px] bg-muted/50">
                      <TableHead className="h-7 px-1" style={{ width: '3%' }}></TableHead>
                      <TableHead className="h-7 px-2 text-[11px] font-bold" style={{ width: '74%' }}>Updates</TableHead>
                      <TableHead className="h-7 px-2 text-[11px] font-bold" style={{ width: '10%' }}>By</TableHead>
                      <TableHead className="h-7 px-2 text-[11px] font-bold" style={{ width: '10%' }}>Time</TableHead>
                      <TableHead className="h-7 px-1" style={{ width: '3%' }}></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mergedHistory.length === 0 ?
                  <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          <div className="flex items-center justify-center">
                            <History className="h-4 w-4 mr-2" />
                            <span className="text-xs">No history yet</span>
                          </div>
                        </TableCell>
                      </TableRow> :

                  mergedHistory.map((entry, index) =>
                  <TableRow key={entry.id} className="text-xs group cursor-pointer hover:bg-muted/30">
                        <TableCell className="py-1.5 px-1 text-[11px] text-muted-foreground text-center">{index + 1}</TableCell>
                        <TableCell className="py-1.5 px-2">
                          {entry.originalLog ?
                      <button
                        onClick={() => setDetailLogId(entry.originalLog!.id)}
                        className="hover:underline text-left whitespace-normal break-words text-[#2e538e] font-normal text-xs">

                              {entry.message}
                            </button> :

                      <span className="text-left whitespace-normal break-words text-xs text-muted-foreground">
                              {entry.message}
                            </span>
                      }
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-muted-foreground whitespace-nowrap text-[11px]">
                          {entry.user_id ? displayNames[entry.user_id] || getUserDisplayName(entry.user_id) || '...' : '-'}
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-[11px] text-muted-foreground whitespace-nowrap w-24">
                          {formatHistoryDateTime(new Date(entry.created_at))}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()} className="py-1.5 px-1 w-8">
                          {entry.originalLog &&
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDetailLogId(entry.originalLog!.id)}>
                              <Eye className="h-3 w-3" />
                            </Button>
                      }
                        </TableCell>
                      </TableRow>
                  )
                  }
                  </TableBody>
                </Table>
              }
            </div>
            <div className="flex justify-end px-2 py-1">
              <button
                onClick={() => {
                  setAddDetailType('log');
                  setAddDetailFromSection('log');
                  setAddDetailOpen(true);
                }}
                className="h-7 w-7 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:bg-primary/90 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Action Items Section - relative for floating button */}
          <div className="flex flex-col flex-1 min-h-0">
            <div className="h-[280px] overflow-y-auto relative" ref={actionItemsScrollRef}>
              {isLoading ?
              <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                </div> :

              <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className="text-[11px] bg-muted/50">
                      <TableHead className="h-7 px-1" style={{ width: '3%' }}></TableHead>
                      <TableHead className="h-7 px-2 text-[11px] font-bold" style={{ width: '70%' }}>Action Items</TableHead>
                      <TableHead className="h-7 px-2 text-[11px] font-bold" style={{ width: '9%' }}>Assigned</TableHead>
                      <TableHead className="h-7 px-2 text-[11px] font-bold" style={{ width: '8%' }}>Due</TableHead>
                      <TableHead className="h-7 px-1 text-[11px] font-bold text-center" style={{ width: '7%' }}>Status</TableHead>
                      <TableHead className="h-7 px-1" style={{ width: '3%' }}></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeActionItems.length === 0 ?
                  <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          <div className="flex flex-col items-center justify-center">
                            <ListTodo className="h-4 w-4 mb-1" />
                            <span className="text-xs">No active action items</span>
                            










                          </div>
                        </TableCell>
                      </TableRow> :

                  activeActionItems.map((item, index) =>
                  <TableRow
                    key={item.id}
                    className="text-xs group cursor-pointer hover:bg-muted/30"
                    onClick={() => handleActionItemClick(item)}>

                        <TableCell className="py-1.5 px-1 text-[11px] text-muted-foreground text-center">{index + 1}</TableCell>

                        {/* Task */}
                        <TableCell className="py-1.5 px-2">
                          <button onClick={(e) => {e.stopPropagation();handleActionItemClick(item);}} className="hover:underline text-left whitespace-normal break-words text-[#2e538e] font-normal text-xs">
                            {item.title}
                          </button>
                        </TableCell>

                        {/* Assigned To */}
                        <TableCell onClick={(e) => e.stopPropagation()} className="py-1.5 px-2 text-xs">
                          <Select value={item.assigned_to || 'unassigned'} onValueChange={(value) => handleAssignedToChange(item.id, value === 'unassigned' ? null : value)}>
                            <SelectTrigger className="h-6 w-auto min-w-0 text-[11px] border-0 bg-transparent hover:bg-muted/50 px-0 [&>svg]:hidden">
                              <SelectValue>
                                <span className="truncate">{item.assigned_to ? getUserDisplayName(item.assigned_to) : 'Unassigned'}</span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Due Date */}
                        <TableCell onClick={(e) => e.stopPropagation()} className="py-1.5 px-2 text-xs whitespace-nowrap">
                          {editingDateId === item.id ?
                      <Input type="date" defaultValue={item.due_date || ''} onBlur={(e) => handleDueDateBlur(item.id, e.target.value)} onKeyDown={(e) => {if (e.key === 'Enter') handleDueDateBlur(item.id, (e.target as HTMLInputElement).value);else if (e.key === 'Escape') setEditingDateId(null);}} autoFocus className="h-6 w-[110px] text-[11px]" /> :

                      <button onClick={() => setEditingDateId(item.id)} className="hover:underline text-[11px]">
                              {item.due_date ? formatHistoryDateTime(new Date(item.due_date)) : '—'}
                            </button>
                      }
                        </TableCell>

                        {/* Status - dot only */}
                        <TableCell onClick={(e) => e.stopPropagation()} className="py-1.5 px-1 text-center">
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex justify-center">
                                  <Select value={item.status} onValueChange={(value) => handleStatusChange(item.id, value)}>
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

                        {/* Actions */}
                        <TableCell onClick={(e) => e.stopPropagation()} className="py-1.5 px-1">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleActionItemClick(item)}>
                                  Edit
                                </DropdownMenuItem>
                                {item.status !== 'Completed' &&
                            <DropdownMenuItem onClick={() => handleStatusChange(item.id, 'Completed')}>
                                    Mark Complete
                                  </DropdownMenuItem>
                            }
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDeleteActionItem(item.id)} className="text-destructive focus:text-destructive">
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                  )
                  }
                  </TableBody>
                </Table>
              }
            </div>
            <div className="flex justify-end px-2 py-1">
              <button
                onClick={() => {
                  setAddDetailType('action_item');
                  setAddDetailFromSection('action_item');
                  setAddDetailOpen(true);
                }}
                className="h-7 w-7 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:bg-primary/90 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Log Dialog */}
      <Dialog open={!!detailLogId} onOpenChange={() => setDetailLogId(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">History Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (() => {
            const details = selectedLog.details as Record<string, any> | null;
            const isManualEntry = details?.manual_entry === true;
            const changes = parseFieldChanges(selectedLog.details);
            const updaterName = selectedLog.user_id ? displayNames[selectedLog.user_id] || 'Unknown' : '-';

            return (
              <ScrollArea className="flex-1 max-h-[calc(85vh-80px)]">
                <div className="space-y-4 text-sm pr-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-muted-foreground text-xs">Updated By</span>
                      <p className="font-medium">{updaterName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Time</span>
                      <p>{format(new Date(selectedLog.created_at), 'PPpp')}</p>
                    </div>
                  </div>
                  
                  {isManualEntry && details?.message &&
                  <div>
                      <span className="text-muted-foreground text-xs block mb-1">Message</span>
                      <p className="text-sm bg-muted/30 rounded-md p-2 whitespace-pre-wrap break-words">{String(details.message)}</p>
                    </div>
                  }

                  {details?.action_item_title &&
                  <div>
                      <span className="text-muted-foreground text-xs block mb-1">Action Item</span>
                      <p className="text-sm font-medium">{String(details.action_item_title)}</p>
                    </div>
                  }
                  
                  {changes.length > 0 &&
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
                            {changes.map((change, idx) =>
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
                          )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  }

                  {!isManualEntry && details && (details.record_data || details.old_data || details.updated_fields || selectedLog.action === 'create') &&
                  <div>{renderFormattedDetails(details)}</div>
                  }
                  {!isManualEntry && selectedLog.action === 'create' && !details &&
                  <p className="text-muted-foreground text-xs italic">Deal was created</p>
                  }
                  {changes.length === 0 && !isManualEntry && selectedLog.action !== 'create' && details && !details.action_item_title && !details.record_data && !details.old_data && !details.updated_fields &&
                  <div>{renderFormattedDetails(details)}</div>
                  }
                </div>
              </ScrollArea>);

          })()}
        </DialogContent>
      </Dialog>
      
      {/* Unified Add Detail Modal */}
      <Dialog open={addDetailOpen} onOpenChange={setAddDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Detail
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {addDetailFromSection === null &&
            <div className="space-y-2">
              <Label className="text-xs">Type</Label>
              <Select value={addDetailType} onValueChange={(v) => setAddDetailType(v as 'log' | 'action_item')}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="log">Update</SelectItem>
                  <SelectItem value="action_item">Action Item</SelectItem>
                </SelectContent>
              </Select>
            </div>
            }

            {addDetailType === 'log' ?
            <>
                <div className="space-y-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                  value={logMessage}
                  onChange={(e) => setLogMessage(e.target.value)}
                  placeholder="Enter log details..."
                  className="min-h-[100px] text-sm" />

                </div>
              </> :

            <>
                <div className="space-y-2">
                  <Label className="text-xs">Title *</Label>
                  <Input
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  placeholder="Action item title..."
                  className="h-9 text-sm" />

                </div>

                <Collapsible open={moreOptionsOpen} onOpenChange={setMoreOptionsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground">
                      {moreOptionsOpen ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                      More options
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <Label className="text-xs">Assigned To</Label>
                      <Select value={actionAssignedTo} onValueChange={setActionAssignedTo}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Due Date</Label>
                      <Input
                      type="date"
                      value={actionDueDate}
                      onChange={(e) => setActionDueDate(e.target.value)}
                      className="h-9 text-sm" />

                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Priority</Label>
                        <Select value={actionPriority} onValueChange={setActionPriority}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Status</Label>
                        <Select value={actionStatus} onValueChange={setActionStatus}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Open">Open</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </>
            }

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddDetailOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveDetail}
                disabled={addDetailType === 'log' ? !logMessage.trim() || isSavingLog : !actionTitle.trim() || isSavingLog}>

                {isSavingLog ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>);

};