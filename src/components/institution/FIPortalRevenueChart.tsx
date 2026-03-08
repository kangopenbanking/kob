import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

interface Props {
  transactions: { amount: number; created_at: string }[];
}

export function FIPortalRevenueChart({ transactions }: Props) {
  const chartData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const grouped: Record<string, { date: string; volume: number; count: number }> = {};

    transactions.forEach((tx) => {
      const day = tx.created_at?.split("T")[0] ?? "unknown";
      if (!grouped[day]) grouped[day] = { date: day, volume: 0, count: 0 };
      grouped[day].volume += Number(tx.amount) || 0;
      grouped[day].count += 1;
    });

    return Object.values(grouped)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [transactions]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Transaction Volume (30d)</CardTitle>
        </div>
        <CardDescription className="text-xs">Daily transaction volume across institutional accounts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fiVolumeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => v.slice(5)}
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
              />
              <YAxis
                tickFormatter={(v) =>
                  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v
                }
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
              />
              <Tooltip
                formatter={(value: number) => [
                  new Intl.NumberFormat("en-US", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(value),
                  "Volume",
                ]}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
              />
              <Area
                type="monotone"
                dataKey="volume"
                stroke="hsl(var(--primary))"
                fill="url(#fiVolumeGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
