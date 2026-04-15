import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useCampaigns, type Campaign } from "@/hooks/useCampaigns";
import { useState, useEffect, KeyboardEvent } from "react";
import { Users, X, Trash2 } from "lucide-react";

interface AudienceData {
  job_titles: string[];
  departments: string[];
  seniorities: string[];
  industries: string[];
  company_sizes: string[];
}

const DEPARTMENTS = ["Sales", "Marketing", "Operations", "Engineering", "Finance", "HR", "Other"];
const SENIORITIES = ["C-Suite", "VP", "Director", "Manager", "Team Lead", "Individual Contributor"];
const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–1000", "1000+"];

function parseAudience(raw: string | null): AudienceData {
  const empty: AudienceData = { job_titles: [], departments: [], seniorities: [], industries: [], company_sizes: [] };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.job_titles) return { ...empty, ...parsed };
    if (Array.isArray(parsed)) {
      const first = parsed[0] || {};
      return {
        job_titles: first.job_title ? [first.job_title] : [],
        departments: first.department ? [first.department] : [],
        seniorities: first.seniority ? [first.seniority] : [],
        industries: first.industry ? [first.industry] : [],
        company_sizes: first.company_size ? [first.company_size] : [],
      };
    }
  } catch {}
  return empty;
}

function TagInput({ tags, onChange, placeholder }: { tags: string[]; onChange: (tags: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState("");
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) onChange([...tags, input.trim()]);
      setInput("");
    }
  };
  const removeTag = (tag: string) => onChange(tags.filter(t => t !== tag));

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1 min-h-[24px]">
        {tags.map(tag => (
          <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-xs py-0">
            {tag}
            <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
          </Badge>
        ))}
      </div>
      <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} className="h-8 text-sm" />
    </div>
  );
}

function MultiCheckbox({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (selected: string[]) => void }) {
  const toggle = (opt: string) => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
          <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)} />
          {opt}
        </label>
      ))}
    </div>
  );
}

interface Props {
  campaign: Campaign;
}

export function CampaignMARTAudience({ campaign }: Props) {
  const { updateCampaign } = useCampaigns();
  const [data, setData] = useState<AudienceData>(() => parseAudience(campaign.target_audience));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setData(parseAudience(campaign.target_audience));
  }, [campaign.target_audience]);

  const handleSave = () => {
    setSaving(true);
    updateCampaign.mutate(
      { id: campaign.id, target_audience: JSON.stringify(data) },
      { onSettled: () => setSaving(false) }
    );
  };

  const handleClearAll = () => {
    setData({ job_titles: [], departments: [], seniorities: [], industries: [], company_sizes: [] });
  };

  const hasContent = data.job_titles.length > 0 || data.departments.length > 0 || data.seniorities.length > 0 || data.industries.length > 0 || data.company_sizes.length > 0;

  const summaryParts: string[] = [];
  if (data.seniorities.length) summaryParts.push(data.seniorities.join(", "));
  if (data.industries.length) summaryParts.push(`in ${data.industries.join(", ")}`);
  if (data.company_sizes.length) summaryParts.push(`companies with ${data.company_sizes.join(" or ")} employees`);
  const summary = summaryParts.length > 0 ? `Targeting ${summaryParts.join(" ")}` : "";

  return (
    <div className="space-y-3">
      {/* 2-column grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Tag inputs */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Job Titles <span className="text-[10px] text-muted-foreground">(type + Enter)</span></Label>
            <TagInput tags={data.job_titles} onChange={tags => setData({ ...data, job_titles: tags })} placeholder="e.g. CEO, VP of Sales..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Industries <span className="text-[10px] text-muted-foreground">(type + Enter)</span></Label>
            <TagInput tags={data.industries} onChange={tags => setData({ ...data, industries: tags })} placeholder="e.g. SaaS, FinTech..." />
          </div>
        </div>

        {/* Right: Checkbox groups */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Departments</Label>
            <MultiCheckbox options={DEPARTMENTS} selected={data.departments} onChange={deps => setData({ ...data, departments: deps })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Seniority</Label>
            <MultiCheckbox options={SENIORITIES} selected={data.seniorities} onChange={sens => setData({ ...data, seniorities: sens })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Company Sizes</Label>
            <MultiCheckbox options={COMPANY_SIZES} selected={data.company_sizes} onChange={sizes => setData({ ...data, company_sizes: sizes })} />
          </div>
        </div>
      </div>

      {/* Summary banner */}
      {summary && (
        <div className="p-2.5 bg-primary/5 border border-primary/10 rounded-lg">
          <p className="text-xs text-muted-foreground italic">{summary}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-8" onClick={handleSave} disabled={saving || !hasContent}>
          {saving ? "Saving..." : "Save Audience"}
        </Button>
        {hasContent && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground gap-1" onClick={handleClearAll}>
            <Trash2 className="h-3 w-3" /> Clear All
          </Button>
        )}
        {!hasContent && (
          <span className="text-xs text-muted-foreground">Add at least one criteria to save</span>
        )}
      </div>
    </div>
  );
}
