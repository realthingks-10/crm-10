
import { GenericCSVExporter } from './genericCSVExporter';
import { supabase } from '@/integrations/supabase/client';

// Exact field order as specified, including action items
const DEALS_EXPORT_FIELDS = [
  'id', 'deal_name', 'stage', 'probability', 'drop_reason', 'created_by', 'modified_by', 
  'created_at', 'modified_at', 'lead_name', 'lead_owner', 'project_name', 'customer_name', 
  'region', 'priority', 'internal_comment', 'expected_closing_date', 'customer_need', 
  'customer_challenges', 'relationship_strength', 'budget', 'business_value', 
  'decision_maker_level', 'is_recurring', 'start_date', 'end_date', 'currency_type', 
  'action_items', 'current_status', 'need_improvement', 'won_reason', 'lost_reason', 
  'total_contract_value', 'project_duration', 'quarterly_revenue_q1', 'quarterly_revenue_q2', 
  'quarterly_revenue_q3', 'quarterly_revenue_q4', 'total_revenue', 'closing', 
  'signed_contract_date', 'implementation_start_date', 'handoff_status', 
  'rfq_received_date', 'proposal_due_date', 'rfq_status', 'action_items_json'
];

export class DealsCSVExporter {
  private genericExporter: GenericCSVExporter;

  constructor() {
    this.genericExporter = new GenericCSVExporter();
  }
  
  async exportToCSV(deals: any[], filename: string) {
    console.log('DealsCSVExporter: Starting export with standardized YYYY-MM-DD date format');
    
    if (!deals || deals.length === 0) {
      throw new Error('No deals to export');
    }

    // Fetch action items for all deals
    const dealIds = deals.map(deal => deal.id);
    const { data: actionItems, error: actionItemsError } = await supabase
      .from('deal_action_items')
      .select('*')
      .in('deal_id', dealIds)
      .order('created_at', { ascending: false });

    if (actionItemsError) {
      console.error('Error fetching action items:', actionItemsError);
      // Continue with export without action items
    }

    // Group action items by deal_id
    const actionItemsByDeal = (actionItems || []).reduce((acc, item) => {
      if (!acc[item.deal_id]) {
        acc[item.deal_id] = [];
      }
      acc[item.deal_id].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    // Combine deals with their action items and ensure date format consistency
    const dealsWithActionItems = deals.map(deal => ({
      ...deal,
      action_items_json: JSON.stringify(actionItemsByDeal[deal.id] || [])
    }));

    await this.genericExporter.exportToCSV(dealsWithActionItems, filename, DEALS_EXPORT_FIELDS);
    console.log('DealsCSVExporter: Export completed successfully with YYYY-MM-DD date format');
  }
}
