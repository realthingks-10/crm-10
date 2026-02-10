
import { supabase } from '@/integrations/supabase/client';

export class LeadsCSVExporter {
  async exportLeads(leads: any[]): Promise<string> {
    console.log('LeadsCSVExporter: Starting export of', leads.length, 'leads');
    
    // Define the exact field order as required
    const fieldOrder = [
      'id',
      'lead_name', 
      'company_name',
      'position',
      'email',
      'phone_no',
      'linkedin',
      'website',
      'contact_source',
      'lead_status',
      'industry',
      'country',
      'description',
      'contact_owner',
      'created_by',
      'modified_by',
      'created_time',
      'modified_time',
      'action_items_json'
    ];

    const csvRows = [];
    
    // Add headers in exact order
    csvRows.push(fieldOrder.join(','));

    // Process each lead
    for (const lead of leads) {
      // Fetch action items for this lead
      let actionItemsJson = '';
      try {
        const { data: actionItems } = await supabase
          .from('lead_action_items')
          .select('*')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: true });

        if (actionItems && actionItems.length > 0) {
          actionItemsJson = JSON.stringify(actionItems);
        }
      } catch (error) {
        console.warn('Failed to fetch action items for lead', lead.id, error);
      }

      // Create row with values in exact field order
      const rowValues = fieldOrder.map(field => {
        let value;
        
        if (field === 'action_items_json') {
          value = actionItemsJson;
        } else {
          value = lead[field];
        }

        // Handle null/undefined values
        if (value === null || value === undefined) {
          return '';
        }

        // Convert to string and escape quotes
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        return stringValue;
      });

      csvRows.push(rowValues.join(','));
    }

    const csvContent = csvRows.join('\n');
    console.log('LeadsCSVExporter: Export completed');
    return csvContent;
  }
}
