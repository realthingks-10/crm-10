import { useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import LeadTable, { LeadTableRef } from "@/components/LeadTable";
import { Button } from "@/components/ui/button";
import { Settings, Plus, Trash2, Upload, Download, Mail } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSimpleLeadsImportExport } from "@/hooks/useSimpleLeadsImportExport";
import { LeadDeleteConfirmDialog } from "@/components/LeadDeleteConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BulkEmailModal, BulkEmailRecipient } from "@/components/BulkEmailModal";

// Leads page component
const Leads = () => {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || 'all';
  const { toast } = useToast();
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false);
  const [bulkEmailRecipients, setBulkEmailRecipients] = useState<BulkEmailRecipient[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const leadTableRef = useRef<LeadTableRef>(null);
  
  const { handleImport, handleExport, isImporting } = useSimpleLeadsImportExport(() => {
    setRefreshTrigger(prev => prev + 1);
  });

  const handleBulkDelete = async (deleteLinkedRecords: boolean = true) => {
    if (selectedLeads.length === 0) return;
    setIsDeleting(true);
    try {
      await leadTableRef.current?.handleBulkDelete(deleteLinkedRecords);
      setShowBulkDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDeleteClick = () => {
    if (selectedLeads.length === 0) return;
    setShowBulkDeleteDialog(true);
  };

  const handleBulkEmailClick = async () => {
    if (selectedLeads.length === 0) return;
    
    // Fetch lead details for selected leads
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, lead_name, email')
      .in('id', selectedLeads);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch lead details",
        variant: "destructive",
      });
      return;
    }

    const recipients: BulkEmailRecipient[] = (leads || []).map(lead => ({
      id: lead.id,
      name: lead.lead_name,
      email: lead.email || undefined,
      type: 'lead' as const,
    }));

    setBulkEmailRecipients(recipients);
    setShowBulkEmailModal(true);
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

  const handleBulkDeleteComplete = () => {
    setSelectedLeads([]);
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-background">
        <div className="px-6 h-16 flex items-center border-b w-full">
          <div className="flex items-center justify-between w-full">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl text-foreground font-semibold">Leads</h1>
            </div>
            <div className="flex items-center gap-3">
              {selectedLeads.length > 0 && (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={handleBulkEmailClick}>
                          <Mail className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Send Email to Selected ({selectedLeads.length})</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
                </>
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
                  <DropdownMenuItem onClick={handleBulkEmailClick} disabled={selectedLeads.length === 0}>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Bulk Email ({selectedLeads.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkDeleteClick} disabled={selectedLeads.length === 0 || isDeleting} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeleting ? 'Deleting...' : `Delete Selected (${selectedLeads.length})`}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5">
                <Plus className="w-4 h-4" />
                Add Lead
              </Button>
            </div>
          </div>
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

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pt-2 pb-4">
        <LeadTable 
          ref={leadTableRef}
          showColumnCustomizer={showColumnCustomizer} 
          setShowColumnCustomizer={setShowColumnCustomizer} 
          showModal={showModal} 
          setShowModal={setShowModal} 
          selectedLeads={selectedLeads} 
          setSelectedLeads={setSelectedLeads} 
          key={`${refreshTrigger}-${initialStatus}`}
          initialStatus={initialStatus}
          onBulkDeleteComplete={handleBulkDeleteComplete}
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

      {/* Bulk Email Modal */}
      <BulkEmailModal
        open={showBulkEmailModal}
        onOpenChange={setShowBulkEmailModal}
        recipients={bulkEmailRecipients}
        onEmailsSent={() => {
          setSelectedLeads([]);
        }}
      />
    </div>
  );
};

export default Leads;
