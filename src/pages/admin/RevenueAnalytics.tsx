import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, DollarSign, TrendingUp, Activity, Landmark } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default function RevenueAnalytics() {
  const { data: transactionFees } = useQuery({
    queryKey: ["admin-revenue-fees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transaction_fees")
        .select("transaction_type, final_fee, calculated_fee, waived_amount, transaction_date, institution_id")
        .order("transaction_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: institutions } = useQuery({
    queryKey: ["admin-revenue-institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("id, institution_name").eq("status", "approved");
      if (error) throw error;
      return data;
    },
  });

  const totalRevenue = transactionFees?.reduce((sum, f) => sum + (Number(f.final_fee) || 0), 0) || 0;
  const totalWaivers = transactionFees?.reduce((sum, f) => sum + (Number(f.waived_amount) || 0), 0) || 0;
  const totalCalculated = transactionFees?.reduce((sum, f) => sum + (Number(f.calculated_fee) || 0), 0) || 0;

  const byType = transactionFees?.reduce((acc, f) => {
    const type = f.transaction_type || "other";
    if (!acc[type]) acc[type] = { count: 0, revenue: 0 };
    acc[type].count++;
    acc[type].revenue += Number(f.final_fee) || 0;
    return acc;
  }, {} as Record<string, { count: number; revenue: number }>) || {};

  const byInstitution = transactionFees?.reduce((acc, f) => {
    const id = f.institution_id || "unknown";
    if (!acc[id]) acc[id] = { count: 0, revenue: 0 };
    acc[id].count++;
    acc[id].revenue += Number(f.final_fee) || 0;
    return acc;
  }, {} as Record<string, { count: number; revenue: number }>) || {};

  const institutionMap = institutions?.reduce((acc, i) => { acc[i.id] = i.institution_name; return acc; }, {} as Record<string, string>) || {};

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={DollarSign} title="Revenue Analytics" description="Platform revenue metrics, trends, and financial reporting" />


      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><DollarSign className="h-4 w-4" />Total Revenue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4" />Total Calculated</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(totalCalculated)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><BarChart3 className="h-4 w-4" />Total Waivers</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{formatCurrency(totalWaivers)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Activity className="h-4 w-4" />Fee Transactions</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{transactionFees?.length || 0}</div></CardContent></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Revenue by Channel</CardTitle><CardDescription>Fee income breakdown by transaction type</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead>Transactions</TableHead><TableHead>Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {Object.entries(byType).sort((a, b) => b[1].revenue - a[1].revenue).map(([type, data]) => (
                  <TableRow key={type}>
                    <TableCell><Badge variant="outline">{type}</Badge></TableCell>
                    <TableCell>{data.count}</TableCell>
                    <TableCell className="font-semibold text-green-600">{formatCurrency(data.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Revenue by Institution</CardTitle><CardDescription>Top revenue-generating institutions</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Institution</TableHead><TableHead>Transactions</TableHead><TableHead>Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {Object.entries(byInstitution).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10).map(([id, data]) => (
                  <TableRow key={id}>
                    <TableCell className="flex items-center gap-2"><Landmark className="h-4 w-4 text-muted-foreground" />{institutionMap[id] || id.substring(0, 8)}</TableCell>
                    <TableCell>{data.count}</TableCell>
                    <TableCell className="font-semibold text-green-600">{formatCurrency(data.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
