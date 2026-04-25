import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, Users, X } from "lucide-react";

interface Props {
  campaignId: string;
}

type Filters = {
  industries: string[];
  regions: string[];
  countries: string[];
  positions: string[];
  status?: string | null;
};

const emptyFilters: Filters = { industries: [], regions: [], countries: [], positions: [], status: null };

function ChipInput({
  label, values, onChange, placeholder,
}: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1 flex-wrap mb-1 mt-1">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1 text-xs">
            {v}
            <button onClick={() => onChange(values.filter((x) => x !== v))} className="ml-0.5">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
        <Button type="button" size="sm" variant="outline" onClick={add}>Add</Button>
      </div>
    </div>
  );
}

export function SegmentManager({ campaignId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const { data: segments = [] } = useQuery({
    queryKey: ["campaign-segments", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_audience_segments")
        .select("id, segment_name, filters, created_at")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createSeg = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!name.trim()) throw new Error("Segment name required");
      const { error } = await supabase.from("campaign_audience_segments").insert({
        campaign_id: campaignId,
        segment_name: name.trim(),
        filters: filters as any,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-segments", campaignId] });
      toast({ title: "Segment saved" });
      setName("");
      setFilters(emptyFilters);
    },
    onError: (e: any) =>
      toast({ title: "Failed to save segment", description: e.message, variant: "destructive" }),
  });

  const deleteSeg = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_audience_segments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-segments", campaignId] });
      toast({ title: "Segment deleted" });
    },
  });

  const summarize = (f: any) => {
    const parts: string[] = [];
    if (f?.industries?.length) parts.push(`${f.industries.length} industry`);
    if (f?.regions?.length) parts.push(`${f.regions.length} region`);
    if (f?.countries?.length) parts.push(`${f.countries.length} country`);
    if (f?.positions?.length) parts.push(`${f.positions.length} role`);
    if (f?.status) parts.push(`status: ${f.status}`);
    return parts.length ? parts.join(" · ") : "No filters";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" /> Audience Segments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {segments.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Create reusable audience slices (e.g. "EU Decision Makers in Auto") to target specific
              messages. Segments combine industry, region, country, role, and stage filters.
            </p>
          )}
          {segments.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate">{s.segment_name}</span>
                <span className="text-xs text-muted-foreground">{summarize(s.filters)}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteSeg.mutate(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-2 border-t">
          <div>
            <Label>Segment name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. EU Auto Decision Makers"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ChipInput
              label="Industries"
              values={filters.industries}
              onChange={(v) => setFilters((f) => ({ ...f, industries: v }))}
              placeholder="Type and press Enter"
            />
            <ChipInput
              label="Regions"
              values={filters.regions}
              onChange={(v) => setFilters((f) => ({ ...f, regions: v }))}
              placeholder="EMEA, APAC, ..."
            />
            <ChipInput
              label="Countries"
              values={filters.countries}
              onChange={(v) => setFilters((f) => ({ ...f, countries: v }))}
              placeholder="Germany, Japan, ..."
            />
            <ChipInput
              label="Roles / Titles"
              values={filters.positions}
              onChange={(v) => setFilters((f) => ({ ...f, positions: v }))}
              placeholder="CTO, VP Sales, ..."
            />
            <div>
              <Label className="text-xs">Stage</Label>
              <Select
                value={filters.status ?? "any"}
                onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "any" ? null : v }))}
              >
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any stage</SelectItem>
                  <SelectItem value="Not Contacted">Not Contacted</SelectItem>
                  <SelectItem value="Contacted">Contacted</SelectItem>
                  <SelectItem value="Engaged">Engaged</SelectItem>
                  <SelectItem value="Replied">Replied</SelectItem>
                  <SelectItem value="Qualified">Qualified</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Button
              size="sm"
              onClick={() => createSeg.mutate()}
              disabled={createSeg.isPending || !name.trim()}
            >
              <Plus className="h-4 w-4 mr-1" /> Save segment
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
