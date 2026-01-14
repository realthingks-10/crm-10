import AccountTable from "@/components/AccountTable";
import { Button } from "@/components/ui/button";
import { Settings, Trash2, Upload, Download, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAccountsImportExport } from "@/hooks/useAccountsImportExport";
import { AccountDeleteConfirmDialog } from "@/components/AccountDeleteConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Export interface for AccountTable ref
export interface AccountTableRef {
  handleBulkDelete: () => Promise<void>;
}

const Accounts = () => {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || 'all';
  const { toast } = useToast();
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Ref to call bulk delete from AccountTable
  const accountTableRef = useRef<AccountTableRef>(null);

  const {
    handleImport,
    handleExport,
    isImporting
  } = useAccountsImportExport(() => {
    setRefreshTrigger(prev => prev + 1);
  });

  const handleBulkDeleteClick = () => {
    if (selectedAccounts.length === 0) return;
    setShowBulkDeleteDialog(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      handleImport(file);
    } else {
      toast({
        title: "Error",
        description: "Please select a valid CSV file",
        variant: "destructive"
      });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Execute bulk delete via AccountTable ref
  const executeBulkDelete = async () => {
    if (accountTableRef.current) {
      await accountTableRef.current.handleBulkDelete();
    }
    setShowBulkDeleteDialog(false);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-background">
        <div className="px-6 h-16 flex items-center border-b w-full">
          <div className="flex items-center justify-between w-full">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl text-foreground font-semibold">Accounts</h1>
            </div>
            <div className="flex items-center gap-3">
              {selectedAccounts.length > 0 && (
                <TooltipProvider>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={handleBulkDeleteClick}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete Selected ({selectedAccounts.length})</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setShowColumnCustomizer(true)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Columns
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                    <Upload className="w-4 h-4 mr-2" />
                    {isImporting ? 'Importing...' : 'Import CSV'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExport}>
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleBulkDeleteClick} 
                    disabled={selectedAccounts.length === 0} 
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected ({selectedAccounts.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5">
                <Plus className="w-4 h-4" />
                Add Account
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pt-2 pb-4">
        <AccountTable 
          ref={accountTableRef}
          showColumnCustomizer={showColumnCustomizer} 
          setShowColumnCustomizer={setShowColumnCustomizer} 
          showModal={showModal} 
          setShowModal={setShowModal} 
          selectedAccounts={selectedAccounts} 
          setSelectedAccounts={setSelectedAccounts} 
          key={`${refreshTrigger}-${initialStatus}`}
          initialStatus={initialStatus}
          onBulkDeleteComplete={() => {
            setSelectedAccounts([]);
            setRefreshTrigger(prev => prev + 1);
            setShowBulkDeleteDialog(false);
          }} 
        />
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      <AccountDeleteConfirmDialog 
        open={showBulkDeleteDialog} 
        onConfirm={executeBulkDelete} 
        onCancel={() => setShowBulkDeleteDialog(false)} 
        isMultiple={true} 
        count={selectedAccounts.length} 
      />

    </div>
  );
};

export default Accounts;
