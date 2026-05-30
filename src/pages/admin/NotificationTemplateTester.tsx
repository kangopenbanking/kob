import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import {
  NOTIFICATION_TEMPLATES as BUILT_IN_TEMPLATES,
  defaultValues,
  renderTemplate,
  type NotificationTemplate,
} from "@/lib/notification-templates-manifest";

const STORAGE_KEY = "kob.notification-templates.override.v1";

// Known internal route prefixes used to lint deep-link targets. Anything
// outside this list is flagged as "unknown route" in the preview.
const KNOWN_PREFIXES = [
  "/app", "/admin", "/bank", "/biz", "/business", "/m", "/merchant",
  "/auth", "/kyc", "/developer", "/help", "/legal", "/",
];

const LucideIcon: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
  const toPascal = (s: string) =>
    s.replace(/(^\w|-\w)/g, (m) => m.replace("-", "").toUpperCase());
  const Comp = (Icons as any)[toPascal(name)] ?? Icons.Bell;
  return <Comp className={className} strokeWidth={1.5} />;
};

function classifyRoute(url: string): { kind: "internal" | "external" | "unknown"; reason: string } {
  if (/^https?:\/\//i.test(url)) return { kind: "external", reason: "External URL" };
  if (!url.startsWith("/")) return { kind: "unknown", reason: "Missing leading slash" };
  const matched = KNOWN_PREFIXES.find((p) => url === p || url.startsWith(p + "/") || url.startsWith(p + "?"));
  if (!matched) return { kind: "unknown", reason: "No matching app route prefix" };
  return { kind: "internal", reason: `Resolves under ${matched}` };
}

type LogRow = {
  id: string;
  created_at: string;
  template_id: string | null;
  title: string;
  status: string;
  recipients: number | null;
  elapsed_ms: number | null;
  error: any;
  url: string | null;
  actions_tested: any;
  onesignal_id: string | null;
};

const NotificationTemplateTester: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Templates: built-in + optional overrides from localStorage.
  const [templates, setTemplates] = useState<NotificationTemplate[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed as NotificationTemplate[];
      }
    } catch { /* ignore */ }
    return BUILT_IN_TEMPLATES;
  });

  const [selectedId, setSelectedId] = useState(templates[0].id);
  const template = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? templates[0],
    [templates, selectedId],
  );
  const [values, setValues] = useState<Record<string, string>>(() => defaultValues(template));
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [schemaEdit, setSchemaEdit] = useState(false);
  const [clickedActions, setClickedActions] = useState<{ index: number; url: string; at: string }[]>([]);

  useEffect(() => {
    setValues(defaultValues(template));
    setClickedActions([]);
    void loadLogs(template.id);
  }, [template]);

  const grouped = useMemo(() => {
    const map: Record<string, NotificationTemplate[]> = {};
    for (const t of templates) (map[t.category] ||= []).push(t);
    return map;
  }, [templates]);

  const missingRequired = useMemo(() => {
    return template.variables
      .filter((v) => v.required && !(values[v.key] && values[v.key].trim()))
      .map((v) => v.key);
  }, [template, values]);

  // ── log helpers ───────────────────────────────────────────────
  async function loadLogs(templateId: string) {
    setLoadingLogs(true);
    const { data, error } = await supabase
      .from("push_test_log" as any)
      .select("*")
      .eq("template_id", templateId)
      .order("created_at", { ascending: false })
      .limit(15);
    if (!error && data) setLogs(data as unknown as LogRow[]);
    setLoadingLogs(false);
  }

  // ── send live ─────────────────────────────────────────────────
  async function sendLive() {
    if (missingRequired.length) {
      toast.error(`Required variables missing: ${missingRequired.join(", ")}`);
      return;
    }
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sign in first");
      setSending(false);
      return;
    }
    try {
      const { rendered: title_en } = renderTemplate(template.title_en, values);
      const { rendered: message_en } = renderTemplate(template.message_en, values);
      const { rendered: title_fr } = renderTemplate(template.title_fr, values);
      const { rendered: message_fr } = renderTemplate(template.message_fr, values);
      const firstActionUrl =
        template.actions?.[0]?.url ? renderTemplate(template.actions[0].url, values).rendered : undefined;

      // Send via push-notification (in-app + OneSignal push if configured).
      const { error } = await supabase.functions.invoke("push-notification", {
        body: {
          user_id: user.id,
          title: title_en,
          message: message_en,
          title_fr,
          message_fr,
          type: template.type,
          icon: template.icon,
          metadata: { template_id: template.id, deep_link: firstActionUrl, test: true },
        },
      });

      // Persist a per-template log row (admin-only, RLS-enforced).
      await supabase.from("push_test_log" as any).insert({
        triggered_by: user.id,
        template_id: template.id,
        target_external_user_id: user.id,
        title: title_en,
        message: message_en,
        url: firstActionUrl ?? null,
        status: error ? "failed" : "sent",
        error: error ? { message: error.message } : null,
        actions_tested: clickedActions,
        elapsed_ms: null,
      });

      if (error) throw error;
      toast.success(`Sent "${template.name}" to your account`);
      void loadLogs(template.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally {
      setSending(false);
    }
  }

  // ── action click testing ──────────────────────────────────────
  const handleActionClick = useCallback(
    (idx: number, rawUrl: string) => {
      const { rendered, missing } = renderTemplate(rawUrl, values);
      if (missing.length) {
        toast.warning(`Action URL has unresolved variables: ${missing.join(", ")}`);
        return;
      }
      const route = classifyRoute(rendered);
      setClickedActions((prev) => [...prev, { index: idx, url: rendered, at: new Date().toISOString() }]);
      if (route.kind === "external") {
        window.open(rendered, "_blank", "noopener,noreferrer");
        toast.success(`Opened external URL: ${rendered}`);
        return;
      }
      if (route.kind === "unknown") {
        toast.error(`Unknown route (${route.reason}): ${rendered}`);
        return;
      }
      navigate(rendered);
      toast.success(`Navigated to ${rendered}`);
    },
    [navigate, values],
  );

  // ── schema editor mutations ───────────────────────────────────
  function persistOverride(next: NotificationTemplate[]) {
    setTemplates(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  function updateTemplate(patch: Partial<NotificationTemplate>) {
    const next = templates.map((t) => (t.id === template.id ? { ...t, ...patch } : t));
    persistOverride(next);
  }
  function setVarRequired(key: string, required: boolean) {
    updateTemplate({
      variables: template.variables.map((v) => (v.key === key ? { ...v, required } : v)),
    });
  }
  function setVarSample(key: string, sample: string) {
    updateTemplate({
      variables: template.variables.map((v) => (v.key === key ? { ...v, sample } : v)),
    });
  }
  function addVariable() {
    const base = "newVar";
    let k = base, i = 1;
    while (template.variables.find((v) => v.key === k)) k = `${base}${i++}`;
    updateTemplate({ variables: [...template.variables, { key: k, sample: "", required: false }] });
  }
  function removeVariable(key: string) {
    updateTemplate({ variables: template.variables.filter((v) => v.key !== key) });
  }

  // ── import / export ───────────────────────────────────────────
  function exportTemplates() {
    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kang-notification-templates-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${templates.length} templates`);
  }
  function importTemplates(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error("Root must be an array");
        for (const t of parsed) {
          if (!t.id || !t.title_en || !t.message_en) {
            throw new Error(`Invalid template (missing id/title_en/message_en): ${JSON.stringify(t).slice(0, 80)}`);
          }
        }
        persistOverride(parsed as NotificationTemplate[]);
        setSelectedId(parsed[0].id);
        toast.success(`Imported ${parsed.length} templates`);
      } catch (e: any) {
        toast.error(`Import failed: ${e?.message ?? "invalid JSON"}`);
      }
    };
    reader.readAsText(file);
  }
  function resetToBuiltIn() {
    localStorage.removeItem(STORAGE_KEY);
    setTemplates(BUILT_IN_TEMPLATES);
    setSelectedId(BUILT_IN_TEMPLATES[0].id);
    toast.success("Reverted to built-in templates");
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notification Template Tester</h1>
          <p className="text-sm text-muted-foreground">
            Preview, validate, and test push templates end to end. Required variables block live sends.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportTemplates}>
            <Icons.Download className="mr-2 h-4 w-4" />Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Icons.Upload className="mr-2 h-4 w-4" />Import JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importTemplates(f); e.target.value = ""; }}
          />
          <Button variant="ghost" size="sm" onClick={resetToBuiltIn}>
            <Icons.RotateCcw className="mr-2 h-4 w-4" />Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Templates</CardTitle>
            <CardDescription>{templates.length} total</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[640px]">
              <div className="space-y-4 p-3">
                {Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat}>
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {cat}
                    </p>
                    <div className="space-y-1">
                      {items.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedId(t.id)}
                          className={`flex w-full items-start gap-2 rounded-md p-2 text-left text-sm transition-colors hover:bg-muted ${
                            t.id === selectedId ? "bg-muted" : ""
                          }`}
                        >
                          <LucideIcon name={t.icon} className="mt-0.5 h-4 w-4 text-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{t.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <LucideIcon name={template.icon} className="h-5 w-5" />
                    {template.name}
                  </CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{template.category}</Badge>
                  <Badge variant="outline">{template.type}</Badge>
                  {template.triggered_by && (
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {template.triggered_by}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="en">
                <TabsList>
                  <TabsTrigger value="en">English</TabsTrigger>
                  <TabsTrigger value="fr">Français</TabsTrigger>
                  <TabsTrigger value="side">Side by side</TabsTrigger>
                </TabsList>
                <TabsContent value="en" className="mt-4">
                  <PreviewCard template={template} values={values} lang="en" onAction={handleActionClick} />
                </TabsContent>
                <TabsContent value="fr" className="mt-4">
                  <PreviewCard template={template} values={values} lang="fr" onAction={handleActionClick} />
                </TabsContent>
                <TabsContent value="side" className="mt-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <PreviewCard template={template} values={values} lang="en" onAction={handleActionClick} />
                    <PreviewCard template={template} values={values} lang="fr" onAction={handleActionClick} />
                  </div>
                </TabsContent>
              </Tabs>

              {clickedActions.length > 0 && (
                <div className="mt-4 rounded-md border bg-muted/40 p-3 text-xs">
                  <p className="mb-1 font-semibold">Action clicks this session</p>
                  <ul className="space-y-1">
                    {clickedActions.map((c, i) => (
                      <li key={i} className="font-mono">
                        #{c.index + 1} → {c.url} <span className="text-muted-foreground">({new Date(c.at).toLocaleTimeString()})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Variables</CardTitle>
                  <CardDescription>
                    Toggle <strong>schema edit</strong> to mark variables required or add new ones. Required
                    variables block live sends.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="schema-edit" className="text-xs">Schema edit</Label>
                  <Switch id="schema-edit" checked={schemaEdit} onCheckedChange={setSchemaEdit} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {template.variables.length === 0 ? (
                <p className="text-sm text-muted-foreground">This template has no variables.</p>
              ) : (
                template.variables.map((v) => {
                  const isMissing = v.required && !(values[v.key] && values[v.key].trim());
                  return (
                    <div key={v.key} className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr_auto_auto] md:items-center">
                      <Label className="flex items-center gap-2 font-mono text-xs">
                        {`{{${v.key}}}`}
                        {v.required && <Badge variant="outline" className="h-5 px-1.5 text-[10px]">required</Badge>}
                      </Label>
                      <Input
                        value={values[v.key] ?? ""}
                        onChange={(e) => setValues((s) => ({ ...s, [v.key]: e.target.value }))}
                        placeholder={v.sample}
                        aria-invalid={isMissing || undefined}
                        className={isMissing ? "border-destructive" : ""}
                      />
                      {schemaEdit ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">Required</Label>
                            <Switch
                              checked={Boolean(v.required)}
                              onCheckedChange={(c) => setVarRequired(v.key, c)}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Input
                              className="h-9 w-32 text-xs"
                              value={v.sample}
                              placeholder="sample"
                              onChange={(e) => setVarSample(v.key, e.target.value)}
                            />
                            <Button variant="ghost" size="icon" onClick={() => removeVariable(v.key)}>
                              <Icons.Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-muted-foreground md:col-span-2">{v.description ?? ""}</span>
                        </>
                      )}
                    </div>
                  );
                })
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {schemaEdit && (
                  <Button variant="outline" size="sm" onClick={addVariable}>
                    <Icons.Plus className="mr-1 h-4 w-4" />Add variable
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setValues(defaultValues(template))}>
                  Reset to samples
                </Button>
                <Button variant="outline" size="sm" onClick={() => setValues({})}>
                  Clear all
                </Button>
                <div className="ml-auto flex items-center gap-3">
                  {missingRequired.length > 0 && (
                    <span className="text-xs text-destructive">
                      Missing required: {missingRequired.join(", ")}
                    </span>
                  )}
                  <Button onClick={sendLive} disabled={sending || missingRequired.length > 0}>
                    <Icons.Send className="mr-2 h-4 w-4" />
                    {sending ? "Sending…" : "Send live to my account"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Delivery log for this template</CardTitle>
                  <CardDescription>Most recent 15 test sends.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => loadLogs(template.id)} disabled={loadingLogs}>
                  <Icons.RefreshCw className="mr-2 h-4 w-4" />Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deep link</TableHead>
                    <TableHead>Action clicks</TableHead>
                    <TableHead>Error reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No sends for this template yet.</TableCell></TableRow>
                  ) : logs.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs">{new Date(row.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {row.status === "sent" ? <Badge>sent</Badge> : <Badge variant="destructive">{row.status}</Badge>}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs">{row.url ?? "—"}</TableCell>
                      <TableCell className="text-xs">{Array.isArray(row.actions_tested) ? row.actions_tested.length : 0}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-xs text-destructive">
                        {row.error ? (typeof row.error === "string" ? row.error : row.error?.message ?? JSON.stringify(row.error)) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ── Preview card ────────────────────────────────────────────────
const PreviewCard: React.FC<{
  template: NotificationTemplate;
  values: Record<string, string>;
  lang: "en" | "fr";
  onAction: (idx: number, url: string) => void;
}> = ({ template, values, lang, onAction }) => {
  const titleSrc = lang === "fr" ? template.title_fr : template.title_en;
  const msgSrc = lang === "fr" ? template.message_fr : template.message_en;
  const { rendered: title, missing: tMissing } = renderTemplate(titleSrc, values);
  const { rendered: body, missing: bMissing } = renderTemplate(msgSrc, values);
  const missing = Array.from(new Set([...tMissing, ...bMissing]));

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {lang === "fr" ? "Français" : "English"}
      </p>
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <LucideIcon name={template.icon} className="h-5 w-5 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold">{title}</p>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">now</span>
            </div>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">{body}</p>
            {template.actions && template.actions.length > 0 && (
              <div className="mt-3 space-y-2">
                {template.actions.map((a, i) => {
                  const { rendered, missing: m } = renderTemplate(a.url, values);
                  const route = classifyRoute(rendered);
                  const badgeVariant: "default" | "destructive" | "outline" | "secondary" =
                    route.kind === "internal" ? "default" : route.kind === "external" ? "secondary" : "destructive";
                  return (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant={i === 0 ? "default" : "outline"}
                        onClick={() => onAction(i, a.url)}
                        disabled={m.length > 0}
                      >
                        {lang === "fr" ? a.label_fr : a.label_en}
                      </Button>
                      <Badge variant={badgeVariant} className="text-[10px]">{route.kind}</Badge>
                      <span className="truncate font-mono text-[11px] text-muted-foreground" title={rendered}>
                        {rendered}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {missing.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          Unresolved variables: <span className="font-mono">{missing.join(", ")}</span>
        </div>
      )}
    </div>
  );
};

export default NotificationTemplateTester;
