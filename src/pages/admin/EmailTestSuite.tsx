import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  EMAIL_TEMPLATES,
  CATEGORY_LABEL,
  type EmailTemplateSpec,
} from "@/lib/email-templates-manifest";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Mail, CheckCircle2, XCircle, Send, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface SendResult {
  templateName: string;
  recipient: string;
  ok: boolean;
  status: string;
  httpStatus: number;
  latencyMs: number;
  errorMessage: string | null;
  variablesRendered: { variable: string; rendered: boolean }[];
  at: string;
}

interface ValidationCheck {
  id: string;
  label: string;
  severity: "error" | "warning" | "info";
  passed: boolean;
  detail?: string;
}
interface ValidationResult {
  template: string;
  displayName: string;
  passed: boolean;
  errors: number;
  warnings: number;
  checks: ValidationCheck[];
  renders: { scenario: string; ok: boolean; html_length: number; text_length: number; error?: string }[];
}
interface ValidationSummary {
  total: number;
  passed: number;
  failed: number;
  total_errors: number;
  total_warnings: number;
  from_address: string;
  reply_to: string;
  sender_domain: string;
}

export default function EmailTestSuite() {
  const [recipient, setRecipient] = useState("");
  const [selected, setSelected] = useState<EmailTemplateSpec>(EMAIL_TEMPLATES[0]);
  const [overrideJson, setOverrideJson] = useState<string>(
    JSON.stringify(EMAIL_TEMPLATES[0].sampleData, null, 2),
  );
  const [sending, setSending] = useState<string | null>(null);
  const [results, setResults] = useState<SendResult[]>([]);

  const grouped = useMemo(() => {
    const map = new Map<string, EmailTemplateSpec[]>();
    for (const t of EMAIL_TEMPLATES) {
      const key = CATEGORY_LABEL[t.category];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, []);

  function selectTemplate(name: string) {
    const t = EMAIL_TEMPLATES.find((x) => x.name === name);
    if (!t) return;
    setSelected(t);
    setOverrideJson(JSON.stringify(t.sampleData, null, 2));
  }

  async function sendTest(spec: EmailTemplateSpec) {
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      toast.error("Enter a valid test recipient email first");
      return;
    }
    if (spec.pipeline === "auth") {
      toast.info(
        "Auth emails are triggered by Supabase Auth events (sign-up, recovery, etc.) and cannot be sent ad-hoc. Trigger the corresponding auth action to test.",
      );
      return;
    }
    let templateData: Record<string, unknown> = spec.sampleData;
    if (selected.name === spec.name && overrideJson.trim()) {
      try {
        templateData = JSON.parse(overrideJson);
      } catch {
        toast.error("Custom payload is not valid JSON");
        return;
      }
    }

    setSending(spec.name);
    try {
      const { data, error } = await supabase.functions.invoke("admin-send-test-email", {
        body: {
          template_name: spec.name,
          recipient_email: recipient,
          template_data: templateData,
        },
      });
      if (error) throw error;

      const variablesRendered = spec.variables.map((v) => ({
        variable: v,
        rendered: Object.prototype.hasOwnProperty.call(templateData, v),
      }));
      const result: SendResult = {
        templateName: spec.name,
        recipient,
        ok: !!data?.ok,
        status: data?.delivery?.status ?? (data?.ok ? "enqueued" : "failed"),
        httpStatus: data?.http_status ?? 0,
        latencyMs: data?.latency_ms ?? 0,
        errorMessage: data?.enqueue_error ?? data?.delivery?.error_message ?? null,
        variablesRendered,
        at: new Date().toISOString(),
      };
      setResults((prev) => [result, ...prev].slice(0, 50));
      if (result.ok) {
        toast.success(`Test sent: ${spec.displayName}`);
      } else {
        toast.error(`Send failed: ${result.errorMessage ?? "unknown error"}`);
      }
    } catch (err) {
      const msg = await extractEdgeFunctionError(err);
      toast.error(msg);
      setResults((prev) => [
        {
          templateName: spec.name,
          recipient,
          ok: false,
          status: "error",
          httpStatus: 0,
          latencyMs: 0,
          errorMessage: msg,
          variablesRendered: spec.variables.map((v) => ({ variable: v, rendered: false })),
          at: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 50));
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="container max-w-6xl space-y-6 py-6">
      <Helmet>
        <title>Email Test Suite — Admin</title>
        <meta name="description" content="Send and verify transactional email templates from the admin panel." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Mail className="h-6 w-6" /> Email Test Suite
        </h1>
        <p className="text-sm text-muted-foreground">
          {EMAIL_TEMPLATES.length} registered templates. Send a sample render to a test address,
          verify variable interpolation, and inspect delivery status from the email send log.
        </p>
      </header>

      {/* Recipient + selected template payload editor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recipient">Test recipient email</Label>
              <Input
                id="recipient"
                type="email"
                placeholder="qa+test@yourdomain.com"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Suppressed (bounced/unsubscribed) addresses will be blocked by the sender.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tpl">Template (for custom payload)</Label>
              <Select value={selected.name} onValueChange={selectTemplate}>
                <SelectTrigger id="tpl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {EMAIL_TEMPLATES.filter((t) => t.pipeline === "transactional").map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.displayName} — {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payload">Template variables (JSON)</Label>
            <Textarea
              id="payload"
              rows={8}
              value={overrideJson}
              onChange={(e) => setOverrideJson(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Required variables: {selected.variables.join(", ") || "—"}
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => sendTest(selected)} disabled={!!sending}>
              {sending === selected.name ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send test email
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Template catalog */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template catalog & triggers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {grouped.map(([category, items]) => (
            <section key={category} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">{category}</h2>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[220px]">Template</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead className="w-[160px]">Variables</TableHead>
                      <TableHead className="w-[120px]">Pipeline</TableHead>
                      <TableHead className="w-[140px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((t) => (
                      <TableRow key={t.name}>
                        <TableCell>
                          <div className="font-medium">{t.displayName}</div>
                          <div className="font-mono text-xs text-muted-foreground">{t.name}</div>
                        </TableCell>
                        <TableCell className="text-sm">{t.trigger}</TableCell>
                        <TableCell className="text-xs">
                          {t.variables.length ? t.variables.join(", ") : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.pipeline === "auth" ? "secondary" : "outline"}>
                            {t.pipeline}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!sending || t.pipeline === "auth"}
                            onClick={() => sendTest(t)}
                            aria-label={`Send test ${t.displayName}`}
                          >
                            {sending === t.name ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ))}
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent test sends</CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No test sends yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Result</TableHead>
                    <TableHead className="w-[200px]">Template</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[100px]">HTTP</TableHead>
                    <TableHead className="w-[100px]">Latency</TableHead>
                    <TableHead>Variables rendered</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, idx) => (
                    <TableRow key={`${r.templateName}-${r.at}-${idx}`}>
                      <TableCell>
                        {r.ok ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.templateName}</TableCell>
                      <TableCell className="text-xs">{r.recipient}</TableCell>
                      <TableCell>
                        <Badge variant={r.ok ? "default" : "destructive"}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.httpStatus || "—"}</TableCell>
                      <TableCell className="text-xs">{r.latencyMs} ms</TableCell>
                      <TableCell className="text-xs">
                        {r.variablesRendered.length === 0
                          ? "—"
                          : r.variablesRendered.map((v) => (
                              <span
                                key={v.variable}
                                className={`mr-1 inline-block rounded border px-1.5 py-0.5 ${
                                  v.rendered
                                    ? "border-primary/30 text-primary"
                                    : "border-destructive/30 text-destructive"
                                }`}
                              >
                                {v.variable}
                              </span>
                            ))}
                      </TableCell>
                      <TableCell className="text-xs text-destructive">
                        {r.errorMessage ?? ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
