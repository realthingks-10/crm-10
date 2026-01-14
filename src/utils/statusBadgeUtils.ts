// Shared status badge utilities for consistent styling across components

// Task Status Utilities
export const TASK_STATUSES = ['open', 'in_progress', 'completed', 'cancelled'] as const;
export type TaskStatusType = typeof TASK_STATUSES[number];

export const getTaskStatusColor = (status?: string | null): string => {
  switch (status?.toLowerCase()) {
    case 'open':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'in_progress':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'cancelled':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border-gray-200 dark:border-gray-700';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

export const getTaskStatusLabel = (status?: string | null): string => {
  switch (status?.toLowerCase()) {
    case 'open':
      return 'Open';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status || 'Unknown';
  }
};

// Task Priority Utilities
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriorityType = typeof TASK_PRIORITIES[number];

export const getTaskPriorityColor = (priority?: string | null): string => {
  switch (priority?.toLowerCase()) {
    case 'high':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    case 'medium':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'low':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

// Meeting Status Utilities
export const MEETING_STATUSES = ['scheduled', 'ongoing', 'completed', 'cancelled', 'no_show'] as const;
export type MeetingStatusType = typeof MEETING_STATUSES[number];

export const getMeetingStatusColor = (status?: string | null): string => {
  switch (status?.toLowerCase()) {
    case 'scheduled':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'ongoing':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'cancelled':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border-gray-200 dark:border-gray-700';
    case 'no_show':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

// Deal Stage Utilities
export const getDealStageColor = (stage?: string | null): string => {
  switch (stage?.toLowerCase()) {
    case 'lead':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    case 'discussions':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'qualified':
      return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
    case 'rfq':
      return 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    case 'offered':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'won':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'lost':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    case 'dropped':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border-gray-200 dark:border-gray-700';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

// Module Type Badge Utilities
export const getModuleTypeColor = (moduleType?: string | null): string => {
  switch (moduleType?.toLowerCase()) {
    case 'accounts':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'contacts':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'leads':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'meetings':
      return 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    case 'deals':
      return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

export const getModuleTypeLabel = (moduleType?: string | null): string => {
  switch (moduleType?.toLowerCase()) {
    case 'accounts':
      return 'Account';
    case 'contacts':
      return 'Contact';
    case 'leads':
      return 'Lead';
    case 'meetings':
      return 'Meeting';
    case 'deals':
      return 'Deal';
    default:
      return moduleType || 'Unknown';
  }
};

// Lead Status Badge Utilities
export const getLeadStatusColor = (status?: string | null): string => {
  switch (status) {
    case 'New':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'Attempted':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'Follow-up':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    case 'Qualified':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'Disqualified':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    case 'Converted':
      return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

// Account Status Badge Utilities  
export const getAccountStatusBadgeColor = (status?: string | null): string => {
  switch (status?.toLowerCase()) {
    case 'new':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'working':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'warm':
      return 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300 border-orange-200 dark:border-orange-800';
    case 'hot':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    case 'nurture':
      return 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    case 'closed-won':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'closed-lost':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border-gray-200 dark:border-gray-700';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};
