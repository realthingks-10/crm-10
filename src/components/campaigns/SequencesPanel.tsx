import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, ListOrdered, ArrowDown } from "lucide-react";

interface Props {
  campaignId: string;
}

const CONDITIONS = [
  { value: "no_reply", label: "If no reply" },
  { value: "no_open", label: "If not opened" },
  { value: "always", label: "Always (after wait)" },
] as const;

export function SequencesPanel({ campaignId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [waitDays, setWaitDays] = useState(3);
  const [condition, setCondition] = useState<string>("no_reply");
  const [templateId, setTemplateId] = useState<string>("");

  const { data: steps = [] } = useQuery({
    queryKey: ["campaign-sequences", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_sequences")
        .select("id, step_number, template_id, wait_business_days, condition, is_enabled")
        .eq("campaign_id", campaignId)
        .order("step_number", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["campaign-templates-for-seq", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_email_templates")
        .select("id, template_name")
        .or(`campaign_id.eq.${campaignId},campaign_id.is.null`)
        .order("template_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const addStep = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!templateId) throw new Error("Pick a template");
      const nextStep = (steps[steps.length - 1]?.step_number ?? 0) + 1;
      const { error } = await supabase.from("campaign_sequences").insert({
        campaign_id: campaignId,
        step_number: nextStep,
        template_id: templateId,
        wait_business_days: waitDays,
        condition,
        is_enabled: true,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-sequences", campaignId] });
      toast({ title: "Sequence step added" });
      setTemplateId("");
    },
    onError: (e: any) =>
      toast({ title: "Failed to add step", description: e.message, variant: "destructive" }),
  });

  const toggleStep = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("campaign_sequences")
        .update({ is_enabled: enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign-sequences", campaignId] }),
  });

  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_sequences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-sequences", campaignId] });
      toast({ title: "Step removed" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListOrdered className="h-4 w-4" /> Multi-touch Sequence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {steps.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No sequence steps yet. Build a multi-touch cadence by adding steps below — each fires
              automatically based on its trigger.
            </p>
          )}
          {steps.map((s: any, idx: number) => {
            const tpl = templates.find((t: any) => t.id === s.template_id);
            const cond = CONDITIONS.find((c) => c.value === s.condition)?.label ?? s.condition;
            return (
              <div key={s.id}>
                <div className="flex items-center justify-between border rounded-md p-2 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className="shrink-0">Step {s.step_number}</Badge>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">
                        {tpl?.template_name || "(deleted template)"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Wait {s.wait_business_days} business day(s) · {cond}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={s.is_enabled}
                      onCheckedChange={(v) => toggleStep.mutate({ id: s.id, enabled: v })}
                    />
                    <Button variant="ghost" size="icon" onClick={() => deleteStep.mutate(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {idx < steps.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end pt-2 border-t">
          <div className="md:col-span-2">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger>
              <SelectContent>
                {templates.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Trigger</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Wait (business days)</Label>
            <Input
              type="number"
              min={0}
              max={60}
              value={waitDays}
              onChange={(e) => setWaitDays(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="md:col-span-4">
            <Button
              onClick={() => addStep.mutate()}
              disabled={addStep.isPending || !templateId}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" /> Add step
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
