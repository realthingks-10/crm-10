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
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { ActivityDetailModal } from "@/components/shared/ActivityDetailModal";

interface TimelineItem {
  id: string;
  type: 'activity' | 'contact' | 'deal' | 'lead' | 'meeting';
  title: string;
  description?: string;
  date: string;
  icon: React.ReactNode;
  metadata?: Record<string, string>;
}

interface MeetingActivityTimelineProps {
  meetingId: string;
  refreshKey?: number;
}

const getActivityColor = (type: string) => {
  switch (type) {
    case 'call': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    case 'email': return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
    case 'meeting': return 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300';
    case 'note': return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
    case 'follow_up': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
    case 'task': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
};

export const MeetingActivityTimeline = ({ meetingId, refreshKey = 0 }: MeetingActivityTimelineProps) => {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<TimelineItem | null>(null);

  useEffect(() => {
    fetchTimeline();
  }, [meetingId, refreshKey]);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const items: TimelineItem[] = [];

      // Fetch meeting follow-ups
      const { data: followUps } = await supabase
        .from('meeting_follow_ups')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false });

      (followUps || []).forEach(item => {
        items.push({
          id: `followup-${item.id}`,
          type: 'activity',
          title: item.title,
          description: item.description || `Status: ${item.status}`,
          date: item.created_at,
          icon: <CheckSquare className="h-4 w-4" />,
          metadata: { type: 'follow_up', status: item.status }
        });
      });

      // Fetch tasks linked to this meeting
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false });

      (tasks || []).forEach(task => {
        items.push({
          id: `task-${task.id}`,
          type: 'activity',
          title: task.title,
          description: task.description || `Priority: ${task.priority}`,
          date: task.created_at,
          icon: <CheckSquare className="h-4 w-4" />,
          metadata: { type: 'task', status: task.status }
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
        <p className="text-xs mt-1">Log activities or create follow-ups to see them here</p>
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
                <div className={`absolute -left-4 mt-1.5 w-4 h-4 rounded-full flex items-center justify-center ${getActivityColor(item.metadata?.type || item.type)}`}>
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
                          {item.metadata.type.replace('_', ' ')}
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
