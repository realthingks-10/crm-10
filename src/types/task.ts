export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskModuleType = 'accounts' | 'contacts' | 'leads' | 'meetings' | 'deals';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: string | null;
  due_date: string | null;
  due_time: string | null;
  assigned_to: string | null;
  created_by: string | null;
  module_type: TaskModuleType | null;
  account_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  meeting_id: string | null;
  deal_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  // Joined data
  lead_name?: string;
  contact_name?: string;
  deal_name?: string;
  account_name?: string;
  meeting_subject?: string;
  deal_stage?: string;
  contact_account_name?: string;
  lead_account_name?: string;
  assigned_user_name?: string;
  created_by_name?: string;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  assigned_to?: string;
  module_type?: TaskModuleType;
  account_id?: string;
  contact_id?: string;
  lead_id?: string;
  meeting_id?: string;
  deal_id?: string;
}

export interface TaskModalContext {
  module?: TaskModuleType;
  recordId?: string;
  recordName?: string;
  locked?: boolean;
}
