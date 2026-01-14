import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Phone, Mail, Calendar, FileText, CheckSquare } from "lucide-react";

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Calendar },
  { value: 'note', label: 'Note', icon: FileText },
  { value: 'task', label: 'Task', icon: CheckSquare },
];

const OUTCOME_OPTIONS = [
  { value: 'successful', label: 'Successful' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'follow_up', label: 'Follow-up Required' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'scheduled', label: 'Scheduled' },
];

interface ActivityLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onSuccess: () => void;
}

export const ActivityLogModal = ({ open, onOpenChange, accountId, onSuccess }: ActivityLogModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    activity_type: 'call',
    subject: '',
    description: '',
    outcome: '',
    duration_minutes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.subject.trim()) {
      toast({
        title: "Missing subject",
        description: "Please enter a subject for the activity",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('account_activities')
        .insert({
          account_id: accountId,
          activity_type: formData.activity_type,
          subject: formData.subject.trim(),
          description: formData.description.trim() || null,
          outcome: formData.outcome || null,
          duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
          created_by: user?.id,
          activity_date: new Date().toISOString()
        });

      if (error) throw error;

      toast({ title: "Activity logged successfully" });
      
      // Reset form
      setFormData({
        activity_type: 'call',
        subject: '',
        description: '',
        outcome: '',
        duration_minutes: ''
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
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder={`${selectedType?.label} subject...`}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Add details..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Outcome</Label>
              <Select
                value={formData.outcome}
                onValueChange={(value) => setFormData(prev => ({ ...prev, outcome: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(formData.activity_type === 'call' || formData.activity_type === 'meeting') && (
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (min)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: e.target.value }))}
                  placeholder="e.g., 30"
                />
              </div>
            )}
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
