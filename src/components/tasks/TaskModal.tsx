import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Task, CreateTaskData, TaskStatus, TaskPriority, TaskModuleType, TaskModalContext } from '@/types/task';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, CalendarIcon, Plus, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AccountModal } from '@/components/AccountModal';
import { ContactModal } from '@/components/ContactModal';
import { LeadModal } from '@/components/LeadModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Generate 30-minute time slots
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']),
  priority: z.enum(['high', 'medium', 'low']),
  due_date: z.string().min(1, 'Due date is required'),
  due_time: z.string().optional(),
  assigned_to: z.string().optional(),
  module_type: z.enum(['accounts', 'contacts', 'leads', 'meetings', 'deals']).optional(),
  account_id: z.string().optional(),
  contact_id: z.string().optional(),
  lead_id: z.string().optional(),
  meeting_id: z.string().optional(),
  deal_id: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  onSubmit: (data: CreateTaskData) => Promise<any>;
  onUpdate?: (taskId: string, data: Partial<Task>, originalTask?: Task) => Promise<boolean>;
  context?: TaskModalContext;
  nested?: boolean;
}

export const TaskModal = ({
  open,
  onOpenChange,
  task,
  onSubmit,
  onUpdate,
  context,
  nested = false,
}: TaskModalProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [accounts, setAccounts] = useState<{ id: string; company_name: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: string; contact_name: string }[]>([]);
  const [leads, setLeads] = useState<{ id: string; lead_name: string }[]>([]);
  const [meetings, setMeetings] = useState<{ id: string; subject: string; start_time: string }[]>([]);
  const [deals, setDeals] = useState<{ id: string; deal_name: string; stage: string }[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Modal states for creating new entities
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'open',
      priority: 'medium',
      due_date: '',
      due_time: '',
      assigned_to: '',
      module_type: undefined,
      account_id: '',
      contact_id: '',
      lead_id: '',
      meeting_id: '',
      deal_id: '',
    },
  });

  const selectedModule = form.watch('module_type');
  const isModuleLocked = context?.locked && context?.module;

  // Fetch current user's display name
  useEffect(() => {
    const fetchCurrentUserName = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (data?.full_name && !data.full_name.includes('@')) {
        setCurrentUserName(data.full_name);
      } else {
        setCurrentUserName(user.email?.split('@')[0] || 'Current User');
      }
    };
    fetchCurrentUserName();
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (open) {
      fetchDropdownData();
      if (task) {
        form.reset({
          title: task.title,
          description: task.description || '',
          status: task.status,
          priority: task.priority,
          due_date: task.due_date || '',
          due_time: task.due_time || '',
          assigned_to: task.assigned_to || '',
          module_type: task.module_type || undefined,
          account_id: task.account_id || '',
          contact_id: task.contact_id || '',
          lead_id: task.lead_id || '',
          meeting_id: task.meeting_id || '',
          deal_id: task.deal_id || '',
        });
      } else {
        form.reset({
          title: '',
          description: '',
          status: 'open',
          priority: 'medium',
          due_date: '',
          due_time: '',
          assigned_to: '',
          module_type: context?.module || undefined,
          account_id: context?.module === 'accounts' ? context?.recordId : '',
          contact_id: context?.module === 'contacts' ? context?.recordId : '',
          lead_id: context?.module === 'leads' ? context?.recordId : '',
          meeting_id: context?.module === 'meetings' ? context?.recordId : '',
          deal_id: context?.module === 'deals' ? context?.recordId : '',
        });
      }
    }
  }, [open, task, form, context]);

  const fetchDropdownData = async () => {
    const [usersRes, accountsRes, contactsRes, leadsRes, meetingsRes, dealsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name'),
      supabase.from('accounts').select('id, company_name').order('company_name'),
      supabase.from('contacts').select('id, contact_name').order('contact_name'),
      supabase.from('leads').select('id, lead_name').order('lead_name'),
      supabase.from('meetings').select('id, subject, start_time').order('start_time', { ascending: false }).limit(100),
      supabase.from('deals').select('id, deal_name, stage').order('deal_name'),
    ]);

    if (usersRes.data) setUsers(usersRes.data);
    if (accountsRes.data) setAccounts(accountsRes.data);
    if (contactsRes.data) setContacts(contactsRes.data);
    if (leadsRes.data) setLeads(leadsRes.data);
    if (meetingsRes.data) setMeetings(meetingsRes.data);
    if (dealsRes.data) setDeals(dealsRes.data);
  };

  const handleModuleChange = (value: TaskModuleType) => {
    form.setValue('module_type', value);
    form.setValue('account_id', '');
    form.setValue('contact_id', '');
    form.setValue('lead_id', '');
    form.setValue('meeting_id', '');
    form.setValue('deal_id', '');
  };

  const handleAccountCreated = (newAccount: { id: string; company_name: string }) => {
    setAccounts(prev => [...prev, newAccount].sort((a, b) => a.company_name.localeCompare(b.company_name)));
    form.setValue('account_id', newAccount.id);
    setAccountModalOpen(false);
  };

  const handleContactCreated = () => {
    fetchDropdownData();
    setContactModalOpen(false);
  };

  const handleLeadCreated = () => {
    fetchDropdownData();
    setLeadModalOpen(false);
  };

  const handleSubmit = async (data: TaskFormData) => {
    setLoading(true);
    try {
      // Normalize special placeholder values to undefined
      const normalizedAssignedTo = data.assigned_to && data.assigned_to !== 'unassigned' ? data.assigned_to : undefined;
      const normalizedDueTime = data.due_time && data.due_time !== 'none' ? data.due_time : undefined;

      const taskData: CreateTaskData & { due_time?: string } = {
        title: data.title,
        description: data.description || undefined,
        status: data.status as TaskStatus,
        priority: data.priority as TaskPriority,
        due_date: data.due_date,
        due_time: normalizedDueTime,
        assigned_to: normalizedAssignedTo,
        module_type: data.module_type as TaskModuleType | undefined,
        account_id: data.account_id || undefined,
        contact_id: data.contact_id || undefined,
        lead_id: data.lead_id || undefined,
        meeting_id: data.meeting_id || undefined,
        deal_id: data.deal_id || undefined,
      };

      let success = false;
      if (task && onUpdate) {
        success = await onUpdate(task.id, taskData, task);
      } else {
        const result = await onSubmit(taskData);
        success = result !== null && result !== undefined;
      }

      if (success) {
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderEntitySelector = () => {
    if (!selectedModule) return null;

    const commonButtonProps = {
      type: "button" as const,
      variant: "outline" as const,
      size: "icon" as const,
      className: "shrink-0 h-8 w-8",
      disabled: !!isModuleLocked,
    };

    switch (selectedModule) {
      case 'accounts':
        return (
          <FormField
            control={form.control}
            name="account_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account</FormLabel>
                <div className="flex gap-2">
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={!!isModuleLocked}>
                    <FormControl>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select account..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button {...commonButtonProps} onClick={() => setAccountModalOpen(true)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add new account</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </FormItem>
            )}
          />
        );

      case 'contacts':
        return (
          <FormField
            control={form.control}
            name="contact_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact</FormLabel>
                <div className="flex gap-2">
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={!!isModuleLocked}>
                    <FormControl>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select contact..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contacts.map(contact => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.contact_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button {...commonButtonProps} onClick={() => setContactModalOpen(true)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add new contact</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </FormItem>
            )}
          />
        );

      case 'leads':
        return (
          <FormField
            control={form.control}
            name="lead_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lead</FormLabel>
                <div className="flex gap-2">
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={!!isModuleLocked}>
                    <FormControl>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select lead..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {leads.map(lead => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.lead_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button {...commonButtonProps} onClick={() => setLeadModalOpen(true)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add new lead</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </FormItem>
            )}
          />
        );

      case 'meetings':
        return (
          <FormField
            control={form.control}
            name="meeting_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meeting</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''} disabled={!!isModuleLocked}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select meeting..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {meetings.map(meeting => (
                      <SelectItem key={meeting.id} value={meeting.id}>
                        {meeting.subject} ({format(new Date(meeting.start_time), 'MMM d, yyyy')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        );

      case 'deals':
        return (
          <FormField
            control={form.control}
            name="deal_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deal</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''} disabled={!!isModuleLocked}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select deal..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {deals.map(deal => (
                      <SelectItem key={deal.id} value={deal.id}>
                        {deal.deal_name} ({deal.stage})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
        <DialogContent 
          className="max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200"
          onOpenAutoFocus={(e) => {
            // Ensure focus is properly set when dialog opens
            setTimeout(() => {
              const firstInput = document.querySelector('[data-radix-dialog-content] input:not([disabled])') as HTMLInputElement;
              if (firstInput) {
                firstInput.focus();
              }
            }, 50);
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {task ? 'Edit Task' : 'Create Task'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Row 1: Module and Entity Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="module_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Module</FormLabel>
                      <Select 
                        onValueChange={handleModuleChange} 
                        value={field.value || ''}
                        disabled={!!isModuleLocked}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select module..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="accounts">Accounts</SelectItem>
                          <SelectItem value="contacts">Contacts</SelectItem>
                          <SelectItem value="leads">Leads</SelectItem>
                          <SelectItem value="meetings">Meetings</SelectItem>
                          <SelectItem value="deals">Deals</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {renderEntitySelector()}
              </div>

              {/* Row 2: Task Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Title <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Follow up with client about proposal" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Row 3: Assigned To and Due Date/Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="assigned_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned To</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select user..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unassigned">
                            <span className="text-muted-foreground">Unassigned</span>
                          </SelectItem>
                          {users.map(u => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.full_name || 'Unknown User'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date <span className="text-destructive">*</span></FormLabel>
                        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal h-8",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(new Date(field.value), 'MMM d, yyyy') : 'Pick date'}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => {
                                field.onChange(date ? format(date, 'yyyy-MM-dd') : '');
                                setCalendarOpen(false);
                              }}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="due_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Time..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">No time</span>
                            </SelectItem>
                            {TIME_SLOTS.map(time => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Row 4: Priority and Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="high">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-red-500" />
                              High
                            </div>
                          </SelectItem>
                          <SelectItem value="medium">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-yellow-500" />
                              Medium
                            </div>
                          </SelectItem>
                          <SelectItem value="low">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-green-500" />
                              Low
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Row 5: Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add task details, notes, or context..."
                        className="resize-none min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Row 6: Created By (Read-only) */}
              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Created by:</span>
                  <span className="font-medium text-foreground">{currentUserName || 'Loading...'}</span>
                </div>
              </div>

              {/* Footer: Actions */}
              <DialogFooter className="pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {task ? 'Update Task' : 'Create Task'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Nested Modals */}
      <AccountModal
        open={accountModalOpen}
        onOpenChange={setAccountModalOpen}
        account={null}
        onSuccess={() => {
          fetchDropdownData();
          setAccountModalOpen(false);
        }}
        onCreated={(newAccount) => {
          handleAccountCreated(newAccount);
        }}
      />

      <ContactModal
        open={contactModalOpen}
        onOpenChange={setContactModalOpen}
        contact={null}
        onSuccess={() => {
          handleContactCreated();
        }}
      />

      <LeadModal
        open={leadModalOpen}
        onOpenChange={setLeadModalOpen}
        lead={null}
        onSuccess={() => {
          handleLeadCreated();
        }}
      />
    </>
  );
};
