import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Briefcase, ExternalLink, Loader2, Mail, Phone, Plus, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AttachRecordModal } from "@/components/shared/AttachRecordModal";

interface Contact {
  id: string;
  contact_name: string;
  email?: string;
  phone_no?: string;
  position?: string;
}

interface Deal {
  id: string;
  deal_name: string;
  stage: string;
  total_contract_value?: number;
  probability?: number;
}

interface Lead {
  id: string;
  lead_name: string;
  lead_status?: string;
  email?: string;
  company_name?: string;
}

interface AccountAssociationsProps {
  accountId: string;
  companyName: string;
}

export const AccountAssociations = ({ accountId, companyName }: AccountAssociationsProps) => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [attachContactOpen, setAttachContactOpen] = useState(false);
  const [attachDealOpen, setAttachDealOpen] = useState(false);
  const [attachLeadOpen, setAttachLeadOpen] = useState(false);

  useEffect(() => {
    fetchAssociations();
  }, [accountId, companyName]);

  const fetchAssociations = async () => {
    setLoading(true);
    try {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('id, contact_name, email, phone_no, position')
        .eq('account_id', accountId)
        .order('contact_name');

      setContacts(contactData || []);

      const { data: dealData } = await supabase
        .from('deals')
        .select('id, deal_name, stage, total_contract_value, probability')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      setDeals(dealData || []);

      const { data: leadData } = await supabase
        .from('leads')
        .select('id, lead_name, lead_status, email, company_name')
        .eq('account_id', accountId)
        .order('created_time', { ascending: false });

      setLeads(leadData || []);
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

  const getLeadStatusColor = (status?: string) => {
    const statusColors: Record<string, string> = {
      'New': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Contacted': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Qualified': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Unqualified': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      'Converted': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    };
    return statusColors[status || ''] || 'bg-gray-100 text-gray-800';
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contacts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Contacts ({contacts.length})
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAttachContactOpen(true)}
                className="h-6 gap-1 text-xs px-2"
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {contacts.length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium">No contacts yet</p>
                  <p className="text-xs text-muted-foreground">Add contacts to track relationships</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAttachContactOpen(true)}
                  className="gap-1 h-7 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Add First Contact
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[150px]">
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs truncate">{contact.contact_name}</p>
                        {contact.position && (
                          <p className="text-xs text-muted-foreground truncate">{contact.position}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        {contact.email && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
                            <a href={`mailto:${contact.email}`}>
                              <Mail className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                        {contact.phone_no && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
                            <a href={`tel:${contact.phone_no}`}>
                              <Phone className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            {contacts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 h-7 text-xs"
                onClick={() => navigate('/contacts')}
              >
                View All
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            )}
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAttachDealOpen(true)}
                className="h-6 gap-1 text-xs px-2"
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {deals.length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium">No deals yet</p>
                  <p className="text-xs text-muted-foreground">Create deals to track opportunities</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAttachDealOpen(true)}
                  className="gap-1 h-7 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Add First Deal
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[150px]">
                <div className="space-y-2">
                  {deals.map((deal) => (
                    <div
                      key={deal.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => navigate(`/deals?viewId=${deal.id}`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs truncate">{deal.deal_name}</p>
                        {deal.total_contract_value && (
                          <p className="text-xs text-muted-foreground">
                            ${deal.total_contract_value.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <Badge className={`ml-2 text-xs ${getStageColor(deal.stage)}`}>
                        {deal.stage}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            {deals.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 h-7 text-xs"
                onClick={() => navigate('/deals')}
              >
                View All
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            )}
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAttachLeadOpen(true)}
                className="h-6 gap-1 text-xs px-2"
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {leads.length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <UserPlus className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium">No leads yet</p>
                  <p className="text-xs text-muted-foreground">Add leads to track opportunities</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAttachLeadOpen(true)}
                  className="gap-1 h-7 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Add First Lead
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[150px]">
                <div className="space-y-2">
                  {leads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => navigate(`/leads?viewId=${lead.id}`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs truncate">{lead.lead_name}</p>
                        {lead.email && (
                          <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                        )}
                      </div>
                      {lead.lead_status && (
                        <Badge className={`ml-2 text-xs ${getLeadStatusColor(lead.lead_status)}`}>
                          {lead.lead_status}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            {leads.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 h-7 text-xs"
                onClick={() => navigate('/leads')}
              >
                View All
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attach Modals */}
      <AttachRecordModal
        open={attachContactOpen}
        onOpenChange={setAttachContactOpen}
        recordType="contact"
        parentId={accountId}
        parentField="account_id"
        title="Attach Contacts to Account"
        onSuccess={fetchAssociations}
      />

      <AttachRecordModal
        open={attachDealOpen}
        onOpenChange={setAttachDealOpen}
        recordType="deal"
        parentId={accountId}
        parentField="account_id"
        title="Attach Deals to Account"
        onSuccess={fetchAssociations}
      />

      <AttachRecordModal
        open={attachLeadOpen}
        onOpenChange={setAttachLeadOpen}
        recordType="lead"
        parentId={accountId}
        parentField="account_id"
        title="Attach Leads to Account"
        onSuccess={fetchAssociations}
      />
    </div>
  );
};
