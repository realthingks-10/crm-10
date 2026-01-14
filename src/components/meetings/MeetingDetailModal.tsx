import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RelatedTasksSection } from "@/components/shared/RelatedTasksSection";
import { Task } from "@/types/task";
import { 
  Calendar, 
  Clock, 
  User, 
  Users, 
  Building2,
  Briefcase,
  Video,
  ExternalLink,
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle,
  UserX,
  CalendarClock,
  Activity,
  ListTodo,
  Pencil,
  Plus,
  Link2,
  History
} from "lucide-react";
import { format } from "date-fns";
import { formatDateTimeStandard } from "@/utils/formatUtils";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import { getMeetingStatus } from "@/utils/meetingStatus";
import { MeetingFollowUpsSection } from "./MeetingFollowUpsSection";
import { RecordChangeHistory } from "@/components/shared/RecordChangeHistory";
import { ContactDetailModal } from "@/components/contacts/ContactDetailModal";
import { LeadDetailModal } from "@/components/leads/LeadDetailModal";
import { AccountDetailModalById } from "@/components/accounts/AccountDetailModalById";
import { MeetingActivityTimeline } from "./MeetingActivityTimeline";
import { MeetingActivityLogModal } from "./MeetingActivityLogModal";

interface Meeting {
  id: string;
  subject: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  join_url?: string | null;
  attendees?: unknown;
  lead_id?: string | null;
  contact_id?: string | null;
  account_id?: string | null;
  deal_id?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  status: string;
  outcome?: string | null;
  notes?: string | null;
  lead_name?: string | null;
  contact_name?: string | null;
}

interface LinkedContact {
  id: string;
  contact_name: string;
  email?: string | null;
  phone_no?: string | null;
  position?: string | null;
  company_name?: string | null;
  account_id?: string | null;
  linkedin?: string | null;
  website?: string | null;
  region?: string | null;
  industry?: string | null;
  contact_source?: string | null;
  description?: string | null;
  tags?: string[] | null;
  email_opens?: number | null;
  email_clicks?: number | null;
  engagement_score?: number | null;
  created_time?: string | null;
  modified_time?: string | null;
}

interface LinkedLead {
  id: string;
  lead_name: string;
  email?: string | null;
  phone_no?: string | null;
  position?: string | null;
  company_name?: string | null;
  account_id?: string | null;
  linkedin?: string | null;
  website?: string | null;
  country?: string | null;
  industry?: string | null;
  contact_source?: string | null;
  description?: string | null;
  lead_status?: string | null;
  created_time?: string | null;
  modified_time?: string | null;
}

interface MeetingDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting | null;
  onEdit?: (meeting: Meeting) => void;
  onUpdate?: () => void;
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  ongoing: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

const outcomeConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  successful: {
    label: "Successful",
    icon: <CheckCircle2 className="h-3 w-3" />,
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  },
  follow_up_needed: {
    label: "Follow-up Needed",
    icon: <AlertCircle className="h-3 w-3" />,
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
  },
  no_show: {
    label: "No-show",
    icon: <UserX className="h-3 w-3" />,
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  },
  rescheduled: {
    label: "Rescheduled",
    icon: <CalendarClock className="h-3 w-3" />,
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
  }
};

export const MeetingDetailModal = ({ 
  open, 
  onOpenChange, 
  meeting, 
  onEdit,
  onUpdate 
}: MeetingDetailModalProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [linkedContact, setLinkedContact] = useState<LinkedContact | null>(null);
  const [linkedLead, setLinkedLead] = useState<LinkedLead | null>(null);
  const [linkedAccount, setLinkedAccount] = useState<{ id: string; company_name: string; industry?: string | null; status?: string | null } | null>(null);
  const [linkedDeal, setLinkedDeal] = useState<{ id: string; deal_name: string; stage: string; total_contract_value?: number | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [tasksRefreshToken, setTasksRefreshToken] = useState(0);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);

  // Detail modal states
  const [showContactDetailModal, setShowContactDetailModal] = useState(false);
  const [showLeadDetailModal, setShowLeadDetailModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showActivityLogModal, setShowActivityLogModal] = useState(false);

  // Navigate to Tasks module for task creation
  const handleRequestCreateTask = () => {
    if (!meeting) return;
    const params = new URLSearchParams({
      create: '1',
      module: 'meetings',
      recordId: meeting.id,
      recordName: meeting.subject,
      return: '/meetings',
      returnViewId: meeting.id,
      returnTab: 'tasks',
    });
    onOpenChange(false);
    navigate(`/tasks?${params.toString()}`);
  };

  const handleRequestEditTask = (task: Task) => {
    if (!meeting) return;
    const params = new URLSearchParams({
      viewId: task.id,
      return: '/meetings',
      returnViewId: meeting.id,
      returnTab: 'tasks',
    });
    onOpenChange(false);
    navigate(`/tasks?${params.toString()}`);
  };

  const userIds = [meeting?.created_by].filter(Boolean) as string[];
  const { displayNames } = useUserDisplayNames(userIds);

  useEffect(() => {
    if (meeting && open) {
      fetchLinkedData();
    }
  }, [meeting?.id, open]);

  const fetchLinkedData = async () => {
    if (!meeting) return;
    setLoading(true);
    try {
      // Fetch linked contact if exists
      if (meeting.contact_id) {
        const { data: contactData } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', meeting.contact_id)
          .single();
        setLinkedContact(contactData);
      } else {
        setLinkedContact(null);
      }

      // Fetch linked lead if exists
      if (meeting.lead_id) {
        const { data: leadData } = await supabase
          .from('leads')
          .select('*')
          .eq('id', meeting.lead_id)
          .single();
        setLinkedLead(leadData);
      } else {
        setLinkedLead(null);
      }

      // Fetch linked account if exists
      if (meeting.account_id) {
        const { data: accountData } = await supabase
          .from('accounts')
          .select('id, company_name, industry, status')
          .eq('id', meeting.account_id)
          .single();
        setLinkedAccount(accountData);
      } else {
        setLinkedAccount(null);
      }

      // Fetch linked deal if exists
      if (meeting.deal_id) {
        const { data: dealData } = await supabase
          .from('deals')
          .select('id, deal_name, stage, total_contract_value')
          .eq('id', meeting.deal_id)
          .single();
        setLinkedDeal(dealData);
      } else {
        setLinkedDeal(null);
      }
    } catch (error) {
      console.error('Error fetching linked data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivityLogged = () => {
    setActivityRefreshKey(prev => prev + 1);
  };

  if (!meeting) return null;

  const effectiveStatus = getMeetingStatus(meeting);
  const attendeesList = meeting.attendees && Array.isArray(meeting.attendees) 
    ? (meeting.attendees as { email: string; name?: string }[])
    : [];

  const getStatusBadge = () => {
    const label = effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1);
    return (
      <Badge variant="outline" className={statusColors[effectiveStatus]}>
        {label}
      </Badge>
    );
  };

  const getOutcomeBadge = () => {
    if (!meeting.outcome) return null;
    const config = outcomeConfig[meeting.outcome];
    if (!config) return null;
    return (
      <Badge variant="outline" className={`gap-1 ${config.className}`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {meeting.subject}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusBadge()}
                  {getOutcomeBadge()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {meeting.join_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(meeting.join_url!, '_blank')}
                    className="gap-2"
                  >
                    <Video className="h-4 w-4" />
                    Join
                  </Button>
                )}
                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(meeting)}
                    className="gap-2"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="linked" className="flex items-center gap-1">
                <Link2 className="h-4 w-4" />
                Linked
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-1">
                <ListTodo className="h-4 w-4" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-1">
                <Activity className="h-4 w-4" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-1">
                <History className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Meeting Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(meeting.start_time), 'EEEE, dd MMM yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {format(new Date(meeting.start_time), 'HH:mm')} - {format(new Date(meeting.end_time), 'HH:mm')}
                      </span>
                    </div>
                    {meeting.description && (
                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground mb-1">Description</p>
                        <p className="text-sm whitespace-pre-wrap">{meeting.description}</p>
                      </div>
                    )}
                    {meeting.notes && (
                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground mb-1">Notes</p>
                        <p className="text-sm whitespace-pre-wrap">{meeting.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Attendees</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {meeting.lead_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>Lead: {meeting.lead_name}</span>
                      </div>
                    )}
                    {meeting.contact_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>Contact: {meeting.contact_name}</span>
                      </div>
                    )}
                    {attendeesList.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground mb-2">External Participants</p>
                        <div className="space-y-1">
                          {attendeesList.map((attendee, idx) => (
                            <div key={idx} className="text-sm flex items-center gap-2">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span>{attendee.name || attendee.email}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {meeting.created_by && (
                      <div className="flex items-center gap-2 text-sm mt-3 pt-3 border-t">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>Organizer: {displayNames[meeting.created_by] || 'Loading...'}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Follow-ups Section */}
              <MeetingFollowUpsSection meetingId={meeting.id} />

              {/* Timestamps */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {meeting.created_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created: {formatDateTimeStandard(meeting.created_at)}
                  </span>
                )}
              </div>
            </TabsContent>

            <TabsContent value="linked" className="mt-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Linked Contact */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Contact
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {linkedContact ? (
                        <div
                          className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                          onClick={() => setShowContactDetailModal(true)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{linkedContact.contact_name}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {linkedContact.position || 'Contact'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No linked contact</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Linked Lead */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Lead
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {linkedLead ? (
                        <div
                          className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                          onClick={() => setShowLeadDetailModal(true)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{linkedLead.lead_name}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {linkedLead.company_name || 'Lead'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No linked lead</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Linked Account */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Account
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {linkedAccount ? (
                        <div
                          className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                          onClick={() => setShowAccountModal(true)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{linkedAccount.company_name}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {linkedAccount.industry || 'Account'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No linked account</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Linked Deal */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Deal
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {linkedDeal ? (
                        <div className="p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Briefcase className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{linkedDeal.deal_name}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {linkedDeal.stage}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No linked deal</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <RelatedTasksSection
                moduleType="meetings"
                recordId={meeting.id}
                recordName={meeting.subject}
                refreshToken={tasksRefreshToken}
                onRequestCreateTask={handleRequestCreateTask}
                onRequestEditTask={handleRequestEditTask}
              />
            </TabsContent>

            <TabsContent value="activity" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Activity Timeline</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowActivityLogModal(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Log Activity
                </Button>
              </div>

              {/* Meeting Notes Card */}
              {meeting.notes && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Meeting Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{meeting.notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Activity Timeline */}
              <MeetingActivityTimeline meetingId={meeting.id} refreshKey={activityRefreshKey} />
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <RecordChangeHistory entityType="meetings" entityId={meeting.id} maxHeight="400px" />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Detail Modals */}
      {linkedContact && (
        <ContactDetailModal
          open={showContactDetailModal}
          onOpenChange={setShowContactDetailModal}
          contact={{ ...linkedContact, company_name: linkedContact.company_name || null }}
          onUpdate={onUpdate}
        />
      )}

      {linkedLead && (
        <LeadDetailModal
          open={showLeadDetailModal}
          onOpenChange={setShowLeadDetailModal}
          lead={{ ...linkedLead, company_name: linkedLead.company_name || null }}
          onUpdate={onUpdate}
        />
      )}

      {linkedAccount && (
        <AccountDetailModalById
          open={showAccountModal}
          onOpenChange={setShowAccountModal}
          accountId={linkedAccount.id}
          onUpdate={onUpdate}
        />
      )}

      {/* Activity Log Modal */}
      <MeetingActivityLogModal
        open={showActivityLogModal}
        onOpenChange={setShowActivityLogModal}
        meetingId={meeting.id}
        onSuccess={handleActivityLogged}
      />
    </>
  );
};
