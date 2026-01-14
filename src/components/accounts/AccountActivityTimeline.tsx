import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Phone, 
  Mail, 
  Calendar, 
  FileText, 
  CheckSquare,
  User,
  Briefcase,
  Clock,
  Loader2,
  UserPlus,
  Video,
  Plus,
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

interface AccountActivityTimelineProps {
  accountId: string;
  onAddActivity?: () => void;
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

export const AccountActivityTimeline = ({ accountId, onAddActivity }: AccountActivityTimelineProps) => {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<TimelineItem | null>(null);

  useEffect(() => {
    fetchTimeline();
  }, [accountId]);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel for better performance
      const [activitiesRes, contactsRes, dealsRes, leadsRes] = await Promise.all([
        supabase
          .from('account_activities')
          .select('id, subject, description, activity_type, activity_date, outcome, duration_minutes')
          .eq('account_id', accountId)
          .order('activity_date', { ascending: false })
          .limit(50),
        supabase
          .from('contacts')
          .select('id, contact_name, email, position, created_time')
          .eq('account_id', accountId)
          .order('created_time', { ascending: false })
          .limit(50),
        supabase
          .from('deals')
          .select('id, deal_name, stage, total_contract_value, created_at')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('leads')
          .select('id, lead_name, lead_status, company_name, created_time')
          .eq('account_id', accountId)
          .order('created_time', { ascending: false })
          .limit(50)
      ]);

      const activities = activitiesRes.data || [];
      const contacts = contactsRes.data || [];
      const deals = dealsRes.data || [];
      const leads = leadsRes.data || [];

      // Fetch meetings using contact IDs from the contacts we already fetched (no duplicate query)
      let meetings: any[] = [];
      const contactIds = contacts.map(c => c.id);
      if (contactIds.length > 0) {
        const { data: meetingData } = await supabase
          .from('meetings')
          .select('id, subject, start_time, status, outcome')
          .in('contact_id', contactIds)
          .order('start_time', { ascending: false })
          .limit(50);
        meetings = meetingData || [];
      }

      // Combine into timeline
      const items: TimelineItem[] = [];

      // Add activities
      activities.forEach(activity => {
        items.push({
          id: `activity-${activity.id}`,
          type: 'activity',
          title: activity.subject,
          description: activity.description,
          date: activity.activity_date,
          icon: getActivityIcon(activity.activity_type),
          metadata: {
            type: activity.activity_type,
            outcome: activity.outcome || '',
            duration: activity.duration_minutes?.toString() || ''
          }
        });
      });

      // Add contacts
      contacts.forEach(contact => {
        items.push({
          id: `contact-${contact.id}`,
          type: 'contact',
          title: `Contact added: ${contact.contact_name}`,
          description: contact.position || contact.email,
          date: contact.created_time || new Date().toISOString(),
          icon: <User className="h-4 w-4" />,
          metadata: { email: contact.email || '' }
        });
      });

      // Add deals
      deals.forEach(deal => {
        items.push({
          id: `deal-${deal.id}`,
          type: 'deal',
          title: `Deal created: ${deal.deal_name}`,
          description: `Stage: ${deal.stage}${deal.total_contract_value ? ` • Value: $${deal.total_contract_value.toLocaleString()}` : ''}`,
          date: deal.created_at,
          icon: <Briefcase className="h-4 w-4" />,
          metadata: { stage: deal.stage }
        });
      });

      // Add leads
      leads.forEach(lead => {
        items.push({
          id: `lead-${lead.id}`,
          type: 'lead',
          title: `Lead added: ${lead.lead_name}`,
          description: lead.lead_status ? `Status: ${lead.lead_status}` : undefined,
          date: lead.created_time || new Date().toISOString(),
          icon: <UserPlus className="h-4 w-4" />,
          metadata: { status: lead.lead_status || '' }
        });
      });

      // Add meetings
      meetings.forEach(meeting => {
        items.push({
          id: `meeting-${meeting.id}`,
          type: 'meeting',
          title: `Meeting: ${meeting.subject}`,
          description: meeting.outcome ? `Outcome: ${meeting.outcome}` : `Status: ${meeting.status}`,
          date: meeting.start_time,
          icon: <Video className="h-4 w-4" />,
          metadata: { status: meeting.status, outcome: meeting.outcome || '' }
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Activity Timeline</h3>
        {onAddActivity && (
          <Button size="sm" variant="outline" onClick={onAddActivity}>
            <Plus className="h-4 w-4 mr-1" />
            Add Activity
          </Button>
        )}
      </div>
      <ScrollArea className="h-[450px] max-h-[60vh]">
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
                  item.type === 'activity' 
                    ? getActivityColor(item.metadata?.type || '')
                    : item.type === 'contact'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                    : item.type === 'deal'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                    : item.type === 'lead'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                    : item.type === 'meeting'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
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
                      {item.type === 'activity' && item.metadata?.type && (
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
