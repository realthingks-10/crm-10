import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RelatedTasksSection } from "@/components/shared/RelatedTasksSection";
import { Task } from "@/types/task";
import { Building2, Globe, Phone, MapPin, Factory, Clock, Plus, ExternalLink, Mail, Pencil, ListTodo, History, Link2, Activity, User, UserPlus, Briefcase, Calendar, Loader2, MessageSquare } from "lucide-react";
import { RecordChangeHistory } from "@/components/shared/RecordChangeHistory";
import { format } from "date-fns";
import { formatDateTimeStandard } from "@/utils/formatUtils";
import { AccountActivityTimeline } from "./AccountActivityTimeline";
import { ActivityLogModal } from "./ActivityLogModal";
import { AttachRecordModal } from "@/components/shared/AttachRecordModal";
import { ContactDetailModal } from "@/components/contacts/ContactDetailModal";
import { MeetingDetailModal } from "@/components/meetings/MeetingDetailModal";
import { getAccountStatusColor } from "@/utils/accountStatusUtils";
import { EntityEmailHistory } from "@/components/shared/EntityEmailHistory";
interface Account {
  id: string;
  company_name: string;
  email?: string | null;
  website?: string | null;
  phone?: string | null;
  industry?: string | null;
  region?: string | null;
  country?: string | null;
  status?: string | null;
  notes?: string | null;
  company_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}
interface Contact {
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
interface Lead {
  id: string;
  lead_name: string;
  lead_status?: string | null;
  email?: string | null;
}
interface Deal {
  id: string;
  deal_name: string;
  stage: string;
  total_contract_value?: number | null;
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
interface AccountDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  onUpdate?: () => void;
  onEdit?: (account: Account) => void;
  defaultTab?: string;
}
export const AccountDetailModal = ({
  open,
  onOpenChange,
  account,
  onUpdate,
  onEdit,
  defaultTab = "overview"
}: AccountDetailModalProps) => {
  const navigate = useNavigate();
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [tasksRefreshToken, setTasksRefreshToken] = useState(0);

  // Attach modal states
  const [attachContactOpen, setAttachContactOpen] = useState(false);
  const [attachDealOpen, setAttachDealOpen] = useState(false);
  const [attachLeadOpen, setAttachLeadOpen] = useState(false);

  // Detail modal states
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showContactDetailModal, setShowContactDetailModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showMeetingDetailModal, setShowMeetingDetailModal] = useState(false);

  // Update activeTab when defaultTab prop changes
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab, open]);

  // Fetch linked contacts
  const {
    data: contacts = [],
    isLoading: loadingContacts,
    refetch: refetchContacts
  } = useQuery({
    queryKey: ['account-contacts', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];
      const {
        data,
        error
      } = await supabase.from('contacts').select('*').eq('account_id', account.id).order('contact_name');
      if (error) throw error;
      return data as Contact[];
    },
    enabled: !!account?.id && open
  });

  // Fetch linked leads
  const {
    data: leads = [],
    isLoading: loadingLeads,
    refetch: refetchLeads
  } = useQuery({
    queryKey: ['account-leads', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];
      const {
        data,
        error
      } = await supabase.from('leads').select('id, lead_name, lead_status, email').eq('account_id', account.id).order('created_time', {
        ascending: false
      });
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!account?.id && open
  });

  // Fetch linked deals
  const {
    data: deals = [],
    isLoading: loadingDeals,
    refetch: refetchDeals
  } = useQuery({
    queryKey: ['account-deals', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];
      const {
        data,
        error
      } = await supabase.from('deals').select('id, deal_name, stage, total_contract_value').eq('account_id', account.id).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      return data as Deal[];
    },
    enabled: !!account?.id && open
  });

  // Fetch linked meetings
  const {
    data: meetings = [],
    isLoading: loadingMeetings
  } = useQuery({
    queryKey: ['account-meetings', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];
      const {
        data,
        error
      } = await supabase.from('meetings').select('*').eq('account_id', account.id).order('start_time', {
        ascending: false
      }).limit(5);
      if (error) throw error;
      return data as Meeting[];
    },
    enabled: !!account?.id && open
  });

  // Handle request to create task - navigate to Tasks module
  const handleRequestCreateTask = () => {
    if (!account) return;
    onOpenChange(false); // Close account modal
    const params = new URLSearchParams({
      create: '1',
      module: 'accounts',
      recordId: account.id,
      recordName: account.company_name,
      return: '/accounts',
      returnViewId: account.id,
      returnTab: 'tasks'
    });
    navigate(`/tasks?${params.toString()}`);
  };

  // Handle request to edit task - navigate to Tasks module with viewId
  const handleRequestEditTask = (task: Task) => {
    if (!account) return;
    onOpenChange(false); // Close account modal
    const params = new URLSearchParams({
      viewId: task.id,
      return: '/accounts',
      returnViewId: account.id,
      returnTab: 'tasks'
    });
    navigate(`/tasks?${params.toString()}`);
  };
  const refetchAllAssociations = () => {
    refetchContacts();
    refetchLeads();
    refetchDeals();
  };
  if (!account) return null;
  const handleActivityLogged = () => {
    setRefreshKey(prev => prev + 1);
    onUpdate?.();
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
      'Dropped': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    };
    return stageColors[stage] || 'bg-gray-100 text-gray-800';
  };
  const getLeadStatusColor = (status?: string | null) => {
    const statusColors: Record<string, string> = {
      'New': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Contacted': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Qualified': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Unqualified': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      'Converted': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    };
    return statusColors[status || ''] || 'bg-gray-100 text-gray-800';
  };
  const getMeetingStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'scheduled': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'completed': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'cancelled': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };
  return <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {account.company_name}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getAccountStatusColor(account.status)}>
                    {account.status || 'New'}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onEdit && <Button variant="outline" size="sm" onClick={() => onEdit(account)} className="gap-2">
                    <Pencil className="h-4 w-4" />
                    Update
                  </Button>}
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview" className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
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
              {/* Account Info - 2 Column Grid */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Company Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {account.email && <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{account.email}</span>
                      </div>}
                    {account.phone && <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <a href={`tel:${account.phone}`} className="hover:underline truncate">
                          {account.phone}
                        </a>
                      </div>}
                    {account.website && <div className="flex items-center gap-2 text-sm">
                        <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <a href={account.website.startsWith('http') ? account.website : `https://${account.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 truncate">
                          <span className="truncate">{account.website}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </div>}
                    {account.industry && <div className="flex items-center gap-2 text-sm">
                        <Factory className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{account.industry}</span>
                      </div>}
                    {account.company_type && <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{account.company_type}</span>
                      </div>}
                    {(account.region || account.country) && <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{[account.region, account.country].filter(Boolean).join(', ')}</span>
                      </div>}
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              {account.notes && <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{account.notes}</p>
                  </CardContent>
                </Card>}

              {/* Timestamps */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {account.created_at && <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created: {formatDateTimeStandard(account.created_at)}
                  </span>}
                {account.updated_at && <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Updated: {formatDateTimeStandard(account.updated_at)}
                  </span>}
              </div>
            </TabsContent>

            <TabsContent value="linked" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Contacts */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Contacts ({contacts.length})
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setAttachContactOpen(true)} className="h-6 gap-1 text-xs px-2">
                        <Plus className="h-3 w-3" />
                        Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {loadingContacts ? <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div> : contacts.length === 0 ? <div className="text-center py-4 text-muted-foreground">
                        <User className="h-6 w-6 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No contacts yet</p>
                      </div> : <ScrollArea className="h-[150px]">
                        <div className="space-y-2">
                          {contacts.map(contact => <div key={contact.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => {
                        setSelectedContact(contact);
                        setShowContactDetailModal(true);
                      }}>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-xs truncate">{contact.contact_name}</p>
                                {contact.position && <p className="text-xs text-muted-foreground truncate">{contact.position}</p>}
                              </div>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                
                              </Button>
                            </div>)}
                        </div>
                      </ScrollArea>}
                  </CardContent>
                </Card>

                {/* Leads */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        Leads ({leads.length})
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setAttachLeadOpen(true)} className="h-6 gap-1 text-xs px-2">
                        <Plus className="h-3 w-3" />
                        Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {loadingLeads ? <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div> : leads.length === 0 ? <div className="text-center py-4 text-muted-foreground">
                        <UserPlus className="h-6 w-6 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No leads yet</p>
                      </div> : <ScrollArea className="h-[150px]">
                        <div className="space-y-2">
                          {leads.map(lead => <div key={lead.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => navigate(`/leads?viewId=${lead.id}`)}>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-xs truncate">{lead.lead_name}</p>
                              </div>
                              {lead.lead_status && <Badge className={`ml-2 text-xs ${getLeadStatusColor(lead.lead_status)}`}>
                                  {lead.lead_status}
                                </Badge>}
                            </div>)}
                        </div>
                      </ScrollArea>}
                  </CardContent>
                </Card>


                {/* Deals */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Deals ({deals.length})
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setAttachDealOpen(true)} className="h-6 gap-1 text-xs px-2">
                        <Plus className="h-3 w-3" />
                        Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {loadingDeals ? <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div> : deals.length === 0 ? <div className="text-center py-4 text-muted-foreground">
                        <Briefcase className="h-6 w-6 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No deals yet</p>
                      </div> : <ScrollArea className="h-[150px]">
                        <div className="space-y-2">
                          {deals.map(deal => <div key={deal.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => navigate(`/deals?viewId=${deal.id}`)}>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-xs truncate">{deal.deal_name}</p>
                                {deal.total_contract_value && <p className="text-xs text-muted-foreground">
                                    ${deal.total_contract_value.toLocaleString()}
                                  </p>}
                              </div>
                              <Badge className={`ml-2 text-xs ${getStageColor(deal.stage)}`}>
                                {deal.stage}
                              </Badge>
                            </div>)}
                        </div>
                      </ScrollArea>}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="mt-4" forceMount hidden={activeTab !== 'tasks'}>
              <RelatedTasksSection moduleType="accounts" recordId={account.id} recordName={account.company_name} refreshToken={tasksRefreshToken} onRequestCreateTask={handleRequestCreateTask} onRequestEditTask={handleRequestEditTask} />
            </TabsContent>

            <TabsContent value="activity" className="mt-4" forceMount hidden={activeTab !== 'activity'}>
              <AccountActivityTimeline key={refreshKey} accountId={account.id} onAddActivity={() => setShowActivityLog(true)} />
            </TabsContent>

            <TabsContent value="history" className="mt-4" forceMount hidden={activeTab !== 'history'}>
              <RecordChangeHistory entityType="accounts" entityId={account.id} maxHeight="400px" />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Activity Log Modal */}
      <ActivityLogModal open={showActivityLog} onOpenChange={setShowActivityLog} accountId={account.id} onSuccess={handleActivityLogged} />

      {/* Attach Modals */}
      <AttachRecordModal open={attachContactOpen} onOpenChange={setAttachContactOpen} recordType="contact" parentId={account.id} parentField="account_id" title="Attach Contacts to Account" onSuccess={refetchAllAssociations} />

      <AttachRecordModal open={attachDealOpen} onOpenChange={setAttachDealOpen} recordType="deal" parentId={account.id} parentField="account_id" title="Attach Deals to Account" onSuccess={refetchAllAssociations} />

      <AttachRecordModal open={attachLeadOpen} onOpenChange={setAttachLeadOpen} recordType="lead" parentId={account.id} parentField="account_id" title="Attach Leads to Account" onSuccess={refetchAllAssociations} />

      {/* Detail Modals */}
      <ContactDetailModal open={showContactDetailModal} onOpenChange={setShowContactDetailModal} contact={selectedContact ? {
      ...selectedContact,
      company_name: selectedContact.company_name || null
    } : null} onUpdate={() => {
      refetchContacts();
      onUpdate?.();
    }} />

      <MeetingDetailModal open={showMeetingDetailModal} onOpenChange={setShowMeetingDetailModal} meeting={selectedMeeting} onUpdate={onUpdate} />
    </>;
};