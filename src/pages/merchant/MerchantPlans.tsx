import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Edit2, Trash2, RefreshCw, Users, CheckCircle2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface Plan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: string;
  interval_count: number;
  trial_period_days: number | null;
  is_active: boolean;
  subscriber_count?: number;
  created_at: string;
}

const INTERVALS = ["day", "week", "month", "year"];

export default function MerchantPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    currency: "XAF",
    interval: "month",
    interval_count: "1",
    trial_period_days: "",
    is_active: true,
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setLoading(false);

    const { data: merchant } = await supabase
      .from("gateway_merchants")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!merchant) return setLoading(false);
    setMerchantId(merchant.id);

    const { data: rawPlans } = await supabase
      .from("gateway_payment_plans")
      .select("*")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false });

    if (rawPlans && rawPlans.length > 0) {
      // Fetch subscriber counts per plan
      const planIds = rawPlans.map((p: any) => p.id);
      const { data: subs } = await supabase
        .from("gateway_subscriptions")
        .select("plan_id")
        .in("plan_id", planIds)
        .eq("status", "active");

      const countMap: Record<string, number> = {};
      (subs || []).forEach((s: any) => {
        countMap[s.plan_id] = (countMap[s.plan_id] || 0) + 1;
      });

      setPlans(rawPlans.map((p: any) => ({ ...p, subscriber_count: countMap[p.id] || 0 })));
    } else {
      setPlans([]);
    }

    setLoading(false);
  };

  const openCreate = () => {
    setEditingPlan(null);
    setForm({ name: "", amount: "", currency: "XAF", interval: "month", interval_count: "1", trial_period_days: "", is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      amount: String(plan.amount),
      currency: plan.currency || "XAF",
      interval: plan.interval,
      interval_count: String(plan.interval_count || 1),
      trial_period_days: plan.trial_period_days ? String(plan.trial_period_days) : "",
      is_active: plan.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!merchantId || !form.name || !form.amount) return;
    setSaving(true);
    try {
      const payload = {
        merchant_id: merchantId,
        name: form.name,
        amount: Number(form.amount),
        currency: form.currency,
        interval: form.interval,
        interval_count: Number(form.interval_count) || 1,
        trial_period_days: form.trial_period_days ? Number(form.trial_period_days) : null,
        is_active: form.is_active,
      };

      if (editingPlan) {
        const { error } = await supabase.from("gateway_payment_plans").update(payload as any).eq("id", editingPlan.id);
        if (error) throw error;
        toast.success("Plan updated");
      } else {
        const { error } = await supabase.from("gateway_payment_plans").insert(payload as any);
        if (error) throw error;
        toast.success("Plan created");
      }
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, "Failed to save plan"));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (plan: Plan) => {
    const { error } = await supabase
      .from("gateway_payment_plans")
      .update({ is_active: !plan.is_active })
      .eq("id", plan.id);
    if (error) return toast.error(extractEdgeFunctionError(error));
    toast.success(`Plan ${plan.is_active ? "deactivated" : "activated"}`);
    loadData();
  };

  const handleDelete = async (plan: Plan) => {
    if (!confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    if ((plan.subscriber_count || 0) > 0) {
      toast.error("Cannot delete a plan with active subscribers. Deactivate it instead.");
      return;
    }
    const { error } = await supabase.from("gateway_payment_plans").delete().eq("id", plan.id);
    if (error) return toast.error(extractEdgeFunctionError(error));
    toast.success("Plan deleted");
    loadData();
  };

  const formatInterval = (plan: Plan) => {
    const count = plan.interval_count || 1;
    return count === 1 ? `per ${plan.interval}` : `every ${count} ${plan.interval}s`;
  };

  const totalSubscribers = plans.reduce((sum, p) => sum + (p.subscriber_count || 0), 0);
  const activePlans = plans.filter(p => p.is_active).length;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment Plans</h1>
          <p className="text-muted-foreground">Manage subscription plans for your customers</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New Plan
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Total Plans", value: plans.length, icon: RefreshCw, color: "text-primary" },
          { label: "Active Plans", value: activePlans, icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Active Subscribers", value: totalSubscribers, icon: Users, color: "text-amber-500" },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plans Grid */}
      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <RefreshCw className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No payment plans yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first plan to start collecting recurring payments</p>
            <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Create Plan</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <Card key={plan.id} className={`relative transition-opacity ${!plan.is_active ? "opacity-60" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{plan.name}</CardTitle>
                  <Badge variant={plan.is_active ? "default" : "secondary"} className="shrink-0">
                    {plan.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription>
                  <span className="text-2xl font-extrabold text-foreground">
                    {(plan.amount || 0).toLocaleString()}
                  </span>{" "}
                  <span className="text-sm font-medium">{plan.currency}</span>
                  <span className="text-xs ml-1 text-muted-foreground">{formatInterval(plan)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {plan.subscriber_count || 0} subscribers
                  </span>
                  {plan.trial_period_days && (
                    <span className="text-xs bg-muted rounded px-1.5 py-0.5">
                      {plan.trial_period_days}d trial
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(plan)} className="gap-1 flex-1">
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleActive(plan)}
                    className="flex-1"
                  >
                    {plan.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive px-2"
                    onClick={() => handleDelete(plan)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "New Payment Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Plan Name *</Label>
              <Input
                placeholder="e.g. Monthly Pro, Annual Basic"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="5000"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} placeholder="XAF" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Billing Interval</Label>
                <select
                  className="w-full h-10 border border-input rounded-md px-3 text-sm bg-background"
                  value={form.interval}
                  onChange={e => setForm(f => ({ ...f, interval: e.target.value }))}
                >
                  {INTERVALS.map(i => <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Every (count)</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.interval_count}
                  onChange={e => setForm(f => ({ ...f, interval_count: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Trial Period (days)</Label>
              <Input
                type="number"
                min="0"
                placeholder="Leave blank for no trial"
                value={form.trial_period_days}
                onChange={e => setForm(f => ({ ...f, trial_period_days: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
              <Label>Active (visible to customers)</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.amount}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {editingPlan ? "Update Plan" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
