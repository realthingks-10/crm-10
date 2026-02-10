import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { LeadsCSVProcessor } from '@/hooks/import-export/leadsCSVProcessor';
import { LeadsCSVExporter } from '@/hooks/import-export/leadsCSVExporter';
import { fetchAllRecords } from '@/utils/supabasePagination';

export const useSimpleLeadsImportExport = (onImportComplete: () => void) => {
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async (file: File) => {
    console.log('=== LEADS IMPORT STARTED ===');
    console.log('File:', file.name, 'Size:', file.size, 'bytes');
    
    if (!file) {
      console.error('Import failed: No file provided');
      toast({
        title: "Error",
        description: "No file selected for import.",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      console.error('Import failed: Invalid file type');
      toast({
        title: "Error",
        description: "Please select a valid CSV file.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    
    const importToast = toast({
      title: "Importing Leads...",
      description: "Processing CSV file, please wait...",
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated. Please log in and try again.');
      }

      console.log('Reading file content...');
      const text = await file.text();
      console.log('File loaded successfully. Content length:', text.length, 'characters');

      if (!text || text.trim() === '') {
        throw new Error('CSV file is empty');
      }

      const processor = new LeadsCSVProcessor();
      const result = await processor.processCSV(text, {
        userId: user.id,
        onProgress: (processed, total) => {
          console.log(`Leads import progress: ${processed}/${total}`);
        }
      });

      console.log('=== IMPORT RESULT ===');
      console.log('Success count:', result.successCount);
      console.log('Update count:', result.updateCount);
      console.log('Error count:', result.errorCount);
      console.log('Errors:', result.errors);

      importToast.dismiss();

      const { successCount, updateCount, errorCount, errors } = result;
      
      let message = '';
      const parts = [];
      
      if (successCount > 0) parts.push(`${successCount} new leads imported`);
      if (updateCount > 0) parts.push(`${updateCount} leads updated`);
      if (errorCount > 0) parts.push(`${errorCount} errors`);
      
      message = parts.length > 0 ? parts.join(', ') : 'No leads were imported';

      if (successCount > 0 || updateCount > 0) {
        toast({
          title: "Import Successful",
          description: message,
        });
        
        onImportComplete();
        
        window.dispatchEvent(new CustomEvent('leads-data-updated', {
          detail: { successCount, updateCount, source: 'csv-import' }
        }));
      } else if (errorCount > 0) {
        const errorSample = errors.slice(0, 3).join('; ');
        toast({
          title: "Import Failed",
          description: `${message}. ${errorSample}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Import Warning",
          description: "No leads were found in the CSV file. Please check the file format and headers.",
          variant: "destructive",
        });
      }

      if (errors.length > 0) {
        console.error('Import errors:', errors);
      }

    } catch (error: any) {
      console.error('=== IMPORT ERROR ===');
      console.error('Error:', error);
      
      toast({
        title: "Import Error",
        description: error?.message || "Failed to import leads. Please check the console for details.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      console.log('=== LEADS IMPORT COMPLETED ===');
    }
  };

  const handleExport = async () => {
    console.log('=== LEADS EXPORT STARTED ===');
    
    try {
      const data = await fetchAllRecords('leads', 'created_time', false);

      if (!data || data.length === 0) {
        toast({
          title: "No Data",
          description: "No leads to export.",
          variant: "destructive",
        });
        return;
      }

      console.log('Exporting', data.length, 'leads');
      const exporter = new LeadsCSVExporter();
      const csvContent = await exporter.exportLeads(data);

      // Download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Exported ${data.length} leads to CSV.`,
      });

      console.log('=== LEADS EXPORT COMPLETED ===');

    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  return {
    handleImport,
    handleExport,
    isImporting
  };
};
