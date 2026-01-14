import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Link2 } from "lucide-react";
import { toast } from "sonner";

type RecordType = 'contact' | 'lead' | 'deal' | 'task' | 'meeting';

interface AttachRecordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordType: RecordType;
  parentId: string;
  parentField: string;
  title: string;
  onSuccess: () => void;
}

interface RecordItem {
  id: string;
  name: string;
  subtitle?: string;
  status?: string;
}

const tableConfig: Record<RecordType, { 
  table: string; 
  nameField: string; 
  subtitleField?: string;
  statusField?: string;
}> = {
  contact: { table: 'contacts', nameField: 'contact_name', subtitleField: 'email', statusField: 'segment' },
  lead: { table: 'leads', nameField: 'lead_name', subtitleField: 'email', statusField: 'lead_status' },
  deal: { table: 'deals', nameField: 'deal_name', subtitleField: 'customer_name', statusField: 'stage' },
  task: { table: 'tasks', nameField: 'title', subtitleField: 'description', statusField: 'status' },
  meeting: { table: 'meetings', nameField: 'subject', subtitleField: 'description', statusField: 'status' },
};

export const AttachRecordModal = ({
  open,
  onOpenChange,
  recordType,
  parentId,
  parentField,
  title,
  onSuccess,
}: AttachRecordModalProps) => {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const config = tableConfig[recordType];

  useEffect(() => {
    if (open) {
      fetchUnlinkedRecords();
      setSelectedIds(new Set());
      setSearchQuery("");
    }
  }, [open, parentId, recordType]);

  const fetchUnlinkedRecords = async () => {
    setLoading(true);
    try {
      let data: any[] = [];

      if (recordType === 'contact') {
        const { data: contacts, error } = await supabase
          .from('contacts')
          .select('id, contact_name, email, segment')
          .is('account_id', null)
          .order('contact_name');
        if (error) throw error;
        data = (contacts || []).map(c => ({
          id: c.id,
          name: c.contact_name,
          subtitle: c.email,
          status: c.segment,
        }));
      } else if (recordType === 'lead') {
        const { data: leads, error } = await supabase
          .from('leads')
          .select('id, lead_name, email, lead_status')
          .is('account_id', null)
          .order('lead_name');
        if (error) throw error;
        data = (leads || []).map(l => ({
          id: l.id,
          name: l.lead_name,
          subtitle: l.email,
          status: l.lead_status,
        }));
      } else if (recordType === 'deal') {
        const { data: deals, error } = await supabase
          .from('deals')
          .select('id, deal_name, customer_name, stage')
          .is('account_id', null)
          .order('deal_name');
        if (error) throw error;
        data = (deals || []).map(d => ({
          id: d.id,
          name: d.deal_name,
          subtitle: d.customer_name,
          status: d.stage,
        }));
      } else if (recordType === 'task') {
        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('id, title, description, status')
          .is(parentField as any, null)
          .order('title');
        if (error) throw error;
        data = (tasks || []).map(t => ({
          id: t.id,
          name: t.title,
          subtitle: t.description,
          status: t.status,
        }));
      } else if (recordType === 'meeting') {
        const { data: meetings, error } = await supabase
          .from('meetings')
          .select('id, subject, description, status')
          .is(parentField as any, null)
          .order('subject');
        if (error) throw error;
        data = (meetings || []).map(m => ({
          id: m.id,
          name: m.subject,
          subtitle: m.description,
          status: m.status,
        }));
      }

      setRecords(data);
    } catch (error) {
      console.error('Error fetching unlinked records:', error);
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map(r => r.id)));
    }
  };

  const handleAttach = async () => {
    if (selectedIds.size === 0) return;

    setAttaching(true);
    try {
      const ids = Array.from(selectedIds);
      let error: any = null;

      if (recordType === 'contact') {
        const result = await supabase
          .from('contacts')
          .update({ account_id: parentId })
          .in('id', ids);
        error = result.error;
      } else if (recordType === 'lead') {
        const result = await supabase
          .from('leads')
          .update({ account_id: parentId })
          .in('id', ids);
        error = result.error;
      } else if (recordType === 'deal') {
        const result = await supabase
          .from('deals')
          .update({ account_id: parentId })
          .in('id', ids);
        error = result.error;
      } else if (recordType === 'task') {
        const result = await supabase
          .from('tasks')
          .update({ [parentField]: parentId } as any)
          .in('id', ids);
        error = result.error;
      } else if (recordType === 'meeting') {
        const result = await supabase
          .from('meetings')
          .update({ [parentField]: parentId } as any)
          .in('id', ids);
        error = result.error;
      }

      if (error) throw error;

      toast.success(`${selectedIds.size} ${recordType}(s) attached successfully`);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error attaching records:', error);
      toast.error('Failed to attach records');
    } finally {
      setAttaching(false);
    }
  };

  const filteredRecords = records.filter(record =>
    record.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (record.subtitle?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusVariant = (status?: string): "default" | "secondary" | "destructive" | "outline" => {
    if (!status) return 'secondary';
    
    const lowerStatus = status.toLowerCase();
    
    // Success states
    if (['won', 'completed', 'converted'].includes(lowerStatus)) return 'default';
    // Error states
    if (['lost', 'cancelled', 'dropped'].includes(lowerStatus)) return 'destructive';
    // Active states
    if (['qualified', 'rfq', 'discussions', 'offered', 'in_progress', 'scheduled', 'contacted', 'new'].includes(lowerStatus)) return 'outline';
    
    return 'secondary';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl z-[60] flex flex-col max-h-[85vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 min-h-0 flex-1">
          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${recordType}s...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Select All */}
          {filteredRecords.length > 0 && (
            <div className="flex items-center justify-between px-1 shrink-0">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === filteredRecords.length && filteredRecords.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  Select All ({filteredRecords.length})
                </span>
              </div>
              {selectedIds.size > 0 && (
                <Badge variant="secondary">{selectedIds.size} selected</Badge>
              )}
            </div>
          )}

          {/* Records List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No matching records found' : `No unlinked ${recordType}s available`}
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-full max-h-[300px]">
                <div className="space-y-2 pr-4">
                  {filteredRecords.map((record) => (
                    <div
                      key={record.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedIds.has(record.id)
                          ? 'bg-primary/10 border-primary'
                          : 'bg-muted/30 border-transparent hover:bg-muted/50'
                      }`}
                      onClick={() => handleToggleSelect(record.id)}
                    >
                      <Checkbox
                        checked={selectedIds.has(record.id)}
                        onCheckedChange={() => handleToggleSelect(record.id)}
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{record.name}</p>
                        {record.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">{record.subtitle}</p>
                        )}
                      </div>
                      {record.status && (
                        <Badge variant={getStatusVariant(record.status)} className="text-xs shrink-0">
                          {record.status}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAttach}
            disabled={selectedIds.size === 0 || attaching}
          >
            {attaching && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Attach Selected ({selectedIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
