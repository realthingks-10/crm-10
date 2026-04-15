import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Campaign } from "@/hooks/useCampaigns";
import { Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface Props {
  campaign: Campaign;
  isCampaignEnded: boolean;
  daysRemaining: number | null;
  timingNotes?: string | null;
  onSaveTimingNotes?: (notes: string) => void;
}

export function CampaignMARTTiming({ campaign, isCampaignEnded, daysRemaining, timingNotes, onSaveTimingNotes }: Props) {
  const [notes, setNotes] = useState(timingNotes || "");

  useEffect(() => {
    setNotes(timingNotes || "");
  }, [timingNotes]);

  const getProgressColor = () => {
    if (isCampaignEnded) return "bg-destructive";
    if (daysRemaining !== null && daysRemaining <= 7) return "bg-yellow-500";
    return "bg-primary";
  };

  const getProgress = () => {
    if (!campaign.start_date || !campaign.end_date) return 0;
    const start = new Date(campaign.start_date + "T00:00:00").getTime();
    const end = new Date(campaign.end_date + "T00:00:00").getTime();
    const now = Date.now();
    if (now >= end) return 100;
    if (now <= start) return 0;
    return Math.round(((now - start) / (end - start)) * 100);
  };

  if (!campaign.start_date || !campaign.end_date) {
    return (
      <div className="space-y-3">
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">⚠️ Set campaign start and end dates (via Edit button) to enable timing tracking.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Timing Note</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Must complete outreach before Diwali..." rows={2} className="text-sm" />
          {onSaveTimingNotes && (
            <Button variant="outline" size="sm" className="h-7 text-xs mt-1" onClick={() => onSaveTimingNotes(notes)}>Save Note</Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Compact horizontal layout: dates + status + progress */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Start</p>
          <p className="text-sm font-medium">{format(new Date(campaign.start_date + "T00:00:00"), "dd MMM yyyy")}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">End</p>
          <p className="text-sm font-medium">{format(new Date(campaign.end_date + "T00:00:00"), "dd MMM yyyy")}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Status</p>
          {isCampaignEnded ? (
            <Badge variant="destructive" className="text-xs flex items-center gap-1 w-fit">
              <AlertTriangle className="h-3 w-3" /> Ended {Math.abs(daysRemaining || 0)}d ago
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs flex items-center gap-1 w-fit">
              <Clock className="h-3 w-3" /> {daysRemaining}d remaining
            </Badge>
          )}
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{getProgress()}%</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${getProgressColor()}`} style={{ width: `${getProgress()}%` }} />
          </div>
        </div>
      </div>

      {/* Timing note */}
      <div className="space-y-1.5">
        <Label className="text-xs">Timing Note</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Must complete outreach before Diwali..." rows={2} className="text-sm" />
        {onSaveTimingNotes && (
          <Button variant="outline" size="sm" className="h-7 text-xs mt-1" onClick={() => onSaveTimingNotes(notes)}>Save Note</Button>
        )}
      </div>
    </div>
  );
}
