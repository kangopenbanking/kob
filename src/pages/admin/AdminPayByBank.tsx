import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CreditCard, Search, RefreshCw, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

type Intent = {
  id: string;
  merchant_id: string;
  merchant_name: string | null;
  amount: number;
  currency: string;
  status: string;
  redirect_uri: string;
  state: string;
  description: string | null;
  customer_user_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  consent_id: string;
};

const statusColors: Record<string, string> = {
  awaiting_auth: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  authorized: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  submitted: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  processing: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  expired: "bg-muted text-muted-foreground",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export default function AdminPayByBank() {
  const tr = useHarvestedT('customer');
  const [intents, setIntents] = useState<Intent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Intent | null>(null);

  const fetchIntents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pay_by_bank_intents" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && data) setIntents(data as unknown as Intent[]);
    setLoading(false);
  };

  useEffect(() => { fetchIntents(); }, []);

  const filtered = intents.filter(i => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (search && !i.merchant_name?.toLowerCase().includes(search.toLowerCase()) && !i.id.includes(search)) return false;
    return true;
  });

  const stats = {
    total: intents.length,
    completed: intents.filter(i => i.status === "completed").length,
    pending: intents.filter(i => ["awaiting_auth", "authorized", "submitted", "processing"].includes(i.status)).length,
    failed: intents.filter(i => ["failed", "expired", "rejected"].includes(i.status)).length,
  };

  return (
    <div>
      <AdminPageHeader title={tr('Pay by Bank')} description={tr('Monitor and manage redirect-based SCA payment intents')} icon={CreditCard} />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Intents", value: stats.total, icon: CreditCard, color: "text-primary" },
            { label: "Completed", value: stats.completed, icon: CheckCircle, color: "text-green-600" },
            { label: "Pending", value: stats.pending, icon: Clock, color: "text-yellow-600" },
            { label: "Failed/Expired", value: stats.failed, icon: XCircle, color: "text-red-600" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                  <div>
                    <p className="text-2xl font-bold">{loading ? "—" : s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={tr('Search by merchant or intent ID...')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tr('All Statuses')}</SelectItem>
              <SelectItem value="awaiting_auth">{tr('Awaiting Auth')}</SelectItem>
              <SelectItem value="authorized">{tr('Authorized')}</SelectItem>
              <SelectItem value="completed">{tr('Completed')}</SelectItem>
              <SelectItem value="failed">{tr('Failed')}</SelectItem>
              <SelectItem value="expired">{tr('Expired')}</SelectItem>
              <SelectItem value="rejected">{tr('Rejected')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchIntents}><RefreshCw className="h-4 w-4" /></Button>
        </div>

        {/* Intent List */}
        <Card>
          <CardHeader><CardTitle className="text-base">{tr('Payment Intents')}</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{tr('No payment intents found')}</p>
            ) : (
              <div className="space-y-2">
                {filtered.map((intent, i) => (
                  <motion.div key={intent.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelected(intent)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{intent.merchant_name || "Unknown Merchant"}</p>
                        <Badge variant="outline" className={statusColors[intent.status] || ""}>{intent.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {intent.currency} {Number(intent.amount).toLocaleString()} • {new Date(intent.created_at).toLocaleString()}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{intent.id.slice(0, 8)}…</p>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{tr('Intent Details')}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground">{tr('Intent ID')}</p><p className="font-mono text-xs break-all">{selected.id}</p></div>
                <div><p className="text-muted-foreground">{tr('Status')}</p><Badge className={statusColors[selected.status]}>{selected.status}</Badge></div>
                <div><p className="text-muted-foreground">{tr('Merchant')}</p><p className="font-medium">{selected.merchant_name || "—"}</p></div>
                <div><p className="text-muted-foreground">{tr('Amount')}</p><p className="font-bold">{selected.currency} {Number(selected.amount).toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">{tr('Consent ID')}</p><p className="font-mono text-xs">{selected.consent_id}</p></div>
                <div><p className="text-muted-foreground">{tr('Customer')}</p><p className="font-mono text-xs">{selected.customer_user_id || "Not yet"}</p></div>
                <div><p className="text-muted-foreground">{tr('Created')}</p><p>{new Date(selected.created_at).toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">{tr('Expires')}</p><p>{new Date(selected.expires_at).toLocaleString()}</p></div>
              </div>
              {selected.description && <div><p className="text-muted-foreground">{tr('Description')}</p><p>{selected.description}</p></div>}
              <div><p className="text-muted-foreground">{tr('Redirect URI')}</p><p className="font-mono text-xs break-all">{selected.redirect_uri}</p></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
