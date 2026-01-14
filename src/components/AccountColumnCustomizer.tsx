import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export interface AccountColumnConfig {
  field: string;
  label: string;
  visible: boolean;
  order: number;
}

interface AccountColumnCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: AccountColumnConfig[];
  onColumnsChange: (columns: AccountColumnConfig[]) => void;
  onSave?: (columns: AccountColumnConfig[]) => Promise<unknown>;
  isSaving?: boolean;
}

export const defaultAccountColumns: AccountColumnConfig[] = [
  { field: 'company_name', label: 'Company Name', visible: true, order: 0 },
  { field: 'email', label: 'Email', visible: true, order: 1 },
  { field: 'phone', label: 'Phone', visible: true, order: 2 },
  { field: 'company_type', label: 'Company Type', visible: true, order: 3 },
  { field: 'industry', label: 'Industry', visible: true, order: 4 },
  { field: 'country', label: 'Country', visible: true, order: 5 },
  { field: 'region', label: 'Region', visible: false, order: 6 },
  { field: 'website', label: 'Website', visible: false, order: 7 },
  { field: 'tags', label: 'Tags', visible: true, order: 8 },
  { field: 'status', label: 'Status', visible: true, order: 9 },
  { field: 'deal_count', label: 'Deals', visible: false, order: 10 },
  { field: 'contact_count', label: 'Contacts', visible: false, order: 11 },
  { field: 'lead_count', label: 'Leads', visible: false, order: 12 },
  { field: 'account_owner', label: 'Account Owner', visible: true, order: 13 },
];

export const AccountColumnCustomizer = ({
  open,
  onOpenChange,
  columns,
  onColumnsChange,
  onSave,
  isSaving = false,
}: AccountColumnCustomizerProps) => {
  // Initialize local columns only when dialog opens
  const [localColumns, setLocalColumns] = useState<AccountColumnConfig[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Sync local columns only when dialog opens (not on every columns prop change)
  useEffect(() => {
    if (open && !isInitialized) {
      const existingFields = new Set(columns.map(c => c.field));
      const missingColumns = defaultAccountColumns.filter(dc => !existingFields.has(dc.field));
      const validColumns = columns.filter(c => 
        defaultAccountColumns.some(dc => dc.field === c.field)
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

  const handleToggleColumn = (field: string, visible: boolean) => {
    const updated = localColumns.map(col =>
      col.field === field ? { ...col, visible } : col
    );
    setLocalColumns(updated);
  };

  const handleSave = async () => {
    onColumnsChange(localColumns);
    if (onSave) {
      await onSave(localColumns);
    }
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalColumns(defaultAccountColumns);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Columns</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>Tip:</strong> Check/uncheck to show/hide columns in the account table.
          </div>
          
          <div className="space-y-2 max-h-[400px] overflow-y-auto p-1">
            {localColumns.map(column => (
              <div
                key={column.field}
                className="flex items-center space-x-3 p-3 border rounded-lg bg-card hover:bg-muted/30"
              >
                <Checkbox
                  id={column.field}
                  checked={column.visible}
                  onCheckedChange={(checked) => handleToggleColumn(column.field, checked as boolean)}
                />
                <Label htmlFor={column.field} className="flex-1 cursor-pointer">
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
