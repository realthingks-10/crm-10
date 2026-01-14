import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Briefcase, Calendar, CheckSquare, ExternalLink, Loader2, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface Deal {
  id: string;
  deal_name: string;
  stage: string;
  total_contract_value?: number;
  probability?: number;
}

interface Meeting {
  id: string;
  subject: string;
  start_time: string;
  status: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date?: string;
}

interface ContactAssociationsProps {
  contactId: string;
  contactName: string;
  accountId?: string;
}

export const ContactAssociations = ({ contactId, contactName, accountId }: ContactAssociationsProps) => {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssociations();
  }, [contactId, accountId]);

  const fetchAssociations = async () => {
    setLoading(true);
    try {
      // Fetch deals through account if available
      if (accountId) {
        const { data: dealData } = await supabase
          .from('deals')
          .select('id, deal_name, stage, total_contract_value, probability')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(5);

        setDeals(dealData || []);
      }

      // Fetch meetings for this contact
      const { data: meetingData } = await supabase
        .from('meetings')
        .select('id, subject, start_time, status')
        .eq('contact_id', contactId)
        .order('start_time', { ascending: false })
        .limit(5);

      setMeetings(meetingData || []);

      // Fetch tasks for this contact
      const { data: taskData } = await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(5);

      setTasks(taskData || []);
    } catch (error) {
      console.error('Error fetching associations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStageColor = (stage: string) => {
    const stageColors: Record<string, string> = {
      'Lead': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      'Qualified': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'RFQ': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'Discussions': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Offered': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'Won': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Lost': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'Dropped': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    };
    return stageColors[stage] || 'bg-gray-100 text-gray-800';
  };

  const getMeetingStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'scheduled': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'completed': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'cancelled': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const getTaskStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'open': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'in_progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'completed': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'deferred': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Deals */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Deals ({deals.length})
              </CardTitle>
              {accountId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/deals?createFor=${accountId}`)}
                  className="h-7 gap-1 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Add Deal
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {deals.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <Briefcase className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">No deals yet</p>
                  <p className="text-xs text-muted-foreground">
                    {accountId ? "Create deals to track opportunities" : "Link contact to an account first"}
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[180px]">
                <div className="space-y-2">
                  {deals.map((deal) => (
                    <div
                      key={deal.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => navigate(`/deals?viewId=${deal.id}`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{deal.deal_name}</p>
                        {deal.total_contract_value && (
                          <p className="text-xs text-muted-foreground">
                            ${deal.total_contract_value.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <Badge className={`ml-2 ${getStageColor(deal.stage)}`}>
                        {deal.stage}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Meetings */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Meetings ({meetings.length})
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/meetings?createFor=${contactId}&contactName=${encodeURIComponent(contactName)}`)}
                className="h-7 gap-1 text-xs"
              >
                <Plus className="h-3 w-3" />
                Add Meeting
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {meetings.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <Calendar className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">No meetings yet</p>
                  <p className="text-xs text-muted-foreground">Schedule meetings to track interactions</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/meetings?createFor=${contactId}&contactName=${encodeURIComponent(contactName)}`)}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Schedule Meeting
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[180px]">
                <div className="space-y-2">
                  {meetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => navigate(`/meetings?viewId=${meeting.id}`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{meeting.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(meeting.start_time), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                      <Badge className={`ml-2 ${getMeetingStatusColor(meeting.status)}`}>
                        {meeting.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tasks */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Tasks ({tasks.length})
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/tasks?createFor=${contactId}&contactName=${encodeURIComponent(contactName)}`)}
              className="h-7 gap-1 text-xs"
            >
              <Plus className="h-3 w-3" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                <CheckSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No tasks yet</p>
                <p className="text-xs text-muted-foreground">Create tasks to track follow-ups</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/tasks?createFor=${contactId}&contactName=${encodeURIComponent(contactName)}`)}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                Add First Task
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => navigate(`/tasks?viewId=${task.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{task.title}</p>
                    {task.due_date && (
                      <p className="text-xs text-muted-foreground">
                        Due: {format(new Date(task.due_date), 'dd/MM/yyyy')}
                      </p>
                    )}
                  </div>
                  <Badge className={`ml-2 text-xs ${getTaskStatusColor(task.status)}`}>
                    {task.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {tasks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={() => navigate('/tasks')}
            >
              View All Tasks
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
