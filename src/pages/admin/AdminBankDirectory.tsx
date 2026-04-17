import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  Building2, Plug, Activity, Heart, Link2, Plus, CheckCircle, XCircle,
  RefreshCw, Search, Upload, FileText, CreditCard, Download, Loader2,
  Globe, Shield, TrendingUp, Users, Database, ArrowUpRight, Clock,
  FolderOpen, AlertTriangle, Server, Wifi, Play, History, TestTube2,
  BookOpen
} from "lucide-react";

const invokeDirectory = async (action: string, params: any = {}) => {
  const { data, error } = await supabase.functions.invoke("bank-directory", {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
};

const invokeFileConnector = async (action: string, params: any = {}) => {
  const { data, error } = await supabase.functions.invoke("bank-file-connector", {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
};

const invokeDbConnector = async (action: string, params: any = {}) => {
  const { data, error } = await supabase.functions.invoke("bank-db-connector", {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
};

const invokeApiConnector = async (action: string, params: any = {}) => {
  const { data, error } = await supabase.functions.invoke("bank-api-connector", {
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
  received: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  validating: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  processed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  running: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  generated: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  delivered: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  executed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  partially_failed: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  reconciled: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.03, duration: 0.25 } }),
};

function TableSkeleton({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: { icon: any; title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-2xl bg-muted/50 p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button size="sm" className="mt-4 gap-2" onClick={onAction}>
          <Plus className="h-4 w-4" />{actionLabel}
        </Button>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`rounded-xl p-2.5 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

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
  const activeBanks = (data?.banks || []).filter((b: any) => b.status === "active").length;
  const pendingBanks = (data?.banks || []).filter((b: any) => b.status === "submitted").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Building2} label="Total Banks" value={data?.banks?.length || 0} color="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle} label="Active" value={activeBanks} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard icon={Clock} label="Pending Approval" value={pendingBanks} color="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search banks by name or code..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
          <Database className="h-4 w-4 mr-1.5" />Seed Sandbox
        </Button>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Register Bank</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Register New Bank</DialogTitle>
              <DialogDescription>Add a new financial institution to the KOB directory</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                {(["legal_name", "display_name", "short_code", "swift_bic", "bank_code", "contact_email"] as const).map(f => (
                  <div key={f} className={f === "legal_name" || f === "contact_email" ? "col-span-2" : ""}>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.replace(/_/g, " ")}</Label>
                    <Input value={(form as any)[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} className="mt-1" />
                  </div>
                ))}
              </div>
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Integration Mode</Label>
                <Select value={form.integration_mode} onValueChange={v => setForm(p => ({ ...p, integration_mode: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {["connector_push", "connector_pull", "file_feed", "db_connector", "mq_realtime", "hybrid"].map(m => (
                      <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.legal_name} className="w-full">
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Register Bank
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Bank</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>SWIFT/BIC</TableHead>
                <TableHead>Integration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton cols={6} /> :
                banks.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><EmptyState icon={Building2} title="No banks found" description="Register your first bank to get started with the connector framework." /></TableCell></TableRow>
                ) :
                banks.map((b: any, i: number) => (
                  <motion.tr key={b.id} variants={rowVariants} initial="hidden" animate="visible" custom={i} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/5 p-2">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{b.display_name}</p>
                          <p className="text-xs text-muted-foreground">{b.legal_name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{b.short_code}</code></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{b.swift_bic || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs font-normal">{b.integration_mode?.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell><Badge className={`${statusColors[b.status] || ""} font-medium`}>{b.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {b.status === "submitted" && <Button size="sm" variant="outline" className="h-8" onClick={() => approveMut.mutate(b.id)}><CheckCircle className="h-3.5 w-3.5 mr-1" />Approve</Button>}
                        {b.status === "active" && <Button size="sm" variant="outline" className="h-8 text-destructive hover:text-destructive" onClick={() => suspendMut.mutate(b.id)}><XCircle className="h-3.5 w-3.5 mr-1" />Suspend</Button>}
                      </div>
                    </TableCell>
                  </motion.tr>
                ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Connectors Tab ───
function ConnectorsTab() {
  const qc = useQueryClient();
  const [showRegister, setShowRegister] = useState(false);
  const [showCert, setShowCert] = useState(false);
  const [connForm, setConnForm] = useState({ bank_id: "", name: "", connector_type: "push", base_url: "", environment: "sandbox" });
  const [certForm, setCertForm] = useState({ bank_id: "", instance_id: "", certificate_pem: "" });

  const { data: banksData } = useQuery({ queryKey: ["banks-list"], queryFn: () => invokeDirectory("list_banks", { limit: 200 }) });
  const banks = banksData?.banks || [];

  const { data, isLoading } = useQuery({ queryKey: ["bank-connectors"], queryFn: () => invokeDirectory("list_connectors") });
  const connectors = data?.connectors || [];

  const registerMut = useMutation({
    mutationFn: (p: any) => invokeDirectory("register_connector", p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-connectors"] }); setShowRegister(false); toast({ title: "Connector registered successfully" }); },
    onError: (e: any) => toast({ title: "Registration failed", description: e.message, variant: "destructive" })
  });

  const certMut = useMutation({
    mutationFn: (p: any) => invokeDirectory("upload_certificate", p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-connectors"] }); setShowCert(false); toast({ title: "Certificate uploaded successfully" }); },
    onError: (e: any) => toast({ title: "Upload failed", description: e.message, variant: "destructive" })
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Plug} label="Total Connectors" value={connectors.length} color="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle} label="Active" value={connectors.filter((c: any) => c.status === "active").length} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard icon={Activity} label="Healthy" value={connectors.filter((c: any) => c.bank_connector_health?.[0]?.status === "healthy").length} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" />
      </div>

      <div className="flex items-center gap-3">
        <Dialog open={showRegister} onOpenChange={setShowRegister}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Register Connector</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Register Connector Instance</DialogTitle>
              <DialogDescription>Create a new connector instance for a bank partner</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bank</Label>
                <Select value={connForm.bank_id} onValueChange={v => setConnForm(p => ({ ...p, bank_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.display_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</Label>
                  <Input value={connForm.name} onChange={e => setConnForm(p => ({ ...p, name: e.target.value }))} className="mt-1" placeholder="e.g. Production Push" />
                </div>
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</Label>
                  <Select value={connForm.connector_type} onValueChange={v => setConnForm(p => ({ ...p, connector_type: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["push", "pull", "file", "db", "mq"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Base URL</Label>
                  <Input value={connForm.base_url} onChange={e => setConnForm(p => ({ ...p, base_url: e.target.value }))} className="mt-1" placeholder="https://..." />
                </div>
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Environment</Label>
                  <Select value={connForm.environment} onValueChange={v => setConnForm(p => ({ ...p, environment: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox</SelectItem>
                      <SelectItem value="prod">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => registerMut.mutate(connForm)} disabled={registerMut.isPending || !connForm.bank_id || !connForm.name} className="w-full">
                {registerMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Register Connector
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showCert} onOpenChange={setShowCert}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Shield className="h-4 w-4 mr-1.5" />Upload Certificate</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload mTLS Certificate</DialogTitle>
              <DialogDescription>Upload an X.509 certificate for mutual TLS authentication</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bank</Label>
                <Select value={certForm.bank_id} onValueChange={v => setCertForm(p => ({ ...p, bank_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.display_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Connector Instance</Label>
                <Select value={certForm.instance_id} onValueChange={v => setCertForm(p => ({ ...p, instance_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select connector" /></SelectTrigger>
                  <SelectContent>
                    {connectors.filter((c: any) => c.bank_id === certForm.bank_id).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Certificate PEM</Label>
                <Textarea rows={6} value={certForm.certificate_pem} onChange={e => setCertForm(p => ({ ...p, certificate_pem: e.target.value }))} className="mt-1 font-mono text-xs" placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"} />
              </div>
              <Button onClick={() => certMut.mutate(certForm)} disabled={certMut.isPending || !certForm.instance_id || !certForm.certificate_pem} className="w-full">
                {certMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                Upload Certificate
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Connector</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Health</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton cols={6} /> :
                connectors.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><EmptyState icon={Plug} title="No connectors registered" description="Register a connector instance to start integrating with a bank partner." /></TableCell></TableRow>
                ) :
                connectors.map((c: any, i: number) => (
                  <motion.tr key={c.id} variants={rowVariants} initial="hidden" animate="visible" custom={i} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/30 p-2">
                          <Plug className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="font-normal">{c.connector_type}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="font-normal">{c.environment}</Badge></TableCell>
                    <TableCell><Badge className={statusColors[c.status] || ""}>{c.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.last_seen_at ? new Date(c.last_seen_at).toLocaleString() : "Never"}</TableCell>
                    <TableCell>
                      {c.bank_connector_health?.[0] ? (
                        <Badge className={`${statusColors[c.bank_connector_health[0].status] || ""} gap-1`}>
                          {c.bank_connector_health[0].status === "healthy" ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          {c.bank_connector_health[0].status} · {c.bank_connector_health[0].latency_ms}ms
                        </Badge>
                      ) : <Badge variant="outline" className="text-muted-foreground">Unknown</Badge>}
                    </TableCell>
                  </motion.tr>
                ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── DB Connectors Tab ───
function DBConnectorsTab() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    bank_id: "", name: "", db_type: "postgresql", host: "", port: "5432", database: "",
    username: "", ssl_enabled: true, poll_interval_seconds: "300", watermark_column: "updated_at",
    poll_query_accounts: "", poll_query_transactions: "", poll_query_balances: ""
  });

  const { data: banksData } = useQuery({ queryKey: ["banks-list"], queryFn: () => invokeDirectory("list_banks", { limit: 200 }) });
  const banks = banksData?.banks || [];

  const { data, isLoading } = useQuery({
    queryKey: ["db-connections"],
    queryFn: () => invokeDbConnector("list_connections")
  });
  const connections = data?.connections || [];

  const { data: runsData } = useQuery({
    queryKey: ["db-sync-runs"],
    queryFn: () => invokeDbConnector("list_sync_runs", { limit: 50 })
  });
  const runs = runsData?.runs || [];

  const createMut = useMutation({
    mutationFn: (p: any) => invokeDbConnector("register_connection", {
      ...p, port: Number(p.port), poll_interval_seconds: Number(p.poll_interval_seconds),
      connection_config_encrypted: { host: p.host, port: Number(p.port), database: p.database, username: p.username, ssl: p.ssl_enabled }
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["db-connections"] }); setShowCreate(false); toast({ title: "DB connection registered successfully" }); },
    onError: (e: any) => toast({ title: "Registration failed", description: e.message, variant: "destructive" })
  });

  const testMut = useMutation({
    mutationFn: (id: string) => invokeDbConnector("test_connection", { connection_id: id }),
    onSuccess: (d) => {
      const ok = d?.success === true || d?.reachable === true;
      const desc = ok
        ? `${d?.host ?? "host"} • ${d?.latency_ms ?? 0}ms${d?.bridge_probed ? " • bridge OK" : ""}`
        : (d?.probe_error || d?.note || "Bridge unreachable. Check connection_config.bridge_url.");
      toast({
        title: ok ? "Connection test passed" : "Connection test failed",
        description: desc,
        variant: ok ? "default" : "destructive",
      });
    },
    onError: (e: any) => toast({ title: "Test failed", description: e.message, variant: "destructive" })
  });

  const syncMut = useMutation({
    mutationFn: (id: string) => invokeDbConnector("trigger_sync", { connection_id: id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["db-sync-runs"] }); toast({ title: "Sync triggered — check history for results" }); },
    onError: (e: any) => toast({ title: "Sync failed", description: e.message, variant: "destructive" })
  });

  const seedMut = useMutation({
    mutationFn: () => invokeDbConnector("sandbox_seed_db_connector"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["db-connections"] }); toast({ title: "Sandbox DB connector seeded" }); }
  });

  const activeConns = connections.filter((c: any) => c.is_active).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Database} label="Total Connections" value={connections.length} color="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle} label="Active" value={activeConns} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard icon={History} label="Sync Runs" value={runs.length} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
      </div>

      <div className="flex items-center gap-3">
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Register DB Connection</Button></DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Register Database Connection</DialogTitle>
              <DialogDescription>Configure a read-only database replica for watermark-based incremental sync</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bank</Label>
                  <Select value={form.bank_id} onValueChange={v => setForm(p => ({ ...p, bank_id: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select bank" /></SelectTrigger>
                    <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.display_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Connection Name</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-1" placeholder="e.g. Prod Read Replica" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">DB Type</Label>
                  <Select value={form.db_type} onValueChange={v => setForm(p => ({ ...p, db_type: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["postgresql", "mysql", "mssql", "oracle", "mongodb"].map(t => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Host</Label>
                  <Input value={form.host} onChange={e => setForm(p => ({ ...p, host: e.target.value }))} className="mt-1" placeholder="db.bank.cm" />
                </div>
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Port</Label>
                  <Input value={form.port} onChange={e => setForm(p => ({ ...p, port: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Database</Label>
                  <Input value={form.database} onChange={e => setForm(p => ({ ...p, database: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Username</Label>
                  <Input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Poll Interval (seconds)</Label>
                  <Input value={form.poll_interval_seconds} onChange={e => setForm(p => ({ ...p, poll_interval_seconds: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Watermark Column</Label>
                  <Input value={form.watermark_column} onChange={e => setForm(p => ({ ...p, watermark_column: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Poll Query — Accounts (optional)</Label>
                <Textarea rows={2} value={form.poll_query_accounts} onChange={e => setForm(p => ({ ...p, poll_query_accounts: e.target.value }))} className="mt-1 font-mono text-xs" placeholder="SELECT * FROM accounts WHERE updated_at > :watermark" />
              </div>
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Poll Query — Transactions (optional)</Label>
                <Textarea rows={2} value={form.poll_query_transactions} onChange={e => setForm(p => ({ ...p, poll_query_transactions: e.target.value }))} className="mt-1 font-mono text-xs" placeholder="SELECT * FROM transactions WHERE updated_at > :watermark" />
              </div>
              <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.bank_id || !form.name || !form.host} className="w-full">
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Register Connection
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="sm" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
          <TestTube2 className="h-4 w-4 mr-1.5" />Seed Sandbox
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Database Connections</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Connection</TableHead>
                <TableHead>DB Type</TableHead>
                <TableHead>Poll Interval</TableHead>
                <TableHead>Last Poll</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton cols={6} /> :
                connections.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><EmptyState icon={Database} title="No DB connections" description="Register a database connection to enable watermark-based sync." /></TableCell></TableRow>
                ) :
                connections.map((c: any, i: number) => (
                  <motion.tr key={c.id} variants={rowVariants} initial="hidden" animate="visible" custom={i} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-orange-100 dark:bg-orange-900/30 p-2">
                          <Server className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.banks?.display_name || c.bank_id?.slice(0, 8)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="font-normal">{c.db_type?.toUpperCase()}</Badge></TableCell>
                    <TableCell className="text-sm">{c.poll_interval_seconds}s</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.last_poll_at ? new Date(c.last_poll_at).toLocaleString() : "Never"}</TableCell>
                    <TableCell>
                      <Badge className={c.is_active ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}>
                        {c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="h-8" onClick={() => testMut.mutate(c.id)} disabled={testMut.isPending}>
                          <TestTube2 className="h-3.5 w-3.5 mr-1" />Test
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={() => syncMut.mutate(c.id)} disabled={syncMut.isPending}>
                          <Play className="h-3.5 w-3.5 mr-1" />Sync
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {runs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" />Sync Run History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Run ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Accounts</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Balances</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r: any, i: number) => (
                  <motion.tr key={r.id} variants={rowVariants} initial="hidden" animate="visible" custom={i} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{r.id?.slice(0, 10)}</code></TableCell>
                    <TableCell><Badge className={`${statusColors[r.status] || ""} font-medium`}>{r.status}</Badge></TableCell>
                    <TableCell className="font-semibold">{r.accounts_synced ?? 0}</TableCell>
                    <TableCell className="font-semibold">{r.transactions_synced ?? 0}</TableCell>
                    <TableCell className="font-semibold">{r.balances_synced ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.started_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.completed_at ? new Date(r.completed_at).toLocaleString() : "—"}</TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── API Connectors Tab ───
function APIConnectorsTab() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    bank_id: "", name: "", base_url: "", auth_method: "api_key", environment: "sandbox",
    poll_interval_seconds: "300", path_accounts: "/accounts", path_transactions: "/transactions",
    path_balances: "/balances", path_health: "/health"
  });

  const { data: banksData } = useQuery({ queryKey: ["banks-list"], queryFn: () => invokeDirectory("list_banks", { limit: 200 }) });
  const banks = banksData?.banks || [];

  const { data, isLoading } = useQuery({
    queryKey: ["api-endpoints"],
    queryFn: () => invokeApiConnector("list_endpoints")
  });
  const endpoints = data?.endpoints || [];

  const { data: runsData } = useQuery({
    queryKey: ["api-pull-runs"],
    queryFn: () => invokeApiConnector("list_pull_runs", { limit: 50 })
  });
  const runs = runsData?.runs || [];

  const createMut = useMutation({
    mutationFn: (p: any) => invokeApiConnector("register_endpoint", {
      bank_id: p.bank_id, name: p.name, base_url: p.base_url, auth_method: p.auth_method,
      environment: p.environment, poll_interval_seconds: Number(p.poll_interval_seconds),
      paths: { accounts: p.path_accounts, transactions: p.path_transactions, balances: p.path_balances, health: p.path_health }
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api-endpoints"] }); setShowCreate(false); toast({ title: "API endpoint registered successfully" }); },
    onError: (e: any) => toast({ title: "Registration failed", description: e.message, variant: "destructive" })
  });

  const testMut = useMutation({
    mutationFn: (id: string) => invokeApiConnector("test_endpoint", { endpoint_id: id }),
    onSuccess: (d) => {
      const ok = d?.success === true || d?.reachable === true;
      const desc = ok
        ? `HTTP ${d?.status ?? "200"} • ${d?.latency_ms ?? 0}ms`
        : (d?.error || `HTTP ${d?.status ?? "—"} from /health endpoint`);
      toast({
        title: ok ? "Endpoint test passed" : "Endpoint test failed",
        description: desc,
        variant: ok ? "default" : "destructive",
      });
    },
    onError: (e: any) => toast({ title: "Test failed", description: e.message, variant: "destructive" })
  });

  const pullMut = useMutation({
    mutationFn: (id: string) => invokeApiConnector("trigger_pull", { endpoint_id: id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api-pull-runs"] }); toast({ title: "Pull triggered — check history for results" }); },
    onError: (e: any) => toast({ title: "Pull failed", description: e.message, variant: "destructive" })
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Globe} label="Total Endpoints" value={endpoints.length} color="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle} label="Active" value={endpoints.filter((e: any) => e.is_active).length} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard icon={History} label="Pull Runs" value={runs.length} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
      </div>

      <div className="flex items-center gap-3">
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Register API Endpoint</Button></DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Register API Endpoint</DialogTitle>
              <DialogDescription>Configure a connector_pull REST API endpoint for data polling</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bank</Label>
                  <Select value={form.bank_id} onValueChange={v => setForm(p => ({ ...p, bank_id: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select bank" /></SelectTrigger>
                    <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.display_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Endpoint Name</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-1" placeholder="e.g. Production API" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Base URL</Label>
                <Input value={form.base_url} onChange={e => setForm(p => ({ ...p, base_url: e.target.value }))} className="mt-1" placeholder="https://api.bank.cm/v1" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Auth Method</Label>
                  <Select value={form.auth_method} onValueChange={v => setForm(p => ({ ...p, auth_method: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["api_key", "oauth2", "basic", "bearer", "mtls"].map(a => <SelectItem key={a} value={a}>{a.replace(/_/g, " ").toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Environment</Label>
                  <Select value={form.environment} onValueChange={v => setForm(p => ({ ...p, environment: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox</SelectItem>
                      <SelectItem value="prod">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Poll Interval (s)</Label>
                  <Input value={form.poll_interval_seconds} onChange={e => setForm(p => ({ ...p, poll_interval_seconds: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["path_accounts", "path_transactions", "path_balances", "path_health"] as const).map(f => (
                  <div key={f}>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.replace("path_", "")} Path</Label>
                    <Input value={(form as any)[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} className="mt-1" />
                  </div>
                ))}
              </div>
              <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.bank_id || !form.name || !form.base_url} className="w-full">
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Register Endpoint
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">API Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Endpoint</TableHead>
                <TableHead>Auth</TableHead>
                <TableHead>Poll Interval</TableHead>
                <TableHead>Last Poll</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton cols={6} /> :
                endpoints.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><EmptyState icon={Globe} title="No API endpoints" description="Register a REST API endpoint to enable connector_pull data sync." /></TableCell></TableRow>
                ) :
                endpoints.map((e: any, i: number) => (
                  <motion.tr key={e.id} variants={rowVariants} initial="hidden" animate="visible" custom={i} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-sky-100 dark:bg-sky-900/30 p-2">
                          <Wifi className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                        </div>
                        <div>
                          <p className="font-medium">{e.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{e.base_url}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="font-normal">{e.auth_method?.toUpperCase()}</Badge></TableCell>
                    <TableCell className="text-sm">{e.poll_interval_seconds}s</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.last_poll_at ? new Date(e.last_poll_at).toLocaleString() : "Never"}</TableCell>
                    <TableCell>
                      <Badge className={e.is_active ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}>
                        {e.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="h-8" onClick={() => testMut.mutate(e.id)} disabled={testMut.isPending}>
                          <TestTube2 className="h-3.5 w-3.5 mr-1" />Test
                        </Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={() => pullMut.mutate(e.id)} disabled={pullMut.isPending}>
                          <Play className="h-3.5 w-3.5 mr-1" />Pull
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {runs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" />Pull Run History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Run ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Accounts</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Balances</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r: any, i: number) => (
                  <motion.tr key={r.id} variants={rowVariants} initial="hidden" animate="visible" custom={i} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{r.id?.slice(0, 10)}</code></TableCell>
                    <TableCell><Badge className={`${statusColors[r.status] || ""} font-medium`}>{r.status}</Badge></TableCell>
                    <TableCell className="font-semibold">{r.accounts_synced ?? 0}</TableCell>
                    <TableCell className="font-semibold">{r.transactions_synced ?? 0}</TableCell>
                    <TableCell className="font-semibold">{r.balances_synced ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.started_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.completed_at ? new Date(r.completed_at).toLocaleString() : "—"}</TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── PSU Links Tab ───
function PSULinksTab() {
  const { data, isLoading } = useQuery({ queryKey: ["psu-links"], queryFn: () => invokeDirectory("list_psu_links") });
  const links = data?.links || [];

  return (
    <div className="space-y-6">
      <StatCard icon={Users} label="Total PSU Links" value={links.length} color="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>User</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Linked At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton cols={4} /> :
                links.length === 0 ? (
                  <TableRow><TableCell colSpan={4}><EmptyState icon={Link2} title="No PSU links" description="User-to-bank mappings will appear here once users link their accounts." /></TableCell></TableRow>
                ) :
                links.map((l: any, i: number) => (
                  <motion.tr key={l.id} variants={rowVariants} initial="hidden" animate="visible" custom={i} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{l.user_id?.slice(0, 12)}...</code></TableCell>
                    <TableCell className="font-medium">{l.banks?.display_name || l.bank_id?.slice(0, 8)}</TableCell>
                    <TableCell><Badge className={statusColors[l.status] || ""}>{l.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.linked_at ? new Date(l.linked_at).toLocaleString() : "—"}</TableCell>
                  </motion.tr>
                ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Bank Payments Tab ───
function BankPaymentsTab() {
  const { data, isLoading } = useQuery({ queryKey: ["bank-payments-list"], queryFn: () => invokeDirectory("list_bank_payments", { limit: 100 }) });
  const payments = data?.payments || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={CreditCard} label="Total Payments" value={payments.length} color="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle} label="Completed" value={payments.filter((p: any) => p.status === "completed" || p.status === "executed").length} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard icon={TrendingUp} label="Total Volume" value={`XAF ${payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0).toLocaleString()}`} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Payment ID</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton cols={5} /> :
                payments.length === 0 ? (
                  <TableRow><TableCell colSpan={5}><EmptyState icon={CreditCard} title="No bank payments" description="Payments initiated via bank connectors will appear here." /></TableCell></TableRow>
                ) :
                payments.map((p: any, i: number) => (
                  <motion.tr key={p.id} variants={rowVariants} initial="hidden" animate="visible" custom={i} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{p.id?.slice(0, 12)}</code></TableCell>
                    <TableCell className="font-medium">{p.banks?.display_name || "—"}</TableCell>
                    <TableCell className="font-semibold">{p.currency} {Number(p.amount).toLocaleString()}</TableCell>
                    <TableCell><Badge className={statusColors[p.status] || ""}>{p.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</TableCell>
                  </motion.tr>
                ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── File Imports Tab ───
function FileImportsTab() {
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ bank_id: "", file_type: "accounts", environment: "sandbox", file_content: "", filename: "" });

  const { data: banksData } = useQuery({ queryKey: ["banks-list"], queryFn: () => invokeDirectory("list_banks", { limit: 200 }) });
  const banks = banksData?.banks || [];

  const { data: filesData, isLoading } = useQuery({ queryKey: ["bank-files"], queryFn: () => invokeFileConnector("list_files") });
  const files = filesData?.files || [];

  const uploadMut = useMutation({
    mutationFn: (params: any) => invokeFileConnector("upload_file", params),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-files"] }); setShowUpload(false); toast({ title: "File uploaded successfully" }); },
    onError: (e: any) => toast({ title: "Upload failed", description: e.message, variant: "destructive" })
  });

  const ingestMut = useMutation({
    mutationFn: (fileId: string) => invokeFileConnector("run_ingestion", { file_id: fileId }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["bank-files"] });
      toast({ title: "Ingestion complete", description: `${data.totals.rows_ok} OK, ${data.totals.rows_invalid} invalid, ${data.totals.rows_duplicate} duplicate` });
    },
    onError: (e: any) => toast({ title: "Ingestion failed", description: e.message, variant: "destructive" })
  });

  const sandboxMut = useMutation({
    mutationFn: (bankId: string) => invokeFileConnector("generate_sandbox_files", { bank_id: bankId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-files"] }); toast({ title: "Sandbox files generated" }); }
  });

  const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadForm(p => ({ ...p, file_content: reader.result as string, filename: file.name }));
    };
    reader.readAsText(file);
  };

  const processedCount = files.filter((f: any) => f.status === "processed").length;
  const failedCount = files.filter((f: any) => f.status === "failed").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Total Files" value={files.length} color="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle} label="Processed" value={processedCount} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard icon={AlertTriangle} label="Failed" value={failedCount} color="bg-destructive/10 text-destructive" />
        <StatCard icon={Clock} label="Pending" value={files.filter((f: any) => f.status === "received").length} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
      </div>

      <div className="flex items-center gap-3">
        <Dialog open={showUpload} onOpenChange={setShowUpload}>
          <DialogTrigger asChild>
            <Button size="sm"><Upload className="h-4 w-4 mr-1.5" />Upload File</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Bank File</DialogTitle>
              <DialogDescription>Upload a CSV file from a bank for ingestion into the system</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bank</Label>
                <Select value={uploadForm.bank_id} onValueChange={v => setUploadForm(p => ({ ...p, bank_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.display_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">File Type</Label>
                  <Select value={uploadForm.file_type} onValueChange={v => setUploadForm(p => ({ ...p, file_type: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["accounts", "balances", "transactions", "beneficiaries", "payment_status"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Environment</Label>
                  <Select value={uploadForm.environment} onValueChange={v => setUploadForm(p => ({ ...p, environment: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox</SelectItem>
                      <SelectItem value="prod">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CSV File</Label>
                <div className="mt-1 border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Input type="file" accept=".csv" onChange={handleFileRead} className="opacity-0 absolute inset-0 cursor-pointer" />
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{uploadForm.filename || "Click or drag to upload CSV"}</p>
                </div>
              </div>
              <Button onClick={() => uploadMut.mutate(uploadForm)} disabled={uploadMut.isPending || !uploadForm.bank_id || !uploadForm.file_content} className="w-full">
                {uploadMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Upload & Register
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {banks.length > 0 && (
          <Select onValueChange={v => sandboxMut.mutate(v)}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Generate sandbox files..." /></SelectTrigger>
            <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.display_name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>File</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Env</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton cols={8} /> :
                files.length === 0 ? (
                  <TableRow><TableCell colSpan={8}><EmptyState icon={FolderOpen} title="No files uploaded" description="Upload CSV files from partner banks or generate sandbox test files." /></TableCell></TableRow>
                ) :
                files.map((f: any, i: number) => (
                  <motion.tr key={f.id} variants={rowVariants} initial="hidden" animate="visible" custom={i} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs max-w-[180px] truncate">{f.original_filename}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{f.banks?.display_name || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs font-normal">{f.file_type}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="text-xs font-normal">{f.environment}</Badge></TableCell>
                    <TableCell><Badge className={`${statusColors[f.status] || ""} font-medium`}>{f.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.file_size ? `${(f.file_size / 1024).toFixed(1)} KB` : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(f.received_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {(f.status === "received" || f.status === "failed") && (
                          <Button size="sm" variant="outline" className="h-8" onClick={() => ingestMut.mutate(f.id)} disabled={ingestMut.isPending}>
                            <RefreshCw className="h-3.5 w-3.5 mr-1" />Ingest
                          </Button>
                        )}
                        {f.status === "processed" && f.error_summary && (
                          <Button size="sm" variant="outline" className="h-8" onClick={async () => {
                            await invokeFileConnector("download_errors", { file_id: f.id });
                            toast({ title: "Error rows downloaded" });
                          }}><Download className="h-3.5 w-3.5 mr-1" />Errors</Button>
                        )}
                      </div>
                    </TableCell>
                  </motion.tr>
                ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Batch Payments Tab ───
function BatchPaymentsTab() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [batchForm, setBatchForm] = useState({ bank_id: "", batch_type: "outgoing_transfers", items_text: "" });
  const [showStatusUpload, setShowStatusUpload] = useState(false);
  const [statusUpload, setStatusUpload] = useState({ bank_id: "", file_content: "", filename: "" });

  const { data: banksData } = useQuery({ queryKey: ["banks-list"], queryFn: () => invokeDirectory("list_banks", { limit: 200 }) });
  const banks = banksData?.banks || [];

  const { data: batchesData, isLoading } = useQuery({ queryKey: ["bank-batches"], queryFn: () => invokeFileConnector("list_batches") });
  const batches = batchesData?.batches || [];

  const createBatchMut = useMutation({
    mutationFn: (params: any) => invokeFileConnector("create_batch", params),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-batches"] }); setShowCreate(false); toast({ title: "Batch created" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" })
  });

  const generateFileMut = useMutation({
    mutationFn: ({ batch_id, format }: { batch_id: string; format: string }) => invokeFileConnector("generate_batch_file", { batch_id, format }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank-batches"] }); toast({ title: "File generated" }); }
  });

  const ingestStatusMut = useMutation({
    mutationFn: async (params: any) => {
      const uploadResult = await invokeFileConnector("upload_file", {
        bank_id: params.bank_id, file_type: "payment_status", environment: "sandbox",
        file_content: params.file_content, filename: params.filename
      });
      return invokeFileConnector("ingest_status_file", { file_id: uploadResult.file.id });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["bank-batches"] }); setShowStatusUpload(false);
      toast({ title: "Status file processed", description: `${data.summary.executed} executed, ${data.summary.failed} failed, ${data.summary.unmatched} unmatched` });
    }
  });

  const handleCreateBatch = () => {
    try {
      const lines = batchForm.items_text.trim().split("\n").filter(Boolean);
      const items = lines.map(line => {
        const [beneficiary_name, beneficiary_account_number, beneficiary_bank_code, amount, narration] = line.split(",").map(s => s.trim());
        return { beneficiary_name, beneficiary_account_number, beneficiary_bank_code, amount: Number(amount), currency: "XAF", narration };
      });
      createBatchMut.mutate({ bank_id: batchForm.bank_id, batch_type: batchForm.batch_type, items });
    } catch {
      toast({ title: "Invalid items format", variant: "destructive" });
    }
  };

  const handleStatusFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setStatusUpload(p => ({ ...p, file_content: reader.result as string, filename: file.name }));
    reader.readAsText(file);
  };

  const totalVolume = batches.reduce((s: number, b: any) => s + Number(b.totals_json?.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={CreditCard} label="Total Batches" value={batches.length} color="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle} label="Executed" value={batches.filter((b: any) => b.status === "executed" || b.status === "reconciled").length} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard icon={TrendingUp} label="Total Volume" value={`XAF ${totalVolume.toLocaleString()}`} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
      </div>

      <div className="flex items-center gap-3">
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Create Batch</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Batch Payment</DialogTitle>
              <DialogDescription>Create a new batch payment instruction for bank processing</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bank</Label>
                <Select value={batchForm.bank_id} onValueChange={v => setBatchForm(p => ({ ...p, bank_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.display_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Batch Type</Label>
                <Select value={batchForm.batch_type} onValueChange={v => setBatchForm(p => ({ ...p, batch_type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outgoing_transfers">Outgoing Transfers</SelectItem>
                    <SelectItem value="salary">Salary</SelectItem>
                    <SelectItem value="merchant_payouts">Merchant Payouts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Items (name, account, bank_code, amount, narration — one per line)</Label>
                <Textarea rows={5} placeholder="Jean Kamga, 100001234, AFRILAND, 50000, Salary March" value={batchForm.items_text} onChange={e => setBatchForm(p => ({ ...p, items_text: e.target.value }))} className="mt-1 font-mono text-xs" />
              </div>
              <Button onClick={handleCreateBatch} disabled={createBatchMut.isPending || !batchForm.bank_id || !batchForm.items_text} className="w-full">
                {createBatchMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Batch
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={showStatusUpload} onOpenChange={setShowStatusUpload}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Upload className="h-4 w-4 mr-1.5" />Upload Status File</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Bank Status File</DialogTitle>
              <DialogDescription>Upload an execution status file returned by the bank</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bank</Label>
                <Select value={statusUpload.bank_id} onValueChange={v => setStatusUpload(p => ({ ...p, bank_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.display_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status CSV File</Label>
                <Input type="file" accept=".csv" onChange={handleStatusFileRead} className="mt-1" />
              </div>
              <Button onClick={() => ingestStatusMut.mutate(statusUpload)} disabled={ingestStatusMut.isPending || !statusUpload.bank_id || !statusUpload.file_content} className="w-full">
                {ingestStatusMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Upload & Process
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Batch ID</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton cols={8} /> :
                batches.length === 0 ? (
                  <TableRow><TableCell colSpan={8}><EmptyState icon={CreditCard} title="No batches yet" description="Create your first batch payment instruction to generate bank files." /></TableCell></TableRow>
                ) :
                batches.map((b: any, i: number) => (
                  <motion.tr key={b.id} variants={rowVariants} initial="hidden" animate="visible" custom={i} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{b.id?.slice(0, 10)}</code></TableCell>
                    <TableCell className="font-medium">{b.banks?.display_name || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs font-normal">{b.batch_type?.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="font-semibold">{b.totals_json?.count || 0}</TableCell>
                    <TableCell className="font-semibold">XAF {Number(b.totals_json?.total_amount || 0).toLocaleString()}</TableCell>
                    <TableCell><Badge className={`${statusColors[b.status] || ""} font-medium`}>{b.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {b.status === "draft" && (
                          <>
                            <Button size="sm" variant="outline" className="h-8" onClick={() => generateFileMut.mutate({ batch_id: b.id, format: "csv" })} disabled={generateFileMut.isPending}>CSV</Button>
                            <Button size="sm" variant="outline" className="h-8" onClick={() => generateFileMut.mutate({ batch_id: b.id, format: "pain001" })} disabled={generateFileMut.isPending}>pain.001</Button>
                          </>
                        )}
                        {b.file_id && (
                          <Button size="sm" variant="outline" className="h-8" onClick={async () => {
                            const result = await invokeFileConnector("download_batch_file", { batch_id: b.id });
                            if (result?.url) window.open(result.url, '_blank');
                          }}><Download className="h-3.5 w-3.5" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </motion.tr>
                ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ───
export default function AdminBankDirectory() {
  const guideUrl = "/docs/KOB_Bank_Integration_Guide.pdf";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <AdminPageHeader icon={Building2} title="Bank Directory" description="Manage bank registrations, connectors, DB sync, API polling, file imports, batch payments & PSU links" />
        <Button variant="outline" size="sm" asChild>
          <a href="https://wdzkzeahdtxlynetndqw.supabase.co/storage/v1/object/public/bank-files/KOB_Bank_Integration_Guide.pdf" target="_blank" rel="noopener noreferrer">
            <BookOpen className="h-4 w-4 mr-1.5" />Integration Guide
          </a>
        </Button>
      </div>

      <Tabs defaultValue="banks" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="banks" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Building2 className="h-4 w-4" />Banks
          </TabsTrigger>
          <TabsTrigger value="connectors" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Plug className="h-4 w-4" />Connectors
          </TabsTrigger>
          <TabsTrigger value="db-connectors" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Database className="h-4 w-4" />DB Connectors
          </TabsTrigger>
          <TabsTrigger value="api-connectors" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Globe className="h-4 w-4" />API Connectors
          </TabsTrigger>
          <TabsTrigger value="psu-links" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Link2 className="h-4 w-4" />PSU Links
          </TabsTrigger>
          <TabsTrigger value="payments" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Activity className="h-4 w-4" />Payments
          </TabsTrigger>
          <TabsTrigger value="file-imports" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4" />File Imports
          </TabsTrigger>
          <TabsTrigger value="batch-payments" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <CreditCard className="h-4 w-4" />Batch Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="banks"><BanksTab /></TabsContent>
        <TabsContent value="connectors"><ConnectorsTab /></TabsContent>
        <TabsContent value="db-connectors"><DBConnectorsTab /></TabsContent>
        <TabsContent value="api-connectors"><APIConnectorsTab /></TabsContent>
        <TabsContent value="psu-links"><PSULinksTab /></TabsContent>
        <TabsContent value="payments"><BankPaymentsTab /></TabsContent>
        <TabsContent value="file-imports"><FileImportsTab /></TabsContent>
        <TabsContent value="batch-payments"><BatchPaymentsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
