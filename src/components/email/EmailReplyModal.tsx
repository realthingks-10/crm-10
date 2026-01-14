import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Mail, Send, Loader2, Paperclip, X, FileIcon, ChevronDown, Reply } from "lucide-react";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { format } from "date-fns";

interface OriginalEmailData {
  id?: string;
  recipient_email: string;
  recipient_name: string | null;
  sender_email: string;
  subject: string;
  body?: string | null;
  sent_at?: string;
  contact_id?: string | null;
  lead_id?: string | null;
  account_id?: string | null;
  thread_id?: string | null;
  message_id?: string | null;
}

interface ReplyToData {
  from_email: string;
  from_name: string | null;
  body_preview?: string | null;
  received_at?: string;
  subject?: string | null;
}

interface EmailReplyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalEmail: OriginalEmailData;
  replyTo?: ReplyToData; // For replying to a specific reply in the thread
  onReplySent?: () => void;
}

export const EmailReplyModal = ({ 
  open, 
  onOpenChange, 
  originalEmail, 
  replyTo,
  onReplySent 
}: EmailReplyModalProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showOriginalMessage, setShowOriginalMessage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const senderEmail = user?.email || "noreply@acmecrm.com";

  // Determine reply-to address and name
  const replyToEmail = replyTo?.from_email || originalEmail.recipient_email;
  const replyToName = replyTo?.from_name || originalEmail.recipient_name;

  // Build the reply subject
  const getReplySubject = () => {
    const baseSubject = replyTo?.subject || originalEmail.subject;
    if (baseSubject.toLowerCase().startsWith('re:')) {
      return baseSubject;
    }
    return `Re: ${baseSubject}`;
  };

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSubject(getReplySubject());
      setBody("");
      setAttachments([]);
      setShowOriginalMessage(false);
    }
  }, [open, originalEmail.subject, replyTo?.subject]);

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
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleSendReply = async () => {
    if (!replyToEmail) {
      toast({
        title: "No recipient",
        description: "Cannot determine reply recipient",
        variant: "destructive",
      });
      return;
    }

    if (!subject.trim()) {
      toast({
        title: "Subject required",
        description: "Please enter a subject",
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

      // Determine entity type and id from original email
      const entityType = originalEmail.contact_id ? 'contact' : 
                         originalEmail.lead_id ? 'lead' : 
                         originalEmail.account_id ? 'account' : undefined;
      const entityId = originalEmail.contact_id || originalEmail.lead_id || originalEmail.account_id || undefined;

      // Thread ID: use existing thread_id, or the original email's ID if it's the first in a thread
      const threadId = originalEmail.thread_id || originalEmail.id;

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: replyToEmail,
          toName: replyToName,
          subject: subject.trim(),
          body: body.trim(),
          from: senderEmail,
          attachments: attachmentData,
          entityType,
          entityId,
          // Threading fields - this is what links the reply to the thread
          parentEmailId: originalEmail.id,
          threadId: threadId,
          isReply: true,
          parentMessageId: originalEmail.message_id,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Reply Sent",
        description: `Reply sent to ${replyToName || replyToEmail}`,
      });
      
      onReplySent?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending reply:', error);
      toast({
        title: "Failed to send reply",
        description: error.message || "An error occurred while sending the reply",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Reply className="h-5 w-5" />
            Reply to {replyToName || replyToEmail}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* From/To Display with emails in brackets */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">From</Label>
              <p className="font-medium text-sm mt-1">{user?.email || "System"} ({senderEmail})</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">To</Label>
              <p className="font-medium text-sm mt-1">
                {replyToName || "Unknown"} ({replyToEmail})
              </p>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="reply-subject">Subject *</Label>
            <Input
              id="reply-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          {/* Message Body */}
          <div className="space-y-2">
            <Label htmlFor="reply-body">Message</Label>
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Type your reply..."
            />
          </div>

          {/* Quoted Original Message */}
          <Collapsible open={showOriginalMessage} onOpenChange={setShowOriginalMessage}>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className={`h-4 w-4 transition-transform ${showOriginalMessage ? 'rotate-180' : ''}`} />
              <Mail className="h-4 w-4" />
              {showOriginalMessage ? 'Hide' : 'Show'} original message
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="text-sm text-muted-foreground border-l-2 border-muted pl-3 py-2 bg-muted/30 rounded-r">
                <p className="font-medium mb-1">
                  {replyTo 
                    ? `From: ${replyTo.from_name || replyTo.from_email} (${replyTo.from_email})`
                    : `To: ${originalEmail.recipient_name || "Unknown"} (${originalEmail.recipient_email})`
                  }
                </p>
                <p className="text-xs mb-2">
                  {replyTo?.received_at 
                    ? format(new Date(replyTo.received_at), 'PPp')
                    : originalEmail.sent_at 
                      ? format(new Date(originalEmail.sent_at), 'PPp')
                      : ''
                  }
                </p>
                <div 
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ 
                    __html: replyTo?.body_preview || originalEmail.body || 'No content' 
                  }}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Attachments */}
          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="reply-attachments"
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

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendReply} 
              disabled={!replyToEmail || isSending}
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
                  Send Reply
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailReplyModal;
