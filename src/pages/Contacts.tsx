import { ContactTable, ContactTableRef } from "@/components/ContactTable";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Settings, Trash2, Upload, Download, Mail, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSimpleContactsImportExport } from "@/hooks/useSimpleContactsImportExport";
import { BulkEmailModal, BulkEmailRecipient } from "@/components/BulkEmailModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const Contacts = () => {
  const { toast } = useToast();
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false);
  const [bulkEmailRecipients, setBulkEmailRecipients] = useState<BulkEmailRecipient[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Ref to call bulk delete from ContactTable
  const contactTableRef = useRef<ContactTableRef>(null);

  const onRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const { handleImport, handleExport, isImporting } = useSimpleContactsImportExport(onRefresh);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await handleImport(file);
      event.target.value = '';
    } catch (error: any) {
      console.error('Import error:', error);
      event.target.value = '';
    }
  };

  const handleBulkDeleteClick = () => {
    if (selectedContacts.length === 0) return;
    setShowBulkDeleteDialog(true);
  };

  // Execute bulk delete via ContactTable ref
  const executeBulkDelete = async () => {
    if (contactTableRef.current) {
      await contactTableRef.current.handleBulkDelete();
    }
    setShowBulkDeleteDialog(false);
  };

  const handleBulkEmailClick = async () => {
    if (selectedContacts.length === 0) return;
    
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id, contact_name, email')
      .in('id', selectedContacts);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch contact details",
        variant: "destructive",
      });
      return;
    }

    const recipients: BulkEmailRecipient[] = (contacts || []).map(contact => ({
      id: contact.id,
      name: contact.contact_name,
      email: contact.email || undefined,
      type: 'contact' as const,
    }));

    setBulkEmailRecipients(recipients);
    setShowBulkEmailModal(true);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-background">
        <div className="px-6 h-16 flex items-center border-b w-full">
          <div className="flex items-center justify-between w-full">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl text-foreground font-semibold">Contacts</h1>
            </div>
            <div className="flex items-center gap-3">
              {selectedContacts.length > 0 && (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={handleBulkEmailClick}>
                          <Mail className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Send Email to Selected ({selectedContacts.length})</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={handleBulkDeleteClick}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete Selected ({selectedContacts.length})</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isImporting}>
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setShowColumnCustomizer(true)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Columns
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleImportClick} disabled={isImporting}>
                    <Upload className="w-4 h-4 mr-2" />
                    {isImporting ? 'Importing...' : 'Import CSV'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExport}>
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkEmailClick} disabled={selectedContacts.length === 0}>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Bulk Email ({selectedContacts.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleBulkDeleteClick} 
                    disabled={selectedContacts.length === 0}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected ({selectedContacts.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5">
                <Plus className="w-4 h-4" />
                Add Contact
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input for CSV import */}
      <Input 
        ref={fileInputRef} 
        type="file" 
        accept=".csv" 
        onChange={handleImportCSV} 
        className="hidden" 
        disabled={isImporting} 
      />

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pt-2 pb-4">
        <ContactTable 
          ref={contactTableRef}
          showColumnCustomizer={showColumnCustomizer} 
          setShowColumnCustomizer={setShowColumnCustomizer} 
          showModal={showModal} 
          setShowModal={setShowModal} 
          selectedContacts={selectedContacts} 
          setSelectedContacts={setSelectedContacts} 
          refreshTrigger={refreshTrigger}
          onBulkDeleteComplete={() => {
            setSelectedContacts([]);
            setRefreshTrigger(prev => prev + 1);
            setShowBulkDeleteDialog(false);
          }}
        />
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedContacts.length} contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected contacts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Email Modal */}
      <BulkEmailModal
        open={showBulkEmailModal}
        onOpenChange={setShowBulkEmailModal}
        recipients={bulkEmailRecipients}
        onEmailsSent={() => {
          setSelectedContacts([]);
        }}
      />
    </div>
  );
};

export default Contacts;
