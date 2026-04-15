import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Building2, Users, MessageSquare, Phone, Linkedin, TrendingUp,
  Target, FileText, CheckCircle2, Circle, BarChart3, ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid
} from "recharts";

interface MARTComplete {
  message: boolean;
  audience: boolean;
  region: boolean;
  timing: boolean;
}

interface Props {
  campaign: any;
  accounts: any[];
  contacts: any[];
  communications: any[];
  isMARTComplete: MARTComplete;
  martProgress: number;
  onTabChange: (tab: string) => void;
}

const statusColors: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Active: "bg-primary/10 text-primary",
  Paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const stageOrder = ["Not Contacted", "Contacted", "Responded", "Qualified", "Converted"];
const stageColors: Record<string, string> = {
  "Not Contacted": "hsl(var(--muted-foreground))",
  "Contacted": "hsl(var(--primary))",
  "Responded": "#f59e0b",
  "Qualified": "#10b981",
  "Converted": "#6366f1",
};

export function CampaignOverview({
  campaign, accounts, contacts, communications,
  isMARTComplete, martProgress, onTabChange
}: Props) {
  // Fetch deals linked to this campaign
  const { data: deals = [] } = useQuery({
    queryKey: ["campaign-deals-overview", campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, stage, total_contract_value")
        .eq("campaign_id", campaign.id);
      if (error) throw error;
      return data;
    },
  });

  const emailCount = communications.filter((c: any) => c.communication_type === "Email").length;
  const callCount = communications.filter((c: any) => c.communication_type === "Call").length;
  const linkedinCount = communications.filter((c: any) => c.communication_type === "LinkedIn").length;
  const responseCount = contacts.filter((c: any) =>
    c.stage === "Responded" || c.stage === "Qualified" || c.stage === "Converted"
  ).length;

  // Contact stage breakdown for chart
  const stageData = useMemo(() => {
    const counts: Record<string, number> = {};
    stageOrder.forEach(s => counts[s] = 0);
    contacts.forEach((c: any) => {
      const stage = c.stage || "Not Contacted";
      if (counts[stage] !== undefined) counts[stage]++;
      else counts["Not Contacted"]++;
    });
    return stageOrder.map(s => ({ stage: s, count: counts[s], fill: stageColors[s] }));
  }, [contacts]);

  // Outreach timeline (group by week)
  const timelineData = useMemo(() => {
    if (communications.length === 0) return [];
    const weekMap: Record<string, number> = {};
    communications.forEach((c: any) => {
      if (!c.communication_date) return;
      const d = new Date(c.communication_date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = format(weekStart, "dd MMM");
      weekMap[key] = (weekMap[key] || 0) + 1;
    });
    return Object.entries(weekMap)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([week, count]) => ({ week, count }));
  }, [communications]);

  const totalDealValue = deals.reduce((sum: number, d: any) => sum + (d.total_contract_value || 0), 0);

  const StatCard = ({ label, value, icon: Icon, onClick, subtitle }: {
    label: string; value: number | string; icon: any; onClick?: () => void; subtitle?: string;
  }) => (
    <Card
      className={`transition-all ${onClick ? "cursor-pointer hover:shadow-md hover:border-primary/30 group" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-1">
            <Icon className="h-5 w-5 text-muted-foreground" />
            {onClick && <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* All 8 stats in one row */}
      <div className="grid grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard label="Accounts" value={accounts.length} icon={Building2} onClick={() => onTabChange("accounts-contacts")} />
        <StatCard label="Contacts" value={contacts.length} icon={Users} onClick={() => onTabChange("accounts-contacts")} />
        <StatCard label="Emails" value={emailCount} icon={MessageSquare} onClick={() => onTabChange("outreach")} />
        <StatCard label="Calls" value={callCount} icon={Phone} onClick={() => onTabChange("outreach")} />
        <StatCard label="LinkedIn" value={linkedinCount} icon={Linkedin} onClick={() => onTabChange("outreach")} />
        <StatCard label="Responses" value={responseCount} icon={TrendingUp} subtitle={contacts.length > 0 ? `${Math.round((responseCount / contacts.length) * 100)}%` : undefined} />
        <StatCard label="Deals" value={deals.length} icon={BarChart3} onClick={() => onTabChange("analytics")} subtitle={totalDealValue > 0 ? `€${totalDealValue.toLocaleString()}` : undefined} />
        <StatCard label="MART" value={`${martProgress}/4`} icon={Target} onClick={() => onTabChange("mart")} subtitle={`${Math.round((martProgress / 4) * 100)}%`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contact Stage Funnel */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2 cursor-pointer hover:text-primary transition-colors" onClick={() => onTabChange("accounts-contacts")}>
              <Users className="h-4 w-4" /> Contact Funnel <ArrowRight className="h-3 w-3 ml-auto" />
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts added yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={stageData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="stage" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [v, "Contacts"]} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                    {stageData.map((entry, i) => (
                      <rect key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* MART Status — clickable */}
        <Card className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" onClick={() => onTabChange("mart")}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" /> MART Status <ArrowRight className="h-3 w-3 ml-auto" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={(martProgress / 4) * 100} className="h-2 mb-3" />
            {[
              { label: "Message", done: isMARTComplete.message },
              { label: "Audience", done: isMARTComplete.audience },
              { label: "Region", done: isMARTComplete.region },
              { label: "Timing", done: isMARTComplete.timing },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                {item.done ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity — clickable items */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2 cursor-pointer hover:text-primary transition-colors" onClick={() => onTabChange("outreach")}>
              <MessageSquare className="h-4 w-4" /> Recent Activity <ArrowRight className="h-3 w-3 ml-auto" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {communications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet</p>
            ) : (
              <div className="space-y-2">
                {communications.slice(0, 5).map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                    onClick={() => onTabChange("outreach")}
                  >
                    <Badge variant="outline" className="text-xs shrink-0">{c.communication_type}</Badge>
                    <span className="truncate">{c.contacts?.contact_name || "Unknown"}</span>
                    <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                      {c.communication_date ? format(new Date(c.communication_date), "dd MMM") : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Outreach Timeline */}
      {timelineData.length > 1 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Outreach Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={timelineData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v, "Messages"]} />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Details, Description, Goal, Notes — compact layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{campaign.campaign_type}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className={statusColors[campaign.status || "Draft"]} variant="secondary">{campaign.status}</Badge></div>
            {campaign.region && <div className="flex justify-between"><span className="text-muted-foreground">Region</span><span>{campaign.region}</span></div>}
            {campaign.country && <div className="flex justify-between"><span className="text-muted-foreground">Country</span><span>{campaign.country}</span></div>}
          </CardContent>
        </Card>

        {(campaign.description || campaign.goal) && (
          <Card>
            <CardContent className="space-y-3 pt-4 text-sm">
              {campaign.description && (
                <div>
                  <p className="font-medium text-sm mb-1">Description</p>
                  <p className="text-muted-foreground">{campaign.description}</p>
                </div>
              )}
              {campaign.goal && (
                <div>
                  <p className="font-medium text-sm mb-1">Goal</p>
                  <p className="text-muted-foreground">{campaign.goal}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {campaign.notes && (
          <Card>
            <CardContent className="pt-4">
              <p className="font-medium text-sm mb-1">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{campaign.notes.replace(/\[timezone:.+?\]\s*/g, "").trim()}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
