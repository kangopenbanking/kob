import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Building2, Plug, Activity, Heart, Link2, Plus, CheckCircle, XCircle, RefreshCw, Search } from "lucide-react";

const invokeDirectory = async (action: string, params: any = {}) => {
  const { data, error } = await supabase.functions.invoke("bank-directory", {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  suspended: "bg-destructive/10 text-destructive",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-destructive/10 text-destructive",
  healthy: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  unknown: "bg-muted text-muted-foreground",
};

// ─── Banks Tab ───
function BanksTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ legal_name: "", display_name: "", short_code: "", swift_bic: "", bank_code: "", integration_mode: "connector_push", contact_email: "" });

  const { data, isLoading } = useQuery({ queryKey: ["banks-list"], queryFn: () => invokeDirectory("list_banks", { limit: 200 }) });
  const createMut = useMutation({ mutationFn: (b: any) => invokeDirectory("register_bank", b), onSuccess: () => { qc.invalidateQueries({ queryKey: ["banks-list"] }); setShowCreate(false); toast({ title: "Bank registered" }); } });
  const approveMut = useMutation({ mutationFn: (id: string) => invokeDirectory("approve_bank", { bank_id: id }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["banks-list"] }); toast({ title: "Bank approved" }); } });
  const suspendMut = useMutation({ mutationFn: (id: string) => invokeDirectory("suspend_bank", { bank_id: id }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["banks-list"] }); toast({ title: "Bank suspended" }); } });
  const seedMut = useMutation({ mutationFn: () => invokeDirectory("sandbox_seed_bank"), onSuccess: () => { qc.invalidateQueries({ queryKey: ["banks-list"] }); toast({ title: "Sandbox bank seeded" }); } });

  const banks = (data?.banks || []).filter((b: any) => !search || b.display_name?.toLowerCase().includes(search.toLowerCase()) || b.short_code?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search banks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Button variant="outline" size="sm" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}><RefreshCw className="h-4 w-4 mr-1" />Seed Sandbox</Button>
        <Dialog open={showCreate} onOpenChange={setShowCreate}><DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Register Bank</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Register New Bank</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {(["legal_name", "display_name", "short_code", "swift_bic", "bank_code", "contact_email"] as const).map(f => (
                <div key={f}><Label className="capitalize">{f.replace(/_/g, " ")}</Label><Input value={(form as any)[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} /></div>
              ))}
              <Select value={form.integration_mode} onValueChange={v => setForm(p => ({ ...p, integration_mode: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                {["connector_push", "connector_pull", "file_feed", "hybrid"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent></Select>
              <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.legal_name}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table><TableHeader><TableRow><TableHead>Bank</TableHead><TableHead>Code</TableHead><TableHead>SWIFT</TableHead><TableHead>Mode</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
        <TableBody>{isLoading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow> :
          banks.map((b: any) => (
            <TableRow key={b.id}><TableCell className="font-medium">{b.display_name}</TableCell><TableCell>{b.short_code}</TableCell><TableCell className="text-xs">{b.swift_bic || "—"}</TableCell><TableCell><Badge variant="outline" className="text-xs">{b.integration_mode}</Badge></TableCell>
              <TableCell><Badge className={statusColors[b.status] || ""}>{b.status}</Badge></TableCell>
              <TableCell className="flex gap-1">
                {b.status === "submitted" && <Button size="sm" variant="outline" onClick={() => approveMut.mutate(b.id)}><CheckCircle className="h-3 w-3 mr-1" />Approve</Button>}
                {b.status === "active" && <Button size="sm" variant="outline" onClick={() => suspendMut.mutate(b.id)}><XCircle className="h-3 w-3 mr-1" />Suspend</Button>}
              </TableCell>
            </TableRow>
          ))
        }</TableBody>
      </Table>
    </div>
  );
}

// ─── Connectors Tab ───
function ConnectorsTab() {
  const { data, isLoading } = useQuery({ queryKey: ["bank-connectors"], queryFn: () => invokeDirectory("list_connectors") });
  const connectors = data?.connectors || [];
  return (
    <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Env</TableHead><TableHead>Status</TableHead><TableHead>Last Seen</TableHead><TableHead>Health</TableHead></TableRow></TableHeader>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow> :
        connectors.map((c: any) => (
          <TableRow key={c.id}><TableCell className="font-medium">{c.name}</TableCell><TableCell>{c.connector_type}</TableCell><TableCell><Badge variant="outline">{c.environment}</Badge></TableCell>
            <TableCell><Badge className={statusColors[c.status] || ""}>{c.status}</Badge></TableCell>
            <TableCell className="text-xs text-muted-foreground">{c.last_seen_at ? new Date(c.last_seen_at).toLocaleString() : "Never"}</TableCell>
            <TableCell>{c.bank_connector_health?.[0] ? <Badge className={statusColors[c.bank_connector_health[0].status] || ""}>{c.bank_connector_health[0].status} ({c.bank_connector_health[0].latency_ms}ms)</Badge> : <Badge variant="outline">Unknown</Badge>}</TableCell>
          </TableRow>
        ))
      }</TableBody>
    </Table>
  );
}

// ─── PSU Links Tab ───
function PSULinksTab() {
  const { data, isLoading } = useQuery({ queryKey: ["psu-links"], queryFn: () => invokeDirectory("list_psu_links") });
  const links = data?.links || [];
  return (
    <Table><TableHeader><TableRow><TableHead>User ID</TableHead><TableHead>Bank</TableHead><TableHead>Status</TableHead><TableHead>Linked At</TableHead></TableRow></TableHeader>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading...</TableCell></TableRow> :
        links.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No PSU links yet</TableCell></TableRow> :
        links.map((l: any) => (
          <TableRow key={l.id}><TableCell className="text-xs font-mono">{l.user_id?.slice(0, 8)}...</TableCell>
            <TableCell>{l.banks?.display_name || l.bank_id?.slice(0, 8)}</TableCell>
            <TableCell><Badge className={statusColors[l.status] || ""}>{l.status}</Badge></TableCell>
            <TableCell className="text-xs">{l.linked_at ? new Date(l.linked_at).toLocaleString() : "—"}</TableCell>
          </TableRow>
        ))
      }</TableBody>
    </Table>
  );
}

// ─── Bank Payments Tab ───
function BankPaymentsTab() {
  const { data, isLoading } = useQuery({ queryKey: ["bank-payments-list"], queryFn: () => invokeDirectory("list_bank_payments", { limit: 100 }) });
  const payments = data?.payments || [];
  return (
    <Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Bank</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
      <TableBody>{isLoading ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell></TableRow> :
        payments.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No bank payments yet</TableCell></TableRow> :
        payments.map((p: any) => (
          <TableRow key={p.id}><TableCell className="text-xs font-mono">{p.id?.slice(0, 8)}</TableCell>
            <TableCell>{p.banks?.display_name || "—"}</TableCell>
            <TableCell>{p.currency} {Number(p.amount).toLocaleString()}</TableCell>
            <TableCell><Badge className={statusColors[p.status] || ""}>{p.status}</Badge></TableCell>
            <TableCell className="text-xs">{new Date(p.created_at).toLocaleString()}</TableCell>
          </TableRow>
        ))
      }</TableBody>
    </Table>
  );
}

// ─── Main Page ───
export default function AdminBankDirectory() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bank Directory</h1>
        <p className="text-muted-foreground">Manage bank registrations, connectors, PSU links, and payments</p>
      </div>

      <Tabs defaultValue="banks">
        <TabsList>
          <TabsTrigger value="banks"><Building2 className="h-4 w-4 mr-1" />Banks</TabsTrigger>
          <TabsTrigger value="connectors"><Plug className="h-4 w-4 mr-1" />Connectors</TabsTrigger>
          <TabsTrigger value="health"><Heart className="h-4 w-4 mr-1" />Health</TabsTrigger>
          <TabsTrigger value="psu-links"><Link2 className="h-4 w-4 mr-1" />PSU Links</TabsTrigger>
          <TabsTrigger value="payments"><Activity className="h-4 w-4 mr-1" />Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="banks"><Card><CardHeader><CardTitle>Bank Registry</CardTitle><CardDescription>Register and manage banks in the KOB directory</CardDescription></CardHeader><CardContent><BanksTab /></CardContent></Card></TabsContent>
        <TabsContent value="connectors"><Card><CardHeader><CardTitle>Connector Instances</CardTitle><CardDescription>Bank connector registrations, certificates, and types</CardDescription></CardHeader><CardContent><ConnectorsTab /></CardContent></Card></TabsContent>
        <TabsContent value="health"><Card><CardHeader><CardTitle>Connector Health</CardTitle><CardDescription>Real-time health monitoring for active connectors</CardDescription></CardHeader><CardContent><ConnectorsTab /></CardContent></Card></TabsContent>
        <TabsContent value="psu-links"><Card><CardHeader><CardTitle>PSU ↔ Bank Links</CardTitle><CardDescription>User-to-bank customer mappings</CardDescription></CardHeader><CardContent><PSULinksTab /></CardContent></Card></TabsContent>
        <TabsContent value="payments"><Card><CardHeader><CardTitle>Bank Payments</CardTitle><CardDescription>Payments initiated via bank connectors</CardDescription></CardHeader><CardContent><BankPaymentsTab /></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
