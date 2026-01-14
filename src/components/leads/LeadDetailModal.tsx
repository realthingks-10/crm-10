import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EntityEmailHistory } from '@/components/shared/EntityEmailHistory';
import { RecordChangeHistory } from '@/components/shared/RecordChangeHistory';
import { RelatedTasksSection } from '@/components/shared/RelatedTasksSection';
import { SendEmailModal } from '@/components/SendEmailModal';
import { LeadActivityTimeline } from './LeadActivityTimeline';
import { LeadActivityLogModal } from './LeadActivityLogModal';
import { MeetingModal } from '@/components/MeetingModal';
import { MeetingDetailModal } from '@/components/meetings/MeetingDetailModal';
import { AccountDetailModalById } from '@/components/accounts/AccountDetailModalById';
import { Task } from '@/types/task';
import { getLeadStatusColor } from '@/utils/leadStatusUtils';
import { toast } from '@/hooks/use-toast';
import {
  User,
  Building2,
  Mail,
  Phone,
  Globe,
  Linkedin,
  MapPin,
  Clock,
  Send,
  Plus,
  Factory,
  Pencil,
  CalendarPlus,
  CheckSquare,
  ExternalLink,
  History,
  Link2,
  ListTodo,
  Activity,
  Tag,
  Calendar,
  Briefcase,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

interface Lead {
  id: string;
  lead_name: string;
  company_name?: string | null;
  account_id?: string | null;
  position?: string | null;
  email?: string | null;
  phone_no?: string | null;
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

interface Account {
  id: string;
  company_name: string;
  industry: string | null;
  website: string | null;
  country: string | null;
  region: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
}

interface Meeting {
  id: string;
  subject: string;
  start_time: string;
  end_time: string;
  status: string;
  description?: string | null;
  join_url?: string | null;
  attendees?: unknown;
  lead_id?: string | null;
  contact_id?: string | null;
  account_id?: string | null;
  deal_id?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  outcome?: string | null;
  notes?: string | null;
  lead_name?: string | null;
  contact_name?: string | null;
}

interface Deal {
  id: string;
  deal_name: string;
  stage: string;
  total_contract_value?: number | null;
}

interface LeadDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onUpdate?: () => void;
  onEdit?: (lead: Lead) => void;
}

export const LeadDetailModal = ({
  open,
  onOpenChange,
  lead,
  onUpdate,
  onEdit,
}: LeadDetailModalProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showActivityLogModal, setShowActivityLogModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showMeetingDetailModal, setShowMeetingDetailModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // Navigate to Tasks module for task creation
  const handleRequestCreateTask = () => {
    if (!lead) return;
    const params = new URLSearchParams({
      create: '1',
      module: 'leads',
      recordId: lead.id,
      recordName: lead.lead_name,
      return: '/leads',
      returnViewId: lead.id,
      returnTab: 'tasks',
    });
    onOpenChange(false);
    navigate(`/tasks?${params.toString()}`);
  };

  const handleRequestEditTask = (task: Task) => {
    if (!lead) return;
    const params = new URLSearchParams({
      viewId: task.id,
      return: '/leads',
      returnViewId: lead.id,
      returnTab: 'tasks',
    });
    onOpenChange(false);
    navigate(`/tasks?${params.toString()}`);
  };

  // Fetch linked account details
  const { data: linkedAccount } = useQuery({
    queryKey: ['linked-account', lead?.account_id],
    queryFn: async () => {
      if (!lead?.account_id) return null;
      const { data, error } = await supabase
        .from('accounts')
        .select('id, company_name, industry, website, country, region, phone, email, status')
        .eq('id', lead.account_id)
        .single();
      
      if (error) {
        console.error('Error fetching linked account:', error);
        return null;
      }
      return data as Account;
    },
    enabled: !!lead?.account_id,
  });

  // Fetch linked meetings
  const { data: linkedMeetings = [], isLoading: loadingMeetings } = useQuery({
    queryKey: ['lead-meetings', lead?.id],
    queryFn: async () => {
      if (!lead?.id) return [];
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('lead_id', lead.id)
        .order('start_time', { ascending: false })
        .limit(5);
      
      if (error) {
        console.error('Error fetching meetings:', error);
        return [];
      }
      return data as Meeting[];
    },
    enabled: !!lead?.id && open,
  });

  // Fetch linked deals through account
  const { data: linkedDeals = [], isLoading: loadingDeals } = useQuery({
    queryKey: ['lead-deals', lead?.account_id],
    queryFn: async () => {
      if (!lead?.account_id) return [];
      const { data, error } = await supabase
        .from('deals')
        .select('id, deal_name, stage, total_contract_value')
        .eq('account_id', lead.account_id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) {
        console.error('Error fetching deals:', error);
        return [];
      }
      return data as Deal[];
    },
    enabled: !!lead?.account_id && open,
  });

  if (!lead) return null;

  const handleActivityLogged = () => {
    setRefreshKey(prev => prev + 1);
    onUpdate?.();
  };

  // Get display company name from linked account or lead's legacy field
  const displayCompanyName = linkedAccount?.company_name || lead.company_name;
  const displayIndustry = linkedAccount?.industry || lead.industry;
  const displayCountry = linkedAccount?.country || lead.country;
  const displayWebsite = linkedAccount?.website || lead.website;

  const getMeetingStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'scheduled': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'completed': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'cancelled': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
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

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {lead.lead_name}
                </DialogTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  {lead.position && <span>{lead.position}</span>}
                  {lead.position && displayCompanyName && <span>at</span>}
                  {displayCompanyName && (
                    <span className="font-medium">{displayCompanyName}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getLeadStatusColor(lead.lead_status)}>
                    {lead.lead_status || 'New'}
                  </Badge>
                  {lead.contact_source && (
                    <Badge variant="outline">Source: {lead.contact_source}</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(lead)}
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
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview" className="flex items-center gap-1">
                <User className="h-4 w-4" />
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
              <TabsTrigger value="emails" className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                Emails
              </TabsTrigger>
              <TabsTrigger value="tags" className="flex items-center gap-1">
                <Tag className="h-4 w-4" />
                Tags
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
                    <CardTitle className="text-base">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {lead.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                          {lead.email}
                        </a>
                      </div>
                    )}
                    {lead.phone_no && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${lead.phone_no}`} className="hover:underline">
                          {lead.phone_no}
                        </a>
                      </div>
                    )}
                    {lead.linkedin && (
                      <div className="flex items-center gap-2 text-sm">
                        <Linkedin className="h-4 w-4 text-muted-foreground" />
                        <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          LinkedIn Profile
                        </a>
                      </div>
                    )}
                    {displayWebsite && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a 
                          href={displayWebsite.startsWith('http') ? displayWebsite : `https://${displayWebsite}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-primary hover:underline"
                        >
                          {displayWebsite}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Company Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {displayCompanyName && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{displayCompanyName}</span>
                      </div>
                    )}
                    {displayIndustry && (
                      <div className="flex items-center gap-2 text-sm">
                        <Factory className="h-4 w-4 text-muted-foreground" />
                        <span>{displayIndustry}</span>
                      </div>
                    )}
                    {displayCountry && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{displayCountry}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {lead.description && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{lead.description}</p>
                  </CardContent>
                </Card>
              )}

              {/* Timestamps */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {lead.created_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created: {format(new Date(lead.created_time), 'dd/MM/yyyy')}
                  </span>
                )}
                {lead.modified_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Updated: {format(new Date(lead.modified_time), 'dd/MM/yyyy')}
                  </span>
                )}
              </div>
            </TabsContent>

            <TabsContent value="linked" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                        onClick={() => setShowAccountModal(true)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{linkedAccount.company_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {[linkedAccount.industry, linkedAccount.country].filter(Boolean).join(' • ')}
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

                {/* Linked Meetings */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Meetings ({linkedMeetings.length})
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowMeetingModal(true)}
                        className="h-7 gap-1 text-xs"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingMeetings ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : linkedMeetings.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No meetings yet</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[180px]">
                        <div className="space-y-2">
                          {linkedMeetings.map((meeting) => (
                            <div
                              key={meeting.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                              onClick={() => {
                                setSelectedMeeting(meeting);
                                setShowMeetingDetailModal(true);
                              }}
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

                {/* Linked Deals */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Deals ({linkedDeals.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingDeals ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : linkedDeals.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No deals yet</p>
                        <p className="text-xs mt-1">Link lead to an account to see deals</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[180px]">
                        <div className="space-y-2">
                          {linkedDeals.map((deal) => (
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
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <RelatedTasksSection
                moduleType="leads"
                recordId={lead.id}
                recordName={lead.lead_name}
                onRequestCreateTask={handleRequestCreateTask}
                onRequestEditTask={handleRequestEditTask}
              />
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Activity Timeline</h3>
                <Button size="sm" onClick={() => setShowActivityLogModal(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Log Activity
                </Button>
              </div>
              <LeadActivityTimeline key={refreshKey} leadId={lead.id} />
            </TabsContent>

            <TabsContent value="emails" className="mt-4">
              <div className="space-y-4">
                {/* Compact Email Engagement Stats with Send Button */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-500" />
                      <span className="text-muted-foreground">Opens:</span>
                      <span className="font-semibold">0</span>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => setShowEmailModal(true)}
                    disabled={!lead.email}
                    title={!lead.email ? "No email address available" : "Send email to lead"}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Send Email
                  </Button>
                </div>

                {/* Email History */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Email History</h4>
                  <EntityEmailHistory entityType="lead" entityId={lead.id} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tags" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Tags & Labels</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="gap-1 cursor-pointer hover:bg-destructive/20"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        {tag}
                        <span className="text-xs">×</span>
                      </Badge>
                    ))}
                    {tags.length === 0 && (
                      <p className="text-sm text-muted-foreground">No tags yet</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder="Add a tag..."
                      className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
                    />
                    <Button size="sm" onClick={handleAddTag}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Note: Tags are managed locally in this view
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <RecordChangeHistory entityType="leads" entityId={lead.id} maxHeight="400px" />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <LeadActivityLogModal
        open={showActivityLogModal}
        onOpenChange={setShowActivityLogModal}
        leadId={lead.id}
        onSuccess={handleActivityLogged}
      />

      <SendEmailModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
        recipient={{
          name: lead.lead_name,
          email: lead.email || undefined,
          company_name: displayCompanyName || undefined,
          position: lead.position || undefined,
        }}
        leadId={lead.id}
        onEmailSent={onUpdate}
      />

      <MeetingModal
        open={showMeetingModal}
        onOpenChange={setShowMeetingModal}
        initialLeadId={lead.id}
        onSuccess={() => {
          setShowMeetingModal(false);
          onUpdate?.();
        }}
      />

      <AccountDetailModalById
        open={showAccountModal}
        onOpenChange={setShowAccountModal}
        accountId={lead.account_id || null}
      />

      <MeetingDetailModal
        open={showMeetingDetailModal}
        onOpenChange={setShowMeetingDetailModal}
        meeting={selectedMeeting}
        onUpdate={onUpdate}
      />
    </>
  );
};
