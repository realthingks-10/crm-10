import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCRUDAudit } from "@/hooks/useCRUDAudit";
import { useDuplicateDetection } from "@/hooks/useDuplicateDetection";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, ChevronDown, Plus, Loader2 } from "lucide-react";
import { DuplicateWarning } from "./shared/DuplicateWarning";
import { MergeRecordsModal } from "./shared/MergeRecordsModal";
import { AccountModal } from "./AccountModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Helper function for URL validation
const normalizeUrl = (url: string) => {
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
};

// Phone number validation regex - allows various international formats
const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/;

const contactSchema = z.object({
  contact_name: z.string()
    .min(1, "Contact name is required")
    .min(2, "Contact name must be at least 2 characters")
    .max(100, "Contact name must be less than 100 characters"),
  account_id: z.string().optional(),
  position: z.string().max(100, "Position must be less than 100 characters").optional(),
  email: z.string().email("Please enter a valid email address (e.g., name@company.com)").optional().or(z.literal("")),
  phone_no: z.string()
    .refine((val) => !val || phoneRegex.test(val.replace(/\s/g, '')), {
      message: "Please enter a valid phone number (e.g., +1 234 567 8900)",
    })
    .optional(),
  linkedin: z.string()
    .refine((val) => !val || val.includes('linkedin.com'), {
      message: "Please enter a valid LinkedIn URL (e.g., https://linkedin.com/in/username)",
    })
    .optional()
    .or(z.literal("")),
  contact_source: z.string().optional(),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
  contact_owner: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface Contact {
  id: string;
  contact_name: string;
  account_id?: string;
  company_name?: string;
  position?: string;
  email?: string;
  phone_no?: string;
  linkedin?: string;
  contact_source?: string;
  description?: string;
  tags?: string[];
}

interface Account {
  id: string;
  company_name: string;
}

interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  onSuccess: () => void;
}

const contactSources = [
  "Website",
  "Referral",
  "LinkedIn",
  "Cold Call",
  "Trade Show",
  "Email Campaign",
  "Social Media",
  "Partner",
  "Other"
];

const tagOptions = [
  "AUTOSAR", "Adaptive AUTOSAR", "Embedded Systems", "BSW", "ECU", "Zone Controller",
  "HCP", "CI/CD", "V&V Testing", "Integration", "Software Architecture", "LINUX",
  "QNX", "Cybersecurity", "FuSa", "OTA", "Diagnostics", "Vehicle Network",
  "Vehicle Architecture", "Connected Car", "Platform", "µC/HW"
];

export const ContactModal = ({ open, onOpenChange, contact, onSuccess }: ContactModalProps) => {
  const { toast } = useToast();
  const { logCreate, logUpdate } = useCRUDAudit();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
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

  // Duplicate detection for contacts
  const { duplicates, isChecking, checkDuplicates, clearDuplicates } = useDuplicateDetection({
    table: 'contacts',
    nameField: 'contact_name',
    emailField: 'email',
  });

  // Debounced duplicate check
  const debouncedCheckDuplicates = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (name: string, email?: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          // Only check for new contacts, not when editing
          if (!contact) {
            checkDuplicates(name, email);
          }
        }, 500);
      };
    })(),
    [contact, checkDuplicates]
  );

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      contact_name: "",
      account_id: "",
      position: "",
      email: "",
      phone_no: "",
      linkedin: "",
      contact_source: "",
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
    if (contact) {
      form.reset({
        contact_name: contact.contact_name || "",
        account_id: contact.account_id || "",
        position: contact.position || "",
        email: contact.email || "",
        phone_no: contact.phone_no || "",
        linkedin: contact.linkedin || "",
        contact_source: contact.contact_source || "",
        description: contact.description || "",
        contact_owner: (contact as any).contact_owner || "",
      });
      setSelectedTags(contact.tags || []);
    } else {
      form.reset({
        contact_name: "",
        account_id: "",
        position: "",
        email: "",
        phone_no: "",
        linkedin: "",
        contact_source: "",
        description: "",
        contact_owner: "",
      });
      setSelectedTags([]);
    }
  }, [contact, form]);

  const onSubmit = async (data: ContactFormData) => {
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
      if (data.email && !contact) {
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id, contact_name')
          .ilike('email', data.email)
          .maybeSingle();
        
        if (existingContact) {
          toast({
            title: "Duplicate Email",
            description: `This email already exists in Contacts (${existingContact.contact_name}). Please use a different email.`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      // Get company_name from selected account
      const selectedAccount = accounts.find(acc => acc.id === data.account_id);
      
      const contactData = {
        contact_name: data.contact_name,
        account_id: data.account_id || null,
        company_name: selectedAccount?.company_name || null,
        position: data.position || null,
        email: data.email || null,
        phone_no: data.phone_no || null,
        linkedin: data.linkedin ? normalizeUrl(data.linkedin) : null,
        contact_source: data.contact_source || null,
        description: data.description || null,
        tags: selectedTags,
        created_by: user.data.user.id,
        modified_by: user.data.user.id,
        contact_owner: data.contact_owner || user.data.user.id,
      };

      if (contact) {
        const { error } = await supabase
          .from('contacts')
          .update({
            ...contactData,
            modified_time: new Date().toISOString(),
          })
          .eq('id', contact.id)
          .select()
          .single();

        if (error) throw error;

        await logUpdate('contacts', contact.id, contactData, contact);

        toast({
          title: "Success",
          description: "Contact updated successfully",
        });
      } else {
        const { data: newContact, error } = await supabase
          .from('contacts')
          .insert(contactData)
          .select()
          .single();

        if (error) throw error;

        await logCreate('contacts', newContact.id, contactData);

        toast({
          title: "Success",
          description: "Contact created successfully",
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving contact:', error);
      toast({
        title: "Error",
        description: contact ? "Failed to update contact" : "Failed to create contact",
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
            {contact ? "Edit Contact" : "Add New Contact"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            {/* Duplicate Warning */}
            {!contact && duplicates.length > 0 && (
              <DuplicateWarning 
                duplicates={duplicates} 
                entityType="contact"
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
                name="contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Jane Doe"
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account..." />
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
                          debouncedCheckDuplicates(form.getValues('contact_name'), e.target.value);
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
                    <FormLabel>Contact Source</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contactSources.map((source) => (
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
                name="contact_owner"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Owner</FormLabel>
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

            {/* Tags Multi-select */}
            <div className="space-y-2">
              <FormLabel>Tags</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between h-auto min-h-10"
                  >
                    <div className="flex flex-wrap gap-1 flex-1">
                      {selectedTags.length > 0 ? (
                        selectedTags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">Select tags...</span>
                      )}
                      {selectedTags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{selectedTags.length - 3} more
                        </Badge>
                      )}
                    </div>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 bg-popover z-50" align="start">
                  <div className="p-3 max-h-[300px] overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {tagOptions.map((tag) => (
                        <Badge
                          key={tag}
                          variant={selectedTags.includes(tag) ? "default" : "outline"}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => toggleTag(tag)}
                        >
                          {tag}
                          {selectedTags.includes(tag) && (
                            <X className="w-3 h-3 ml-1" />
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about the contact..."
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
                    {contact ? "Saving..." : "Creating..."}
                  </>
                ) : contact ? "Save Changes" : "Add Contact"}
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
          entityType="contacts"
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
