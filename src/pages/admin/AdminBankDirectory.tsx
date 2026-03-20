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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Building2, Plug, Activity, Heart, Link2, Plus, CheckCircle, XCircle, RefreshCw, Search, Upload, FileText, CreditCard, Download } from "lucide-react";

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

// ─── File Imports Tab ───
function FileImportsTab() {
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ bank_id: "", file_type: "accounts", environment: "sandbox", file_content: "", filename: "" });

  const { data: banksData } = useQuery({ queryKey: ["banks-list"], queryFn: () => invokeDirectory("list_banks", { limit: 200 }) });
  const banks = banksData?.banks || [];

  const { data: filesData, isLoading } = useQuery({
    queryKey: ["bank-files"],
    queryFn: () => invokeFileConnector("list_files")
  });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Dialog open={showUpload} onOpenChange={setShowUpload}>
          <DialogTrigger asChild><Button size="sm"><Upload className="h-4 w-4 mr-1" />Upload File</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Bank File</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Bank</Label>
                <Select value={uploadForm.bank_id} onValueChange={v => setUploadForm(p => ({ ...p, bank_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.display_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>File Type</Label>
                <Select value={uploadForm.file_type} onValueChange={v => setUploadForm(p => ({ ...p, file_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["accounts", "balances", "transactions", "beneficiaries", "payment_status"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Environment</Label>
                <Select value={uploadForm.environment} onValueChange={v => setUploadForm(p => ({ ...p, environment: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="prod">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>CSV File</Label>
                <Input type="file" accept=".csv" onChange={handleFileRead} />
              </div>
              <Button onClick={() => uploadMut.mutate(uploadForm)} disabled={uploadMut.isPending || !uploadForm.bank_id || !uploadForm.file_content}>
                {uploadMut.isPending ? "Uploading..." : "Upload & Register"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {banks.length > 0 && (
          <Select onValueChange={v => sandboxMut.mutate(v)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Generate sandbox..." /></SelectTrigger>
            <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.display_name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Filename</TableHead>
            <TableHead>Bank</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Env</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Received</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading...</TableCell></TableRow> :
            files.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No files uploaded yet</TableCell></TableRow> :
            files.map((f: any) => (
              <TableRow key={f.id}>
                <TableCell className="font-mono text-xs max-w-[200px] truncate">{f.original_filename}</TableCell>
                <TableCell>{f.banks?.display_name || "—"}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{f.file_type}</Badge></TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{f.environment}</Badge></TableCell>
                <TableCell><Badge className={statusColors[f.status] || ""}>{f.status}</Badge></TableCell>
                <TableCell className="text-xs">{f.file_size ? `${(f.file_size / 1024).toFixed(1)} KB` : "—"}</TableCell>
                <TableCell className="text-xs">{new Date(f.received_at).toLocaleString()}</TableCell>
                <TableCell className="flex gap-1">
                  {(f.status === "received" || f.status === "failed") && (
                    <Button size="sm" variant="outline" onClick={() => ingestMut.mutate(f.id)} disabled={ingestMut.isPending}>
                      <RefreshCw className="h-3 w-3 mr-1" />Ingest
                    </Button>
                  )}
                  {f.status === "processed" && f.error_summary && (
                    <Button size="sm" variant="outline" onClick={async () => {
                      const result = await invokeFileConnector("download_errors", { file_id: f.id });
                      toast({ title: "Error rows downloaded" });
                    }}><Download className="h-3 w-3 mr-1" />Errors</Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          }
        </TableBody>
      </Table>
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

  const { data: batchesData, isLoading } = useQuery({
    queryKey: ["bank-batches"],
    queryFn: () => invokeFileConnector("list_batches")
  });
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
      // First upload file
      const uploadResult = await invokeFileConnector("upload_file", {
        bank_id: params.bank_id,
        file_type: "payment_status",
        environment: "sandbox",
        file_content: params.file_content,
        filename: params.filename
      });
      // Then ingest
      return invokeFileConnector("ingest_status_file", { file_id: uploadResult.file.id });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["bank-batches"] });
      setShowStatusUpload(false);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Create Batch</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Batch Payment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Bank</Label>
                <Select value={batchForm.bank_id} onValueChange={v => setBatchForm(p => ({ ...p, bank_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.display_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Batch Type</Label>
                <Select value={batchForm.batch_type} onValueChange={v => setBatchForm(p => ({ ...p, batch_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outgoing_transfers">Outgoing Transfers</SelectItem>
                    <SelectItem value="salary">Salary</SelectItem>
                    <SelectItem value="merchant_payouts">Merchant Payouts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Items (name, account, bank_code, amount, narration — one per line)</Label>
                <Textarea rows={5} placeholder="Jean Kamga, 100001234, AFRILAND, 50000, Salary March" value={batchForm.items_text} onChange={e => setBatchForm(p => ({ ...p, items_text: e.target.value }))} />
              </div>
              <Button onClick={handleCreateBatch} disabled={createBatchMut.isPending || !batchForm.bank_id || !batchForm.items_text}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={showStatusUpload} onOpenChange={setShowStatusUpload}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Upload className="h-4 w-4 mr-1" />Upload Status File</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Bank Status File</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Bank</Label>
                <Select value={statusUpload.bank_id} onValueChange={v => setStatusUpload(p => ({ ...p, bank_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent>{banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.display_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Status CSV File</Label><Input type="file" accept=".csv" onChange={handleStatusFileRead} /></div>
              <Button onClick={() => ingestStatusMut.mutate(statusUpload)} disabled={ingestStatusMut.isPending || !statusUpload.bank_id || !statusUpload.file_content}>
                {ingestStatusMut.isPending ? "Processing..." : "Upload & Process"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Bank</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading...</TableCell></TableRow> :
            batches.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No batches yet</TableCell></TableRow> :
            batches.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.id?.slice(0, 8)}</TableCell>
                <TableCell>{b.banks?.display_name || "—"}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{b.batch_type}</Badge></TableCell>
                <TableCell>{b.totals_json?.count || 0}</TableCell>
                <TableCell className="font-medium">XAF {Number(b.totals_json?.total_amount || 0).toLocaleString()}</TableCell>
                <TableCell><Badge className={statusColors[b.status] || ""}>{b.status}</Badge></TableCell>
                <TableCell className="text-xs">{new Date(b.created_at).toLocaleString()}</TableCell>
                <TableCell className="flex gap-1">
                  {b.status === "draft" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => generateFileMut.mutate({ batch_id: b.id, format: "csv" })} disabled={generateFileMut.isPending}>CSV</Button>
                      <Button size="sm" variant="outline" onClick={() => generateFileMut.mutate({ batch_id: b.id, format: "pain001" })} disabled={generateFileMut.isPending}>pain.001</Button>
                    </>
                  )}
                  {b.file_id && (
                    <Button size="sm" variant="outline" onClick={async () => {
                      const result = await invokeFileConnector("download_batch_file", { batch_id: b.id });
                      if (result?.url) window.open(result.url, '_blank');
                    }}><Download className="h-3 w-3" /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          }
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Main Page ───
export default function AdminBankDirectory() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bank Directory</h1>
        <p className="text-muted-foreground">Manage bank registrations, connectors, file imports, batch payments, and PSU links</p>
      </div>

      <Tabs defaultValue="banks">
        <TabsList className="flex-wrap">
          <TabsTrigger value="banks"><Building2 className="h-4 w-4 mr-1" />Banks</TabsTrigger>
          <TabsTrigger value="connectors"><Plug className="h-4 w-4 mr-1" />Connectors</TabsTrigger>
          <TabsTrigger value="health"><Heart className="h-4 w-4 mr-1" />Health</TabsTrigger>
          <TabsTrigger value="psu-links"><Link2 className="h-4 w-4 mr-1" />PSU Links</TabsTrigger>
          <TabsTrigger value="payments"><Activity className="h-4 w-4 mr-1" />Payments</TabsTrigger>
          <TabsTrigger value="file-imports"><FileText className="h-4 w-4 mr-1" />File Imports</TabsTrigger>
          <TabsTrigger value="batch-payments"><CreditCard className="h-4 w-4 mr-1" />Batch Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="banks"><Card><CardHeader><CardTitle>Bank Registry</CardTitle><CardDescription>Register and manage banks in the KOB directory</CardDescription></CardHeader><CardContent><BanksTab /></CardContent></Card></TabsContent>
        <TabsContent value="connectors"><Card><CardHeader><CardTitle>Connector Instances</CardTitle><CardDescription>Bank connector registrations, certificates, and types</CardDescription></CardHeader><CardContent><ConnectorsTab /></CardContent></Card></TabsContent>
        <TabsContent value="health"><Card><CardHeader><CardTitle>Connector Health</CardTitle><CardDescription>Real-time health monitoring for active connectors</CardDescription></CardHeader><CardContent><ConnectorsTab /></CardContent></Card></TabsContent>
        <TabsContent value="psu-links"><Card><CardHeader><CardTitle>PSU ↔ Bank Links</CardTitle><CardDescription>User-to-bank customer mappings</CardDescription></CardHeader><CardContent><PSULinksTab /></CardContent></Card></TabsContent>
        <TabsContent value="payments"><Card><CardHeader><CardTitle>Bank Payments</CardTitle><CardDescription>Payments initiated via bank connectors</CardDescription></CardHeader><CardContent><BankPaymentsTab /></CardContent></Card></TabsContent>
        <TabsContent value="file-imports"><Card><CardHeader><CardTitle>File Imports</CardTitle><CardDescription>Upload CSV/Excel files from banks, run ingestion, and track row-level results</CardDescription></CardHeader><CardContent><FileImportsTab /></CardContent></Card></TabsContent>
        <TabsContent value="batch-payments"><Card><CardHeader><CardTitle>Batch Payments</CardTitle><CardDescription>Create payment instruction batches, generate CSV/pain.001 files, and ingest status files</CardDescription></CardHeader><CardContent><BatchPaymentsTab /></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
