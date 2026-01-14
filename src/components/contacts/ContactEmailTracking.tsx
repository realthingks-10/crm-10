import { Mail, AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ContactEmailTrackingProps {
  emailOpens: number;
  showWarning?: boolean;
}

export const ContactEmailTracking = ({
  emailOpens,
  showWarning = false,
}: ContactEmailTrackingProps) => {
  if (showWarning && emailOpens > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-yellow-500" />
              <span className="text-muted-foreground">Opens:</span>
              <span className="font-semibold text-yellow-600">{emailOpens}</span>
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Some opens may be from automated email scanners</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Mail className="h-4 w-4 text-blue-500" />
      <span className="text-muted-foreground">Opens:</span>
      <span className="font-semibold">{emailOpens}</span>
    </div>
  );
};
