import LeadTable from "@/components/LeadTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, MoreVertical, Upload, Download, Settings, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useSimpleLeadsImportExport } from "@/hooks/useSimpleLeadsImportExport";
import { useLeadDeletion } from "@/hooks/useLeadDeletion";
import { LeadDeleteConfirmDialog } from "@/components/LeadDeleteConfirmDialog";
import { LeadStatusFilter } from "@/components/LeadStatusFilter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const Leads = () => {
  const { toast } = useToast();
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("New");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // URL params for highlight from notifications
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  
  // Clear highlight param after passing to LeadTable
  const clearHighlight = () => {
    setSearchParams({}, { replace: true });
  };

  const { handleImport, handleExport, isImporting } = useSimpleLeadsImportExport(() => {
    setRefreshTrigger(prev => prev + 1);
  });

  const { deleteLeads, isDeleting } = useLeadDeletion();

  const handleBulkDelete = async (deleteLinkedRecords: boolean = true) => {
    if (selectedLeads.length === 0) return;
    const result = await deleteLeads(selectedLeads, deleteLinkedRecords);
    if (result.success) {
      setSelectedLeads([]);
      setRefreshTrigger(prev => prev + 1);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkDeleteClick = () => {
    if (selectedLeads.length === 0) return;
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header - fixed height matching sidebar */}
      <div className="flex-shrink-0 h-16 border-b bg-background px-6 flex items-center">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl font-semibold text-foreground">Leads</h1>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Filter Bar - consistent padding and styling */}
      <div className="flex-shrink-0 border-b bg-muted/30 px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search input */}
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search leads..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="pl-9" 
            />
          </div>

          {/* Status filter */}
          <LeadStatusFilter value={statusFilter} onValueChange={setStatusFilter} />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Delete button - visible when items selected */}
          {selectedLeads.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleBulkDeleteClick} disabled={isDeleting}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isDeleting ? 'Deleting...' : `Delete Selected (${selectedLeads.length})`}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="w-4 h-4" />
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
                disabled={selectedLeads.length === 0 || isDeleting} 
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? 'Deleting...' : `Delete Selected (${selectedLeads.length})`}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Hidden file input */}
      <input 
        ref={fileInputRef} 
        type="file" 
        accept=".csv" 
        onChange={handleFileSelect} 
        className="hidden"
      />

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <LeadTable 
          showColumnCustomizer={showColumnCustomizer} 
          setShowColumnCustomizer={setShowColumnCustomizer} 
          showModal={showModal} 
          setShowModal={setShowModal} 
          selectedLeads={selectedLeads} 
          setSelectedLeads={setSelectedLeads} 
          key={refreshTrigger}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          highlightId={highlightId}
          clearHighlight={clearHighlight}
        />
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      <LeadDeleteConfirmDialog 
        open={showBulkDeleteDialog} 
        onConfirm={handleBulkDelete} 
        onCancel={() => setShowBulkDeleteDialog(false)} 
        isMultiple={true} 
        count={selectedLeads.length} 
      />
    </div>
  );
};

export default Leads;
