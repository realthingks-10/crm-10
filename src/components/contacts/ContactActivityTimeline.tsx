import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Phone, Mail, Calendar, FileText, MessageSquare, Users, Clock, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ActivityDetailModal } from '@/components/shared/ActivityDetailModal';

interface Activity {
  id: string;
  activity_type: string;
  subject: string;
  description: string | null;
  outcome: string | null;
  duration_minutes: number | null;
  activity_date: string;
  created_by: string | null;
}

interface TimelineItem {
  id: string;
  type: 'activity';
  title: string;
  description?: string;
  date: string;
  metadata?: Record<string, string>;
}

interface ContactActivityTimelineProps {
  contactId: string;
}

const activityIcons: Record<string, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  meeting: <Calendar className="h-4 w-4" />,
  note: <FileText className="h-4 w-4" />,
  message: <MessageSquare className="h-4 w-4" />,
  task: <Users className="h-4 w-4" />,
};

const activityColors: Record<string, string> = {
  call: 'bg-slate-500',
  email: 'bg-slate-600',
  meeting: 'bg-zinc-500',
  note: 'bg-stone-500',
  message: 'bg-gray-500',
  task: 'bg-neutral-600',
};

export const ContactActivityTimeline = ({ contactId }: ContactActivityTimelineProps) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<TimelineItem | null>(null);

  useEffect(() => {
    fetchActivities();
  }, [contactId]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_activities')
        .select('*')
        .eq('contact_id', contactId)
        .order('activity_date', { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivityClick = (activity: Activity) => {
    setSelectedActivity({
      id: activity.id,
      type: 'activity',
      title: activity.subject,
      description: activity.description || undefined,
      date: activity.activity_date,
      metadata: {
        type: activity.activity_type,
        outcome: activity.outcome || '',
        duration: activity.duration_minutes?.toString() || ''
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No activities recorded yet</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-[350px] pr-4">
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
          
          <div className="space-y-6">
            {activities.map((activity) => (
              <div 
                key={activity.id} 
                className="relative pl-10 cursor-pointer"
                onClick={() => handleActivityClick(activity)}
              >
                <div className={`absolute left-2 w-5 h-5 rounded-full ${activityColors[activity.activity_type] || 'bg-gray-500'} flex items-center justify-center text-white`}>
                  {activityIcons[activity.activity_type] || <FileText className="h-3 w-3" />}
                </div>
                
                <div className="bg-card border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-foreground">{activity.subject}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="capitalize">
                          {activity.activity_type}
                        </Badge>
                        {activity.duration_minutes && (
                          <span className="text-xs text-muted-foreground">
                            {activity.duration_minutes} min
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(activity.activity_date), 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>
                  
                  {activity.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {activity.description}
                    </p>
                  )}
                  
                  {activity.outcome && (
                    <div className="mt-2 pt-2 border-t">
                      <span className="text-xs font-medium text-muted-foreground">Outcome: </span>
                      <span className="text-sm">{activity.outcome}</span>
                    </div>
                  )}
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
