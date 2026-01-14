import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Send, Loader2, Users, X, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { EMAIL_VARIABLES } from "@/utils/emailConstants";
import { stripHtmlTags } from "@/utils/emailUtils";
import { useQueryClient } from "@tanstack/react-query";

export interface BulkEmailRecipient {
  id: string;
  name: string;
  email?: string;
  type: 'lead' | 'contact' | 'account';
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface BulkEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: BulkEmailRecipient[];
  onEmailsSent?: () => void;
}

export const BulkEmailModal = ({ open, onOpenChange, recipients, onEmailsSent }: BulkEmailModalProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0 });
  
  const senderEmail = user?.email || "noreply@acmecrm.com";
  
  // Filter recipients with valid emails
  const validRecipients = recipients.filter(r => r.email);
  const invalidRecipients = recipients.filter(r => !r.email);

  useEffect(() => {
    if (open) {
      fetchTemplates();
      setSelectedTemplate("");
      setSubject("");
      setBody("");
      setSendProgress({ sent: 0, total: 0 });
    }
  }, [open]);

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

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    
    if (templateId === "none") {
      setSubject("");
      setBody("");
      return;
    }

    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  };

  const replaceVariables = (text: string, recipient: BulkEmailRecipient) => {
    return text
      .replace(/\{\{contact_name\}\}/g, recipient.name || '')
      .replace(/\{\{name\}\}/g, recipient.name || '');
  };

  const handleSendBulkEmail = async () => {
    if (validRecipients.length === 0) {
      toast({
        title: "No valid recipients",
        description: "None of the selected recipients have email addresses",
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
    setSendProgress({ sent: 0, total: validRecipients.length });
    
    let successCount = 0;
    let failCount = 0;

    const now = new Date().toISOString();
    const contactIds: string[] = [];
    const leadIds: string[] = [];
    const accountIds: string[] = [];

    for (const recipient of validRecipients) {
      try {
        const personalizedSubject = replaceVariables(subject.trim(), recipient);
        const personalizedBody = replaceVariables(body.trim(), recipient);

        // Pass entityType and entityId so send-email creates the email_history record
        // with proper association - no need to create a duplicate record client-side
        const { data, error } = await supabase.functions.invoke('send-email', {
          body: {
            to: recipient.email,
            toName: recipient.name,
            subject: personalizedSubject,
            body: personalizedBody,
            from: senderEmail,
            entityType: recipient.type,
            entityId: recipient.id,
          },
        });

        if (error) throw error;

        // Track successful recipients by type for last_contacted_at update
        if (recipient.type === 'contact') contactIds.push(recipient.id);
        else if (recipient.type === 'lead') leadIds.push(recipient.id);
        else if (recipient.type === 'account') accountIds.push(recipient.id);

        successCount++;
      } catch (error) {
        console.error(`Failed to send email to ${recipient.email}:`, error);
        failCount++;
      }
      
      setSendProgress(prev => ({ ...prev, sent: prev.sent + 1 }));
    }

    // Update last_contacted_at for all successfully emailed recipients
    if (contactIds.length > 0) {
      await supabase.from('contacts').update({ last_contacted_at: now }).in('id', contactIds);
    }
    if (leadIds.length > 0) {
      await supabase.from('leads').update({ last_contacted_at: now }).in('id', leadIds);
    }
    if (accountIds.length > 0) {
      await supabase.from('accounts').update({ last_contacted_at: now }).in('id', accountIds);
    }

    setIsSending(false);

    if (successCount > 0) {
      // Invalidate caches so tables refresh immediately
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      
      toast({
        title: "Bulk email completed",
        description: `Successfully sent ${successCount} emails${failCount > 0 ? `, ${failCount} failed` : ''}`,
      });
      onEmailsSent?.();
      onOpenChange(false);
    } else {
      toast({
        title: "Failed to send emails",
        description: "All emails failed to send. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Send Bulk Email ({validRecipients.length} recipients)
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Recipients preview */}
          <div className="space-y-2">
            <Label>Recipients</Label>
            <ScrollArea className="h-24 rounded-md border p-2">
              <div className="flex flex-wrap gap-1">
                {validRecipients.map((r) => (
                  <Badge key={r.id} variant="secondary" className="text-xs">
                    {r.name} ({r.email})
                  </Badge>
                ))}
              </div>
            </ScrollArea>
            {invalidRecipients.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {invalidRecipients.length} recipient(s) have no email address and will be skipped.
              </p>
            )}
          </div>

          <div className="p-3 bg-muted/50 rounded-lg">
            <Label className="text-sm text-muted-foreground">From:</Label>
            <p className="font-medium text-sm">{senderEmail}</p>
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
            <p className="text-xs text-muted-foreground">
              Use {"{{name}}"} or {"{{contact_name}}"} to personalize each email.
            </p>
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
              placeholder="Email message... Use {{name}} for personalization."
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-xs text-muted-foreground">Insert:</span>
              {EMAIL_VARIABLES.slice(0, 3).map((v) => (
                <Badge 
                  key={v.variable}
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs"
                  onClick={() => setBody(prev => prev + v.variable)}
                >
                  {v.variable}
                </Badge>
              ))}
            </div>
          </div>

          {isSending && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Sending emails...</span>
                <span className="text-sm text-muted-foreground">
                  {sendProgress.sent} / {sendProgress.total}
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(sendProgress.sent / sendProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendBulkEmail} 
              disabled={validRecipients.length === 0 || isSending}
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
                  Send to {validRecipients.length} Recipients
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
