import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Phone, Mail, Calendar, FileText, CheckSquare } from "lucide-react";

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Calendar },
  { value: 'note', label: 'Note', icon: FileText },
  { value: 'task', label: 'Task', icon: CheckSquare },
];

interface LeadActivityLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onSuccess: () => void;
}

export const LeadActivityLogModal = ({ open, onOpenChange, leadId, onSuccess }: LeadActivityLogModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    activity_type: 'call',
    next_action: '',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.next_action.trim()) {
      toast({
        title: "Missing action",
        description: "Please enter the activity details",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Create a task instead of lead_action_items
      const { error } = await supabase
        .from('tasks')
        .insert({
          lead_id: leadId,
          title: `[${formData.activity_type.toUpperCase()}] ${formData.next_action.trim()}`,
          description: formData.notes.trim() || null,
          status: 'open',
          priority: 'medium',
          created_by: user?.id,
          module_type: 'leads'
        });

      if (error) throw error;

      toast({ title: "Activity logged successfully" });
      
      // Reset form
      setFormData({
        activity_type: 'call',
        next_action: '',
        notes: ''
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error logging activity:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to log activity",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedType = ACTIVITY_TYPES.find(t => t.value === formData.activity_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Activity</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Activity Type</Label>
            <div className="grid grid-cols-5 gap-2">
              {ACTIVITY_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <Button
                    key={type.value}
                    type="button"
                    variant={formData.activity_type === type.value ? 'default' : 'outline'}
                    className="flex flex-col items-center gap-1 h-auto py-3"
                    onClick={() => setFormData(prev => ({ ...prev, activity_type: type.value }))}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{type.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="next_action">Activity Details *</Label>
            <Input
              id="next_action"
              value={formData.next_action}
              onChange={(e) => setFormData(prev => ({ ...prev, next_action: e.target.value }))}
              placeholder={`${selectedType?.label} details...`}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Log Activity
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
