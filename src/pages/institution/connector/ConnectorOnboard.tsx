import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBankConnector } from "@/hooks/useBankConnector";
import { ConnectorPageHeader } from "@/components/institution/connector/ConnectorPageHeader";
import { Rocket, CheckCircle2, ArrowRight, ArrowLeft, FileText, Database, Radio, Globe, Upload, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  { id: 1, label: "Integration Mode", icon: Radio },
  { id: 2, label: "Connection Config", icon: Database },
  { id: 3, label: "Security", icon: Shield },
  { id: 4, label: "Validation", icon: CheckCircle2 },
];

const MODES = [
  { value: "file", label: "File-Based (CSV / pain.001)", desc: "Upload CSV files from your core banking system. Best for banks with no API.", icon: FileText, color: "border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20" },
  { value: "db", label: "Database Connector", desc: "KOB polls your read-only DB replica on a schedule. Needs a DB proxy endpoint.", icon: Database, color: "border-teal-500/40 bg-teal-50/50 dark:bg-teal-950/20" },
  { value: "mq", label: "Message Queue (Real-Time)", desc: "Push/receive events via Kafka, RabbitMQ, or webhook. For real-time sync.", icon: Radio, color: "border-violet-500/40 bg-violet-50/50 dark:bg-violet-950/20" },
  { value: "api_pull", label: "API Pull (KOB → Your API)", desc: "KOB polls your REST API automatically. You expose standard endpoints.", icon: Globe, color: "border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20" },
];

export default function ConnectorOnboard() {
  const navigate = useNavigate();
  const { bankId, bankName, loading: bankLoading } = useBankConnector();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const updateConfig = (key: string, value: string) => setConfig(prev => ({ ...prev, [key]: value }));

  const handleComplete = async () => {
    if (!bankId) return;
    setSubmitting(true);
    try {
      if (mode === "file") {
        toast({ title: "File mode active", description: "Your bank is already set up for file-based integration. Head to Uploads to start." });
      } else if (mode === "db") {
        const { error } = await supabase.functions.invoke("bank-db-connector", {
          body: {
            action: "register_connection",
            bank_id: bankId,
            name: config.name || `${bankName} DB Connection`,
            db_type: config.db_type || "postgresql",
            connection_config: {
              bridge_url: config.bridge_url,
              bridge_api_key: config.bridge_api_key,
              host: config.host,
              database: config.database,
            },
            environment: config.environment || "sandbox",
            poll_interval_seconds: parseInt(config.poll_interval || "300"),
          },
        });
        if (error) throw error;
      } else if (mode === "api_pull") {
        const { error } = await supabase.functions.invoke("bank-api-connector", {
          body: {
            action: "register_endpoint",
            bank_id: bankId,
            name: config.name || `${bankName} API Endpoint`,
            base_url: config.base_url,
            auth_method: config.auth_method || "api_key",
            auth_config: {
              api_key: config.api_key,
              header_name: config.header_name || "X-API-Key",
              token_url: config.token_url,
              client_id: config.client_id,
              client_secret: config.client_secret,
            },
            paths: {
              accounts: config.path_accounts || "/api/accounts",
              transactions: config.path_transactions || "/api/transactions",
              balances: config.path_balances || "/api/balances",
              health: config.path_health || "/health",
            },
            environment: config.environment || "sandbox",
          },
        });
        if (error) throw error;
      } else if (mode === "mq") {
        const { error } = await supabase.functions.invoke("bank-mq-connector", {
          body: {
            action: "register_channel",
            bank_id: bankId,
            channel_name: config.channel_name || `${bankName}-channel`,
            channel_type: config.channel_type || "webhook",
            direction: config.direction || "bidirectional",
            webhook_url: config.webhook_url,
            broker_type: config.broker_type || null,
          },
        });
        if (error) throw error;
      }

      setCompleted(true);
      toast({ title: "Integration configured!", description: "Your connector has been set up. Run a sandbox test to validate." });
    } catch (err: any) {
      toast({ title: "Configuration failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={Rocket} title="Onboarding Complete" description="Your bank integration is configured" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="max-w-lg mx-auto text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
              <h2 className="text-2xl font-semibold">All Set!</h2>
              <p className="text-muted-foreground">
                Your <Badge variant="outline">{MODES.find(m => m.value === mode)?.label}</Badge> integration is configured for <strong>{bankName}</strong>.
              </p>
              <div className="flex gap-3 justify-center pt-4">
                <Button variant="outline" onClick={() => navigate("/fi-portal/connector")}>Go to Overview</Button>
                <Button onClick={() => navigate("/fi-portal/connector/health")}>Check Health</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConnectorPageHeader icon={Rocket} title="Connector Onboarding" description="Set up your bank's integration with KOB in a few steps" />

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${step >= s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              <s.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Choose Integration Mode</CardTitle>
                <CardDescription>Select how your bank will connect to KOB</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {MODES.map(m => (
                  <button key={m.value} onClick={() => setMode(m.value)} className={`text-left p-4 rounded-lg border-2 transition-all hover:shadow-md ${mode === m.value ? "ring-2 ring-primary border-primary" : m.color}`}>
                    <m.icon className="h-6 w-6 mb-2" />
                    <p className="font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {step === 2 && mode === "file" && (
            <Card>
              <CardHeader>
                <CardTitle>File-Based Configuration</CardTitle>
                <CardDescription>No additional setup needed — just download templates and start uploading</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">File mode is the simplest integration. Download CSV templates, fill them with your bank data, and upload. No API or DB credentials required.</p>
                <div className="flex gap-3">
                  <Select value={config.environment || "sandbox"} onValueChange={v => updateConfig("environment", v)}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Environment" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && mode === "db" && (
            <Card>
              <CardHeader>
                <CardTitle>Database Connection</CardTitle>
                <CardDescription>Configure your HTTP-to-SQL bridge endpoint</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label>Connection Name</Label><Input value={config.name || ""} onChange={e => updateConfig("name", e.target.value)} placeholder="Production DB" /></div>
                  <div><Label>DB Type</Label>
                    <Select value={config.db_type || "postgresql"} onValueChange={v => updateConfig("db_type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["postgresql", "mysql", "mssql", "oracle", "mongodb"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2"><Label>Bridge URL</Label><Input value={config.bridge_url || ""} onChange={e => updateConfig("bridge_url", e.target.value)} placeholder="https://your-db-proxy.example.com/query" /></div>
                  <div className="sm:col-span-2"><Label>Bridge API Key (optional)</Label><Input type="password" value={config.bridge_api_key || ""} onChange={e => updateConfig("bridge_api_key", e.target.value)} placeholder="Bearer token for bridge auth" /></div>
                  <div><Label>Host (for reference)</Label><Input value={config.host || ""} onChange={e => updateConfig("host", e.target.value)} placeholder="db.bank.example.com" /></div>
                  <div><Label>Database</Label><Input value={config.database || ""} onChange={e => updateConfig("database", e.target.value)} placeholder="core_banking" /></div>
                  <div><Label>Poll Interval (seconds)</Label><Input type="number" value={config.poll_interval || "300"} onChange={e => updateConfig("poll_interval", e.target.value)} /></div>
                  <div><Label>Environment</Label>
                    <Select value={config.environment || "sandbox"} onValueChange={v => updateConfig("environment", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="sandbox">Sandbox</SelectItem><SelectItem value="production">Production</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && mode === "api_pull" && (
            <Card>
              <CardHeader>
                <CardTitle>API Pull Configuration</CardTitle>
                <CardDescription>Provide your bank's REST API details — KOB will poll automatically</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Label>Base URL</Label><Input value={config.base_url || ""} onChange={e => updateConfig("base_url", e.target.value)} placeholder="https://api.bank.example.com" /></div>
                  <div><Label>Auth Method</Label>
                    <Select value={config.auth_method || "api_key"} onValueChange={v => updateConfig("auth_method", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="api_key">API Key</SelectItem>
                        <SelectItem value="oauth2_client_credentials">OAuth2 Client Credentials</SelectItem>
                        <SelectItem value="basic">Basic Auth</SelectItem>
                        <SelectItem value="bearer_token">Bearer Token</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>API Key / Token</Label><Input type="password" value={config.api_key || ""} onChange={e => updateConfig("api_key", e.target.value)} /></div>
                  <div><Label>Accounts Path</Label><Input value={config.path_accounts || "/api/accounts"} onChange={e => updateConfig("path_accounts", e.target.value)} /></div>
                  <div><Label>Transactions Path</Label><Input value={config.path_transactions || "/api/transactions"} onChange={e => updateConfig("path_transactions", e.target.value)} /></div>
                  <div><Label>Balances Path</Label><Input value={config.path_balances || "/api/balances"} onChange={e => updateConfig("path_balances", e.target.value)} /></div>
                  <div><Label>Environment</Label>
                    <Select value={config.environment || "sandbox"} onValueChange={v => updateConfig("environment", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="sandbox">Sandbox</SelectItem><SelectItem value="production">Production</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && mode === "mq" && (
            <Card>
              <CardHeader>
                <CardTitle>Message Queue Configuration</CardTitle>
                <CardDescription>Set up real-time message channel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label>Channel Name</Label><Input value={config.channel_name || ""} onChange={e => updateConfig("channel_name", e.target.value)} placeholder="payment-events" /></div>
                  <div><Label>Channel Type</Label>
                    <Select value={config.channel_type || "webhook"} onValueChange={v => updateConfig("channel_type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="webhook">Webhook</SelectItem>
                        <SelectItem value="kafka">Kafka</SelectItem>
                        <SelectItem value="rabbitmq">RabbitMQ</SelectItem>
                        <SelectItem value="realtime">Realtime</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Direction</Label>
                    <Select value={config.direction || "bidirectional"} onValueChange={v => updateConfig("direction", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inbound">Inbound</SelectItem>
                        <SelectItem value="outbound">Outbound</SelectItem>
                        <SelectItem value="bidirectional">Bidirectional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Webhook URL</Label><Input value={config.webhook_url || ""} onChange={e => updateConfig("webhook_url", e.target.value)} placeholder="https://your-bank.com/webhook" /></div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Security & Certificates</CardTitle>
                <CardDescription>For production connectors, mTLS is required</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm font-medium">mTLS Certificate (Optional for Sandbox)</p>
                  <p className="text-xs text-muted-foreground mt-1">Upload your X.509 certificate for mutual TLS authentication. Required for production. You can add this later from the Connector Health page.</p>
                  <Textarea className="mt-3" placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----" value={config.certificate_pem || ""} onChange={e => updateConfig("certificate_pem", e.target.value)} rows={4} />
                </div>
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm font-medium">HMAC Secret (Optional)</p>
                  <p className="text-xs text-muted-foreground mt-1">For webhook payload signature verification</p>
                  <Input className="mt-3" type="password" placeholder="Your HMAC secret" value={config.hmac_secret || ""} onChange={e => updateConfig("hmac_secret", e.target.value)} />
                </div>
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Review & Activate</CardTitle>
                <CardDescription>Verify your configuration before activating</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Bank</p>
                    <p className="font-medium">{bankName || "Loading..."}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Integration Mode</p>
                    <p className="font-medium">{MODES.find(m => m.value === mode)?.label}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Environment</p>
                    <p className="font-medium capitalize">{config.environment || "sandbox"}</p>
                  </div>
                  {config.base_url && <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Base URL</p><p className="font-medium truncate">{config.base_url}</p></div>}
                  {config.bridge_url && <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Bridge URL</p><p className="font-medium truncate">{config.bridge_url}</p></div>}
                  {config.channel_type && <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Channel Type</p><p className="font-medium capitalize">{config.channel_type}</p></div>}
                </div>
                <Button className="w-full" size="lg" onClick={handleComplete} disabled={submitting}>
                  {submitting ? "Configuring..." : "Activate Integration"}
                </Button>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        {step < 4 && (
          <Button onClick={() => setStep(step + 1)} disabled={step === 1 && !mode}>
            Next <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
