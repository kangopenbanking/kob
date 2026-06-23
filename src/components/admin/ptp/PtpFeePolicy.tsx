// PTP missed-payment fee policy editor (admin).
// Lists loan products and lets admins configure the fee that is charged
// when a customer's Promise to Pay is broken.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Coins, Save, Loader2 } from "lucide-react";

type Product = {
  id: string;
  product_name: string;
  product_code: string;
  ptp_missed_fee_enabled: boolean;
  ptp_missed_fee_type: "fixed" | "percentage";
  ptp_missed_fee_value: number;
  ptp_missed_fee_cap: number | null;
  ptp_missed_fee_grace_days: number;
};

export default function PtpFeePolicy() {
  const { toast } = useToast();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("loan_products")
      .select("id, product_name, product_code, ptp_missed_fee_enabled, ptp_missed_fee_type, ptp_missed_fee_value, ptp_missed_fee_cap, ptp_missed_fee_grace_days")
      .eq("is_active", true)
      .order("product_name");
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const patch = (id: string, p: Partial<Product>) =>
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...p } : it)));

  const save = async (p: Product) => {
    setSavingId(p.id);
    const { error } = await supabase
      .from("loan_products")
      .update({
        ptp_missed_fee_enabled: p.ptp_missed_fee_enabled,
        ptp_missed_fee_type: p.ptp_missed_fee_type,
        ptp_missed_fee_value: Number(p.ptp_missed_fee_value) || 0,
        ptp_missed_fee_cap: p.ptp_missed_fee_cap == null || p.ptp_missed_fee_cap === ('' as any) ? null : Number(p.ptp_missed_fee_cap),
        ptp_missed_fee_grace_days: Number(p.ptp_missed_fee_grace_days) || 0,
      })
      .eq("id", p.id);
    setSavingId(null);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Fee policy updated", description: p.product_name });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" strokeWidth={1.5} />
          <CardTitle className="text-base">Missed-payment fee policy</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure the fee charged automatically when a customer's Promise to Pay is not kept. Applies per loan product.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="w-[110px]">Enabled</TableHead>
                <TableHead className="w-[140px]">Type</TableHead>
                <TableHead className="w-[130px]">Value</TableHead>
                <TableHead className="w-[130px]">Cap (max)</TableHead>
                <TableHead className="w-[110px]">Grace days</TableHead>
                <TableHead className="text-right w-[110px]">Save</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(p => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.product_name}</div>
                    <div className="text-xs text-muted-foreground">{p.product_code}</div>
                    {p.ptp_missed_fee_enabled && (
                      <Badge variant="outline" className="mt-1 border-primary/50 text-primary text-[10px]">
                        Active — {p.ptp_missed_fee_type === "percentage" ? `${p.ptp_missed_fee_value}%` : p.ptp_missed_fee_value}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={p.ptp_missed_fee_enabled}
                        onCheckedChange={(v) => patch(p.id, { ptp_missed_fee_enabled: v })}
                        aria-label={`Enable PTP fee for ${p.product_name}`}
                      />
                      <Label className="text-xs">{p.ptp_missed_fee_enabled ? "On" : "Off"}</Label>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={p.ptp_missed_fee_type}
                      onValueChange={(v) => patch(p.id, { ptp_missed_fee_type: v as any })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed amount</SelectItem>
                        <SelectItem value="percentage">Percentage</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number" min={0} step="0.01"
                      value={p.ptp_missed_fee_value ?? 0}
                      onChange={(e) => patch(p.id, { ptp_missed_fee_value: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number" min={0} step="0.01"
                      placeholder="None"
                      value={p.ptp_missed_fee_cap ?? ""}
                      onChange={(e) => patch(p.id, { ptp_missed_fee_cap: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number" min={0} step="1"
                      value={p.ptp_missed_fee_grace_days ?? 0}
                      onChange={(e) => patch(p.id, { ptp_missed_fee_grace_days: Number(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => save(p)} disabled={savingId === p.id}>
                      {savingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1" />Save</>}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">No active loan products.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
