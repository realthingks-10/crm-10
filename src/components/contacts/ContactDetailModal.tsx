import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ContactActivityTimeline } from './ContactActivityTimeline';
import { ContactActivityLogModal } from './ContactActivityLogModal';
import { ContactTagsManager } from './ContactTagsManager';
import { ContactEmailTracking } from './ContactEmailTracking';
import { EntityEmailHistory } from '@/components/shared/EntityEmailHistory';
import { RecordChangeHistory } from '@/components/shared/RecordChangeHistory';
import { RelatedTasksSection } from '@/components/shared/RelatedTasksSection';
import { SendEmailModal } from '@/components/SendEmailModal';
import { AccountDetailModalById } from '@/components/accounts/AccountDetailModalById';
import { MeetingModal } from '@/components/MeetingModal';
import { MeetingDetailModal } from '@/components/meetings/MeetingDetailModal';
import { Task } from '@/types/task';
import { toast } from '@/hooks/use-toast';
import { User, Building2, Mail, Phone, Globe, Linkedin, MapPin, Plus, Clock, Tag, Activity, Send, History, Pencil, Link2, CalendarPlus, ListTodo, Calendar, ExternalLink, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
interface Contact {
  id: string;
  contact_name: string;
  company_name?: string | null;
  account_id?: string | null;
  position?: string | null;
  email?: string | null;
  phone_no?: string | null;
  linkedin?: string | null;
  contact_source?: string | null;
  description?: string | null;
  tags?: string[] | null;
  email_opens?: number | null;
  email_clicks?: number | null;
  engagement_score?: number | null;
  created_time?: string | null;
  modified_time?: string | null;
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
interface ContactDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onUpdate?: () => void;
  onEdit?: (contact: Contact) => void;
}
export const ContactDetailModal = ({
  open,
  onOpenChange,
  contact,
  onUpdate,
  onEdit
}: ContactDetailModalProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showActivityLogModal, setShowActivityLogModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [tasksRefreshToken, setTasksRefreshToken] = useState(0);
  const [activityRefreshToken, setActivityRefreshToken] = useState(0);

  // Linked data
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showMeetingDetailModal, setShowMeetingDetailModal] = useState(false);

  // Navigate to Tasks module for task creation
  const handleRequestCreateTask = () => {
    if (!contact) return;
    const params = new URLSearchParams({
      create: '1',
      module: 'contacts',
      recordId: contact.id,
      recordName: contact.contact_name,
      return: '/contacts',
      returnViewId: contact.id,
      returnTab: 'tasks'
    });
    onOpenChange(false);
    navigate(`/tasks?${params.toString()}`);
  };
  const handleRequestEditTask = (task: Task) => {
    if (!contact) return;
    const params = new URLSearchParams({
      viewId: task.id,
      return: '/contacts',
      returnViewId: contact.id,
      returnTab: 'tasks'
    });
    onOpenChange(false);
    navigate(`/tasks?${params.toString()}`);
  };
  useEffect(() => {
    if (contact) {
      setTags(contact.tags || []);
      // Fetch account name if linked
      if (contact.account_id) {
        fetchAccountName(contact.account_id);
      } else {
        setAccountName(null);
      }
      fetchLinkedData();
    }
  }, [contact]);
  const fetchAccountName = async (accountId: string) => {
    const {
      data
    } = await supabase.from('accounts').select('company_name').eq('id', accountId).single();
    setAccountName(data?.company_name || null);
  };
  const fetchLinkedData = async () => {
    if (!contact) return;
    setLoadingLinked(true);
    try {
      // Fetch meetings for this contact
      const {
        data: meetingData
      } = await supabase.from('meetings').select('*').eq('contact_id', contact.id).order('start_time', {
        ascending: false
      }).limit(5);
      setMeetings(meetingData || []);
    } catch (error) {
      console.error('Error fetching linked data:', error);
    } finally {
      setLoadingLinked(false);
    }
  };
  const handleTagsChange = async (newTags: string[]) => {
    if (!contact) return;
    try {
      const {
        error
      } = await supabase.from('contacts').update({
        tags: newTags
      }).eq('id', contact.id);
      if (error) throw error;
      setTags(newTags);
      toast({
        title: "Tags Updated",
        description: "Contact tags have been updated"
      });
      onUpdate?.();
    } catch (error: any) {
      console.error('Error updating tags:', error);
      toast({
        title: "Error",
        description: "Failed to update tags",
        variant: "destructive"
      });
    }
  };
  const handleActivityLogged = () => {
    setActivityRefreshToken(prev => prev + 1);
    onUpdate?.();
  };
  const getMeetingStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'scheduled': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'completed': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'cancelled': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };
  if (!contact) return null;
  return <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {contact.contact_name}
                </DialogTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  {contact.position && <span>{contact.position}</span>}
                  {contact.position && (contact.company_name || accountName) && <span>at</span>}
                  {(accountName || contact.company_name) && <button onClick={() => contact.account_id && setShowAccountModal(true)} className={`font-medium ${contact.account_id ? 'text-primary hover:underline cursor-pointer' : ''}`} disabled={!contact.account_id}>
                      {accountName || contact.company_name}
                    </button>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onEdit && <Button variant="outline" size="sm" onClick={() => onEdit(contact)} className="gap-2">
                    <Pencil className="h-4 w-4" />
                    Update
                  </Button>}
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
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

            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground">Contact Information</h3>
                  
                  {contact.email && <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <a href={`mailto:${contact.email}`} className="text-sm hover:underline">
                          {contact.email}
                        </a>
                        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setShowEmailModal(true)}>
                          <Send className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>}
                  
                  {contact.phone_no && <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${contact.phone_no}`} className="text-sm hover:underline">
                        {contact.phone_no}
                      </a>
                    </div>}
                  
                  {contact.linkedin && <div className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4 text-muted-foreground" />
                      <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline">
                        LinkedIn Profile
                      </a>
                    </div>}
                </div>

                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground">Company Details</h3>
                  
                  {(accountName || contact.company_name) && <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {contact.account_id ? <button onClick={() => setShowAccountModal(true)} className="text-sm text-primary hover:underline">
                          {accountName || contact.company_name}
                        </button> : <span className="text-sm">{contact.company_name}</span>}
                    </div>}
                  
                  {contact.contact_source && <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Source: {contact.contact_source}</span>
                    </div>}
                </div>
              </div>

              {contact.description && <>
                  <Separator />
                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground mb-2">Description</h3>
                    <p className="text-sm">{contact.description}</p>
                  </div>
                </>}

              {/* Timestamps */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                {contact.created_time && <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created: {format(new Date(contact.created_time), 'dd/MM/yyyy')}
                  </span>}
                {contact.modified_time && <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Updated: {format(new Date(contact.modified_time), 'dd/MM/yyyy')}
                  </span>}
              </div>
            </TabsContent>

            <TabsContent value="linked" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Linked Account */}
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Account
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contact.account_id && accountName ? <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => setShowAccountModal(true)}>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{accountName}</p>
                            <p className="text-sm text-muted-foreground">Account</p>
                          </div>
                        </div>
                        
                      </div> : <div className="text-center py-6 text-muted-foreground">
                        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No linked account</p>
                      </div>}
                  </CardContent>
                </Card>

                {/* Linked Meetings */}
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Meetings ({meetings.length})
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setShowMeetingModal(true)} className="h-7 gap-1 text-xs">
                        <Plus className="h-3 w-3" />
                        Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingLinked ? <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div> : meetings.length === 0 ? <div className="text-center py-6 text-muted-foreground">
                        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No meetings yet</p>
                      </div> : <ScrollArea className="h-[180px]">
                        <div className="space-y-2">
                          {meetings.map(meeting => <div key={meeting.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => {
                        setSelectedMeeting(meeting);
                        setShowMeetingDetailModal(true);
                      }}>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">{meeting.subject}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(meeting.start_time), 'dd/MM/yyyy HH:mm')}
                                </p>
                              </div>
                              <Badge className={`ml-2 ${getMeetingStatusColor(meeting.status)}`}>
                                {meeting.status}
                              </Badge>
                            </div>)}
                        </div>
                      </ScrollArea>}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <RelatedTasksSection moduleType="contacts" recordId={contact.id} recordName={contact.contact_name} refreshToken={tasksRefreshToken} onRequestCreateTask={handleRequestCreateTask} onRequestEditTask={handleRequestEditTask} />
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Activity Timeline</h3>
                <Button size="sm" onClick={() => setShowActivityLogModal(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Log Activity
                </Button>
              </div>
              <ContactActivityTimeline contactId={contact.id} key={activityRefreshToken} />
            </TabsContent>

            <TabsContent value="emails" className="mt-4">
              <div className="space-y-4">
                {/* Compact Email Engagement Stats with Send Button */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <ContactEmailTracking emailOpens={contact.email_opens || 0} />
                  <Button size="sm" onClick={() => setShowEmailModal(true)} disabled={!contact.email} title={!contact.email ? "No email address available" : "Send email to contact"}>
                    <Send className="h-4 w-4 mr-1" />
                    Send Email
                  </Button>
                </div>

                {/* Email History */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Email History</h4>
                  <EntityEmailHistory entityType="contact" entityId={contact.id} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tags" className="mt-4">
              <div className="space-y-4">
                <h3 className="font-medium">Tags & Labels</h3>
                <ContactTagsManager tags={tags} onTagsChange={handleTagsChange} />
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <RecordChangeHistory entityType="contacts" entityId={contact.id} maxHeight="400px" />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ContactActivityLogModal open={showActivityLogModal} onOpenChange={setShowActivityLogModal} contactId={contact.id} onSuccess={handleActivityLogged} />

      <SendEmailModal open={showEmailModal} onOpenChange={setShowEmailModal} recipient={{
      name: contact.contact_name,
      email: contact.email || undefined,
      company_name: contact.company_name || undefined,
      position: contact.position || undefined
    }} contactId={contact.id} onEmailSent={onUpdate} />

      <AccountDetailModalById open={showAccountModal} onOpenChange={setShowAccountModal} accountId={contact.account_id || null} />

      <MeetingModal open={showMeetingModal} onOpenChange={setShowMeetingModal} initialContactId={contact.id} onSuccess={() => {
      setShowMeetingModal(false);
      fetchLinkedData();
      onUpdate?.();
    }} />

      <MeetingDetailModal open={showMeetingDetailModal} onOpenChange={setShowMeetingDetailModal} meeting={selectedMeeting} onUpdate={() => {
      fetchLinkedData();
      onUpdate?.();
    }} />
    </>;
};