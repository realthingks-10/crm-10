import { useState, memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  Reply,
  Eye,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  formatEmailTimestamp, 
  getBounceExplanation,
  cleanBounceReason,
  stripHtmlTags,
} from '@/utils/emailUtils';
import { EMAIL_STATUS_COLORS } from '@/utils/emailConstants';
import { OutlookEmailBody } from './OutlookEmailBody';

export interface OutlookCompactCardProps {
  id: string;
  type: 'sent' | 'received';
  subject?: string;
  body: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  toName: string | null;
  timestamp: string;
  status?: string;
  bounceType?: string | null;
  bounceReason?: string | null;
  isValidOpen?: boolean | null;
  openCount?: number | null;
  onReply?: () => void;
  className?: string;
}

export const OutlookCompactCard = memo(({
  id,
  type,
  subject,
  body,
  fromEmail,
  fromName,
  toEmail,
  toName,
  timestamp,
  status = 'sent',
  bounceType,
  bounceReason,
  isValidOpen,
  openCount,
  onReply,
  className,
}: OutlookCompactCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Direction styling
  const isSent = type === 'sent';
  const directionClasses = isSent
    ? 'border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/20'
    : 'border-l-purple-500 bg-purple-50/30 dark:bg-purple-950/20';
  
  // Format display names
  const formatName = (name: string | null, email: string) => {
    if (name && name.trim()) return name.trim();
    return email.split('@')[0];
  };

  const fromDisplay = formatName(fromName, fromEmail);
  const toDisplay = formatName(toName, toEmail);

  // Get preview text
  const previewText = body ? stripHtmlTags(body).substring(0, 100) + (body.length > 100 ? '...' : '') : '';

  // Status badge (compact version)
  const getStatusBadge = () => {
    const sentAt = new Date(timestamp);
    const isRecentlySent = Date.now() - sentAt.getTime() < 60000;

    if (status === 'sent' && isRecentlySent && !bounceType && isSent) {
      return (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
          <Loader2 className="w-2.5 h-2.5 animate-spin mr-0.5" />
          Verifying
        </Badge>
      );
    }

    if (bounceType || status === 'bounced') {
      const bounceInfo = getBounceExplanation(bounceType, bounceReason);
      const cleanedReason = cleanBounceReason(bounceReason);
      
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                <XCircle className="w-2.5 h-2.5 mr-0.5" />
                Bounced
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-[250px]">
              <p className="font-medium text-xs">{bounceInfo.title}</p>
              <p className="text-[10px] text-muted-foreground">{bounceInfo.subtitle}</p>
              {cleanedReason.summary && <p className="text-[10px] mt-1">{cleanedReason.summary}</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    if (status === 'replied') {
      return (
        <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", EMAIL_STATUS_COLORS.replied.bg, EMAIL_STATUS_COLORS.replied.text)}>
          <Reply className="w-2.5 h-2.5 mr-0.5" />
          Replied
        </Badge>
      );
    }

    if (status === 'opened' && isValidOpen === false) {
      return (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
          <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
          Suspicious
        </Badge>
      );
    }

    if (status === 'opened') {
      return (
        <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", EMAIL_STATUS_COLORS.opened.bg, EMAIL_STATUS_COLORS.opened.text)}>
          <Eye className="w-2.5 h-2.5 mr-0.5" />
          {openCount && openCount > 1 ? `${openCount}×` : 'Opened'}
        </Badge>
      );
    }

    if (status === 'delivered') {
      return (
        <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", EMAIL_STATUS_COLORS.delivered.bg, EMAIL_STATUS_COLORS.delivered.text)}>
          <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
          Delivered
        </Badge>
      );
    }

    if (type === 'received') {
      return (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800">
          <ArrowDown className="w-2.5 h-2.5 mr-0.5" />
          Received
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", EMAIL_STATUS_COLORS.sent.bg, EMAIL_STATUS_COLORS.sent.text)}>
        <Send className="w-2.5 h-2.5 mr-0.5" />
        Sent
      </Badge>
    );
  };

  return (
    <div 
      className={cn(
        'rounded-md border-l-[3px] overflow-hidden transition-all cursor-pointer hover:shadow-sm',
        directionClasses,
        'border border-border/50',
        className
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Compact Header Row */}
      <div className="px-3 py-2 flex items-center gap-2">
        {/* Direction Arrow */}
        <div className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center shrink-0',
          isSent ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-purple-100 dark:bg-purple-900/50'
        )}>
          {isSent ? (
            <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          ) : (
            <ArrowDown className="w-3 h-3 text-purple-600 dark:text-purple-400" />
          )}
        </div>

        {/* From → To */}
        <div className="flex items-center gap-1 min-w-0 flex-1 text-xs">
          <span className="font-medium truncate max-w-[100px]">{fromDisplay}</span>
          <span className="text-muted-foreground shrink-0">→</span>
          <span className="truncate max-w-[100px] text-muted-foreground">{toDisplay}</span>
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
          {formatEmailTimestamp(timestamp)}
        </span>

        {/* Status Badge */}
        {getStatusBadge()}
      </div>

      {/* Body - Always visible preview, full when expanded */}
      <div className="px-3 pb-2">
        {isExpanded ? (
          <div className="space-y-2">
            <OutlookEmailBody body={body} maxHeight="200px" className="text-sm" />
            
            {/* Reply Action */}
            {onReply && !bounceType && (
              <div className="pt-2 border-t border-border/50">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); onReply(); }}
                  className="h-7 px-2 text-xs gap-1"
                >
                  <Reply className="h-3 w-3" />
                  Reply
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {previewText || 'No content'}
          </p>
        )}
      </div>
    </div>
  );
});

OutlookCompactCard.displayName = 'OutlookCompactCard';

export default OutlookCompactCard;
