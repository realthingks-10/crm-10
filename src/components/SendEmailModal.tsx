import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Send, Loader2, Paperclip, X, FileIcon } from "lucide-react";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Generic recipient interface that works with contacts, leads, and accounts
export interface EmailRecipient {
  name: string;
  email?: string;
  company_name?: string;
  position?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface SendEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: EmailRecipient | null;
  contactId?: string | null;
  leadId?: string | null;
  accountId?: string | null;
  onEmailSent?: () => void;
  // Legacy prop for backwards compatibility
  contact?: {
    contact_name: string;
    company_name?: string;
    position?: string;
    email?: string;
  } | null;
}

export const SendEmailModal = ({ open, onOpenChange, recipient, contactId, leadId, accountId, onEmailSent, contact }: SendEmailModalProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const senderEmail = user?.email || "noreply@acmecrm.com";

  // Fetch sender's display name from profile
  const { data: senderName } = useQuery({
    queryKey: ['sender-profile-name', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (error) return null;
      return data?.full_name || null;
    },
    enabled: !!user?.id && open,
    staleTime: 5 * 60 * 1000,
  });

  // Display name: use profile name, fallback to email username, then "System"
  const senderDisplayName = senderName || user?.email?.split('@')[0] || "System";

  // Use recipient or convert legacy contact prop
  const emailRecipient: EmailRecipient | null = recipient || (contact ? {
    name: contact.contact_name,
    email: contact.email,
    company_name: contact.company_name,
    position: contact.position,
  } : null);

  useEffect(() => {
    if (open) {
      fetchTemplates();
      setSelectedTemplate("");
      setSubject("");
      setBody("");
      setAttachments([]);
    }
  }, [open]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      const maxSize = 10 * 1024 * 1024; // 10MB per file
      
      const validFiles = newFiles.filter(file => {
        if (file.size > maxSize) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds the 10MB limit`,
            variant: "destructive",
          });
          return false;
        }
        return true;
      });
      
      setAttachments(prev => [...prev, ...validFiles]);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('id, name, subject, body')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const replaceVariables = (text: string, recipientData: EmailRecipient | null) => {
    if (!recipientData) return text;
    
    return text
      .replace(/\{\{contact_name\}\}/g, recipientData.name || '')
      .replace(/\{\{name\}\}/g, recipientData.name || '')
      .replace(/\{\{company_name\}\}/g, recipientData.company_name || '')
      .replace(/\{\{position\}\}/g, recipientData.position || '')
      .replace(/\{\{email\}\}/g, recipientData.email || '');
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    
    if (templateId === "none") {
      setSubject("");
      setBody("");
      return;
    }

    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSubject(replaceVariables(template.subject, emailRecipient));
      setBody(replaceVariables(template.body, emailRecipient));
    }
  };

  const handleSendEmail = async () => {
    if (!emailRecipient?.email) {
      toast({
        title: "No email address",
        description: "This recipient doesn't have an email address",
        variant: "destructive",
      });
      return;
    }

    if (!subject.trim()) {
      toast({
        title: "Subject required",
        description: "Please enter an email subject",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      // Convert attachments to base64
      const attachmentData = await Promise.all(
        attachments.map(async (file) => ({
          name: file.name,
          contentType: file.type || 'application/octet-stream',
          contentBytes: await fileToBase64(file),
        }))
      );

      // Determine entity type and id
      const entityType = contactId ? 'contact' : leadId ? 'lead' : accountId ? 'account' : undefined;
      const entityId = contactId || leadId || accountId || undefined;

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: emailRecipient.email,
          toName: emailRecipient.name,
          subject: subject.trim(),
          body: body.trim(),
          from: senderEmail,
          attachments: attachmentData,
          entityType,
          entityId,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      // Update last_contacted_at for the entity (email history is created by the edge function)
      const now = new Date().toISOString();
      
      if (contactId) {
        try {
          await supabase
            .from('contacts')
            .update({ last_contacted_at: now })
            .eq('id', contactId);
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
        } catch (updateError) {
          console.error('Error updating contact last_contacted_at:', updateError);
        }
      }
      
      if (leadId) {
        try {
          await supabase
            .from('leads')
            .update({ last_contacted_at: now })
            .eq('id', leadId);
          queryClient.invalidateQueries({ queryKey: ['leads'] });
        } catch (updateError) {
          console.error('Error updating lead last_contacted_at:', updateError);
        }
      }
      
      if (accountId) {
        try {
          await supabase
            .from('accounts')
            .update({ last_contacted_at: now })
            .eq('id', accountId);
          queryClient.invalidateQueries({ queryKey: ['accounts'] });
        } catch (updateError) {
          console.error('Error updating account last_contacted_at:', updateError);
        }
      }

      toast({
        title: "Email Sent",
        description: `Email successfully sent to ${emailRecipient.name}`,
      });
      
      onEmailSent?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: "Failed to send email",
        description: error.message || "An error occurred while sending the email",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!emailRecipient) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Email to {emailRecipient.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">From</Label>
              <p className="font-medium text-sm mt-1">{senderDisplayName}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">To</Label>
              <p className="font-medium text-sm mt-1">
                {emailRecipient.name} ({emailRecipient.email || "No email"})
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Email Template</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No templates available. Create templates in Settings → Email Templates.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Email message..."
            />
          </div>

          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="email-attachments"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Paperclip className="h-4 w-4" />
                Add Attachments
              </Button>
              <span className="text-xs text-muted-foreground">
                Max 10MB per file
              </span>
            </div>
            
            {attachments.length > 0 && (
              <div className="space-y-2 mt-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({formatFileSize(file.size)})
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(index)}
                      className="h-6 w-6 p-0 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmail} 
              disabled={!emailRecipient?.email || isSending}
              className="gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
