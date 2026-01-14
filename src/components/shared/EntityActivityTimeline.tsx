import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { 
  Phone, Mail, Calendar, FileText, MessageSquare, 
  Users, Clock, Loader2, Video, Briefcase, UserPlus, Send
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TimelineItem {
  id: string;
  type: 'activity' | 'email' | 'meeting' | 'task' | 'deal' | 'created';
  title: string;
  description?: string;
  date: string;
  icon: React.ReactNode;
  metadata?: Record<string, string>;
}

interface EntityActivityTimelineProps {
  entityType: 'account' | 'contact' | 'lead';
  entityId: string;
  showTabs?: boolean;
}

const activityIcons: Record<string, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  meeting: <Calendar className="h-4 w-4" />,
  note: <FileText className="h-4 w-4" />,
  message: <MessageSquare className="h-4 w-4" />,
  task: <Users className="h-4 w-4" />,
};

const getActivityColor = (type: string) => {
  switch (type) {
    case 'call': return 'bg-blue-500';
    case 'email': return 'bg-emerald-500';
    case 'meeting': return 'bg-purple-500';
    case 'note': return 'bg-amber-500';
    case 'message': return 'bg-cyan-500';
    case 'task': return 'bg-indigo-500';
    default: return 'bg-gray-500';
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'activity': return 'bg-blue-500';
    case 'email': return 'bg-emerald-500';
    case 'meeting': return 'bg-purple-500';
    case 'task': return 'bg-indigo-500';
    case 'deal': return 'bg-amber-500';
    case 'created': return 'bg-gray-500';
    default: return 'bg-gray-500';
  }
};

export const EntityActivityTimeline = ({ 
  entityType, 
  entityId, 
  showTabs = true 
}: EntityActivityTimelineProps) => {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchTimeline();
  }, [entityType, entityId]);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const items: TimelineItem[] = [];

      // Fetch activities based on entity type
      if (entityType === 'account') {
        const { data: activities } = await supabase
          .from('account_activities')
          .select('*')
          .eq('account_id', entityId)
          .order('activity_date', { ascending: false });

        (activities || []).forEach(activity => {
          items.push({
            id: `activity-${activity.id}`,
            type: 'activity',
            title: activity.subject,
            description: activity.description,
            date: activity.activity_date,
            icon: activityIcons[activity.activity_type] || <FileText className="h-4 w-4" />,
            metadata: { activityType: activity.activity_type, outcome: activity.outcome || '' }
          });
        });
      } else if (entityType === 'contact') {
        const { data: activities } = await supabase
          .from('contact_activities')
          .select('*')
          .eq('contact_id', entityId)
          .order('activity_date', { ascending: false });

        (activities || []).forEach(activity => {
          items.push({
            id: `activity-${activity.id}`,
            type: 'activity',
            title: activity.subject,
            description: activity.description,
            date: activity.activity_date,
            icon: activityIcons[activity.activity_type] || <FileText className="h-4 w-4" />,
            metadata: { activityType: activity.activity_type, outcome: activity.outcome || '' }
          });
        });
      }

      // Fetch email history
      const emailQuery = supabase
        .from('email_history')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50);

      if (entityType === 'account') {
        emailQuery.eq('account_id', entityId);
      } else if (entityType === 'contact') {
        emailQuery.eq('contact_id', entityId);
      } else if (entityType === 'lead') {
        emailQuery.eq('lead_id', entityId);
      }

      const { data: emails } = await emailQuery;
      (emails || []).forEach(email => {
        const isBounced = email.status === 'bounced' || email.bounce_type;
        items.push({
          id: `email-${email.id}`,
          type: 'email',
          title: `Email: ${email.subject}`,
          description: isBounced 
            ? `Bounced: ${email.recipient_email}` 
            : `To: ${email.recipient_email}`,
          date: email.sent_at,
          icon: <Send className="h-4 w-4" />,
          metadata: { 
            status: isBounced ? 'bounced' : email.status, 
            opens: isBounced ? '0' : String(email.open_count || 0),
            bounceType: email.bounce_type || '',
          }
        });
      });

      // Fetch meetings
      if (entityType === 'contact') {
        const { data: meetings } = await supabase
          .from('meetings')
          .select('*')
          .eq('contact_id', entityId)
          .order('start_time', { ascending: false });

        (meetings || []).forEach(meeting => {
          items.push({
            id: `meeting-${meeting.id}`,
            type: 'meeting',
            title: meeting.subject,
            description: meeting.outcome ? `Outcome: ${meeting.outcome}` : `Status: ${meeting.status}`,
            date: meeting.start_time,
            icon: <Video className="h-4 w-4" />,
            metadata: { status: meeting.status, outcome: meeting.outcome || '' }
          });
        });
      } else if (entityType === 'lead') {
        const { data: meetings } = await supabase
          .from('meetings')
          .select('*')
          .eq('lead_id', entityId)
          .order('start_time', { ascending: false });

        (meetings || []).forEach(meeting => {
          items.push({
            id: `meeting-${meeting.id}`,
            type: 'meeting',
            title: meeting.subject,
            description: meeting.outcome ? `Outcome: ${meeting.outcome}` : `Status: ${meeting.status}`,
            date: meeting.start_time,
            icon: <Video className="h-4 w-4" />,
            metadata: { status: meeting.status, outcome: meeting.outcome || '' }
          });
        });
      }

      // Fetch tasks
      const taskQuery = supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (entityType === 'account') {
        taskQuery.eq('account_id', entityId);
      } else if (entityType === 'contact') {
        taskQuery.eq('contact_id', entityId);
      } else if (entityType === 'lead') {
        taskQuery.eq('lead_id', entityId);
      }

      const { data: tasks } = await taskQuery;
      (tasks || []).forEach(task => {
        items.push({
          id: `task-${task.id}`,
          type: 'task',
          title: task.title,
          description: `Status: ${task.status} • Priority: ${task.priority}`,
          date: task.created_at,
          icon: <Users className="h-4 w-4" />,
          metadata: { status: task.status, priority: task.priority }
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

  const filteredTimeline = activeTab === 'all' 
    ? timeline 
    : timeline.filter(item => item.type === activeTab);

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

  const TimelineContent = () => (
    <ScrollArea className="h-[350px] pr-4">
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
        
        <div className="space-y-4">
          {filteredTimeline.map((item) => (
            <div key={item.id} className="relative pl-10">
              <div className={`absolute left-2 w-5 h-5 rounded-full ${getTypeColor(item.type)} flex items-center justify-center text-white`}>
                {item.icon}
              </div>
              
              <div className="bg-card border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    {item.type === 'email' && item.metadata && (
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {item.metadata.opens} opens
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(item.date), 'dd/MM/yyyy HH:mm')}
                    </span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {item.type}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );

  if (!showTabs) {
    return <TimelineContent />;
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="mb-4">
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="activity">Activities</TabsTrigger>
        <TabsTrigger value="email">Emails</TabsTrigger>
        <TabsTrigger value="meeting">Meetings</TabsTrigger>
        <TabsTrigger value="task">Tasks</TabsTrigger>
      </TabsList>
      
      <TabsContent value={activeTab}>
        <TimelineContent />
      </TabsContent>
    </Tabs>
  );
};
