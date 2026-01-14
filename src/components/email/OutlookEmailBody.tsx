import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { stripHtmlTags } from '@/utils/emailUtils';

interface OutlookEmailBodyProps {
  body: string | null;
  className?: string;
  maxHeight?: string;
}

// Patterns to detect quoted content
const QUOTED_PATTERNS = [
  { pattern: /_{10,}/, name: 'Outlook separator' },
  { pattern: /^-{3,}\s*Original Message\s*-{3,}/mi, name: 'Original message' },
  { pattern: /^On\s+.+wrote:$/m, name: 'Gmail style' },
  { pattern: /^From:\s*.+\n(Sent|Date):\s*.+\n(To|Subject):/m, name: 'Email headers' },
  { pattern: /^>\s+/m, name: 'Quote prefix' },
];

/**
 * Clean and format HTML email body for display
 * Uses shared stripHtmlTags utility to preserve text placeholders like <Company>
 */
const cleanEmailBody = (html: string): string => {
  if (!html) return '';
  
  // Use shared utility that preserves placeholders like <Company>, <Name> etc.
  return stripHtmlTags(html);
};

/**
 * Parse email body to separate main content from quoted content
 */
const parseQuotedContent = (body: string): { main: string; quoted: string | null } => {
  if (!body) return { main: '', quoted: null };
  
  const cleanBody = cleanEmailBody(body);
  
  for (const { pattern } of QUOTED_PATTERNS) {
    const match = cleanBody.match(pattern);
    if (match && match.index !== undefined && match.index > 20) {
      return {
        main: cleanBody.substring(0, match.index).trim(),
        quoted: cleanBody.substring(match.index).trim(),
      };
    }
  }
  
  return { main: cleanBody, quoted: null };
};

export const OutlookEmailBody = ({ body, className, maxHeight = '300px' }: OutlookEmailBodyProps) => {
  const [showQuoted, setShowQuoted] = useState(false);
  const { main, quoted } = parseQuotedContent(body || '');
  
  if (!body && !main) {
    return (
      <p className="text-sm text-muted-foreground italic">No content</p>
    );
  }
  
  return (
    <div className={cn('space-y-3', className)}>
      {/* Main email content */}
      <div 
        className="text-sm text-foreground whitespace-pre-line leading-relaxed"
        style={{ maxHeight, overflowY: 'auto' }}
      >
        {main}
      </div>
      
      {/* Quoted content toggle */}
      {quoted && (
        <Collapsible open={showQuoted} onOpenChange={setShowQuoted}>
          <CollapsibleTrigger className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
            <ChevronDown className={cn(
              'h-3 w-3 transition-transform',
              showQuoted && 'rotate-180'
            )} />
            {showQuoted ? 'Hide' : 'Show'} quoted text
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 text-xs text-muted-foreground border-l-2 border-muted pl-3 whitespace-pre-line">
              {quoted}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export { cleanEmailBody, parseQuotedContent };
export default OutlookEmailBody;
