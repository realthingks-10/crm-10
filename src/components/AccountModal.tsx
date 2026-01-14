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
import { X, ChevronDown } from "lucide-react";
import { Account } from "./AccountTable";
import { DuplicateWarning } from "./shared/DuplicateWarning";
import { MergeRecordsModal } from "./shared/MergeRecordsModal";
import { regions, regionCountries } from "@/utils/countryData";

const accountSchema = z.object({
  company_name: z.string()
    .min(1, "Company name is required")
    .min(2, "Company name must be at least 2 characters")
    .max(100, "Company name must be less than 100 characters"),
  email: z.string().email("Please enter a valid email address (e.g., contact@company.com)").optional().or(z.literal("")),
  region: z.string().optional(),
  country: z.string().optional(),
  website: z.string()
    .refine((val) => !val || val.startsWith('http://') || val.startsWith('https://') || /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/.test(val), {
      message: "Please enter a valid URL (e.g., https://company.com or company.com)"
    })
    .optional()
    .or(z.literal("")),
  company_type: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().max(2000, "Notes must be less than 2000 characters").optional(),
  industry: z.string().optional(),
  phone: z.string()
    .refine((val) => !val || /^[+]?[\d\s\-().]{7,20}$/.test(val), {
      message: "Please enter a valid phone number (e.g., +1 234 567 8900)"
    })
    .optional(),
  account_owner: z.string().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
  onSuccess: () => void;
  onCreated?: (account: Account) => void;
}

const statuses = ["New", "Working", "Warm", "Hot", "Nurture", "Closed-Won", "Closed-Lost"];

const tagOptions = [
  "AUTOSAR", "Adaptive AUTOSAR", "Embedded Systems", "BSW", "ECU", "Zone Controller",
  "HCP", "CI/CD", "V&V Testing", "Integration", "Software Architecture", "LINUX",
  "QNX", "Cybersecurity", "FuSa", "OTA", "Diagnostics", "Vehicle Network",
  "Vehicle Architecture", "Connected Car", "Platform", "µC/HW"
];

const industries = [
  "Automotive", "Technology", "Manufacturing", "Healthcare", "Finance/Banking",
  "Retail", "Energy", "Aerospace", "Telecommunications", "Logistics",
  "Government", "Education", "Consulting", "Software", "Electronics", "Other"
];

const companyTypes = ["OEM", "Tier-1", "Tier-2", "Startup", "Enterprise", "SMB", "Government", "Non-Profit", "Other"];



export const AccountModal = ({ open, onOpenChange, account, onSuccess, onCreated }: AccountModalProps) => {
  const { toast } = useToast();
  const { logCreate, logUpdate } = useCRUDAudit();
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name: string | null }[]>([]);
  
  // Merge modal state
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");

  // Duplicate detection for accounts
  const { duplicates, isChecking, checkDuplicates, clearDuplicates } = useDuplicateDetection({
    table: 'accounts',
    nameField: 'company_name',
    emailField: 'email',
  });

  // Debounced duplicate check
  const debouncedCheckDuplicates = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (name: string, email?: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          // Only check for new accounts, not when editing
          if (!account) {
            checkDuplicates(name, email);
          }
        }, 500);
      };
    })(),
    [account, checkDuplicates]
  );

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      company_name: "",
      email: "",
      region: "",
      country: "",
      website: "",
      company_type: "",
      status: "New",
      notes: "",
      industry: "",
      phone: "",
      account_owner: "",
    },
  });

  const watchedRegion = form.watch("region");

  useEffect(() => {
    if (watchedRegion && regionCountries[watchedRegion]) {
      setAvailableCountries(regionCountries[watchedRegion]);
    } else {
      setAvailableCountries([]);
    }
  }, [watchedRegion]);

  // Fetch users for owner dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name', { ascending: true });
      
      if (!error && data) {
        setUsers(data);
      }
    };
    
    if (open) {
      fetchUsers();
    }
  }, [open]);

  useEffect(() => {
    if (account) {
      form.reset({
        company_name: account.company_name || "",
        email: account.email || "",
        region: account.region || "",
        country: account.country || "",
        website: account.website || "",
        company_type: account.company_type || "",
        status: account.status || "New",
        notes: account.notes || "",
        industry: account.industry || "",
        phone: account.phone || "",
        account_owner: account.account_owner || "",
      });
      setSelectedTags(account.tags || []);
      if (account.region && regionCountries[account.region]) {
        setAvailableCountries(regionCountries[account.region]);
      }
    } else {
      form.reset({
        company_name: "",
        email: "",
        region: "",
        country: "",
        website: "",
        company_type: "",
        status: "New",
        notes: "",
        industry: "",
        phone: "",
        account_owner: "",
      });
      setSelectedTags([]);
    }
  }, [account, form]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const onSubmit = async (data: AccountFormData) => {
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
      if (data.email && !account) {
        const { data: existingAccount } = await supabase
          .from('accounts')
          .select('id, company_name')
          .ilike('email', data.email)
          .maybeSingle();
        
        if (existingAccount) {
          toast({
            title: "Duplicate Email",
            description: `This email already exists in Accounts (${existingAccount.company_name}). Please use a different email.`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      // Build account data with owner
      const accountData = {
        company_name: data.company_name,
        email: data.email || null,
        region: data.region || null,
        country: data.country || null,
        website: data.website || null,
        company_type: data.company_type || null,
        tags: selectedTags.length > 0 ? selectedTags : null,
        status: data.status || 'New',
        notes: data.notes || null,
        industry: data.industry || null,
        phone: data.phone || null,
        modified_by: user.data.user.id,
        account_owner: data.account_owner || user.data.user.id,
      };

      if (account) {
        const { error } = await supabase
          .from('accounts')
          .update({
            ...accountData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', account.id);

        if (error) throw error;

        await logUpdate('accounts', account.id, accountData, account);

        toast({
          title: "Success",
          description: "Account updated successfully",
        });
      } else {
        const { data: newAccount, error } = await supabase
          .from('accounts')
          .insert({
            ...accountData,
            created_by: user.data.user.id,
          })
          .select()
          .single();

        if (error) throw error;

        await logCreate('accounts', newAccount.id, accountData);

        toast({
          title: "Success",
          description: "Account created successfully",
        });

        // Call onCreated callback if provided
        if (onCreated && newAccount) {
          onCreated(newAccount as Account);
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: account ? "Failed to update account" : "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" disableOutsidePointerEvents={false}>
        <DialogHeader>
          <DialogTitle>
            {account ? "Edit Account" : "Add New Account"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            {/* Duplicate Warning */}
            {!account && duplicates.length > 0 && (
              <DuplicateWarning 
                duplicates={duplicates} 
                entityType="account"
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
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Acme Corporation"
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g., name@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select industry..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {industries.map((industry) => (
                          <SelectItem key={industry} value={industry}>
                            {industry}
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
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select region..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {regions.map((region) => (
                          <SelectItem key={region} value={region}>
                            {region}
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
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!watchedRegion}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={watchedRegion ? "Select country..." : "Select region first..."} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableCountries.map((country) => (
                          <SelectItem key={country} value={country}>
                            {country}
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
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 234 567 8900" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select company type..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companyTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
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
                        {statuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
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
                name="account_owner"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Owner</FormLabel>
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
                    className="w-full justify-between h-auto min-h-10 py-2"
                  >
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      {selectedTags.length > 0 ? (
                        <div className="flex gap-1 flex-wrap flex-1">
                          {selectedTags.slice(0, 4).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {selectedTags.length > 4 && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Badge 
                                  variant="outline" 
                                  className="text-xs cursor-pointer hover:bg-muted"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  +{selectedTags.length - 4} more
                                </Badge>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-2" side="top" onClick={(e) => e.stopPropagation()}>
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {selectedTags.slice(4).map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Select tags...</span>
                      )}
                    </div>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[480px] p-0 bg-popover border shadow-lg z-50" align="start">
                  <div className="p-4 max-h-[350px] overflow-y-auto">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Select Tags</span>
                      {selectedTags.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setSelectedTags([])}
                        >
                          Clear all
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {tagOptions.map((tag) => (
                        <Badge
                          key={tag}
                          variant={selectedTags.includes(tag) ? "default" : "outline"}
                          className="cursor-pointer hover:opacity-80 transition-opacity justify-center py-1.5 text-xs"
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about the account..."
                      className="min-h-24"
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
                    <span className="animate-spin mr-2">⏳</span>
                    {account ? "Saving..." : "Creating..."}
                  </>
                ) : account ? "Save Changes" : "Add Account"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>

      {/* Merge Modal */}
      {mergeTargetId && (
        <MergeRecordsModal
          open={mergeModalOpen}
          onOpenChange={(open) => {
            setMergeModalOpen(open);
            if (!open) setMergeTargetId("");
          }}
          entityType="accounts"
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
