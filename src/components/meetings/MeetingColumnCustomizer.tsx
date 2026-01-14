import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export interface MeetingColumnConfig {
  field: string;
  label: string;
  visible: boolean;
  order: number;
}

interface MeetingColumnCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: MeetingColumnConfig[];
  onColumnsChange: (columns: MeetingColumnConfig[]) => void;
  onSave?: (columns: MeetingColumnConfig[]) => Promise<unknown>;
  isSaving?: boolean;
}

export const defaultMeetingColumns: MeetingColumnConfig[] = [
  { field: 'subject', label: 'Subject', visible: true, order: 0 },
  { field: 'date', label: 'Date', visible: true, order: 1 },
  { field: 'time', label: 'Time', visible: true, order: 2 },
  { field: 'lead_contact', label: 'Lead/Contact', visible: true, order: 3 },
  { field: 'status', label: 'Status', visible: true, order: 4 },
  { field: 'outcome', label: 'Outcome', visible: true, order: 5 },
  { field: 'join_url', label: 'Join URL', visible: true, order: 6 },
  { field: 'organizer', label: 'Organizer', visible: true, order: 7 },
];

export const MeetingColumnCustomizer = ({ 
  open, 
  onOpenChange, 
  columns, 
  onColumnsChange,
  onSave,
  isSaving = false,
}: MeetingColumnCustomizerProps) => {
  // Initialize local columns only when dialog opens
  const [localColumns, setLocalColumns] = useState<MeetingColumnConfig[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Sync local columns only when dialog opens (not on every columns prop change)
  useEffect(() => {
    if (open && !isInitialized) {
      const existingFields = new Set(columns.map(c => c.field));
      const missingColumns = defaultMeetingColumns.filter(dc => !existingFields.has(dc.field));
      const validColumns = columns.filter(c => 
        defaultMeetingColumns.some(dc => dc.field === c.field)
      );
      
      if (missingColumns.length > 0 || validColumns.length !== columns.length) {
        setLocalColumns([...validColumns, ...missingColumns]);
      } else {
        setLocalColumns(columns);
      }
      setIsInitialized(true);
    }
    
    // Reset initialization flag when dialog closes
    if (!open) {
      setIsInitialized(false);
    }
  }, [open, columns, isInitialized]);

  const handleVisibilityChange = (field: string, visible: boolean) => {
    const updatedColumns = localColumns.map(col => 
      col.field === field ? { ...col, visible } : col
    );
    setLocalColumns(updatedColumns);
  };

  const handleSave = async () => {
    onColumnsChange(localColumns);
    if (onSave) {
      await onSave(localColumns);
    }
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalColumns(defaultMeetingColumns);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Columns</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>Tip:</strong> Check/uncheck to show/hide columns in the meetings table.
          </div>
          
          <div className="space-y-2 max-h-[400px] overflow-y-auto p-1">
            {localColumns.map((column) => (
              <div
                key={column.field}
                className="flex items-center space-x-3 p-3 border rounded-lg bg-card hover:bg-muted/30"
              >
                <Checkbox
                  id={column.field}
                  checked={column.visible}
                  onCheckedChange={(checked) => 
                    handleVisibilityChange(column.field, Boolean(checked))
                  }
                />
                
                <Label
                  htmlFor={column.field}
                  className="flex-1 cursor-pointer"
                >
                  {column.label}
                </Label>
              </div>
            ))}
          </div>
          
          <div className="flex justify-between gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleReset}>
              Reset to Default
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
