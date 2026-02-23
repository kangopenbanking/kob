import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "#f59e0b", "#10b981"];

export default function MerchantAnalytics() {
  const [loading, setLoading] = useState(true);
  const [channelData, setChannelData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      const { data: charges } = await supabase.from("gateway_charges").select("amount, status, channel, created_at, currency").eq("merchant_id", m.id);
      if (charges) {
        // Channel breakdown
        const channelMap: Record<string, number> = {};
        charges.filter(c => c.status === "successful").forEach(c => { channelMap[c.channel || "unknown"] = (channelMap[c.channel || "unknown"] || 0) + Number(c.amount); });
        setChannelData(Object.entries(channelMap).map(([name, value]) => ({ name, value })));

        // Daily revenue (last 14 days)
        const daily: Record<string, number> = {};
        charges.filter(c => c.status === "successful").forEach(c => {
          const day = c.created_at?.split("T")[0] || "";
          daily[day] = (daily[day] || 0) + Number(c.amount);
        });
        setDailyData(Object.entries(daily).sort().slice(-14).map(([date, revenue]) => ({ date: date.slice(5), revenue })));
      }
    }
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Analytics</h1><p className="text-muted-foreground">Revenue trends and payment method breakdown</p></div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Daily Revenue (Last 14 Days)</CardTitle></CardHeader>
          <CardContent>
            {dailyData.length === 0 ? <p className="text-center text-muted-foreground py-8">No data</p> : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by Channel</CardTitle></CardHeader>
          <CardContent>
            {channelData.length === 0 ? <p className="text-center text-muted-foreground py-8">No data</p> : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart><Pie data={channelData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name }) => name}>
                  {channelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
