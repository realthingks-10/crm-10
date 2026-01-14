import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Edit2, Plus, Trash2, Clock, ChevronDown, ChevronRight, Loader2, History } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useUserDisplayNames } from '@/hooks/useUserDisplayNames';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface FieldChange {
  field: string;
  old: any;
  new: any;
}

interface HistoryRecord {
  id: string;
  action: string;
  created_at: string;
  user_id: string | null;
  details: {
    operation?: string;
    status?: string;
    timestamp?: string;
    record_data?: Record<string, any>;
    updated_fields?: Record<string, any>;
    old_data?: Record<string, any>;
    field_changes?: Record<string, { old: any; new: any }>;
    deleted_data?: Record<string, any>;
    bulk_count?: number;
    module?: string;
  } | null;
}

interface RecordChangeHistoryProps {
  entityType: string;
  entityId: string;
  maxHeight?: string;
}

// Convert snake_case to Title Case
const formatFieldName = (field: string): string => {
  return field
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Format value for display
const formatValue = (value: any): string => {
  if (value === null || value === undefined || value === '') {
    return '(empty)';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : '(empty)';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

// Fields to exclude from display
const excludedFields = [
  'id', 'created_at', 'updated_at', 'created_time', 'modified_time',
  'created_by', 'modified_by'
];

export const RecordChangeHistory = ({ 
  entityType, 
  entityId, 
  maxHeight = '400px' 
}: RecordChangeHistoryProps) => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const userIds = history.map(h => h.user_id).filter(Boolean) as string[];
  const { displayNames } = useUserDisplayNames(userIds);

  useEffect(() => {
    fetchHistory();
  }, [entityType, entityId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('security_audit_log')
        .select('id, action, created_at, user_id, details')
        .eq('resource_type', entityType)
        .eq('resource_id', entityId)
        .order('created_at', { ascending: false })
        .limit(50); // Limit initial load for better performance

      if (error) throw error;
      setHistory((data as HistoryRecord[]) || []);
    } catch (error) {
      console.error('Error fetching record history:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <Plus className="h-4 w-4" />;
      case 'UPDATE':
        return <Edit2 className="h-4 w-4" />;
      case 'DELETE':
        return <Trash2 className="h-4 w-4" />;
      default:
        return <History className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'DELETE':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'Record Created';
      case 'UPDATE':
        return 'Record Updated';
      case 'DELETE':
        return 'Record Deleted';
      default:
        return action;
    }
  };

  const getFieldChanges = (record: HistoryRecord): FieldChange[] => {
    const changes: FieldChange[] = [];
    const details = record.details;

    if (!details) return changes;

    // Check for field_changes (UPDATE operations)
    if (details.field_changes && typeof details.field_changes === 'object') {
      Object.entries(details.field_changes).forEach(([field, change]) => {
        if (!excludedFields.includes(field) && change) {
          changes.push({
            field,
            old: change.old,
            new: change.new
          });
        }
      });
    }
    // Fallback: compare updated_fields with old_data
    else if (details.updated_fields && details.old_data) {
      Object.entries(details.updated_fields).forEach(([field, newValue]) => {
        if (!excludedFields.includes(field)) {
          const oldValue = details.old_data?.[field];
          if (newValue !== oldValue) {
            changes.push({
              field,
              old: oldValue,
              new: newValue
            });
          }
        }
      });
    }
    // For CREATE operations, show record_data
    else if (record.action === 'CREATE' && details.record_data) {
      Object.entries(details.record_data).forEach(([field, value]) => {
        if (!excludedFields.includes(field) && value !== null && value !== undefined && value !== '') {
          changes.push({
            field,
            old: null,
            new: value
          });
        }
      });
    }

    return changes;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No change history recorded</p>
        <p className="text-xs mt-1">Changes to this record will appear here</p>
      </div>
    );
  }

  return (
    <ScrollArea className={`h-[${maxHeight}]`} style={{ maxHeight }}>
      <div className="relative pl-6 pr-2">
        {/* Timeline line */}
        <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
        
        <div className="space-y-4">
          {history.map((record) => {
            const isExpanded = expandedItems.has(record.id);
            const fieldChanges = getFieldChanges(record);
            const hasDetails = fieldChanges.length > 0;

            return (
              <div key={record.id} className="relative">
                {/* Timeline dot */}
                <div className={`absolute -left-4 mt-1.5 w-5 h-5 rounded-full flex items-center justify-center ${getActionColor(record.action)}`}>
                  {getActionIcon(record.action)}
                </div>
                
                <Collapsible open={isExpanded} onOpenChange={() => hasDetails && toggleExpanded(record.id)}>
                  <div className="ml-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <CollapsibleTrigger asChild disabled={!hasDetails}>
                      <div className={`flex items-start justify-between gap-2 ${hasDetails ? 'cursor-pointer' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{getActionLabel(record.action)}</p>
                            {hasDetails && (
                              isExpanded ? 
                                <ChevronDown className="h-4 w-4 text-muted-foreground" /> :
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            by {record.user_id ? (displayNames[record.user_id] || 'Loading...') : 'System'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(record.created_at), 'dd/MM/yyyy')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(record.created_at), 'HH:mm')}
                          </span>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      {hasDetails && (
                        <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                          {fieldChanges.map((change, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-muted-foreground">•</span>
                              <span className="font-medium text-muted-foreground min-w-[100px]">
                                {formatFieldName(change.field)}:
                              </span>
                              {record.action === 'CREATE' ? (
                                <span className="text-foreground">{formatValue(change.new)}</span>
                              ) : (
                                <span className="text-foreground">
                                  <span className="text-muted-foreground line-through">{formatValue(change.old)}</span>
                                  <span className="mx-2">→</span>
                                  <span className="text-emerald-600 dark:text-emerald-400">{formatValue(change.new)}</span>
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
};
