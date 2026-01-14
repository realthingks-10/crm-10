import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface TaskColumnCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onColumnsChange?: (columns: string[], order?: string[]) => void;
}

interface ColumnConfig {
  key: string;
  label: string;
  required?: boolean;
}

const availableColumns: ColumnConfig[] = [
  { key: 'checkbox', label: 'Checkbox', required: true },
  { key: 'title', label: 'Task Title', required: true },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'due_time', label: 'Due Time' },
  { key: 'assigned_to', label: 'Assigned To' },
  { key: 'linked_to', label: 'Linked To' },
  { key: 'created_by', label: 'Task Owner' },
  { key: 'module_type', label: 'Module' },
  { key: 'description', label: 'Description' },
  { key: 'created_at', label: 'Created Date' },
  { key: 'actions', label: 'Actions', required: true },
];

const defaultColumns = ['checkbox', 'title', 'status', 'priority', 'due_date', 'assigned_to', 'linked_to', 'created_by', 'actions'];

interface ColumnPreference {
  visible_columns: string[];
  column_order: string[];
}

export const TaskColumnCustomizer = ({ open, onOpenChange, onColumnsChange }: TaskColumnCustomizerProps) => {
  const { user } = useAuth();
  const [selectedColumns, setSelectedColumns] = useState<string[]>(defaultColumns);
  const [columnOrder, setColumnOrder] = useState<string[]>(availableColumns.map(c => c.key));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user?.id) {
      loadPreferences();
    }
  }, [open, user?.id]);

  const loadPreferences = async () => {
    if (!user?.id) return;
    
    try {
      const { data } = await supabase
        .from('table_column_preferences')
        .select('column_config')
        .eq('user_id', user.id)
        .eq('module_name', 'tasks')
        .maybeSingle();

      if (data?.column_config) {
        const config = data.column_config as unknown as ColumnPreference;
        if (config.visible_columns && Array.isArray(config.visible_columns)) {
          setSelectedColumns(config.visible_columns);
        }
        if (config.column_order && Array.isArray(config.column_order)) {
          setColumnOrder(config.column_order);
        }
      }
    } catch (error) {
      console.error('Error loading column preferences:', error);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const columnConfig: ColumnPreference = {
        visible_columns: selectedColumns,
        column_order: columnOrder,
      };

      // Check if record exists
      const { data: existing } = await supabase
        .from('table_column_preferences')
        .select('id')
        .eq('user_id', user.id)
        .eq('module_name', 'tasks')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('table_column_preferences')
          .update({ column_config: columnConfig as any })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('table_column_preferences')
          .insert({
            user_id: user.id,
            module_name: 'tasks',
            column_config: columnConfig as any,
          });
        if (error) throw error;
      }

      toast({ title: 'Success', description: 'Column preferences saved' });
      onColumnsChange?.(selectedColumns, columnOrder);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast({ title: 'Error', description: 'Failed to save preferences', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleColumnToggle = (columnKey: string) => {
    const column = availableColumns.find(c => c.key === columnKey);
    if (column?.required) return;

    setSelectedColumns(prev => 
      prev.includes(columnKey)
        ? prev.filter(c => c !== columnKey)
        : [...prev, columnKey]
    );
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(columnOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setColumnOrder(items);
  };

  const handleReset = () => {
    setSelectedColumns(defaultColumns);
    setColumnOrder(availableColumns.map(c => c.key));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Customize Columns</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="columns">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-2"
                >
                  {columnOrder.map((columnKey, index) => {
                    const column = availableColumns.find(c => c.key === columnKey);
                    if (!column) return null;

                    return (
                      <Draggable key={columnKey} draggableId={columnKey} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center gap-3 p-2 rounded-md border bg-background ${
                              snapshot.isDragging ? 'shadow-md' : ''
                            }`}
                          >
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab text-muted-foreground hover:text-foreground"
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <Checkbox
                              id={columnKey}
                              checked={selectedColumns.includes(columnKey)}
                              onCheckedChange={() => handleColumnToggle(columnKey)}
                              disabled={column.required}
                            />
                            <Label 
                              htmlFor={columnKey} 
                              className={`flex-1 cursor-pointer ${column.required ? 'text-muted-foreground' : ''}`}
                            >
                              {column.label}
                              {column.required && <span className="text-xs ml-1">(required)</span>}
                            </Label>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </ScrollArea>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleReset}>
            Reset to Default
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
