import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Link2, Copy, Plus, ExternalLink, Trash2, Search, CheckCircle2, XCircle, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { API_CONFIG } from "@/config/api";
import { motion } from "framer-motion";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

export default function MerchantPaymentLinks() {
  const [links, setLinks] = useState<any[]>([]);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ title: "", description: "", amount: "", currency: "XAF", redirect_url: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      setMerchantId(m.id);
      const { data } = await supabase.from("gateway_payment_links").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setLinks(data || []);
    }
    setLoading(false);
  };

  const generateSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).substring(2, 8);

  const handleCreate = async () => {
    if (!merchantId || !form.title) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("gateway_payment_links").insert({
        merchant_id: merchantId,
        title: form.title,
        description: form.description || null,
        amount: form.amount ? Number(form.amount) : null,
        currency: form.currency,
        slug: generateSlug(form.title),
        status: "active",
        redirect_url: form.redirect_url || null,
      });
      if (error) throw error;
      toast.success("Payment link created");
      setDialogOpen(false);
      setForm({ title: "", description: "", amount: "", currency: "XAF", redirect_url: "" });
      loadData();
    } catch (err: any) { toast.error(extractEdgeFunctionError(err)); }
    finally { setSaving(false); }
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${API_CONFIG.SITE_URL}/pay/${slug}`);
    toast.success("Payment link copied!");
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("gateway_payment_links").update({ status: current ? "inactive" : "active" }).eq("id", id);
    if (error) { toast.error(extractEdgeFunctionError(error)); return; }
    toast.success(`Link ${current ? "deactivated" : "activated"}`);
    loadData();
  };

  const deleteLink = async (id: string) => {
    const { error } = await supabase.from("gateway_payment_links").delete().eq("id", id);
    if (error) { toast.error(extractEdgeFunctionError(error)); return; }
    toast.success("Payment link deleted");
    loadData();
  };

  const filtered = links.filter(l => {
    if (search && !l.title?.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    return true;
  });

  const activeCount = links.filter(l => l.status === "active").length;
  const inactiveCount = links.filter(l => l.status !== "active").length;
  const totalRevenue = links.reduce((sum, l) => sum + Number(l.amount || 0), 0);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Links</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and share no-code payment pages</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Create Link</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Payment Link</DialogTitle>
              <DialogDescription>Generate a shareable link to collect payments</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Title *</Label><Input placeholder="Product name or payment description" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Description</Label><Input placeholder="Optional details" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2"><Label>Amount (leave empty for flexible)</Label><Input type="number" placeholder="5000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="XAF">XAF</SelectItem>
                      <SelectItem value="XOF">XOF</SelectItem>
                      <SelectItem value="NGN">NGN</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Redirect URL (after payment)</Label><Input placeholder="https://yoursite.com/thank-you" value={form.redirect_url} onChange={e => setForm(f => ({ ...f, redirect_url: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving || !form.title}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create Link</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Stats */}
      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp}
        className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Links" value={links.length.toLocaleString()} icon={<Link2 className="h-5 w-5" />} />
        <StatCard title="Active" value={activeCount.toLocaleString()} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard title="Inactive" value={inactiveCount.toLocaleString()} icon={<XCircle className="h-5 w-5" />} />
        <StatCard title="Fixed Amount Total" value={`${totalRevenue.toLocaleString()} XAF`} icon={<DollarSign className="h-5 w-5" />} />
      </motion.div>

      {/* Filters */}
      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}
        className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by title..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Links List */}
      <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
        {filtered.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="p-0">
              <EmptyState
                icon={<Link2 className="h-6 w-6 text-muted-foreground" />}
                title={search || statusFilter !== "all" ? "No matching links" : "No payment links yet"}
                description="Create your first payment link to start accepting payments without code"
                action={!search && statusFilter === "all" ? { label: "Create Link", onClick: () => setDialogOpen(true) } : undefined}
              />
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/60">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(l => (
                      <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium truncate max-w-[220px]">{l.title}</p>
                            {l.description && <p className="text-xs text-muted-foreground truncate max-w-[220px]">{l.description}</p>}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold">
                          {l.amount ? `${Number(l.amount).toLocaleString()} ${l.currency}` : <span className="text-muted-foreground text-xs">Flexible</span>}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={l.status === "active" ? "default" : "secondary"} className="text-xs">
                            {l.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                          {l.created_at ? format(new Date(l.created_at), "MMM d, yyyy") : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyLink(l.slug)} title="Copy link"><Copy className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(`${API_CONFIG.SITE_URL}/pay/${l.slug}`, "_blank")} title="Open"><ExternalLink className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => toggleActive(l.id, l.status === "active")}>
                              {l.status === "active" ? "Disable" : "Enable"}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteLink(l.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
