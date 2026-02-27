import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface FeeAnalyticsProps {
  transactionFees: any[];
  feeStructures: any[];
}

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(35, 80%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 65%, 55%)",
  "hsl(180, 50%, 45%)",
  "hsl(60, 70%, 50%)",
];

export function FeeAnalytics({ transactionFees, feeStructures }: FeeAnalyticsProps) {
  const monthlyData = useMemo(() => {
    const byMonth: Record<string, { month: string; fees: number; waived: number; count: number }> = {};
    transactionFees.forEach((f) => {
      const d = new Date(f.transaction_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { month: key, fees: 0, waived: 0, count: 0 };
      byMonth[key].fees += Number(f.final_fee || 0);
      byMonth[key].waived += Number(f.waived_amount || 0);
      byMonth[key].count += 1;
    });
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [transactionFees]);

  const byType = useMemo(() => {
    const groups: Record<string, number> = {};
    transactionFees.forEach((f) => {
      const t = f.transaction_type?.replace(/_/g, ' ') || 'Unknown';
      groups[t] = (groups[t] || 0) + Number(f.final_fee || 0);
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [transactionFees]);

  const byModel = useMemo(() => {
    const groups: Record<string, number> = {};
    feeStructures.forEach((s) => {
      groups[s.fee_model] = (groups[s.fee_model] || 0) + 1;
    });
    return Object.entries(groups).map(([name, value]) => ({ name: name.toUpperCase(), value }));
  }, [feeStructures]);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Monthly Fee Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No data to display</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()} XAF`} />
                  <Bar dataKey="fees" name="Fees Collected" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="waived" name="Waived" fill="hsl(35, 80%, 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Fee Distribution by Type */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue by Transaction Type</CardTitle>
          </CardHeader>
          <CardContent>
            {byType.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No data to display</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                    {byType.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()} XAF`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fee Model Distribution */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Fee Structure Models Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {byModel.map((m, idx) => (
              <div key={m.name} className="flex items-center gap-2 rounded-lg border p-3 min-w-[120px]">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                <div>
                  <p className="text-sm font-bold">{m.value}</p>
                  <p className="text-xs text-muted-foreground">{m.name}</p>
                </div>
              </div>
            ))}
            {byModel.length === 0 && <p className="text-sm text-muted-foreground">No structures to analyze</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
