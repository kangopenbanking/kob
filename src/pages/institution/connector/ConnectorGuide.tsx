import { ConnectorPageHeader } from "@/components/institution/connector/ConnectorPageHeader";
import { useBankConnector } from "@/hooks/useBankConnector";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Loader2, HelpCircle, FileDown, GitBranch, Upload, CheckCircle2,
  Banknote, ClipboardList, ArrowUpDown, ChevronRight, Sparkles,
  FileText, ArrowRight, Shield, Zap, Database, Radio, Wifi,
  Server, Cable, MessageSquare, Activity,
} from "lucide-react";

// ─── File-based Steps ───
const FILE_STEPS = [
  {
    number: 1, icon: FileDown, title: "Download a CSV Template",
    desc: "Start by downloading a ready-made CSV template for the type of data you want to send — accounts, balances, transactions, or beneficiaries.",
    detail: "Each template has the exact column headers KOB expects. Just fill in your bank's data.",
    link: "/fi-portal/connector/templates", linkLabel: "Go to Templates",
    color: "from-blue-500/20 to-blue-600/10", accent: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  },
  {
    number: 2, icon: GitBranch, title: "Create a Mapping Profile",
    desc: "If your CSV columns have different names than the template, create a mapping profile to tell KOB which column is which.",
    detail: "Example: Your file says 'acct_no' instead of 'account_number'? Map it here. Skip this step if your columns already match.",
    link: "/fi-portal/connector/mappings", linkLabel: "Go to Mappings",
    color: "from-violet-500/20 to-violet-600/10", accent: "text-violet-600 dark:text-violet-400",
    badge: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
  },
  {
    number: 3, icon: Upload, title: "Upload Your CSV File",
    desc: "Upload your filled CSV file. KOB will automatically validate every row, flag errors, and import the good data.",
    detail: "You'll see a progress indicator and can review results instantly. Any bad rows are listed with clear error messages.",
    link: "/fi-portal/connector/uploads", linkLabel: "Go to Uploads",
    color: "from-emerald-500/20 to-emerald-600/10", accent: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
  },
  {
    number: 4, icon: CheckCircle2, title: "Review Import Results",
    desc: "After upload, check how many rows succeeded, how many had errors, and download a report of any issues.",
    detail: "Fix the flagged rows in your CSV and re-upload if needed. Each upload is tracked with a unique ID.",
    link: "/fi-portal/connector/uploads", linkLabel: "View Imports",
    color: "from-teal-500/20 to-teal-600/10", accent: "text-teal-600 dark:text-teal-400",
    badge: "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300",
  },
  {
    number: 5, icon: Banknote, title: "Create Batch Payments",
    desc: "Need to send payment instructions to your core banking system? Create a batch with the payment details.",
    detail: "Add payment items manually or upload a payout CSV. Then generate an instruction file in CSV or ISO 20022 pain.001 format.",
    link: "/fi-portal/connector/batches", linkLabel: "Go to Batches",
    color: "from-amber-500/20 to-amber-600/10", accent: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  },
  {
    number: 6, icon: ClipboardList, title: "Upload Status Files",
    desc: "After your core banking system processes the batch, upload the status file to report which payments succeeded or failed.",
    detail: "KOB will automatically match each status row to the original payment instruction by reference.",
    link: "/fi-portal/connector/status", linkLabel: "Go to Status",
    color: "from-orange-500/20 to-orange-600/10", accent: "text-orange-600 dark:text-orange-400",
    badge: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300",
  },
  {
    number: 7, icon: ArrowUpDown, title: "Reconcile & Verify",
    desc: "Compare what was expected vs. what actually happened. Resolve any mismatches and export a reconciliation report.",
    detail: "Use the reconciliation dashboard to see totals, spot discrepancies, and mark items as resolved with a reason.",
    link: "/fi-portal/connector/reconciliation", linkLabel: "Go to Reconciliation",
    color: "from-rose-500/20 to-rose-600/10", accent: "text-rose-600 dark:text-rose-400",
    badge: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
  },
];

// ─── DB Connector Steps ───
const DB_STEPS = [
  {
    number: 1, icon: Database, title: "Register a Database Connection",
    desc: "Configure the connection to your bank's database — provide host, port, database name, and read-only credentials.",
    detail: "Supported databases: PostgreSQL, MySQL, MSSQL, Oracle, MongoDB. Only read-only access is required.",
    color: "from-cyan-500/20 to-cyan-600/10", accent: "text-cyan-600 dark:text-cyan-400",
    badge: "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300",
  },
  {
    number: 2, icon: Server, title: "Define Polling Queries",
    desc: "Write SQL queries that KOB will execute to fetch accounts, transactions, and balances from your database.",
    detail: "Use :watermark in your queries to fetch only changes since the last sync. Example: WHERE updated_at > :watermark",
    color: "from-indigo-500/20 to-indigo-600/10", accent: "text-indigo-600 dark:text-indigo-400",
    badge: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300",
  },
  {
    number: 3, icon: Activity, title: "Set Polling Interval",
    desc: "Choose how often KOB should query your database — from every 5 minutes to once per day.",
    detail: "The system uses a watermark column (usually updated_at) to avoid re-syncing unchanged rows.",
    color: "from-green-500/20 to-green-600/10", accent: "text-green-600 dark:text-green-400",
    badge: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  },
  {
    number: 4, icon: Zap, title: "Test & Activate",
    desc: "Test the connection, run a manual sync, and review the results. Then activate for automatic scheduled polling.",
    detail: "Every sync run is logged with counts, errors, and watermark values for full auditability.",
    color: "from-amber-500/20 to-amber-600/10", accent: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  },
];

// ─── Message Queue Steps ───
const MQ_STEPS = [
  {
    number: 1, icon: Cable, title: "Create a Message Channel",
    desc: "Register a channel for your bank — choose between Realtime (Supabase), Webhook, or SSE delivery.",
    detail: "Each channel has a topic filter to control which events are accepted (e.g., 'transaction.created,balance.updated').",
    color: "from-purple-500/20 to-purple-600/10", accent: "text-purple-600 dark:text-purple-400",
    badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
  },
  {
    number: 2, icon: Radio, title: "Configure Inbound Events",
    desc: "Send real-time events to KOB as they happen in your core system — account changes, new transactions, balance updates.",
    detail: "POST events to the /bank-mq-connector endpoint with your bank_id, channel_name, and message payload.",
    color: "from-pink-500/20 to-pink-600/10", accent: "text-pink-600 dark:text-pink-400",
    badge: "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300",
  },
  {
    number: 3, icon: MessageSquare, title: "Subscribe to Outbound Events",
    desc: "Receive payment instructions and status updates from KOB via your configured webhook URL or Realtime subscription.",
    detail: "HMAC-SHA256 signed payloads ensure message integrity. Webhook delivery includes automatic retry on failure.",
    color: "from-sky-500/20 to-sky-600/10", accent: "text-sky-600 dark:text-sky-400",
    badge: "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300",
  },
  {
    number: 4, icon: Activity, title: "Monitor & Debug",
    desc: "Track message delivery, view payload history, and check channel health in real-time with full message logs.",
    detail: "Every message is stored with a correlation_id for end-to-end tracing. Deduplication prevents duplicate processing.",
    color: "from-emerald-500/20 to-emerald-600/10", accent: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
  },
];

const INTEGRATION_MODES = [
  {
    id: "file",
    label: "CSV / File",
    icon: FileText,
    desc: "Best for banks without API capability. Exchange data via CSV files.",
    badge: "Production Ready",
    badgeVariant: "default" as const,
    steps: FILE_STEPS,
  },
  {
    id: "db",
    label: "Database",
    icon: Database,
    desc: "Direct database polling with watermark-based incremental sync.",
    badge: "New",
    badgeVariant: "secondary" as const,
    steps: DB_STEPS,
  },
  {
    id: "mq",
    label: "Real-Time",
    icon: Wifi,
    desc: "Event-driven messaging via webhook, Realtime, or SSE channels.",
    badge: "New",
    badgeVariant: "secondary" as const,
    steps: MQ_STEPS,
  },
];

const HIGHLIGHTS = [
  { icon: Shield, label: "SHA-256 deduplication" },
  { icon: Zap, label: "Automatic validation" },
  { icon: FileText, label: "ISO 20022 support" },
  { icon: Database, label: "DB polling (CDC)" },
  { icon: Wifi, label: "Real-time events" },
  { icon: Sparkles, label: "Self-service" },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const lineVariants = {
  hidden: { scaleY: 0 },
  visible: { scaleY: 1, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export default function ConnectorGuide() {
  const { loading: bankLoading } = useBankConnector();
  const navigate = useNavigate();

  if (bankLoading) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={HelpCircle} title="How It Works" description="Loading..." />
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ConnectorPageHeader
        icon={HelpCircle}
        title="How the Connector Kit Works"
        description="Choose your integration mode and follow the step-by-step guide"
      />

      {/* Highlights bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        {HIGHLIGHTS.map((h) => (
          <div
            key={h.label}
            className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-4 py-3"
          >
            <h.icon className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">{h.label}</span>
          </div>
        ))}
      </motion.div>

      {/* Intro */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.5 }}
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-primary/10 p-3 shrink-0">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">What is the Connector Kit?</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The Bank Connector Kit lets your institution exchange data with KOB using <strong>three integration modes</strong>.
                  Choose the mode that best fits your infrastructure:
                </p>
                <div className="grid sm:grid-cols-3 gap-3 mt-4">
                  {INTEGRATION_MODES.map((mode) => (
                    <div key={mode.id} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <mode.icon className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold text-foreground">{mode.label}</span>
                        <Badge variant={mode.badgeVariant} className="text-[10px] h-4 ml-auto">{mode.badge}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{mode.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Integration Mode Tabs */}
      <Tabs defaultValue="file" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          {INTEGRATION_MODES.map((mode) => (
            <TabsTrigger key={mode.id} value={mode.id} className="gap-2 text-xs">
              <mode.icon className="h-3.5 w-3.5" />
              {mode.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {INTEGRATION_MODES.map((mode) => (
          <TabsContent key={mode.id} value={mode.id}>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="relative"
            >
              {mode.steps.map((step, i) => (
                <motion.div key={step.number} variants={itemVariants} className="relative flex gap-4 sm:gap-6">
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center shrink-0 w-10">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${step.badge} z-10`}
                    >
                      {step.number}
                    </div>
                    {i < mode.steps.length - 1 && (
                      <motion.div
                        variants={lineVariants}
                        className="w-px flex-1 bg-border/60 origin-top my-1"
                      />
                    )}
                  </div>

                  {/* Content card */}
                  <Card className="flex-1 mb-4 group hover:shadow-md transition-shadow duration-300">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className={`rounded-lg bg-gradient-to-br ${step.color} p-2.5 shrink-0`}>
                          <step.icon className={`h-5 w-5 ${step.accent}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground mb-1">{step.title}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                          <p className="text-xs text-muted-foreground/70 mt-2 italic">{step.detail}</p>
                          {"link" in step && (step as any).link && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-3 h-8 px-3 text-xs gap-1.5 group-hover:bg-muted/50"
                              onClick={() => navigate((step as any).link)}
                            >
                              {(step as any).linkLabel}
                              <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Quick Reference */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Integration Quick Reference
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { label: "File Encoding", value: "UTF-8" },
                { label: "Date format", value: "YYYY-MM-DD (ISO 8601)" },
                { label: "Amounts", value: "Numeric, period decimal (1000.50)" },
                { label: "Currency", value: "ISO 4217 code (default XAF)" },
                { label: "DB Watermark", value: "Incremental sync via updated_at column" },
                { label: "MQ Events", value: "JSON payload with correlation_id" },
                { label: "MQ Auth", value: "HMAC-SHA256 signatures" },
                { label: "DB Support", value: "PostgreSQL, MySQL, MSSQL, Oracle" },
                { label: "Deduplication", value: "SHA-256 (files) / correlation_id (MQ)" },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
                  <ArrowRight className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-medium text-foreground">{item.label}</span>
                    <p className="text-xs text-muted-foreground">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.75, duration: 0.4 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-3 py-4"
      >
        <Button onClick={() => navigate("/fi-portal/connector/templates")} className="gap-2">
          <FileDown className="h-4 w-4" /> Download Templates
        </Button>
        <Button variant="outline" onClick={() => navigate("/fi-portal/connector/uploads")} className="gap-2">
          <Upload className="h-4 w-4" /> Start Uploading
        </Button>
      </motion.div>
    </div>
  );
}
