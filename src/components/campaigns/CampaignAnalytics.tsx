import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Users, Building2, Mail, Phone, MessageSquare, TrendingUp, RefreshCw, ArrowRight } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
  Tooltip as RechartsTooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid
} from "recharts";
import { format } from "date-fns";

interface Props {
  campaignId: string;
}

const ICON_BG: Record<string, string> = {
  "Accounts Targeted": "bg-blue-100 dark:bg-blue-900/30",
  "Contacts Targeted": "bg-green-100 dark:bg-green-900/30",
  "Emails Sent": "bg-indigo-100 dark:bg-indigo-900/30",
  "Calls Made": "bg-orange-100 dark:bg-orange-900/30",
  "LinkedIn Messages": "bg-purple-100 dark:bg-purple-900/30",
  "Responses": "bg-emerald-100 dark:bg-emerald-900/30",
  "Deals Created": "bg-pink-100 dark:bg-pink-900/30",
  "Deals Won": "bg-amber-100 dark:bg-amber-900/30",
};

const ICON_COLOR: Record<string, string> = {
  "Accounts Targeted": "text-blue-600 dark:text-blue-400",
  "Contacts Targeted": "text-green-600 dark:text-green-400",
  "Emails Sent": "text-indigo-600 dark:text-indigo-400",
  "Calls Made": "text-orange-600 dark:text-orange-400",
  "LinkedIn Messages": "text-purple-600 dark:text-purple-400",
  "Responses": "text-emerald-600 dark:text-emerald-400",
  "Deals Created": "text-pink-600 dark:text-pink-400",
  "Deals Won": "text-amber-600 dark:text-amber-400",
};

const FUNNEL_COLORS = ["hsl(var(--primary))", "hsl(var(--primary) / 0.8)", "#f59e0b", "#10b981", "#6366f1", "#ec4899"];

export function CampaignAnalytics({ campaignId }: Props) {
  const queryClient = useQueryClient();

  const { data: accounts = [] } = useQuery({
    queryKey: ["campaign-accounts", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaign_accounts").select("*").eq("campaign_id", campaignId);
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["campaign-contacts", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaign_contacts").select("*").eq("campaign_id", campaignId);
      if (error) throw error;
      return data;
    },
  });

  const { data: communications = [] } = useQuery({
    queryKey: ["campaign-communications", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaign_communications").select("*").eq("campaign_id", campaignId);
      if (error) throw error;
      return data;
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["campaign-deals", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("id, stage").eq("campaign_id", campaignId);
      if (error) throw error;
      return data;
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["campaign-accounts", campaignId] });
    queryClient.invalidateQueries({ queryKey: ["campaign-contacts", campaignId] });
    queryClient.invalidateQueries({ queryKey: ["campaign-communications", campaignId] });
    queryClient.invalidateQueries({ queryKey: ["campaign-deals", campaignId] });
  };

  const emails = communications.filter((c) => c.communication_type === "Email");
  const calls = communications.filter((c) => c.communication_type === "Call");
  const linkedIn = communications.filter((c) => c.communication_type === "LinkedIn");
  const responded = contacts.filter((c) => c.stage === "Responded" || c.stage === "Qualified");
  const dealsWon = deals.filter((d) => d.stage === "Won");

  const stats = [
    { label: "Accounts Targeted", value: accounts.length, icon: Building2 },
    { label: "Contacts Targeted", value: contacts.length, icon: Users },
    { label: "Emails Sent", value: emails.length, icon: Mail },
    { label: "Calls Made", value: calls.length, icon: Phone },
    { label: "LinkedIn Messages", value: linkedIn.length, icon: MessageSquare },
    { label: "Responses", value: responded.length, icon: TrendingUp },
    { label: "Deals Created", value: deals.length, icon: BarChart3 },
    { label: "Deals Won", value: dealsWon.length, icon: BarChart3 },
  ];

  const funnel = [
    { label: "Targeted", value: contacts.length },
    { label: "Contacted", value: contacts.filter((c) => c.stage !== "Not Contacted").length },
    { label: "Responded", value: responded.length },
    { label: "Qualified", value: contacts.filter((c) => c.stage === "Qualified").length },
    { label: "Deal Created", value: deals.length },
    { label: "Won", value: dealsWon.length },
  ];

  // Channel breakdown for pie chart
  const channelData = useMemo(() => {
    const data = [
      { name: "Email", value: emails.length, fill: "#6366f1" },
      { name: "Call", value: calls.length, fill: "#f59e0b" },
      { name: "LinkedIn", value: linkedIn.length, fill: "#8b5cf6" },
    ].filter(d => d.value > 0);
    return data;
  }, [emails.length, calls.length, linkedIn.length]);

  // Outreach timeline
  const timelineData = useMemo(() => {
    if (communications.length === 0) return [];
    const weekMap: Record<string, { week: string; Email: number; Call: number; LinkedIn: number }> = {};
    communications.forEach((c: any) => {
      if (!c.communication_date) return;
      const d = new Date(c.communication_date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = format(weekStart, "dd MMM");
      if (!weekMap[key]) weekMap[key] = { week: key, Email: 0, Call: 0, LinkedIn: 0 };
      const type = c.communication_type as "Email" | "Call" | "LinkedIn";
      if (weekMap[key][type] !== undefined) weekMap[key][type]++;
    });
    return Object.values(weekMap).sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime());
  }, [communications]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="border">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${ICON_BG[s.label] || "bg-primary/10"}`}>
                <s.icon className={`h-5 w-5 ${ICON_COLOR[s.label] || "text-primary"}`} />
              </div>
              <div>
                <p className="text-2xl font-semibold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Conversion Funnel */}
        <Card className="border">
          <CardHeader><CardTitle className="text-base">Conversion Funnel</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {funnel.map((stage, i) => {
                const maxVal = funnel[0].value || 1;
                const pct = Math.round((stage.value / maxVal) * 100);
                const prevValue = i > 0 ? funnel[i - 1].value : stage.value;
                const convRate = prevValue > 0 ? Math.round((stage.value / prevValue) * 100) : 0;
                return (
                  <div key={stage.label}>
                    <div className="flex items-center gap-4">
                      <div className="w-28 text-sm text-muted-foreground">{stage.label}</div>
                      <div className="flex-1 bg-muted rounded-md h-6 overflow-hidden">
                        <div
                          className="h-full rounded-md flex items-center justify-end pr-2 transition-all"
                          style={{ width: `${stage.value === 0 ? 0 : Math.max(pct, 5)}%`, backgroundColor: FUNNEL_COLORS[i] || "hsl(var(--primary))" }}
                        >
                          <span className="text-xs font-medium text-white">{stage.value}</span>
                        </div>
                      </div>
                      <div className="w-14 text-xs text-muted-foreground text-right">{pct}%</div>
                    </div>
                    {i > 0 && (
                      <div className="ml-28 pl-4 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <ArrowRight className="h-2.5 w-2.5" /> {convRate}% conversion
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Channel Breakdown */}
        <Card className="border">
          <CardHeader><CardTitle className="text-base">Channel Breakdown</CardTitle></CardHeader>
          <CardContent>
            {channelData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No outreach data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={channelData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                    {channelData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number, name: string) => [`${value} messages`, name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend verticalAlign="bottom" height={24} iconSize={8} formatter={(value: string) => (<span className="text-xs text-muted-foreground">{value}</span>)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Outreach Timeline */}
      {timelineData.length >= 1 && (
        <Card className="border">
          <CardHeader><CardTitle className="text-base">Outreach Timeline</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timelineData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <RechartsTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Area type="monotone" dataKey="Email" stackId="1" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} strokeWidth={2} />
                <Area type="monotone" dataKey="Call" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} strokeWidth={2} />
                <Area type="monotone" dataKey="LinkedIn" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} strokeWidth={2} />
                <Legend iconSize={8} formatter={(value: string) => (<span className="text-xs text-muted-foreground">{value}</span>)} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
