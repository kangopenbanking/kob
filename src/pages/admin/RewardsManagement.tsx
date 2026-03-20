import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Gift, Users, Settings, Search, Loader2, XCircle, Plus, Save,
  UserPlus, Banknote, ArrowUpDown, CheckCircle2, AlertTriangle
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

// ─── Referrals Tab ──────────────────────────────────────────────────
function ReferralsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["admin-referrals"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_referrals")
        .select("*, referrer:profiles!customer_referrals_referrer_id_fkey(email, full_name), referred:profiles!customer_referrals_referred_id_fkey(email, full_name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const voidReferral = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("customer_referrals")
        .update({ status: "voided" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Referral voided" });
      queryClient.invalidateQueries({ queryKey: ["admin-referrals"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = referrals.filter((r: any) => {
    const matchSearch = !search ||
      r.referrer?.email?.toLowerCase().includes(search.toLowerCase()) ||
      r.referred?.email?.toLowerCase().includes(search.toLowerCase()) ||
      r.referral_code?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by email or code..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referrer</TableHead>
                <TableHead>Referred</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">Bonus</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No referrals found</TableCell></TableRow>
              ) : filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{r.referrer?.email || r.referrer_id?.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm">{r.referred?.email || r.referred_id?.slice(0, 8)}</TableCell>
                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.referral_code}</code></TableCell>
                  <TableCell className="text-right font-medium">{(r.bonus_amount || 0).toLocaleString()} XAF</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "completed" ? "default" : r.status === "voided" ? "destructive" : "secondary"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    {r.status === "completed" && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => voidReferral.mutate(r.id)}>
                        <XCircle className="h-4 w-4 mr-1" /> Void
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Showing {filtered.length} of {referrals.length} referrals</p>
    </div>
  );
}

// ─── Rewards Tab ────────────────────────────────────────────────────
function RewardsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({ user_email: "", amount: 0, description: "" });

  const { data: rewards = [], isLoading } = useQuery({
    queryKey: ["admin-rewards"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_rewards")
        .select("*, profile:profiles!customer_rewards_user_id_fkey(email, full_name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const creditReward = useMutation({
    mutationFn: async (form: typeof manualForm) => {
      // Look up user by email
      const { data: profile } = await supabase.from("profiles").select("id").eq("email", form.user_email).single();
      if (!profile) throw new Error("User not found");
      const { error } = await (supabase as any)
        .from("customer_rewards")
        .insert({
          user_id: profile.id,
          reward_type: "manual_credit",
          amount: form.amount,
          currency: "XAF",
          status: "credited",
          description: form.description || "Manual admin credit",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Reward credited" });
      setShowManual(false);
      setManualForm({ user_email: "", amount: 0, description: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-rewards"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = rewards.filter((r: any) => {
    const matchSearch = !search ||
      r.profile?.email?.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || r.reward_type === typeFilter;
    return matchSearch && matchType;
  });

  const totalCredited = rewards.reduce((s: number, r: any) => s + (r.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Total Rewards</p>
          <p className="text-2xl font-bold">{rewards.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Total Credited</p>
          <p className="text-2xl font-bold">{totalCredited.toLocaleString()} <span className="text-sm text-muted-foreground">XAF</span></p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-end">
          <Button onClick={() => setShowManual(true)} size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Manual Credit</Button>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="cashback">Cashback</SelectItem>
            <SelectItem value="referral_bonus">Referral Bonus</SelectItem>
            <SelectItem value="manual_credit">Manual Credit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No rewards found</TableCell></TableRow>
              ) : filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{r.profile?.email || r.user_id?.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{r.reward_type?.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{(r.amount || 0).toLocaleString()} {r.currency}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "credited" ? "default" : "secondary"}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.description}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showManual} onOpenChange={setShowManual}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Reward Credit</DialogTitle>
            <DialogDescription>Credit a reward to a user's account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>User Email</Label>
              <Input placeholder="user@example.com" value={manualForm.user_email}
                onChange={e => setManualForm(p => ({ ...p, user_email: e.target.value }))} />
            </div>
            <div>
              <Label>Amount (XAF)</Label>
              <Input type="number" value={manualForm.amount}
                onChange={e => setManualForm(p => ({ ...p, amount: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Input placeholder="Reason for credit" value={manualForm.description}
                onChange={e => setManualForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <Button onClick={() => creditReward.mutate(manualForm)} disabled={!manualForm.user_email || manualForm.amount <= 0 || creditReward.isPending}
              className="w-full gap-2">
              {creditReward.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Credit Reward
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Settings Tab ───────────────────────────────────────────────────
function RewardSettingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const configKeys = ["referral_bonus_amount", "cashback_rate", "cashback_min_transfer"];

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["reward-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("*")
        .in("key", configKeys);
      if (error) throw error;
      return data || [];
    },
  });

  const [values, setValues] = useState<Record<string, string>>({});

  // Sync fetched values
  const getVal = (key: string) => values[key] ?? configs.find((c: any) => c.key === key)?.value ?? "";

  const saveConfig = useMutation({
    mutationFn: async () => {
      for (const key of configKeys) {
        const val = values[key];
        if (val !== undefined) {
          const { error } = await supabase
            .from("system_config")
            .update({ value: val, updated_at: new Date().toISOString() })
            .eq("key", key);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Settings saved" });
      queryClient.invalidateQueries({ queryKey: ["reward-settings"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const configMeta: Record<string, { label: string; desc: string; unit: string; icon: any }> = {
    referral_bonus_amount: { label: "Referral Bonus Amount", desc: "Amount credited to both referrer and referred user", unit: "XAF", icon: UserPlus },
    cashback_rate: { label: "Cashback Rate", desc: "Percentage of qualifying transfer amount returned as cashback", unit: "%", icon: Banknote },
    cashback_min_transfer: { label: "Minimum Transfer for Cashback", desc: "Minimum transfer amount to qualify for cashback", unit: "XAF", icon: ArrowUpDown },
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800 dark:text-amber-200">Changes apply immediately to the rewards edge function and customer app.</p>
      </div>

      {configKeys.map(key => {
        const meta = configMeta[key];
        const Icon = meta.icon;
        return (
          <Card key={key}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{meta.label}</CardTitle>
              </div>
              <CardDescription>{meta.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={String(getVal(key) ?? "")}
                  onChange={e => setValues(p => ({ ...p, [key]: e.target.value }))}
                  className="max-w-[200px]"
                />
                <span className="text-sm text-muted-foreground font-medium">{meta.unit}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending} className="gap-2">
        {saveConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save Settings
      </Button>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function RewardsManagement() {
  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Gift} title="Rewards & Referral Management" description="Manage rewards programs, referral campaigns, and point systems" />


      <Tabs defaultValue="referrals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="referrals" className="gap-1.5"><Users className="h-4 w-4" /> Referrals</TabsTrigger>
          <TabsTrigger value="rewards" className="gap-1.5"><Gift className="h-4 w-4" /> Rewards</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Settings className="h-4 w-4" /> Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals"><ReferralsTab /></TabsContent>
        <TabsContent value="rewards"><RewardsTab /></TabsContent>
        <TabsContent value="settings"><RewardSettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
