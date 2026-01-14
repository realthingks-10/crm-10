import { getColumnConfig } from '@/hooks/import-export/columnConfig';

// Generate import template for each module with headers and sample values

export interface TemplateConfig {
  headers: string[];
  sampleRow: string[];
  hints: Record<string, string>;
}

// Human-readable header labels
const HEADER_LABELS: Record<string, string> = {
  id: 'ID',
  contact_name: 'Contact Name',
  company_name: 'Company Name',
  position: 'Position',
  email: 'Email',
  phone_no: 'Phone',
  mobile_no: 'Mobile',
  linkedin: 'LinkedIn',
  website: 'Website',
  contact_source: 'Source',
  industry: 'Industry',
  region: 'Region',
  country: 'Country',
  description: 'Description',
  contact_owner: 'Contact Owner',
  created_by: 'Created By',
  modified_by: 'Modified By',
  created_time: 'Created Date',
  modified_time: 'Modified Date',
  lead_name: 'Lead Name',
  lead_status: 'Lead Status',
  subject: 'Subject',
  start_time: 'Start Date',
  end_time: 'End Date',
  status: 'Status',
  outcome: 'Outcome',
  notes: 'Notes',
  join_url: 'Join URL',
  title: 'Title',
  priority: 'Priority',
  due_date: 'Due Date',
  due_time: 'Due Time',
  assigned_to: 'Assigned To',
  module_type: 'Module Type',
  deal_name: 'Deal Name',
  stage: 'Stage',
  total_contract_value: 'Contract Value',
  expected_closing_date: 'Expected Close Date',
  lead_owner: 'Lead Owner',
  account_owner: 'Account Owner',
  phone: 'Phone',
  tags: 'Tags',
  category: 'Category',
};

// Sample values for different field types
const getSampleValue = (field: string, enums?: string[]): string => {
  if (enums && enums.length > 0) {
    return enums.slice(0, 3).join(' | ');
  }

  // Date fields
  if (field.includes('date') || field === 'start_time' || field === 'end_time') {
    return 'YYYY-MM-DD';
  }
  if (field.includes('time') && !field.includes('date')) {
    return 'HH:mm';
  }

  // User fields
  if (field.includes('owner') || field.includes('_by') || field === 'assigned_to' || field === 'host') {
    return 'User Full Name';
  }

  // Specific field types
  switch (field) {
    case 'email':
      return 'example@email.com';
    case 'phone':
    case 'phone_no':
    case 'mobile_no':
      return '+1234567890';
    case 'website':
    case 'linkedin':
      return 'https://...';
    case 'tags':
      return 'tag1; tag2; tag3';
    case 'total_contract_value':
    case 'annual_revenue':
      return '10000';
    case 'probability':
      return '75';
    default:
      return '';
  }
};

export const generateImportTemplate = (moduleName: string): string => {
  const config = getColumnConfig(moduleName);
  
  // Exclude ID from import template (let DB generate)
  const exportFields = config.allowedColumns.filter(col => col !== 'id');
  
  // Create headers with human-readable labels
  const headers = exportFields.map(field => HEADER_LABELS[field] || field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
  
  // Create sample row with hints
  const sampleRow = exportFields.map(field => {
    const enumValues = config.enums[field];
    return getSampleValue(field, enumValues);
  });
  
  // Build CSV content
  const csvContent = [
    headers.join(','),
    sampleRow.map(val => val.includes(',') ? `"${val}"` : val).join(',')
  ].join('\n');
  
  return csvContent;
};

export const getTemplateConfig = (moduleName: string): TemplateConfig => {
  const config = getColumnConfig(moduleName);
  const exportFields = config.allowedColumns.filter(col => col !== 'id');
  
  const headers = exportFields.map(field => HEADER_LABELS[field] || field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
  
  const sampleRow = exportFields.map(field => {
    const enumValues = config.enums[field];
    return getSampleValue(field, enumValues);
  });
  
  const hints: Record<string, string> = {};
  exportFields.forEach(field => {
    const enumValues = config.enums[field];
    if (enumValues) {
      hints[field] = `Allowed values: ${enumValues.join(', ')}`;
    } else if (field.includes('date')) {
      hints[field] = 'Use format: YYYY-MM-DD';
    } else if (field.includes('owner') || field.includes('_by') || field === 'assigned_to') {
      hints[field] = 'Enter user full name (will be matched to user)';
    }
  });
  
  return { headers, sampleRow, hints };
};

export const downloadImportTemplate = (moduleName: string): void => {
  const csvContent = generateImportTemplate(moduleName);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', `${moduleName}_import_template.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
