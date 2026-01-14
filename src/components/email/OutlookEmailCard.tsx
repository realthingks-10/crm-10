import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  ChevronDown,
  ChevronUp,
  Reply,
  Forward,
  Eye,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MailX,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  getAvatarColor, 
  getInitials, 
  formatEmailTimestamp, 
  getBounceExplanation,
  cleanBounceReason,
  stripHtmlTags,
} from '@/utils/emailUtils';
import { EMAIL_STATUS_COLORS, MESSAGE_DIRECTION_COLORS } from '@/utils/emailConstants';
import { OutlookEmailBody } from './OutlookEmailBody';

export interface OutlookEmailCardProps {
  id: string;
  type: 'sent' | 'received';
  subject: string;
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
  hasAttachments?: boolean;
  isExpanded?: boolean;
  onReply?: () => void;
  onForward?: () => void;
  className?: string;
}

export const OutlookEmailCard = ({
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
  hasAttachments,
  isExpanded: defaultExpanded = false,
  onReply,
  onForward,
  className,
}: OutlookEmailCardProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const directionColors = MESSAGE_DIRECTION_COLORS[type];
  
  // For avatar, use the "other" party - sent shows recipient, received shows sender
  const avatarEmail = type === 'sent' ? toEmail : fromEmail;
  const avatarName = type === 'sent' ? toName : fromName;
  const avatarColor = getAvatarColor(avatarEmail);
  const initials = getInitials(avatarName, avatarEmail);
  
  // Format display names
  const formatDisplayName = (name: string | null, email: string) => {
    if (name && name.trim()) {
      return name.trim();
    }
    // Extract name from email (before @)
    return email.split('@')[0];
  };

  const fromDisplayName = formatDisplayName(fromName, fromEmail);
  const toDisplayName = formatDisplayName(toName, toEmail);

  // Clean preview text using shared utility that preserves placeholders like <Company>
  const getPreviewText = () => {
    if (!body) return '';
    const clean = stripHtmlTags(body).replace(/\s+/g, ' ').trim();
    return clean.substring(0, 150) + (clean.length > 150 ? '...' : '');
  };

  const getStatusBadge = () => {
    // Check for verifying state (sent within last 60 seconds)
    const sentAt = new Date(timestamp);
    const isRecentlySent = Date.now() - sentAt.getTime() < 60000;

    if (status === 'sent' && isRecentlySent && !bounceType && type === 'sent') {
      return (
        <Badge className={cn(EMAIL_STATUS_COLORS.verifying.bg, EMAIL_STATUS_COLORS.verifying.text, 'flex items-center gap-1')}>
          <Loader2 className="w-3 h-3 animate-spin" />
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
            <TooltipTrigger>
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                {bounceInfo.title}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px]">
              <p className="font-medium">{bounceInfo.title}</p>
              <p className="text-xs text-muted-foreground">{bounceInfo.subtitle}</p>
              {cleanedReason.summary && (
                <p className="text-xs mt-1">{cleanedReason.summary}</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    if (status === 'replied') {
      return (
        <Badge className={cn(EMAIL_STATUS_COLORS.replied.bg, EMAIL_STATUS_COLORS.replied.text, 'flex items-center gap-1')}>
          <Reply className="w-3 h-3" />
          Replied
        </Badge>
      );
    }

    if (status === 'opened' && isValidOpen === false) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge className={cn(EMAIL_STATUS_COLORS.suspicious.bg, EMAIL_STATUS_COLORS.suspicious.text, EMAIL_STATUS_COLORS.suspicious.border, 'flex items-center gap-1 border')}>
                <AlertTriangle className="w-3 h-3" />
                Suspicious
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>This open may be from an email scanner or bot</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    if (status === 'opened') {
      return (
        <Badge className={cn(EMAIL_STATUS_COLORS.opened.bg, EMAIL_STATUS_COLORS.opened.text, 'flex items-center gap-1')}>
          <Eye className="w-3 h-3" />
          Opened {openCount && openCount > 1 ? `(${openCount})` : ''}
        </Badge>
      );
    }

    if (status === 'delivered') {
      return (
        <Badge className={cn(EMAIL_STATUS_COLORS.delivered.bg, EMAIL_STATUS_COLORS.delivered.text, 'flex items-center gap-1')}>
          <CheckCircle2 className="w-3 h-3" />
          Delivered
        </Badge>
      );
    }

    if (type === 'received') {
      return (
        <Badge className={cn(EMAIL_STATUS_COLORS.replied.bg, EMAIL_STATUS_COLORS.replied.text, 'flex items-center gap-1')}>
          <ArrowDownLeft className="w-3 h-3" />
          Received
        </Badge>
      );
    }

    return (
      <Badge className={cn(EMAIL_STATUS_COLORS.sent.bg, EMAIL_STATUS_COLORS.sent.text, 'flex items-center gap-1')}>
        <Send className="w-3 h-3" />
        Sent
      </Badge>
    );
  };

  return (
    <div 
      className={cn(
        'rounded-lg border overflow-hidden transition-all duration-200',
        directionColors.bg,
        `border-l-4 ${directionColors.accent}`,
        className
      )}
    >
      {/* Email Header - Dark bar like Outlook */}
      <div 
        className="bg-slate-800 dark:bg-slate-900 px-4 py-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {type === 'sent' ? (
              <ArrowUpRight className="h-4 w-4 text-blue-400 shrink-0" />
            ) : (
              <ArrowDownLeft className="h-4 w-4 text-purple-400 shrink-0" />
            )}
            <span className="text-white font-medium truncate text-sm">{subject}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasAttachments && (
              <Paperclip className="h-3.5 w-3.5 text-slate-400" />
            )}
            <span className="text-slate-400 text-xs hidden sm:inline">
              {formatEmailTimestamp(timestamp)}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </div>
      </div>

      {/* Email Content */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0',
            avatarColor
          )}>
            {initials}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* From Line */}
            <div className="flex items-baseline gap-2 text-sm mb-1">
              <span className="text-muted-foreground font-medium shrink-0">From:</span>
              <span className="font-medium truncate">{fromDisplayName}</span>
              <span className="text-muted-foreground text-xs truncate">({fromEmail})</span>
            </div>
            
            {/* To Line */}
            <div className="flex items-baseline gap-2 text-sm mb-2">
              <span className="text-muted-foreground font-medium shrink-0">To:</span>
              <span className="font-medium truncate">{toDisplayName}</span>
              <span className="text-muted-foreground text-xs truncate">({toEmail})</span>
            </div>

            {/* Timestamp and Status */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs text-muted-foreground sm:hidden">
                {formatEmailTimestamp(timestamp)}
              </span>
              {getStatusBadge()}
            </div>

            {/* Body Preview or Full */}
            {isExpanded ? (
              <div className="mt-3 space-y-3">
                <OutlookEmailBody body={body} maxHeight="300px" />

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  {onReply && !bounceType && (
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onReply(); }} className="gap-1.5">
                      <Reply className="h-3.5 w-3.5" />
                      Reply
                    </Button>
                  )}
                  {onForward && (
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onForward(); }} className="gap-1.5">
                      <Forward className="h-3.5 w-3.5" />
                      Forward
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {getPreviewText()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutlookEmailCard;
