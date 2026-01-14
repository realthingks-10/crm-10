/**
 * Email-related constants for consistent styling and behavior
 */

// Email status colors for badges
export const EMAIL_STATUS_COLORS = {
  sent: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  delivered: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  opened: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-800 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
  },
  replied: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-800 dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-800',
  },
  bounced: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
  failed: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
  verifying: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-800 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
  },
  suspicious: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    text: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-yellow-400 dark:border-yellow-600',
  },
} as const;

// Message direction colors
export const MESSAGE_DIRECTION_COLORS = {
  sent: {
    accent: 'border-l-blue-500',
    bg: 'bg-blue-50/50 dark:bg-blue-950/20',
    icon: 'text-blue-500',
  },
  received: {
    accent: 'border-l-purple-500',
    bg: 'bg-purple-50/50 dark:bg-purple-950/20',
    icon: 'text-purple-500',
  },
} as const;

// Email variable placeholders
export const EMAIL_VARIABLES = [
  { variable: '{{contact_name}}', description: 'Contact\'s full name', aliases: ['{{name}}'] },
  { variable: '{{company_name}}', description: 'Company name' },
  { variable: '{{position}}', description: 'Contact\'s position/title' },
  { variable: '{{email}}', description: 'Contact\'s email address' },
  { variable: '{{first_name}}', description: 'Contact\'s first name' },
  { variable: '{{last_name}}', description: 'Contact\'s last name' },
] as const;

// Chart colors for analytics
export const ANALYTICS_COLORS = {
  sent: '#3b82f6',     // blue-500
  opened: '#10b981',   // emerald-500
  clicked: '#8b5cf6',  // violet-500
  replied: '#6366f1',  // indigo-500
  bounced: '#ef4444',  // red-500
  delivered: '#22c55e', // green-500
};

// Status icons mapping
export const EMAIL_STATUS_ICONS = {
  sent: 'Send',
  delivered: 'CheckCircle2',
  opened: 'Eye',
  replied: 'Reply',
  bounced: 'XCircle',
  failed: 'AlertTriangle',
  verifying: 'Loader2',
} as const;

// Quick filter options
export const EMAIL_QUICK_FILTERS = [
  { id: 'all', label: 'All Emails', value: 'all' },
  { id: 'unread', label: 'Unread', value: 'unread' },
  { id: 'opened', label: 'Opened', value: 'opened' },
  { id: 'replied', label: 'Replied', value: 'replied' },
  { id: 'bounced', label: 'Bounced', value: 'bounced' },
] as const;

// Date range options
export const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
] as const;

// Email type options
export const EMAIL_TYPE_OPTIONS = [
  { value: 'all', label: 'All Emails' },
  { value: 'contact', label: 'Contacts' },
  { value: 'lead', label: 'Leads' },
  { value: 'account', label: 'Accounts' },
] as const;

// Items per page options
export const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
export const DEFAULT_ITEMS_PER_PAGE = 10;
