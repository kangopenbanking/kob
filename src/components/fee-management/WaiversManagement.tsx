import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, MoreHorizontal, Power, PowerOff, Gift, Percent, Tag } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";

const WAIVER_TYPES = [
  { value: "percentage_discount", label: "Percentage Discount", icon: <Percent className="h-4 w-4" /> },
  { value: "fixed_discount", label: "Fixed Discount", icon: <Tag className="h-4 w-4" /> },
  { value: "full_waiver", label: "Full Waiver", icon: <Gift className="h-4 w-4" /> },
  { value: "promotional", label: "Promotional", icon: <Gift className="h-4 w-4" /> },
];

const TRANSACTION_TYPES = [
  "transfer", "payment", "bill_payment", "mobile_money_transfer", "mobile_money_charge",
  "byo_mobile_money_routing", "byo_fallback_charge",
  "bank_transfer", "card_payment", "virtual_card_topup", "qr_payment",
  "piggybank_deposit", "piggybank_withdrawal", "njangi_contribution", "njangi_payout",
  "rent_payment", "loan_disbursement", "loan_repayment", "savings_deposit", "savings_withdrawal",
  "international_transfer", "ussd_payment", "withdrawal", "account_funding",
  "gateway_charge", "gateway_payout", "paypal_payment", "fx_conversion",
  "escrow_payment", "api_request", "mobile_recharge", "invoice_create",
  "credit_report_purchase", "overdraft_fee", "loan_processing_fee",
  "atm_withdrawal", "standing_order", "dormancy_fee",
  "remittance_inbound", "remittance_outbound", "remittance_bank_credit",
  "remittance_wallet_credit", "remittance_bill_payment", "remittance_fx_markup",
  "overdraft_interest", "overdraft_setup_fee", "overdraft_renewal_fee",
];

interface WaiversManagementProps {
  institutions: any[];
  onRefresh: () => void;
}

export function WaiversManagement({ institutions, onRefresh }: WaiversManagementProps) {
  const { toast } = useToast();
  const [waivers, setWaivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteItem, setDeleteItem] = useState<any | null>(null);

  const [form, setForm] = useState({
    institution_id: '',
    waiver_type: 'percentage_discount',
    discount_percentage: 0,
    discount_fixed_amount: 0,
    reason: '',
    effective_from: new Date().toISOString().split('T')[0],
    effective_until: '',
    max_uses: null as number | null,
    applies_to_transaction_types: [] as string[],
  });

  useEffect(() => { loadWaivers(); }, []);

  const loadWaivers = async () => {
    setLoading(true);
    const { data } = await supabase.from("fee_waivers").select("*, institutions(institution_name)").order("created_at", { ascending: false });
    setWaivers(data || []);
    setLoading(false);
  };

  const resetForm = () => setForm({
    institution_id: '', waiver_type: 'percentage_discount', discount_percentage: 0,
    discount_fixed_amount: 0, reason: '', effective_from: new Date().toISOString().split('T')[0],
    effective_until: '', max_uses: null, applies_to_transaction_types: [],
  });

  const openEdit = (w: any) => {
    setForm({
      institution_id: w.institution_id,
      waiver_type: w.waiver_type,
      discount_percentage: w.discount_percentage || 0,
      discount_fixed_amount: w.discount_fixed_amount || 0,
      reason: w.reason || '',
      effective_from: w.effective_from?.split('T')[0] || '',
      effective_until: w.effective_until?.split('T')[0] || '',
      max_uses: w.max_uses,
      applies_to_transaction_types: w.applies_to_transaction_types || [],
    });
    setEditItem(w);
    setShowCreate(true);
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      institution_id: form.institution_id,
      waiver_type: form.waiver_type,
      discount_percentage: form.waiver_type === 'percentage_discount' || form.waiver_type === 'promotional' ? form.discount_percentage : null,
      discount_fixed_amount: form.waiver_type === 'fixed_discount' ? form.discount_fixed_amount : null,
      reason: form.reason,
      effective_from: form.effective_from,
      effective_until: form.effective_until,
      max_uses: form.max_uses,
      applies_to_transaction_types: form.applies_to_transaction_types.length > 0 ? form.applies_to_transaction_types : null,
      is_active: true,
    };

    let error;
    if (editItem) {
      ({ error } = await supabase.from("fee_waivers").update(payload).eq("id", editItem.id));
    } else {
      payload.created_by = user?.id;
      ({ error } = await supabase.from("fee_waivers").insert(payload));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editItem ? "Updated" : "Created", description: "Waiver saved" });
      setShowCreate(false);
      setEditItem(null);
      resetForm();
      loadWaivers();
      onRefresh();
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("fee_waivers").update({ is_active: !active }).eq("id", id);
    toast({ title: active ? "Deactivated" : "Activated" });
    loadWaivers();
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await supabase.from("fee_waivers").delete().eq("id", deleteItem.id);
    toast({ title: "Deleted" });
    setDeleteItem(null);
    loadWaivers();
    onRefresh();
  };

  const toggleTxType = (type: string) => {
    setForm(f => ({
      ...f,
      applies_to_transaction_types: f.applies_to_transaction_types.includes(type)
        ? f.applies_to_transaction_types.filter(t => t !== type)
        : [...f.applies_to_transaction_types, type],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold">Fee Waivers & Discounts</h3>
          <p className="text-xs text-muted-foreground">Manage promotional discounts and fee exemptions</p>
        </div>
        <Button onClick={() => { resetForm(); setEditItem(null); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-1.5" /> Create Waiver
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading…</div>
      ) : waivers.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center">
          <Gift className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">No waivers configured. Create promotional discounts or fee exemptions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {waivers.map((w, idx) => {
            const usagePercent = w.max_uses ? Math.round((w.current_uses / w.max_uses) * 100) : 0;
            const isExpired = new Date(w.effective_until) < new Date();

            return (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`rounded-xl border bg-card p-4 shadow-sm ${!w.is_active || isExpired ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{w.institutions?.institution_name}</span>
                      <Badge variant="outline" className="text-[10px]">{w.waiver_type.replace(/_/g, ' ').toUpperCase()}</Badge>
                      {!w.is_active && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
                      {isExpired && <Badge variant="outline" className="text-[10px] border-red-300 text-red-600">Expired</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{w.reason}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      {w.discount_percentage > 0 && <p className="font-bold text-sm">{w.discount_percentage}% off</p>}
                      {w.discount_fixed_amount > 0 && <p className="font-bold text-sm">{Number(w.discount_fixed_amount).toLocaleString()} XAF off</p>}
                      {w.waiver_type === 'full_waiver' && <p className="font-bold text-sm text-emerald-600">100% waived</p>}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(w)}><Pencil className="h-3 w-3 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(w.id, w.is_active)}>
                          {w.is_active ? <><PowerOff className="h-3 w-3 mr-2" /> Deactivate</> : <><Power className="h-3 w-3 mr-2" /> Activate</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteItem(w)}>
                          <Trash2 className="h-3 w-3 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Period</span>
                    <p className="font-medium">{new Date(w.effective_from).toLocaleDateString()} — {new Date(w.effective_until).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Applies To</span>
                    <p className="font-medium">{w.applies_to_transaction_types?.length ? w.applies_to_transaction_types.join(', ').replace(/_/g, ' ') : 'All types'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Usage</span>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{w.current_uses || 0}{w.max_uses ? ` / ${w.max_uses}` : ' (unlimited)'}</p>
                    </div>
                    {w.max_uses && <Progress value={usagePercent} className="h-1 mt-1" />}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditItem(null); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Waiver' : 'Create Fee Waiver'}</DialogTitle>
            <DialogDescription>Configure a discount or exemption for an institution</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Institution</Label>
              <Select value={form.institution_id} onValueChange={(v) => setForm({ ...form, institution_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select institution" /></SelectTrigger>
                <SelectContent>
                  {institutions.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.institution_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Waiver Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {WAIVER_TYPES.map((wt) => (
                  <button
                    key={wt.value}
                    type="button"
                    onClick={() => setForm({ ...form, waiver_type: wt.value })}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-all ${
                      form.waiver_type === wt.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card'
                    }`}
                  >
                    {wt.icon}
                    <span className="font-medium">{wt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {(form.waiver_type === 'percentage_discount' || form.waiver_type === 'promotional') && (
              <div className="space-y-2">
                <Label>Discount Percentage (%)</Label>
                <Input type="number" min={0} max={100} step={0.1} value={form.discount_percentage} onChange={(e) => setForm({ ...form, discount_percentage: Number(e.target.value) })} />
              </div>
            )}

            {form.waiver_type === 'fixed_discount' && (
              <div className="space-y-2">
                <Label>Discount Amount (XAF)</Label>
                <Input type="number" min={0} value={form.discount_fixed_amount} onChange={(e) => setForm({ ...form, discount_fixed_amount: Number(e.target.value) })} />
              </div>
            )}

            <div className="space-y-2">
              <Label>Reason / Description</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Early adopter promotion" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Effective From</Label>
                <Input type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Effective Until</Label>
                <Input type="date" value={form.effective_until} onChange={(e) => setForm({ ...form, effective_until: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Max Uses (leave empty for unlimited)</Label>
              <Input type="number" min={0} value={form.max_uses || ''} onChange={(e) => setForm({ ...form, max_uses: e.target.value ? Number(e.target.value) : null })} placeholder="Unlimited" />
            </div>

            <div className="space-y-2">
              <Label>Applies To (leave empty for all types)</Label>
              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                {TRANSACTION_TYPES.map((tt) => (
                  <button
                    key={tt}
                    type="button"
                    onClick={() => toggleTxType(tt)}
                    className={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
                      form.applies_to_transaction_types.includes(tt) ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {tt.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleSave} className="w-full" disabled={!form.institution_id || !form.reason || !form.effective_until}>
              {editItem ? 'Update Waiver' : 'Create Waiver'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Waiver?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this waiver. Active transactions using it won't be affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
