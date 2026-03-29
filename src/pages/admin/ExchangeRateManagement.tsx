import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeftRight, Plus, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const CURRENCIES = ["XAF", "XOF", "EUR", "USD", "GBP", "NGN"];

export default function ExchangeRateManagement() {
  const queryClient = useQueryClient();
  const [newRate, setNewRate] = useState({ base: "USD", target: "XAF", rate: "", margin: "0" });

  const { data: rates, isLoading } = useQuery({
    queryKey: ["admin-exchange-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_exchange_rates")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addRate = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("admin_exchange_rates").insert({
        base_currency: newRate.base,
        target_currency: newRate.target,
        rate: parseFloat(newRate.rate),
        margin_percentage: parseFloat(newRate.margin),
        set_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-exchange-rates"] });
      toast.success("Exchange rate added successfully");
      setNewRate({ base: "USD", target: "XAF", rate: "", margin: "0" });
    },
    onError: (error: any) => toast.error(`Failed to add rate: ${error.message}`),
  });

  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={ArrowLeftRight} title="Exchange Rate Management" description="Configure and monitor currency exchange rates" />

      <div className="flex items-center justify-between">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Rate</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Exchange Rate</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Base Currency</Label>
                  <Select value={newRate.base} onValueChange={(v) => setNewRate({ ...newRate, base: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Target Currency</Label>
                  <Select value={newRate.target} onValueChange={(v) => setNewRate({ ...newRate, target: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Rate</Label><Input type="number" step="0.0001" value={newRate.rate} onChange={(e) => setNewRate({ ...newRate, rate: e.target.value })} placeholder="e.g. 610.50" /></div>
              <div><Label>Margin (%)</Label><Input type="number" step="0.01" value={newRate.margin} onChange={(e) => setNewRate({ ...newRate, margin: e.target.value })} placeholder="e.g. 1.5" /></div>
              <Button onClick={() => {
                if (newRate.base === newRate.target) { toast.error("Base and target currencies must be different"); return; }
                if (!newRate.rate || parseFloat(newRate.rate) <= 0) { toast.error("Rate must be greater than zero"); return; }
                addRate.mutate(undefined, { onSuccess: () => setDialogOpen(false) });
              }} disabled={!newRate.rate || addRate.isPending} className="w-full">
                {addRate.isPending ? "Saving..." : "Save Rate"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Rates</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{rates?.length || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Currency Pairs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{new Set(rates?.map((r) => `${r.base_currency}/${r.target_currency}`)).size || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Last Updated</CardTitle></CardHeader><CardContent><div className="text-sm font-medium">{rates?.[0] ? format(new Date(rates[0].updated_at), "MMM dd, HH:mm") : "N/A"}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Active Exchange Rates</CardTitle><CardDescription>Current exchange rates with margins applied</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : rates?.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No exchange rates configured</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pair</TableHead>
                  <TableHead>Base Rate</TableHead>
                  <TableHead>Margin</TableHead>
                  <TableHead>Effective Rate</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates?.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-semibold"><ArrowLeftRight className="h-4 w-4 inline mr-2" />{rate.base_currency}/{rate.target_currency}</TableCell>
                    <TableCell className="font-mono">{Number(rate.rate).toFixed(4)}</TableCell>
                    <TableCell><Badge variant="outline">{Number(rate.margin_percentage).toFixed(2)}%</Badge></TableCell>
                    <TableCell className="font-mono font-semibold">{Number(rate.effective_rate).toFixed(4)}</TableCell>
                    <TableCell><Badge variant="secondary">{rate.source}</Badge></TableCell>
                    <TableCell className="text-xs">{format(new Date(rate.updated_at), "MMM dd, HH:mm")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
