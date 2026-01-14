import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { 
  Send, 
  Loader2, 
  Paperclip, 
  X, 
  FileIcon, 
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EMAIL_VARIABLES } from '@/utils/emailConstants';
import { supabase } from '@/integrations/supabase/client';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface OutlookComposeEmailProps {
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  toName?: string | null;
  defaultSubject?: string;
  defaultBody?: string;
  replyToMessage?: {
    subject: string;
    body: string;
    fromEmail: string;
    fromName?: string | null;
    timestamp: string;
  };
  showCcBcc?: boolean;
  onSend: (data: {
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
    attachments?: { name: string; contentType: string; contentBytes: string }[];
  }) => Promise<void>;
  onCancel?: () => void;
  isSending?: boolean;
  className?: string;
}

export const OutlookComposeEmail = ({
  fromEmail,
  fromName,
  toEmail,
  toName,
  defaultSubject = '',
  defaultBody = '',
  replyToMessage,
  showCcBcc = false,
  onSend,
  onCancel,
  isSending = false,
  className,
}: OutlookComposeEmailProps) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [showCc, setShowCc] = useState(false);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (replyToMessage) {
      // Set subject for reply
      const replySubject = replyToMessage.subject.startsWith('Re:') 
        ? replyToMessage.subject 
        : `Re: ${replyToMessage.subject}`;
      setSubject(replySubject);
    }
  }, [replyToMessage]);

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
    
    if (templateId === 'none') {
      if (!replyToMessage) {
        setSubject('');
        setBody('');
      }
      return;
    }

    const template = templates.find(t => t.id === templateId);
    if (template) {
      // Replace variables
      const replaceVars = (text: string) => {
        return text
          .replace(/\{\{contact_name\}\}/g, toName || '')
          .replace(/\{\{name\}\}/g, toName || '')
          .replace(/\{\{email\}\}/g, toEmail || '');
      };
      
      setSubject(replaceVars(template.subject));
      setBody(replaceVars(template.body));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      const validFiles = newFiles.filter(file => file.size <= maxSize);
      setAttachments(prev => [...prev, ...validFiles]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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

  const handleSubmit = async () => {
    const attachmentData = await Promise.all(
      attachments.map(async (file) => ({
        name: file.name,
        contentType: file.type || 'application/octet-stream',
        contentBytes: await fileToBase64(file),
      }))
    );

    await onSend({
      subject: subject.trim(),
      body: body.trim(),
      cc: cc.trim() || undefined,
      bcc: bcc.trim() || undefined,
      attachments: attachmentData.length > 0 ? attachmentData : undefined,
    });
  };

  const insertVariable = (variable: string) => {
    setBody(prev => prev + variable);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* From/To Header Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3 bg-muted/50 rounded-lg border">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">From</Label>
          <p className="font-medium text-sm mt-1">
            {fromName ? `${fromName} (${fromEmail})` : fromEmail}
          </p>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg border">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">To</Label>
          <p className="font-medium text-sm mt-1">
            {toName ? `${toName} (${toEmail})` : toEmail}
          </p>
        </div>
      </div>

      {/* CC/BCC Toggle */}
      {showCcBcc && (
        <>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowCc(!showCc)}
            className="text-xs text-muted-foreground"
          >
            {showCc ? 'Hide' : 'Show'} CC/BCC
          </Button>
          
          {showCc && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cc" className="text-sm">CC</Label>
                <Input
                  id="cc"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="email@example.com"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bcc" className="text-sm">BCC</Label>
                <Input
                  id="bcc"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="email@example.com"
                  className="text-sm"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Template Selector */}
      <div className="space-y-1.5">
        <Label htmlFor="template" className="text-sm">Template</Label>
        <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
          <SelectTrigger className="w-full md:w-72">
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
      </div>

      {/* Subject */}
      <div className="space-y-1.5">
        <Label htmlFor="subject" className="text-sm">Subject *</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject"
        />
      </div>

      {/* Message Body */}
      <div className="space-y-1.5">
        <Label className="text-sm">Message</Label>
        <RichTextEditor
          value={body}
          onChange={setBody}
          placeholder="Write your message..."
        />
        
        {/* Variable Pills */}
        <div className="flex flex-wrap gap-2 pt-2">
          <span className="text-xs text-muted-foreground">Insert:</span>
          {EMAIL_VARIABLES.slice(0, 4).map((v) => (
            <Badge 
              key={v.variable}
              variant="outline" 
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs"
              onClick={() => insertVariable(v.variable)}
            >
              {v.variable}
            </Badge>
          ))}
        </div>
      </div>

      {/* Original Message (for replies) */}
      {replyToMessage && (
        <Collapsible open={showOriginal} onOpenChange={setShowOriginal}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              {showOriginal ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showOriginal ? 'Hide' : 'Show'} original message
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 p-3 bg-muted/30 rounded-lg border-l-2 border-muted-foreground/30">
              <div className="text-xs text-muted-foreground mb-2">
                On {new Date(replyToMessage.timestamp).toLocaleString()}, {replyToMessage.fromName || replyToMessage.fromEmail} wrote:
              </div>
              <div 
                className="text-sm text-muted-foreground prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: replyToMessage.body }}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Attachments */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="compose-attachments"
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
          <span className="text-xs text-muted-foreground">Max 10MB per file</span>
        </div>
        
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded-lg text-sm"
              >
                <FileIcon className="h-4 w-4 text-muted-foreground" />
                <span className="truncate max-w-[150px]">{file.name}</span>
                <span className="text-xs text-muted-foreground">({formatFileSize(file.size)})</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttachment(index)}
                  className="h-5 w-5 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowPreview(!showPreview)}
            className="gap-1.5"
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isSending}>
              Cancel
            </Button>
          )}
          <Button 
            onClick={handleSubmit} 
            disabled={!subject.trim() || isSending}
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

      {/* Preview Modal */}
      {showPreview && (
        <div className="mt-4 p-4 border rounded-lg bg-background">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Email Preview</h4>
            <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2 text-sm">
            <div><strong>Subject:</strong> {subject}</div>
            <div><strong>To:</strong> {toName ? `${toName} (${toEmail})` : toEmail}</div>
            <hr className="my-2" />
            <div 
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: body }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default OutlookComposeEmail;
