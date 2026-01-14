import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Phone, 
  Mail, 
  Calendar, 
  FileText, 
  CheckSquare,
  Clock,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ActivityDetailModal } from "@/components/shared/ActivityDetailModal";

interface TimelineItem {
  id: string;
  type: 'activity' | 'meeting';
  title: string;
  description?: string;
  date: string;
  icon: React.ReactNode;
  metadata?: Record<string, string>;
}

interface LeadActivityTimelineProps {
  leadId: string;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'call': return <Phone className="h-4 w-4" />;
    case 'email': return <Mail className="h-4 w-4" />;
    case 'meeting': return <Calendar className="h-4 w-4" />;
    case 'note': return <FileText className="h-4 w-4" />;
    case 'task': return <CheckSquare className="h-4 w-4" />;
    default: return <Clock className="h-4 w-4" />;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case 'call': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    case 'email': return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
    case 'meeting': return 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300';
    case 'note': return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
    case 'task': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
};

export const LeadActivityTimeline = ({ leadId }: LeadActivityTimelineProps) => {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<TimelineItem | null>(null);

  useEffect(() => {
    fetchTimeline();
  }, [leadId]);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const items: TimelineItem[] = [];

      // Fetch tasks linked to this lead (replacing lead_action_items)
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      (tasks || []).forEach(task => {
        // Extract activity type from title if it's prefixed (e.g., "[CALL] ...")
        const typeMatch = task.title?.match(/^\[([A-Z]+)\]/);
        const activityType = typeMatch ? typeMatch[1].toLowerCase() : 'task';
        
        items.push({
          id: `task-${task.id}`,
          type: 'activity',
          title: task.title?.replace(/^\[[A-Z]+\]\s*/, '') || 'Task',
          description: task.description || `Status: ${task.status}`,
          date: task.created_at,
          icon: getActivityIcon(activityType),
          metadata: { type: activityType, status: task.status }
        });
      });

      // Fetch meetings linked to this lead
      const { data: meetings } = await supabase
        .from('meetings')
        .select('*')
        .eq('lead_id', leadId)
        .order('start_time', { ascending: false });

      (meetings || []).forEach(meeting => {
        items.push({
          id: `meeting-${meeting.id}`,
          type: 'meeting',
          title: meeting.subject,
          description: meeting.description,
          date: meeting.start_time,
          icon: <Calendar className="h-4 w-4" />,
          metadata: { status: meeting.status, outcome: meeting.outcome || '' }
        });
      });

      // Fetch emails sent to this lead
      const { data: emails } = await supabase
        .from('email_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('sent_at', { ascending: false });

      (emails || []).forEach(email => {
        items.push({
          id: `email-${email.id}`,
          type: 'activity',
          title: `Email: ${email.subject}`,
          description: `To: ${email.recipient_email}`,
          date: email.sent_at,
          icon: <Mail className="h-4 w-4" />,
          metadata: { type: 'email', status: email.status }
        });
      });

      // Sort by date descending
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTimeline(items);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No activity yet</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-[350px]">
        <div className="relative pl-6">
          {/* Timeline line */}
          <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
          
          <div className="space-y-4">
            {timeline.map((item) => (
              <div 
                key={item.id} 
                className="relative cursor-pointer"
                onClick={() => setSelectedActivity(item)}
              >
                {/* Timeline dot */}
                <div className={`absolute -left-4 mt-1.5 w-4 h-4 rounded-full flex items-center justify-center ${
                  item.type === 'meeting'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                    : getActivityColor(item.metadata?.type || '')
                }`}>
                  {item.icon}
                </div>
                
                <div className="ml-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.date), 'dd/MM/yyyy')}
                      </span>
                      {item.metadata?.type && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {item.metadata.type}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      <ActivityDetailModal
        open={!!selectedActivity}
        onOpenChange={(open) => !open && setSelectedActivity(null)}
        activity={selectedActivity}
      />
    </>
  );
};
