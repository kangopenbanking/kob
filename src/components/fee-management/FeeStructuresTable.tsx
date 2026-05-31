import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  MoreHorizontal, Pencil, Power, PowerOff, Trash2, Copy, ChevronDown, ChevronUp,
  ArrowLeftRight, CreditCard, Receipt, Smartphone, PhoneCall, Landmark,
  QrCode, PiggyBank, Users, Home, ArrowUpFromLine, ArrowDownToLine,
  Wallet, Globe2, Hash, Banknote, Zap, Send, Lock, Plug, Radio, FileText,
  Plus, RefreshCw, Search, LayoutGrid, List, Filter,
  Building2, Plane, Hotel, MapPin, Gauge, ShieldCheck, XCircle,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreateFeeStructureForm } from "./CreateFeeStructureForm";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FeeStructuresTableProps {
  structures: any[];
  institutions?: any[];
  onRefresh: () => void;
}

const MODEL_COLORS: Record<string, string> = {
  fixed: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800",
  percentage: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-800",
  hybrid: "bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-400 dark:border-purple-800",
  tiered: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800",
};

const TX_TYPE_META: Record<string, { icon: any; category: string; label: string }> = {
  transfer: { icon: ArrowLeftRight, category: "Core", label: "Account Transfer" },
  payment: { icon: CreditCard, category: "Core", label: "Payment" },
  bill_payment: { icon: Receipt, category: "Core", label: "Bill Payment" },
  mobile_money_transfer: { icon: Smartphone, category: "Mobile", label: "Mobile Money Transfer" },
  mobile_money_charge: { icon: PhoneCall, category: "Mobile", label: "Mobile Money Charge" },
  byo_mobile_money_routing: { icon: PhoneCall, category: "Mobile", label: "BYO Routing Fee (Direct Rail)" },
  byo_fallback_charge: { icon: PhoneCall, category: "Mobile", label: "BYO Fallback Charge (Flutterwave Rescue)" },
  bank_transfer: { icon: Landmark, category: "Banking", label: "Bank Transfer (Generic)" },
  intra_bank_transfer: { icon: Building2, category: "Banking", label: "Intra-Bank Transfer (Same Bank)" },
  inter_bank_transfer: { icon: ArrowLeftRight, category: "Banking", label: "Inter-Bank Transfer (Different Banks)" },
  card_payment: { icon: CreditCard, category: "Cards", label: "Card Payment" },
  virtual_card_topup: { icon: RefreshCw, category: "Cards", label: "Virtual Card Top-up" },
  qr_payment: { icon: QrCode, category: "Core", label: "QR Payment" },
  piggybank_deposit: { icon: PiggyBank, category: "Savings", label: "Piggy Bank Deposit" },
  piggybank_withdrawal: { icon: PiggyBank, category: "Savings", label: "Piggy Bank Withdrawal" },
  njangi_contribution: { icon: Users, category: "Social", label: "Njangi Contribution" },
  njangi_payout: { icon: Users, category: "Social", label: "Njangi Payout" },
  rent_payment: { icon: Home, category: "Core", label: "Rent Payment" },
  loan_disbursement: { icon: ArrowUpFromLine, category: "Lending", label: "Loan Disbursement" },
  loan_repayment: { icon: ArrowDownToLine, category: "Lending", label: "Loan Repayment" },
  savings_deposit: { icon: Wallet, category: "Savings", label: "Savings Deposit" },
  savings_withdrawal: { icon: Wallet, category: "Savings", label: "Savings Withdrawal" },
  international_transfer: { icon: Globe2, category: "International", label: "International Transfer" },
  ussd_payment: { icon: Hash, category: "Mobile", label: "USSD Payment" },
  withdrawal: { icon: Banknote, category: "Core", label: "Cash Out" },
  account_funding: { icon: Plus, category: "Core", label: "Account Funding" },
  gateway_charge: { icon: Zap, category: "Gateway", label: "Gateway Charge" },
  gateway_payout: { icon: Send, category: "Gateway", label: "Gateway Payout" },
  paypal_payment: { icon: Globe2, category: "International", label: "PayPal Payment" },
  fx_conversion: { icon: ArrowLeftRight, category: "International", label: "FX Conversion" },
  escrow_payment: { icon: Lock, category: "Core", label: "Escrow Payment" },
  api_request: { icon: Plug, category: "Gateway", label: "API Request" },
  mobile_recharge: { icon: Radio, category: "Mobile", label: "Mobile Recharge" },
  invoice_create: { icon: FileText, category: "Core", label: "Invoice Create" },
  credit_report_purchase: { icon: FileText, category: "CrediQ", label: "Credit Report Purchase" },
  credit_score_inquiry: { icon: Gauge, category: "CrediQ", label: "Credit Score Inquiry (Bank)" },
  credit_report_inquiry: { icon: FileText, category: "CrediQ", label: "Credit Report Inquiry (Bank)" },
  credit_premium_subscription: { icon: ShieldCheck, category: "CrediQ", label: "CrediQ Premium Subscription" },
  overdraft_fee: { icon: ArrowDownToLine, category: "Lending", label: "Overdraft Fee" },
  loan_processing_fee: { icon: ArrowUpFromLine, category: "Lending", label: "Loan Processing Fee" },
  atm_withdrawal: { icon: Banknote, category: "Banking", label: "ATM Withdrawal" },
  standing_order: { icon: RefreshCw, category: "Banking", label: "Standing Order" },
  dormancy_fee: { icon: Lock, category: "Banking", label: "Dormancy Fee" },
  // Travel & Tourism
  hotel_booking: { icon: Hotel, category: "Travel", label: "Hotel Booking" },
  flight_booking: { icon: Plane, category: "Travel", label: "Flight Booking" },
  tour_booking: { icon: MapPin, category: "Travel", label: "Tour Booking" },
  travel_booking: { icon: Plane, category: "Travel", label: "Travel Booking (Generic)" },
  travel_cancellation_fee: { icon: XCircle, category: "Travel", label: "Travel Cancellation Fee" },
  // Remittance
  remittance_inbound: { icon: ArrowDownToLine, category: "Remittance", label: "Remittance Inbound" },
  remittance_outbound: { icon: Send, category: "Remittance", label: "Remittance Outbound" },
  remittance_bank_credit: { icon: Landmark, category: "Remittance", label: "Remittance Bank Credit" },
  remittance_wallet_credit: { icon: Wallet, category: "Remittance", label: "Remittance Wallet Credit" },
  remittance_bill_payment: { icon: Receipt, category: "Remittance", label: "Remittance Bill Payment" },
  remittance_fx_markup: { icon: ArrowLeftRight, category: "Remittance", label: "Remittance FX Markup" },
  // Overdraft (additional)
  overdraft_interest: { icon: ArrowDownToLine, category: "Lending", label: "Overdraft Interest" },
  overdraft_setup_fee: { icon: ArrowDownToLine, category: "Lending", label: "Overdraft Setup Fee" },
  overdraft_renewal_fee: { icon: RefreshCw, category: "Lending", label: "Overdraft Renewal Fee" },
  // Statements
  statement_download_consumer: { icon: FileText, category: "Services", label: "Statement Download — Consumers App" },
  statement_download_banking: { icon: FileText, category: "Services", label: "Statement Download — Banking App" },
  // WooCommerce & Enterprise packages
  woocommerce_transaction: { icon: ShieldCheck, category: "Gateway", label: "WooCommerce Transaction Fee" },
  enterprise_subscription_starter: { icon: ShieldCheck, category: "Services", label: "Enterprise Starter Package (Monthly)" },
  enterprise_subscription_growth: { icon: ShieldCheck, category: "Services", label: "Enterprise Growth Package (Monthly)" },
  enterprise_subscription_scale: { icon: ShieldCheck, category: "Services", label: "Enterprise Scale Package (Monthly)" },
};

const CATEGORY_ORDER = ["Core", "Banking", "Mobile", "Cards", "Savings", "Lending", "Travel", "Remittance", "International", "Social", "Gateway", "CrediQ", "Services", "Other"];

const CATEGORY_STYLES: Record<string, { bg: string; border: string; text: string; icon: any }> = {
  Core: { bg: "bg-blue-500/5", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-400", icon: ArrowLeftRight },
  Banking: { bg: "bg-slate-500/5", border: "border-slate-200 dark:border-slate-800", text: "text-slate-700 dark:text-slate-400", icon: Landmark },
  Mobile: { bg: "bg-violet-500/5", border: "border-violet-200 dark:border-violet-800", text: "text-violet-700 dark:text-violet-400", icon: Smartphone },
  Cards: { bg: "bg-rose-500/5", border: "border-rose-200 dark:border-rose-800", text: "text-rose-700 dark:text-rose-400", icon: CreditCard },
  Savings: { bg: "bg-emerald-500/5", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-400", icon: Wallet },
  Lending: { bg: "bg-orange-500/5", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-400", icon: ArrowUpFromLine },
  Travel: { bg: "bg-sky-500/5", border: "border-sky-200 dark:border-sky-800", text: "text-sky-700 dark:text-sky-400", icon: Plane },
  Remittance: { bg: "bg-indigo-500/5", border: "border-indigo-200 dark:border-indigo-800", text: "text-indigo-700 dark:text-indigo-400", icon: Send },
  International: { bg: "bg-cyan-500/5", border: "border-cyan-200 dark:border-cyan-800", text: "text-cyan-700 dark:text-cyan-400", icon: Globe2 },
  Social: { bg: "bg-pink-500/5", border: "border-pink-200 dark:border-pink-800", text: "text-pink-700 dark:text-pink-400", icon: Users },
  Gateway: { bg: "bg-amber-500/5", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", icon: Zap },
  CrediQ: { bg: "bg-fuchsia-500/5", border: "border-fuchsia-200 dark:border-fuchsia-800", text: "text-fuchsia-700 dark:text-fuchsia-400", icon: Gauge },
  Services: { bg: "bg-teal-500/5", border: "border-teal-200 dark:border-teal-800", text: "text-teal-700 dark:text-teal-400", icon: FileText },
  Other: { bg: "bg-muted", border: "border-border", text: "text-muted-foreground", icon: FileText },
};

function getFeeDisplay(s: any) {
  if (s.fee_model === "fixed") return `${Number(s.fixed_amount).toLocaleString()} XAF`;
  if (s.fee_model === "percentage") return `${s.percentage_rate}%`;
  if (s.fee_model === "hybrid") return `${Number(s.fixed_amount).toLocaleString()} XAF + ${s.percentage_rate}%`;
  if (s.fee_model === "tiered") return `${(s.tiered_rates as any[])?.length || 0} tiers`;
  return "—";
}

export function FeeStructuresTable({ structures, institutions = [], onRefresh }: FeeStructuresTableProps) {
  const { toast } = useToast();
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteItem, setDeleteItem] = useState<any | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const toggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from("fee_structures").update({ is_active: !currentActive }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: currentActive ? "Deactivated" : "Activated", description: "Fee structure updated" });
      onRefresh();
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    const { error } = await supabase.from("fee_structures").delete().eq("id", deleteItem.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Fee structure removed" });
      setDeleteItem(null);
      onRefresh();
    }
  };

  const handleEdit = async (formData: any) => {
    if (!editItem) return;
    const { error } = await supabase.from("fee_structures").update({
      institution_id: formData.institution_id,
      transaction_type: formData.transaction_type,
      fee_model: formData.fee_model,
      fixed_amount: formData.fixed_amount || 0,
      percentage_rate: formData.percentage_rate || 0,
      min_fee_amount: formData.min_fee_amount || 0,
      max_fee_amount: formData.max_fee_amount || null,
      tiered_rates: formData.tiered_rates || null,
      effective_from: formData.effective_from,
      effective_until: formData.effective_until,
      daily_limit: formData.daily_limit ?? -1,
      monthly_limit: formData.monthly_limit ?? -1,
      max_charge_cap: formData.max_charge_cap ?? -1,
      agent_commission_percent: formData.agent_commission_percent ?? 0,
      agent_commission_fixed: formData.agent_commission_fixed ?? 0,
      referral_percent_commission: formData.referral_percent_commission ?? 0,
      referral_fixed_commission: formData.referral_fixed_commission ?? 0,
      merchant_percent_charge: formData.merchant_percent_charge ?? 0,
      merchant_fixed_charge: formData.merchant_fixed_charge ?? 0,
    }).eq("id", editItem.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: "Fee structure updated successfully" });
      setEditItem(null);
      onRefresh();
    }
  };

  const duplicate = async (structure: any) => {
    const { id, created_at, updated_at, institutions: _, ...rest } = structure;
    const { error } = await supabase.from("fee_structures").insert({ ...rest, is_active: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Duplicated", description: "Fee structure copied (inactive)" });
      onRefresh();
    }
  };

  const grouped = useMemo(() => {
    const filtered = structures.filter((s) => {
      const meta = TX_TYPE_META[s.transaction_type];
      const label = meta?.label || s.transaction_type;
      const institution = s.institutions?.institution_name || "";
      const matchesSearch = !searchTerm || label.toLowerCase().includes(searchTerm.toLowerCase()) || institution.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !activeCategory || (meta?.category === activeCategory);
      return matchesSearch && matchesCategory;
    });

    const map: Record<string, any[]> = {};
    filtered.forEach((s) => {
      const cat = TX_TYPE_META[s.transaction_type]?.category || "Other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(s);
    });

    return CATEGORY_ORDER
      .filter((cat) => map[cat]?.length)
      .map((cat) => ({ category: cat, items: map[cat] }));
  }, [structures, searchTerm, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    structures.forEach((s) => {
      const cat = TX_TYPE_META[s.transaction_type]?.category || "Other";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [structures]);

  if (structures.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center">
        <p className="text-muted-foreground">No fee structures configured yet. Create your first one above.</p>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fee structures..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeCategory === null ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs rounded-full"
            onClick={() => setActiveCategory(null)}
          >
            All ({structures.length})
          </Button>
          {CATEGORY_ORDER.filter((c) => categoryCounts[c]).map((cat) => {
            const style = CATEGORY_STYLES[cat];
            const CatIcon = style?.icon;
            return (
              <Button
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"}
                size="sm"
                className={cn("h-7 text-xs rounded-full gap-1.5", activeCategory !== cat && style?.text)}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              >
                {CatIcon && <CatIcon className="h-3 w-3" />}
                {cat} ({categoryCounts[cat]})
              </Button>
            );
          })}
        </div>
      </div>

      {/* Categorized Grid */}
      <div className="space-y-6">
        {grouped.map(({ category, items }) => {
          const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.Core;
          const CatIcon = style.icon;
          return (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("flex items-center justify-center h-7 w-7 rounded-lg", style.bg, style.border, "border")}>
                  <CatIcon className={cn("h-3.5 w-3.5", style.text)} />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{category}</h3>
                <Badge variant="secondary" className="text-[10px] h-5">{items.length}</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((s: any, idx: number) => {
                  const meta = TX_TYPE_META[s.transaction_type];
                  const TxIcon = meta?.icon || FileText;
                  const isExpanded = expandedId === s.id;

                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className={cn(
                        "rounded-xl border bg-card shadow-sm hover:shadow-md transition-all group relative",
                        !s.is_active && "opacity-70"
                      )}
                    >
                      {/* Card header */}
                      <div className="p-4 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={cn("flex items-center justify-center h-9 w-9 rounded-lg shrink-0", style.bg, style.border, "border")}>
                              <TxIcon className={cn("h-4 w-4", style.text)} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{meta?.label || s.transaction_type.replace(/_/g, " ")}</p>
                              <p className="text-xs text-muted-foreground truncate">{s.institutions?.institution_name || "Platform Default"}</p>
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => setEditItem(s)}><Pencil className="h-3 w-3 mr-2" /> Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicate(s)}><Copy className="h-3 w-3 mr-2" /> Duplicate</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleActive(s.id, s.is_active)}>
                                {s.is_active ? <><PowerOff className="h-3 w-3 mr-2" /> Deactivate</> : <><Power className="h-3 w-3 mr-2" /> Activate</>}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteItem(s)}>
                                <Trash2 className="h-3 w-3 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Fee info row */}
                        <div className="flex items-center gap-2 mt-3">
                          <Badge variant="outline" className={cn("text-[10px] font-semibold", MODEL_COLORS[s.fee_model] || "")}>
                            {s.fee_model.toUpperCase()}
                          </Badge>
                          <span className="text-sm font-bold text-foreground ml-auto">{getFeeDisplay(s)}</span>
                        </div>

                        {!s.is_active && (
                          <Badge variant="outline" className="text-[10px] border-destructive text-destructive mt-2">Inactive</Badge>
                        )}

                        {/* Limit & Commission badges */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {s.daily_limit && s.daily_limit > 0 && (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Daily: {Number(s.daily_limit).toLocaleString()}</Badge>
                          )}
                          {s.monthly_limit && s.monthly_limit > 0 && (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Monthly: {Number(s.monthly_limit).toLocaleString()}</Badge>
                          )}
                          {s.max_charge_cap && s.max_charge_cap > 0 && (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Cap: {Number(s.max_charge_cap).toLocaleString()}</Badge>
                          )}
                          {s.agent_commission_percent > 0 && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-emerald-200 text-emerald-700 dark:text-emerald-400">Agent {s.agent_commission_percent}%</Badge>
                          )}
                        </div>
                      </div>

                      {/* Expand toggle */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : s.id)}
                        className="w-full border-t px-4 py-1.5 flex items-center justify-center text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                        {isExpanded ? "Less" : "Details"}
                      </button>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t px-4 pb-3 pt-2 space-y-2 text-xs">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-muted-foreground">From</span>
                                  <p className="font-medium">{new Date(s.effective_from).toLocaleDateString()}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Until</span>
                                  <p className="font-medium">{s.effective_until ? new Date(s.effective_until).toLocaleDateString() : "Ongoing"}</p>
                                </div>
                                {s.min_fee_amount > 0 && (
                                  <div>
                                    <span className="text-muted-foreground">Min Fee</span>
                                    <p className="font-medium">{Number(s.min_fee_amount).toLocaleString()} XAF</p>
                                  </div>
                                )}
                                {s.max_fee_amount && (
                                  <div>
                                    <span className="text-muted-foreground">Max Fee</span>
                                    <p className="font-medium">{Number(s.max_fee_amount).toLocaleString()} XAF</p>
                                  </div>
                                )}
                              </div>

                              {s.fee_model === "tiered" && Array.isArray(s.tiered_rates) && (
                                <div>
                                  <span className="text-muted-foreground">Tiers</span>
                                  <div className="mt-1 grid grid-cols-4 gap-1 text-[10px] font-medium bg-muted/50 rounded-lg p-2">
                                    <span>Min</span><span>Max</span><span>Fixed</span><span>%</span>
                                    {(s.tiered_rates as any[]).map((t: any, i: number) => (
                                      <span key={i} className="contents">
                                        <span>{Number(t.min).toLocaleString()}</span>
                                        <span>{t.max ? Number(t.max).toLocaleString() : "∞"}</span>
                                        <span>{t.fixed}</span>
                                        <span>{t.percentage}%</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}

        {grouped.length === 0 && (
          <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center">
            <p className="text-muted-foreground text-sm">No fee structures match your search.</p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Fee Structure</DialogTitle>
            <DialogDescription>Modify the fee structure configuration</DialogDescription>
          </DialogHeader>
          {editItem && (
            <CreateFeeStructureForm
              institutions={institutions}
              onSubmit={handleEdit}
              onCancel={() => setEditItem(null)}
              initialData={editItem}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fee Structure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the fee structure for <strong>{deleteItem?.institutions?.institution_name}</strong> — <em>{deleteItem?.transaction_type}</em>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
