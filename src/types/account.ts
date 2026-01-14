// Shared Account type definition

export interface Account {
  id: string;
  company_name: string;
  region?: string | null;
  country?: string | null;
  website?: string | null;
  company_type?: string | null;
  tags?: string[] | null;
  status?: string | null;
  notes?: string | null;
  account_owner?: string | null;
  industry?: string | null;
  phone?: string | null;
  email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  modified_by?: string | null;
  deal_count?: number | null;
  contact_count?: number | null;
  lead_count?: number | null;
  last_activity_date?: string | null;
}

export interface AccountFormData {
  company_name: string;
  email?: string;
  region?: string;
  country?: string;
  website?: string;
  company_type?: string;
  status?: string;
  notes?: string;
  industry?: string;
  phone?: string;
}
