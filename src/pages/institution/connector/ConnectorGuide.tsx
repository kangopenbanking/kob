import { ConnectorPageHeader } from "@/components/institution/connector/ConnectorPageHeader";
import { useBankConnector } from "@/hooks/useBankConnector";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Loader2, HelpCircle, FileDown, GitBranch, Upload, CheckCircle2,
  Banknote, ClipboardList, ArrowUpDown, ChevronRight, Sparkles,
  FileText, ArrowRight, Shield, Zap,
} from "lucide-react";

const STEPS = [
  {
    number: 1,
    icon: FileDown,
    title: "Download a CSV Template",
    desc: "Start by downloading a ready-made CSV template for the type of data you want to send — accounts, balances, transactions, or beneficiaries.",
    detail: "Each template has the exact column headers KOB expects. Just fill in your bank's data.",
    link: "/fi-portal/connector/templates",
    linkLabel: "Go to Templates",
    color: "from-blue-500/20 to-blue-600/10",
    accent: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  },
  {
    number: 2,
    icon: GitBranch,
    title: "Create a Mapping Profile",
    desc: "If your CSV columns have different names than the template, create a mapping profile to tell KOB which column is which.",
    detail: "Example: Your file says 'acct_no' instead of 'account_number'? Map it here. Skip this step if your columns already match.",
    link: "/fi-portal/connector/mappings",
    linkLabel: "Go to Mappings",
    color: "from-violet-500/20 to-violet-600/10",
    accent: "text-violet-600 dark:text-violet-400",
    badge: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300",
  },
  {
    number: 3,
    icon: Upload,
    title: "Upload Your CSV File",
    desc: "Upload your filled CSV file. KOB will automatically validate every row, flag errors, and import the good data.",
    detail: "You'll see a progress indicator and can review results instantly. Any bad rows are listed with clear error messages.",
    link: "/fi-portal/connector/uploads",
    linkLabel: "Go to Uploads",
    color: "from-emerald-500/20 to-emerald-600/10",
    accent: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
  },
  {
    number: 4,
    icon: CheckCircle2,
    title: "Review Import Results",
    desc: "After upload, check how many rows succeeded, how many had errors, and download a report of any issues.",
    detail: "Fix the flagged rows in your CSV and re-upload if needed. Each upload is tracked with a unique ID.",
    link: "/fi-portal/connector/uploads",
    linkLabel: "View Imports",
    color: "from-teal-500/20 to-teal-600/10",
    accent: "text-teal-600 dark:text-teal-400",
    badge: "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300",
  },
  {
    number: 5,
    icon: Banknote,
    title: "Create Batch Payments",
    desc: "Need to send payment instructions to your core banking system? Create a batch with the payment details.",
    detail: "Add payment items manually or upload a payout CSV. Then generate an instruction file in CSV or ISO 20022 pain.001 format.",
    link: "/fi-portal/connector/batches",
    linkLabel: "Go to Batches",
    color: "from-amber-500/20 to-amber-600/10",
    accent: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  },
  {
    number: 6,
    icon: ClipboardList,
    title: "Upload Status Files",
    desc: "After your core banking system processes the batch, upload the status file to report which payments succeeded or failed.",
    detail: "KOB will automatically match each status row to the original payment instruction by reference.",
    link: "/fi-portal/connector/status",
    linkLabel: "Go to Status",
    color: "from-orange-500/20 to-orange-600/10",
    accent: "text-orange-600 dark:text-orange-400",
    badge: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300",
  },
  {
    number: 7,
    icon: ArrowUpDown,
    title: "Reconcile & Verify",
    desc: "Compare what was expected vs. what actually happened. Resolve any mismatches and export a reconciliation report.",
    detail: "Use the reconciliation dashboard to see totals, spot discrepancies, and mark items as resolved with a reason.",
    link: "/fi-portal/connector/reconciliation",
    linkLabel: "Go to Reconciliation",
    color: "from-rose-500/20 to-rose-600/10",
    accent: "text-rose-600 dark:text-rose-400",
    badge: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
  },
];

const HIGHLIGHTS = [
  { icon: Shield, label: "SHA-256 file deduplication" },
  { icon: Zap, label: "Automatic row validation" },
  { icon: FileText, label: "ISO 20022 support" },
  { icon: Sparkles, label: "Self-service, no admin needed" },
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
        description="A simple step-by-step guide to integrating your bank with KOB using file-based data exchange"
      />

      {/* Highlights bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
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
                  The Bank Connector Kit lets your institution exchange data with KOB using simple CSV files.
                  You don't need a live API connection — just export files from your core banking system, 
                  upload them here, and KOB handles the rest. It works in <strong>two directions</strong>:
                </p>
                <div className="grid sm:grid-cols-2 gap-3 mt-4">
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <p className="text-xs font-semibold text-foreground mb-1">📥 Inbound (Bank → KOB)</p>
                    <p className="text-xs text-muted-foreground">Send account, balance, transaction, and beneficiary data to KOB via CSV uploads.</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <p className="text-xs font-semibold text-foreground mb-1">📤 Outbound (KOB → Bank)</p>
                    <p className="text-xs text-muted-foreground">Generate payment instruction files, download them, process in your system, then upload results back.</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Steps timeline */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative"
      >
        {STEPS.map((step, i) => (
          <motion.div key={step.number} variants={itemVariants} className="relative flex gap-4 sm:gap-6">
            {/* Timeline connector */}
            <div className="flex flex-col items-center shrink-0 w-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${step.badge} z-10`}
              >
                {step.number}
              </div>
              {i < STEPS.length - 1 && (
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 h-8 px-3 text-xs gap-1.5 group-hover:bg-muted/50"
                      onClick={() => navigate(step.link)}
                    >
                      {step.linkLabel}
                      <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* File format quick ref */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              File Format Quick Reference
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { label: "Encoding", value: "UTF-8" },
                { label: "Format", value: "Comma-separated (CSV)" },
                { label: "First row", value: "Must be column headers" },
                { label: "Date format", value: "YYYY-MM-DD (ISO 8601)" },
                { label: "Amounts", value: "Numeric, period decimal (1000.50)" },
                { label: "Currency", value: "ISO 4217 code (default XAF)" },
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
