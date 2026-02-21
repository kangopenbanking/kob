import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, TrendingUp, Clock } from "lucide-react";
import { format } from "date-fns";

export default function InstitutionExchangeRates() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data } = await supabase.from("exchange_rates_cache").select("*").order("created_at", { ascending: false }).limit(100);
      setRates(data || []);
    } catch (error) { console.error("Error:", error); }
    finally { setLoading(false); }
  };

  const isExpired = (validUntil: string) => new Date(validUntil) < new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted"><TrendingUp className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Exchange Rates</h1>
            <p className="text-xs text-muted-foreground">Current and historical currency rates</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Currency Pairs", value: rates.length, icon: TrendingUp },
          { label: "Active Rates", value: rates.filter(r => !isExpired(r.valid_until)).length, icon: Clock },
          { label: "Sources", value: new Set(rates.map(r => r.rate_source)).size, icon: TrendingUp },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted"><s.icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-sm font-semibold">Exchange Rates</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : rates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No exchange rates cached</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Base</TableHead><TableHead className="text-xs">Target</TableHead><TableHead className="text-xs">Rate</TableHead><TableHead className="text-xs">Source</TableHead><TableHead className="text-xs">Valid Until</TableHead><TableHead className="text-xs">Status</TableHead></TableRow></TableHeader>
              <TableBody>{rates.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-medium text-sm">{r.base_currency}</TableCell>
                  <TableCell className="font-mono text-sm">{r.target_currency}</TableCell>
                  <TableCell className="font-mono text-sm">{Number(r.rate).toFixed(4)}</TableCell>
                  <TableCell className="text-sm">{r.rate_source}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(r.valid_until), 'PPp')}</TableCell>
                  <TableCell><Badge variant={isExpired(r.valid_until) ? "destructive" : "default"} className="text-[10px]">{isExpired(r.valid_until) ? "Expired" : "Active"}</Badge></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
