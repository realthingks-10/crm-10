
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";

interface LeadDeleteConfirmDialogProps {
  open: boolean;
  onConfirm: (deleteLinkedRecords: boolean) => void;
  onCancel: () => void;
  leadName?: string;
  isMultiple?: boolean;
  count?: number;
}

export const LeadDeleteConfirmDialog = ({ 
  open, 
  onConfirm, 
  onCancel, 
  leadName, 
  isMultiple = false,
  count = 1
}: LeadDeleteConfirmDialogProps) => {
  const [deleteLinkedRecords, setDeleteLinkedRecords] = useState(true);

  const handleConfirm = () => {
    onConfirm(deleteLinkedRecords);
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {isMultiple ? `${count} Leads` : 'Lead'}</AlertDialogTitle>
          <AlertDialogDescription>
            {isMultiple 
              ? `This will permanently delete ${count} leads and cannot be undone.`
              : `This will permanently delete the lead "${leadName}" and cannot be undone.`
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="delete-linked"
              checked={deleteLinkedRecords}
              onCheckedChange={(checked) => setDeleteLinkedRecords(checked as boolean)}
            />
            <label
              htmlFor="delete-linked"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Also delete all related records (notifications, action items, etc.)
            </label>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            This option is recommended to avoid foreign key constraint errors.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete {isMultiple ? 'Leads' : 'Lead'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
