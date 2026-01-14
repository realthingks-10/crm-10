import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle, ExternalLink, ArrowRight } from "lucide-react";

interface Contact {
  id: string;
  contact_name: string;
  company_name?: string;
  position?: string;
  email?: string;
  phone_no?: string;
  linkedin?: string;
  contact_source?: string;
  description?: string;
  contact_owner?: string;
}

interface ExistingLead {
  id: string;
  lead_name: string;
  email?: string;
  converted_from_contact_id?: string;
}

interface ConvertContactToLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onSuccess: () => void;
  onViewLead?: (leadId: string) => void;
  onMergeLead?: (contactId: string, leadId: string) => void;
}

export const ConvertContactToLeadModal = ({
  open,
  onOpenChange,
  contact,
  onSuccess,
  onViewLead,
  onMergeLead,
}: ConvertContactToLeadModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isChecking, setIsChecking] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [alreadyConverted, setAlreadyConverted] = useState<ExistingLead | null>(null);
  const [duplicateLeads, setDuplicateLeads] = useState<ExistingLead[]>([]);
  const [confirmCreateAnyway, setConfirmCreateAnyway] = useState(false);

  const checkForDuplicates = useCallback(async () => {
    if (!contact) return;

    setIsChecking(true);
    try {
      // First, check if this contact was already converted
      const { data: existingConversion } = await supabase
        .from("leads")
        .select("id, lead_name, email, converted_from_contact_id")
        .eq("converted_from_contact_id", contact.id)
        .maybeSingle();

      if (existingConversion) {
        setAlreadyConverted(existingConversion);
        setIsChecking(false);
        return;
      }

      // Check for duplicate leads by email
      const duplicates: ExistingLead[] = [];
      
      if (contact.email) {
        const { data: emailMatches } = await supabase
          .from("leads")
          .select("id, lead_name, email, converted_from_contact_id")
          .ilike("email", contact.email)
          .limit(5);

        if (emailMatches) {
          duplicates.push(...emailMatches);
        }
      }

      // Check for duplicate leads by name (similar matching)
      if (contact.contact_name && contact.contact_name.length >= 2) {
        const nameParts = contact.contact_name.toLowerCase().split(" ");
        const searchPattern = `%${nameParts[0]}%`;

        const { data: nameMatches } = await supabase
          .from("leads")
          .select("id, lead_name, email, converted_from_contact_id")
          .ilike("lead_name", searchPattern)
          .limit(5);

        if (nameMatches) {
          // Add only unique matches not already in duplicates
          nameMatches.forEach((match) => {
            if (!duplicates.find((d) => d.id === match.id)) {
              // Check if names are similar
              const matchName = match.lead_name?.toLowerCase() || "";
              const inputName = contact.contact_name.toLowerCase();
              if (matchName.includes(inputName) || inputName.includes(matchName)) {
                duplicates.push(match);
              }
            }
          });
        }
      }

      setDuplicateLeads(duplicates);
    } catch (error) {
      console.error("Error checking for duplicates:", error);
    } finally {
      setIsChecking(false);
    }
  }, [contact]);

  // Check for existing conversions and duplicates when modal opens
  useEffect(() => {
    if (open && contact) {
      checkForDuplicates();
    } else {
      // Reset state when modal closes
      setAlreadyConverted(null);
      setDuplicateLeads([]);
      setConfirmCreateAnyway(false);
    }
  }, [open, contact, checkForDuplicates]);

  const handleConvert = async () => {
    if (!contact) return;

    setIsConverting(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("User not authenticated");

      const leadData: Record<string, unknown> = {
        lead_name: contact.contact_name,
        converted_from_contact_id: contact.id,
        created_by: userData.user.id,
        contact_owner: userData.user.id,
        created_time: new Date().toISOString(),
        modified_time: new Date().toISOString(),
      };

      // Map contact fields to lead fields
      if (contact.company_name) leadData.company_name = contact.company_name;
      if (contact.position) leadData.position = contact.position;
      if (contact.email) leadData.email = contact.email;
      if (contact.phone_no) leadData.phone_no = contact.phone_no;
      if (contact.linkedin) leadData.linkedin = contact.linkedin;
      if (contact.contact_source) leadData.contact_source = contact.contact_source;
      if (contact.description) leadData.description = contact.description;
      if (contact.contact_owner) leadData.contact_owner = contact.contact_owner;

      const { error } = await supabase.from("leads").insert([leadData as any]);

      if (error) {
        // Handle unique constraint violation
        if (error.code === "23505" && error.message.includes("converted_from_contact")) {
          toast({
            title: "Already Converted",
            description: "This contact has already been converted to a lead.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Success",
        description: `Contact "${contact.contact_name}" has been converted to a lead.`,
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error converting contact to lead:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to convert contact to lead.",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  const handleViewExistingLead = (leadId: string) => {
    onOpenChange(false);
    if (onViewLead) {
      onViewLead(leadId);
    }
  };

  const handleMergeWithLead = (leadId: string) => {
    if (contact && onMergeLead) {
      onMergeLead(contact.id, leadId);
      onOpenChange(false);
    }
  };

  if (!contact) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Convert Contact to Lead
          </DialogTitle>
          <DialogDescription>
            Review the contact details and confirm the conversion.
          </DialogDescription>
        </DialogHeader>

        {isChecking ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Checking for duplicates...</span>
          </div>
        ) : alreadyConverted ? (
          /* Already Converted Warning */
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="ml-2">
                  <p className="font-medium">This contact has already been converted to a lead.</p>
                  <div className="mt-2 p-2 bg-destructive/10 rounded">
                    <p className="font-medium">{alreadyConverted.lead_name}</p>
                    {alreadyConverted.email && (
                      <p className="text-sm text-muted-foreground">{alreadyConverted.email}</p>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => handleViewExistingLead(alreadyConverted.id)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Existing Lead
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Contact Details Preview */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <h4 className="font-medium mb-3">Contact Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium">{contact.contact_name}</p>
                </div>
                {contact.email && (
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium">{contact.email}</p>
                  </div>
                )}
                {contact.company_name && (
                  <div>
                    <span className="text-muted-foreground">Company:</span>
                    <p className="font-medium">{contact.company_name}</p>
                  </div>
                )}
                {contact.position && (
                  <div>
                    <span className="text-muted-foreground">Position:</span>
                    <p className="font-medium">{contact.position}</p>
                  </div>
                )}
                {contact.phone_no && (
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <p className="font-medium">{contact.phone_no}</p>
                  </div>
                )}
                {contact.contact_source && (
                  <div>
                    <span className="text-muted-foreground">Source:</span>
                    <p className="font-medium">{contact.contact_source}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Duplicate Warning */}
            {duplicateLeads.length > 0 && !confirmCreateAnyway && (
              <Alert variant="default" className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription>
                  <div className="ml-2">
                    <p className="font-medium text-amber-700 dark:text-amber-400">
                      Possible duplicate leads found
                    </p>
                    <ul className="mt-2 space-y-2">
                      {duplicateLeads.slice(0, 3).map((lead) => (
                        <li
                          key={lead.id}
                          className="flex items-center justify-between p-2 bg-background rounded border"
                        >
                          <div>
                            <span className="font-medium">{lead.lead_name}</span>
                            {lead.email && (
                              <span className="text-sm text-muted-foreground ml-2">
                                ({lead.email})
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewExistingLead(lead.id)}
                            >
                              View
                            </Button>
                            {onMergeLead && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMergeWithLead(lead.id)}
                              >
                                Merge
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {duplicateLeads.length > 3 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        + {duplicateLeads.length - 3} more
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Conversion Preview */}
            {(duplicateLeads.length === 0 || confirmCreateAnyway) && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-400">
                  Ready to convert. A new lead will be created with the contact details above.
                </span>
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              
              {duplicateLeads.length > 0 && !confirmCreateAnyway ? (
                <Button
                  variant="secondary"
                  onClick={() => setConfirmCreateAnyway(true)}
                >
                  Create Anyway
                </Button>
              ) : (
                <Button onClick={handleConvert} disabled={isConverting}>
                  {isConverting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Convert to Lead
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
