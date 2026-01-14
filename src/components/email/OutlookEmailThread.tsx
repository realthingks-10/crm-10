import { useState } from 'react';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Clock,
  Reply,
  Eye,
  XCircle,
  Send,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OutlookEmailCard, OutlookEmailCardProps } from './OutlookEmailCard';
import { EMAIL_STATUS_COLORS } from '@/utils/emailConstants';

export interface ThreadMessage {
  id: string;
  type: 'sent' | 'received';
  timestamp: string;
  subject: string | null;
  body: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  toName: string | null;
  status?: string;
  bounceType?: string | null;
  bounceReason?: string | null;
  isValidOpen?: boolean | null;
  openCount?: number | null;
  hasAttachments?: boolean;
}

export interface OutlookEmailThreadProps {
  threadId: string;
  subject: string;
  messages: ThreadMessage[];
  lastActivity: string;
  hasReplies: boolean;
  hasBounce: boolean;
  latestStatus: string;
  defaultExpanded?: boolean;
  onReply?: (message: ThreadMessage) => void;
  onForward?: (message: ThreadMessage) => void;
  className?: string;
}

export const OutlookEmailThread = ({
  threadId,
  subject,
  messages,
  lastActivity,
  hasReplies,
  hasBounce,
  latestStatus,
  defaultExpanded = false,
  onReply,
  onForward,
  className,
}: OutlookEmailThreadProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  const toggleMessage = (messageId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const getThreadStatusBadge = () => {
    if (hasBounce) {
      return (
        <Badge className={cn(EMAIL_STATUS_COLORS.bounced.bg, EMAIL_STATUS_COLORS.bounced.text, 'flex items-center gap-1')}>
          <XCircle className="h-3 w-3" />
          Bounced
        </Badge>
      );
    }

    if (hasReplies || latestStatus === 'replied') {
      return (
        <Badge className={cn(EMAIL_STATUS_COLORS.replied.bg, EMAIL_STATUS_COLORS.replied.text, 'flex items-center gap-1')}>
          <Reply className="h-3 w-3" />
          Replied
        </Badge>
      );
    }

    if (latestStatus === 'opened') {
      return (
        <Badge className={cn(EMAIL_STATUS_COLORS.opened.bg, EMAIL_STATUS_COLORS.opened.text, 'flex items-center gap-1')}>
          <Eye className="h-3 w-3" />
          Opened
        </Badge>
      );
    }

    if (latestStatus === 'delivered') {
      return (
        <Badge className={cn(EMAIL_STATUS_COLORS.delivered.bg, EMAIL_STATUS_COLORS.delivered.text, 'flex items-center gap-1')}>
          <CheckCircle2 className="h-3 w-3" />
          Delivered
        </Badge>
      );
    }

    return (
      <Badge className={cn(EMAIL_STATUS_COLORS.sent.bg, EMAIL_STATUS_COLORS.sent.text, 'flex items-center gap-1')}>
        <Send className="h-3 w-3" />
        Sent
      </Badge>
    );
  };

  const handleReplyToThread = () => {
    // Reply to the last sent message in the thread
    const lastSentMessage = [...messages].reverse().find(m => m.type === 'sent');
    if (lastSentMessage && onReply) {
      onReply(lastSentMessage);
    }
  };

  return (
    <Card 
      className={cn(
        'overflow-hidden transition-all duration-200',
        hasBounce && 'border-destructive/30',
        className
      )}
    >
      {/* Thread Header */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="mt-0.5">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-semibold truncate">{subject}</span>
                    {messages.length > 1 && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {messages.length} messages
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(lastActivity), 'dd/MM/yyyy HH:mm')}
                    </span>
                    {hasReplies && (
                      <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                        <Reply className="h-3 w-3" />
                        Has replies
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                {getThreadStatusBadge()}
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t">
            {/* Messages */}
            <div className="p-4 space-y-3">
              {messages.map((message, index) => (
                <OutlookEmailCard
                  key={message.id}
                  id={message.id}
                  type={message.type}
                  subject={message.subject || subject}
                  body={message.body}
                  fromEmail={message.fromEmail}
                  fromName={message.fromName}
                  toEmail={message.toEmail}
                  toName={message.toName}
                  timestamp={message.timestamp}
                  status={message.status}
                  bounceType={message.bounceType}
                  bounceReason={message.bounceReason}
                  isValidOpen={message.isValidOpen}
                  openCount={message.openCount}
                  hasAttachments={message.hasAttachments}
                  isExpanded={expandedMessages.has(message.id)}
                  onReply={onReply ? () => onReply(message) : undefined}
                  onForward={onForward ? () => onForward(message) : undefined}
                />
              ))}
            </div>

            {/* Thread Actions Footer */}
            <div className="px-4 py-3 bg-muted/30 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {messages.filter(m => m.type === 'sent').length} sent, {messages.filter(m => m.type === 'received').length} received
              </span>
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleReplyToThread}
                disabled={hasBounce}
                className="gap-1.5"
              >
                <Reply className="h-3.5 w-3.5" />
                Reply to Thread
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default OutlookEmailThread;
