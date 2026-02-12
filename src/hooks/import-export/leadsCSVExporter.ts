
import { supabase } from '@/integrations/supabase/client';
import { UserNameUtils } from '@/utils/userNameUtils';

export class LeadsCSVExporter {
  async exportLeads(leads: any[]): Promise<string> {
    console.log('LeadsCSVExporter: Starting export of', leads.length, 'leads');
    
    const fieldOrder = [
      'id', 'lead_name', 'company_name', 'position', 'email', 'phone_no',
      'linkedin', 'website', 'contact_source', 'lead_status', 'industry',
      'country', 'description', 'account_id', 'contact_owner', 'created_by',
      'modified_by', 'created_time', 'modified_time', 'action_items_json'
    ];

    // Fetch user display names
    const userIds = UserNameUtils.extractUserIds(leads, ['contact_owner', 'created_by', 'modified_by']);
    const userNameMap = await UserNameUtils.fetchUserDisplayNames(userIds);
    console.log('LeadsCSVExporter: Fetched display names for', Object.keys(userNameMap).length, 'users');

    const csvRows = [];
    csvRows.push(fieldOrder.join(','));

    for (const lead of leads) {
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

      const rowValues = fieldOrder.map(field => {
        let value;
        
        if (field === 'action_items_json') {
          value = actionItemsJson;
        } else {
          value = lead[field];
        }

        // Format ID (shortened)
        if (field === 'id' && value) {
          return UserNameUtils.formatIdForExport(value);
        }

        // Convert UUID to display name for user fields
        if (UserNameUtils.isUserField(field) && value) {
          const displayName = userNameMap[value] || '';
          return this.escapeCSVValue(displayName);
        }

        // Format datetime fields
        if (UserNameUtils.isDateTimeField(field) && value) {
          return this.escapeCSVValue(UserNameUtils.formatDateTimeForExport(value));
        }

        if (value === null || value === undefined) {
          return '';
        }

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

  private escapeCSVValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
