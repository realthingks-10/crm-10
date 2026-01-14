import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface BackupFormProps {
  onClose: () => void;
}

const BackupForm = ({ onClose }: BackupFormProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    file_name: "",
    backup_type: "manual",
    status: "completed",
    records_count: "",
    size_bytes: "",
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        file_name: data.file_name,
        file_path: `/backups/${data.file_name}`,
        backup_type: data.backup_type,
        status: data.status,
        records_count: data.records_count ? parseInt(data.records_count) : null,
        size_bytes: data.size_bytes ? parseInt(data.size_bytes) : null,
      };

      const { error } = await supabase.from("backups").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backups_list"] });
      toast.success("Backup record added");
      onClose();
    },
    onError: () => {
      toast.error("Failed to add backup record");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.file_name) {
      toast.error("Backup name is required");
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Backup Record</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="file_name">Backup Name *</Label>
            <Input
              id="file_name"
              value={formData.file_name}
              onChange={(e) => setFormData({ ...formData, file_name: e.target.value })}
              placeholder="e.g., full_backup_2024_01_15"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="backup_type">Type</Label>
              <Select value={formData.backup_type} onValueChange={(v) => setFormData({ ...formData, backup_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automatic">Automatic</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="records_count">Records Count</Label>
              <Input
                id="records_count"
                type="number"
                value={formData.records_count}
                onChange={(e) => setFormData({ ...formData, records_count: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="size_bytes">Size (bytes)</Label>
              <Input
                id="size_bytes"
                type="number"
                value={formData.size_bytes}
                onChange={(e) => setFormData({ ...formData, size_bytes: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Add Record"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BackupForm;
