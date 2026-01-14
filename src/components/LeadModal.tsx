import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCRUDAudit } from "@/hooks/useCRUDAudit";
import { useDuplicateDetection } from "@/hooks/useDuplicateDetection";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { LEAD_SOURCES } from "@/utils/leadStatusUtils";
import { DuplicateWarning } from "./shared/DuplicateWarning";
import { MergeRecordsModal } from "./shared/MergeRecordsModal";
import { AccountModal } from "./AccountModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const leadSchema = z.object({
  lead_name: z.string()
    .min(1, "Lead name is required")
    .min(2, "Lead name must be at least 2 characters")
    .max(100, "Lead name must be less than 100 characters"),
  account_id: z.string().optional(),
  position: z.string().max(100, "Position must be less than 100 characters").optional(),
  email: z.string().email("Please enter a valid email address (e.g., name@company.com)").optional().or(z.literal("")),
  phone_no: z.string().max(20, "Phone number must be less than 20 characters").optional(),
  linkedin: z.string().url("Please enter a valid LinkedIn URL (e.g., https://linkedin.com/in/username)").optional().or(z.literal("")),
  contact_source: z.string().optional(),
  lead_status: z.string().optional(),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
  contact_owner: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface Lead {
  id: string;
  lead_name: string;
  account_id?: string;
  position?: string;
  email?: string;
  phone_no?: string;
  linkedin?: string;
  contact_source?: string;
  description?: string;
  lead_status?: string;
}

interface Account {
  id: string;
  company_name: string;
}

interface LeadStatus {
  id: string;
  status_name: string;
  status_color: string | null;
  status_order: number;
}

interface LeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSuccess: () => void;
}

export const LeadModal = ({ open, onOpenChange, lead, onSuccess }: LeadModalProps) => {
  const { toast } = useToast();
  const { logCreate, logUpdate } = useCRUDAudit();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [users, setUsers] = useState<{ id: string; full_name: string | null }[]>([]);
  
  // Merge modal state
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");

  // Handler for when a new account is created
  const handleAccountCreated = (newAccount: Account) => {
    setAccounts(prev => [...prev, newAccount].sort((a, b) => a.company_name.localeCompare(b.company_name)));
    form.setValue('account_id', newAccount.id);
    setAccountModalOpen(false);
  };

  // Duplicate detection for leads
  const { duplicates, isChecking, checkDuplicates, clearDuplicates } = useDuplicateDetection({
    table: 'leads',
    nameField: 'lead_name',
    emailField: 'email',
  });

  // Debounced duplicate check
  const debouncedCheckDuplicates = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (name: string, email?: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          // Only check for new leads, not when editing
          if (!lead) {
            checkDuplicates(name, email);
          }
        }, 500);
      };
    })(),
    [lead, checkDuplicates]
  );

  // Fetch lead statuses from database
  const { data: leadStatuses = [] } = useQuery({
    queryKey: ['lead-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('id, status_name, status_color, status_order')
        .eq('is_active', true)
        .order('status_order', { ascending: true });
      
      if (error) {
        console.error('Error fetching lead statuses:', error);
        // Fallback to default statuses
        return [
          { id: '1', status_name: 'New', status_color: '#3b82f6', status_order: 0 },
          { id: '2', status_name: 'Attempted', status_color: '#f59e0b', status_order: 1 },
          { id: '3', status_name: 'Follow-up', status_color: '#64748b', status_order: 2 },
          { id: '4', status_name: 'Qualified', status_color: '#10b981', status_order: 3 },
          { id: '5', status_name: 'Disqualified', status_color: '#ef4444', status_order: 4 },
        ] as LeadStatus[];
      }
      return data as LeadStatus[];
    },
  });

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      lead_name: "",
      account_id: "",
      position: "",
      email: "",
      phone_no: "",
      linkedin: "",
      contact_source: "",
      lead_status: "New",
      description: "",
      contact_owner: "",
    },
  });

  // Fetch accounts and users for dropdowns
  useEffect(() => {
    const fetchData = async () => {
      const [accountsResult, usersResult] = await Promise.all([
        supabase.from('accounts').select('id, company_name').order('company_name', { ascending: true }),
        supabase.from('profiles').select('id, full_name').order('full_name', { ascending: true })
      ]);
      
      if (!accountsResult.error && accountsResult.data) {
        setAccounts(accountsResult.data);
      }
      if (!usersResult.error && usersResult.data) {
        setUsers(usersResult.data);
      }
    };
    
    if (open) {
      fetchData();
    }
  }, [open]);

  useEffect(() => {
    if (lead) {
      form.reset({
        lead_name: lead.lead_name || "",
        account_id: lead.account_id || "",
        position: lead.position || "",
        email: lead.email || "",
        phone_no: lead.phone_no || "",
        linkedin: lead.linkedin || "",
        contact_source: lead.contact_source || "",
        lead_status: lead.lead_status || "New",
        description: lead.description || "",
        contact_owner: (lead as any).contact_owner || "",
      });
    } else {
      form.reset({
        lead_name: "",
        account_id: "",
        position: "",
        email: "",
        phone_no: "",
        linkedin: "",
        contact_source: "",
        lead_status: "New",
        description: "",
        contact_owner: "",
      });
    }
  }, [lead, form]);

  const onSubmit = async (data: LeadFormData) => {
    try {
      setLoading(true);
      const user = await supabase.auth.getUser();
      
      if (!user.data.user) {
        toast({
          title: "Error",
          description: "You must be logged in to perform this action",
          variant: "destructive",
        });
        return;
      }

      // Check for exact email duplicate (blocking)
      if (data.email && !lead) {
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id, lead_name')
          .ilike('email', data.email)
          .maybeSingle();
        
        if (existingLead) {
          toast({
            title: "Duplicate Email",
            description: `This email already exists in Leads (${existingLead.lead_name}). Please use a different email.`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      // Prepare base data without created_by - that's set only on creation
      const baseLeadData = {
        lead_name: data.lead_name,
        account_id: data.account_id && data.account_id.trim() !== "" ? data.account_id : null,
        position: data.position || null,
        email: data.email || null,
        phone_no: data.phone_no || null,
        linkedin: data.linkedin || null,
        contact_source: data.contact_source || null,
        lead_status: data.lead_status || 'New',
        description: data.description || null,
        modified_by: user.data.user.id,
        contact_owner: data.contact_owner || user.data.user.id,
      };

      if (lead) {
        console.log('Updating lead with data:', { ...baseLeadData, modified_time: new Date().toISOString() });
        
        const { data: updatedLead, error } = await supabase
          .from('leads')
          .update({
            ...baseLeadData,
            modified_time: new Date().toISOString(),
          })
          .eq('id', lead.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating lead:', error);
          throw error;
        }
        
        console.log('Lead updated successfully:', updatedLead);

        await logUpdate('leads', lead.id, baseLeadData, lead);

        toast({
          title: "Success",
          description: "Lead updated successfully",
        });
      } else {
        // For new leads, add created_by and contact_owner
        const newLeadData = {
          ...baseLeadData,
          created_by: user.data.user.id,
          created_time: new Date().toISOString(),
        };
        
        console.log('Creating new lead with data:', newLeadData);
        
        const { data: newLead, error } = await supabase
          .from('leads')
          .insert(newLeadData)
          .select()
          .single();

        if (error) {
          console.error('Error creating lead:', error);
          throw error;
        }
        
        console.log('Lead created successfully:', newLead);

        await logCreate('leads', newLead.id, newLeadData);

        toast({
          title: "Success",
          description: "Lead created successfully",
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: lead ? "Failed to update lead" : "Failed to create lead",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter(account =>
    account.company_name.toLowerCase().includes(accountSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" disableOutsidePointerEvents={false}>
        <DialogHeader>
          <DialogTitle>
            {lead ? "Edit Lead" : "Add New Lead"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            {/* Duplicate Warning */}
            {!lead && duplicates.length > 0 && (
              <DuplicateWarning 
                duplicates={duplicates} 
                entityType="lead"
                onMerge={(duplicateId) => {
                  setMergeTargetId(duplicateId);
                  setMergeModalOpen(true);
                }}
                preventCreation={duplicates.some(d => d.matchType === "exact")}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="lead_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Name *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., John Smith"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          debouncedCheckDuplicates(e.target.value, form.getValues('email'));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account...">
                            {field.value && accounts.find(a => a.id === field.value)?.company_name}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <div className="px-2 py-1 flex gap-1">
                          <Input
                            placeholder="Search accounts..."
                            value={accountSearch}
                            onChange={(e) => setAccountSearch(e.target.value)}
                            inputSize="control"
                            className="flex-1"
                          />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setAccountModalOpen(true);
                                  }}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Add new account</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        {filteredAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.company_name}
                          </SelectItem>
                        ))}
                        {filteredAccounts.length === 0 && (
                          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                            No accounts found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., CEO, Sales Manager" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="e.g., name@company.com" 
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          debouncedCheckDuplicates(form.getValues('lead_name'), e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 234 567 8900" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="linkedin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn Profile</FormLabel>
                    <FormControl>
                      <Input placeholder="https://linkedin.com/in/username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Source</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LEAD_SOURCES.map((source) => (
                          <SelectItem key={source} value={source}>
                            {source}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lead_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leadStatuses.map((status) => (
                          <SelectItem key={status.id} value={status.status_name}>
                            <div className="flex items-center gap-2">
                              {status.status_color && (
                                <span 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ backgroundColor: status.status_color }}
                                />
                              )}
                              {status.status_name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_owner"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Owner</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select owner..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name || 'Unknown User'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about the lead..."
                      className="min-h-20"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {lead ? "Saving..." : "Creating..."}
                  </>
                ) : lead ? "Save Changes" : "Add Lead"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>

      {/* Nested Account Modal */}
      <AccountModal
        open={accountModalOpen}
        onOpenChange={setAccountModalOpen}
        onSuccess={() => {}}
        onCreated={handleAccountCreated}
      />

      {/* Merge Modal */}
      {mergeTargetId && (
        <MergeRecordsModal
          open={mergeModalOpen}
          onOpenChange={(open) => {
            setMergeModalOpen(open);
            if (!open) setMergeTargetId("");
          }}
          entityType="leads"
          sourceId=""
          targetId={mergeTargetId}
          onSuccess={() => {
            onSuccess();
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
};
