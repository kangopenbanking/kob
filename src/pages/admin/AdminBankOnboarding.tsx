import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Server, Database, FileText, Code2, CheckCircle2, Circle, ArrowRight, ArrowLeft, Plus } from "lucide-react";

type Stage = "assessment" | "adapter_selection" | "credentials" | "sandbox_test" | "certification" | "go_live" | "completed";
type Adapter = "rest" | "sql" | "file" | "soap";

interface OnboardingRecord {
  id: string;
  bank_id: string | null;
  bank_name: string;
  stage: Stage;
  adapter_type: Adapter | null;
  assessment_data: Record<string, any>;
  credentials_configured: boolean;
  sandbox_test_passed: boolean;
  sandbox_test_results: Record<string, any>;
  certification_passed: boolean;
  certification_checklist: Array<{ key: string; label: string; checked: boolean }>;
  go_live_at: string | null;
  notes: string | null;
}

const STAGES: { key: Stage; label: string; description: string }[] = [
  { key: "assessment", label: "Assessment", description: "Capture bank infrastructure profile" },
  { key: "adapter_selection", label: "Adapter", description: "Choose integration method" },
  { key: "credentials", label: "Credentials", description: "Configure connection in Tenant Connectors" },
  { key: "sandbox_test", label: "Sandbox Test", description: "Verify against bank-data-router" },
  { key: "certification", label: "Certification", description: "Complete go-live checklist" },
  { key: "go_live", label: "Go Live", description: "Activate production traffic" },
];

const ADAPTER_OPTIONS: { value: Adapter; label: string; icon: any; description: string }[] = [
  { value: "rest", label: "REST API", icon: Server, description: "Bank exposes a modern HTTPS/JSON API" },
  { value: "sql", label: "SQL Gateway", icon: Database, description: "Read-only DB replica via parameterized queries" },
  { value: "file", label: "File (CSV/pain.001/MT940)", icon: FileText, description: "Daily batch files via SFTP or upload" },
  { value: "soap", label: "SOAP / Legacy", icon: Code2, description: "WSDL/XML legacy core banking" },
];

const DEFAULT_CHECKLIST = [
  { key: "auth", label: "Credentials encrypted and stored in tenant connector", checked: false },
  { key: "health", label: "Adapter health check returns OK", checked: false },
  { key: "sample", label: "Sample account fetch verified end-to-end", checked: false },
  { key: "recon", label: "Reconciliation run completed without unflagged variance", checked: false },
  { key: "audit", label: "Connector attempt audit trail confirmed", checked: false },
  { key: "runbook", label: "Operational runbook signed off", checked: false },
];

export default function AdminBankOnboarding() {
  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [active, setActive] = useState<OnboardingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("bank_onboarding_records" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load onboarding records");
    else setRecords((data as any) || []);
    setLoading(false);
  }

  async function createRecord() {
    if (!newName.trim()) { toast.error("Bank name required"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("bank_onboarding_records" as any)
      .insert({
        bank_name: newName.trim(),
        stage: "assessment",
        certification_checklist: DEFAULT_CHECKLIST,
        created_by: user?.id,
      } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    toast.success("Onboarding record created");
    setNewName("");
    setCreating(false);
    setActive(data as any);
    load();
  }

  async function update(patch: Partial<OnboardingRecord>) {
    if (!active) return;
    const { data, error } = await supabase
      .from("bank_onboarding_records" as any)
      .update(patch as any)
      .eq("id", active.id)
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setActive(data as any);
    load();
  }

  function stageIndex(s: Stage) { return STAGES.findIndex(x => x.key === s); }

  async function advance() {
    if (!active) return;
    const idx = stageIndex(active.stage);
    if (idx < 0 || idx >= STAGES.length - 1) {
      await update({ stage: "completed", go_live_at: new Date().toISOString() });
      toast.success("Bank marked as live");
      return;
    }
    await update({ stage: STAGES[idx + 1].key });
  }

  async function back() {
    if (!active) return;
    const idx = stageIndex(active.stage);
    if (idx <= 0) return;
    await update({ stage: STAGES[idx - 1].key });
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bank Onboarding</h1>
          <p className="text-sm text-muted-foreground">Guide CEMAC banks from assessment to production go-live</p>
        </div>
        <Button onClick={() => setCreating(true)} variant="outline">
          <Plus className="mr-2 h-4 w-4" />New Onboarding
        </Button>
      </div>

      {creating && (
        <Card className="border border-border/50">
          <CardHeader><CardTitle className="text-base">New Bank Onboarding</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="bn">Bank legal name</Label>
              <Input id="bn" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Afriland First Bank" />
            </div>
            <div className="flex gap-2">
              <Button onClick={createRecord} variant="outline">Create</Button>
              <Button onClick={() => setCreating(false)} variant="ghost">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="border border-border/50">
          <CardHeader><CardTitle className="text-base">Pipeline</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && records.length === 0 && <p className="text-sm text-muted-foreground">No records yet</p>}
            {records.map((r) => (
              <button
                key={r.id}
                onClick={() => setActive(r)}
                className={`w-full rounded-md border p-3 text-left transition-colors ${
                  active?.id === r.id ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{r.bank_name}</span>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {STAGES.find(s => s.key === r.stage)?.label || r.stage}
                  </Badge>
                </div>
                {r.adapter_type && (
                  <p className="mt-1 text-xs text-muted-foreground uppercase">{r.adapter_type}</p>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!active && (
            <Card className="border border-border/50">
              <CardContent className="p-12 text-center text-sm text-muted-foreground">
                Select an onboarding record or create a new one to begin.
              </CardContent>
            </Card>
          )}

          {active && (
            <>
              <Card className="border border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">{active.bank_name}</CardTitle>
                  <CardDescription>Six-stage certification flow</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2">
                    {STAGES.map((s, i) => {
                      const idx = stageIndex(active.stage);
                      const done = i < idx || active.stage === "completed";
                      const current = i === idx && active.stage !== "completed";
                      return (
                        <div key={s.key} className="flex items-center gap-2">
                          <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${
                            current ? "border-primary text-primary" :
                            done ? "border-border bg-muted/50 text-foreground" : "border-border/50 text-muted-foreground"
                          }`}>
                            {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                            {s.label}
                          </div>
                          {i < STAGES.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <StageContent record={active} onUpdate={update} />

              <div className="flex justify-between">
                <Button onClick={back} variant="ghost" disabled={stageIndex(active.stage) <= 0 || active.stage === "completed"}>
                  <ArrowLeft className="mr-2 h-4 w-4" />Back
                </Button>
                <Button onClick={advance} variant="outline" disabled={active.stage === "completed"}>
                  {active.stage === "go_live" ? "Mark Completed" : "Advance Stage"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StageContent({ record, onUpdate }: { record: OnboardingRecord; onUpdate: (p: Partial<OnboardingRecord>) => void }) {
  const stage = record.stage;

  if (stage === "completed") {
    return (
      <Card className="border border-border/50">
        <CardHeader><CardTitle className="text-base">Completed</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Bank went live on {record.go_live_at ? new Date(record.go_live_at).toLocaleString() : "—"}.
        </CardContent>
      </Card>
    );
  }

  if (stage === "assessment") {
    const a = record.assessment_data || {};
    return (
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Bank Assessment</CardTitle>
          <CardDescription>Capture infrastructure profile to recommend an adapter</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Core banking system</Label>
            <Input value={a.core_system || ""} onChange={(e) => onUpdate({ assessment_data: { ...a, core_system: e.target.value } })} placeholder="Temenos T24, Flexcube, custom…" />
          </div>
          <div>
            <Label>Existing API surface</Label>
            <Select value={a.api_surface || ""} onValueChange={(v) => onUpdate({ assessment_data: { ...a, api_surface: v } })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="modern_rest">Modern REST/JSON</SelectItem>
                <SelectItem value="legacy_soap">Legacy SOAP/XML</SelectItem>
                <SelectItem value="db_only">Database only</SelectItem>
                <SelectItem value="files_only">Batch files only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={record.notes || ""} onChange={(e) => onUpdate({ notes: e.target.value })} rows={3} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stage === "adapter_selection") {
    return (
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Choose Adapter</CardTitle>
          <CardDescription>Maps to a connector in /_shared/bank-connectors</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {ADAPTER_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = record.adapter_type === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onUpdate({ adapter_type: opt.value })}
                className={`rounded-md border p-4 text-left transition-colors ${
                  selected ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-sm">{opt.label}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{opt.description}</p>
              </button>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  if (stage === "credentials") {
    return (
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Credentials</CardTitle>
          <CardDescription>Configure the connector entry under Tenant Connectors. This page only tracks status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={record.credentials_configured}
              onCheckedChange={(v) => onUpdate({ credentials_configured: !!v })}
            />
            <Label>Credentials configured and encrypted in bank_connector_configs</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Open <a href="/admin/tenant-connectors" className="text-primary underline">/admin/tenant-connectors</a> to add the encrypted credentials. Return here to confirm.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (stage === "sandbox_test") {
    const r = record.sandbox_test_results || {};
    return (
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Sandbox Test</CardTitle>
          <CardDescription>Run against bank-data-router with sandbox credentials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            {["health_check", "get_account_details", "get_transactions"].map((op) => (
              <div key={op} className="flex items-center gap-2 rounded-md border border-border/50 p-3">
                <Checkbox
                  checked={!!r[op]}
                  onCheckedChange={(v) => onUpdate({ sandbox_test_results: { ...r, [op]: !!v } })}
                />
                <Label className="text-xs">{op}</Label>
              </div>
            ))}
          </div>
          <Separator />
          <div className="flex items-center gap-2">
            <Checkbox
              checked={record.sandbox_test_passed}
              onCheckedChange={(v) => onUpdate({ sandbox_test_passed: !!v })}
            />
            <Label>All sandbox checks pass</Label>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stage === "certification") {
    const list = record.certification_checklist?.length ? record.certification_checklist : DEFAULT_CHECKLIST;
    const allChecked = list.every(i => i.checked);
    return (
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Certification Checklist</CardTitle>
          <CardDescription>All items must be confirmed before go-live</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {list.map((item, i) => (
            <div key={item.key} className="flex items-start gap-2 rounded-md border border-border/50 p-3">
              <Checkbox
                checked={item.checked}
                onCheckedChange={(v) => {
                  const next = [...list];
                  next[i] = { ...item, checked: !!v };
                  onUpdate({ certification_checklist: next, certification_passed: next.every(x => x.checked) });
                }}
              />
              <Label className="text-sm">{item.label}</Label>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{allChecked ? "Ready for go-live." : "Awaiting checklist completion."}</p>
        </CardContent>
      </Card>
    );
  }

  if (stage === "go_live") {
    return (
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Go Live</CardTitle>
          <CardDescription>Confirm production cutover</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">Bank: <strong>{record.bank_name}</strong></p>
          <p className="text-sm">Adapter: <strong className="uppercase">{record.adapter_type || "—"}</strong></p>
          <p className="text-sm">Certification: <strong>{record.certification_passed ? "Passed" : "Pending"}</strong></p>
          <p className="text-xs text-muted-foreground">
            Click "Mark Completed" to record the go-live timestamp. Set the matching `bank_connector_configs.enabled = true` separately.
          </p>
        </CardContent>
      </Card>
    );
  }

  return null;
}
