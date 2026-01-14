import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface SystemUpdate {
  id: string;
  device_name: string;
  os_version: string | null;
  update_version: string | null;
  patch_id: string | null;
  update_type: string | null;
  status: string | null;
  last_checked: string | null;
  installed_on: string | null;
  remarks: string | null;
}

interface SystemUpdateFormProps {
  update: SystemUpdate | null;
  onClose: () => void;
}

const SystemUpdateForm = ({ update, onClose }: SystemUpdateFormProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    device_name: update?.device_name || "",
    os_version: update?.os_version || "",
    update_version: update?.update_version || "",
    patch_id: update?.patch_id || "",
    update_type: update?.update_type || "Security",
    status: update?.status || "Pending",
    installed_on: update?.installed_on?.split("T")[0] || "",
    remarks: update?.remarks || "",
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        device_name: data.device_name,
        os_version: data.os_version || null,
        update_version: data.update_version || null,
        patch_id: data.patch_id || null,
        update_type: data.update_type,
        status: data.status,
        installed_on: data.installed_on ? new Date(data.installed_on).toISOString() : null,
        remarks: data.remarks || null,
        last_checked: new Date().toISOString(),
      };

      if (update) {
        const { error } = await supabase
          .from("system_updates" as any)
          .update(payload)
          .eq("id", update.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("system_updates" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system_updates"] });
      toast.success(update ? "Update modified successfully" : "Update created successfully");
      onClose();
    },
    onError: () => {
      toast.error("Failed to save update");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.device_name) {
      toast.error("Device name is required");
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{update ? "Edit System Update" : "Add System Update"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="device_name">Device Name *</Label>
              <Input
                id="device_name"
                value={formData.device_name}
                onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="os_version">OS Version</Label>
              <Input
                id="os_version"
                value={formData.os_version}
                onChange={(e) => setFormData({ ...formData, os_version: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="update_version">Update Version</Label>
              <Input
                id="update_version"
                value={formData.update_version}
                onChange={(e) => setFormData({ ...formData, update_version: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="patch_id">Patch ID</Label>
              <Input
                id="patch_id"
                value={formData.patch_id}
                onChange={(e) => setFormData({ ...formData, patch_id: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="update_type">Update Type</Label>
              <Select value={formData.update_type} onValueChange={(v) => setFormData({ ...formData, update_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Security">Security</SelectItem>
                  <SelectItem value="Feature">Feature</SelectItem>
                  <SelectItem value="Driver">Driver</SelectItem>
                  <SelectItem value="Cumulative">Cumulative</SelectItem>
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
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Installed">Installed</SelectItem>
                  <SelectItem value="Failed">Failed</SelectItem>
                  <SelectItem value="Verified">Verified</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="installed_on">Installed On</Label>
              <Input
                id="installed_on"
                type="date"
                value={formData.installed_on}
                onChange={(e) => setFormData({ ...formData, installed_on: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : update ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SystemUpdateForm;
