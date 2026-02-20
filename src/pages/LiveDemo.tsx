import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  Smartphone,
  Building2,
  Play,
  CheckCircle2,
  Loader2,
  ArrowRight,
  RefreshCw,
  Zap,
  Shield,
  Globe2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";

// ── Types ──────────────────────────────────────────────────────────────────
type DemoStep = {
  id: string;
  label: string;
  status: "idle" | "running" | "done" | "error";
  request?: object;
  response?: object;
};

type ActiveFlow = "account" | "payment" | "mobile-money";

// ── Helpers ────────────────────────────────────────────────────────────────
function useCopyText() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return { copied, copy };
}

function JsonBlock({ data }: { data: object }) {
  const { copied, copy } = useCopyText();
  const text = JSON.stringify(data, null, 2);
  return (
    <div className="relative group">
      <pre className="text-xs font-mono overflow-auto max-h-48 p-3 rounded-lg bg-[hsl(217_33%_10%)] text-[hsl(142_76%_70%)] leading-relaxed">
        {text}
      </pre>
      <button
        onClick={() => copy(text)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-[hsl(217_91%_35%/0.6)] text-white"
        aria-label="Copy"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

function StepItem({ step, index }: { step: DemoStep; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex gap-3">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold border-2 transition-colors duration-300",
            step.status === "done" &&
              "bg-[hsl(142_76%_36%)] border-[hsl(142_76%_36%)] text-white",
            step.status === "running" &&
              "bg-[hsl(217_91%_35%)] border-[hsl(217_91%_60%)] text-white animate-pulse",
            step.status === "idle" &&
              "bg-muted border-border text-muted-foreground",
            step.status === "error" &&
              "bg-destructive border-destructive text-white"
          )}
        >
          {step.status === "done" ? (
            <CheckCircle2 size={14} />
          ) : step.status === "running" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            index + 1
          )}
        </div>
        <div className="w-px flex-1 bg-border mt-1" />
      </div>
      {/* Content */}
      <div className="pb-4 flex-1 min-w-0">
        <button
          className="flex items-center gap-2 w-full text-left"
          onClick={() => step.response && setOpen((p) => !p)}
        >
          <span
            className={cn(
              "text-sm font-medium transition-colors",
              step.status === "done" && "text-foreground",
              step.status === "running" && "text-primary",
              step.status === "idle" && "text-muted-foreground"
            )}
          >
            {step.label}
          </span>
          {step.response && (
            <span className="ml-auto text-muted-foreground">
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
        </button>

        <AnimatePresence>
          {open && step.response && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {step.request && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1 font-mono">
                    → REQUEST
                  </p>
                  <JsonBlock data={step.request} />
                </div>
              )}
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1 font-mono">
                  ← RESPONSE
                </p>
                <JsonBlock data={step.response} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Flow definitions ───────────────────────────────────────────────────────
const FLOWS: Record<
  ActiveFlow,
  {
    id: ActiveFlow;
    icon: React.ElementType;
    label: string;
    tagline: string;
    color: string;
    badge: string;
    steps: { label: string; endpoint: string; request: object }[];
  }
> = {
  account: {
    id: "account",
    icon: Building2,
    label: "Account Information",
    tagline: "Read balances & transaction history via open banking consent",
    color: "hsl(217 91% 35%)",
    badge: "AISP",
    steps: [
      {
        label: "Create AISP consent",
        endpoint: "account-balance",
        request: {
          permissions: ["ReadAccountsBasic", "ReadBalances"],
          expiration_date: "2026-12-31T00:00:00Z",
        },
      },
      {
        label: "Fetch account balance",
        endpoint: "account-balance",
        request: { account_id: "ACC-DEMO-001", currency: "XAF" },
      },
      {
        label: "Retrieve transactions",
        endpoint: "transactions",
        request: {
          account_id: "ACC-DEMO-001",
          from_date: "2026-01-01",
          to_date: "2026-02-20",
          limit: 5,
        },
      },
    ],
  },
  payment: {
    id: "payment",
    icon: CreditCard,
    label: "Card Payment",
    tagline: "Initiate a Stripe payment intent and confirm in real-time",
    color: "hsl(258 90% 60%)",
    badge: "PISP",
    steps: [
      {
        label: "Create payment intent",
        endpoint: "create-payment",
        request: { amount: 10000, currency: "XAF", description: "Demo product" },
      },
      {
        label: "Check payment status",
        endpoint: "payment-status",
        request: { payment_id: "PAY-DEMO-LIVE" },
      },
      {
        label: "Verify webhook confirmation",
        endpoint: "webhook-test",
        request: {
          event: "payment_intent.succeeded",
          payment_intent: "pi_demo_001",
        },
      },
    ],
  },
  "mobile-money": {
    id: "mobile-money",
    icon: Smartphone,
    label: "Mobile Money",
    tagline: "Charge or transfer via MTN / Orange Money across 8 currencies",
    color: "hsl(142 76% 36%)",
    badge: "MM",
    steps: [
      {
        label: "Initiate mobile money charge",
        endpoint: "mobile-money-transfer",
        request: {
          phone_number: "237670000000",
          provider: "mtn",
          amount: 5000,
          currency: "XAF",
        },
      },
      {
        label: "Poll transaction status",
        endpoint: "payment-status",
        request: { transaction_ref: "MMC_DEMO_001" },
      },
      {
        label: "Confirm credit to wallet",
        endpoint: "dashboard-data",
        request: { user_id: "USER-DEMO-001", event: "wallet_credited" },
      },
    ],
  },
};

// ── Main page ──────────────────────────────────────────────────────────────
export default function LiveDemo() {
  const [activeFlow, setActiveFlow] = useState<ActiveFlow>("account");
  const [steps, setSteps] = useState<DemoStep[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const flow = FLOWS[activeFlow];

  const resetDemo = () => {
    setSteps([]);
    setDone(false);
  };

  const runDemo = async () => {
    if (running) return;
    setRunning(true);
    setDone(false);
    setSteps(
      flow.steps.map((s) => ({ id: s.label, label: s.label, status: "idle" }))
    );

    // Scroll to results
    setTimeout(
      () => resultRef.current?.scrollIntoView({ behavior: "smooth" }),
      100
    );

    for (let i = 0; i < flow.steps.length; i++) {
      const stepDef = flow.steps[i];

      // Mark running
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx === i ? { ...s, status: "running" } : s
        )
      );

      // Simulate network latency
      await new Promise((r) => setTimeout(r, 700 + Math.random() * 600));

      try {
        const { data, error } = await supabase.functions.invoke(
          "api-demo-proxy",
          {
            body: {
              endpoint: stepDef.endpoint,
              method: "POST",
              platform: "live-demo-page",
              body: stepDef.request,
            },
          }
        );

        if (error) throw error;

        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === i
              ? {
                  ...s,
                  status: "done",
                  request: stepDef.request,
                  response: data?.data ?? data,
                }
              : s
          )
        );
      } catch {
        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === i
              ? {
                  ...s,
                  status: "error",
                  response: { error: "Edge function unavailable — demo mode" },
                }
              : s
          )
        );
      }
    }

    setRunning(false);
    setDone(true);
  };

  const switchFlow = (id: ActiveFlow) => {
    if (running) return;
    setActiveFlow(id);
    resetDemo();
  };

  return (
    <>
      <SEO
        title="Live API Demo | KOB Open Banking"
        description="Watch KOB's core API flows in action — account data, payments, and mobile money, all live."
      />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[hsl(217_91%_15%)] py-20 px-6">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 60% 40%, hsl(217 91% 60%), transparent)",
          }}
        />
        <div className="relative max-w-4xl mx-auto text-center space-y-5">
          <Badge className="bg-[hsl(142_76%_36%/0.2)] text-[hsl(142_76%_60%)] border border-[hsl(142_76%_36%/0.4)] uppercase tracking-widest text-xs">
            <Zap size={10} className="mr-1" /> Live Interactive Demo
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            See the KOB API{" "}
            <span className="text-[hsl(142_76%_60%)]">in action</span>
          </h1>
          <p className="text-lg text-[hsl(217_40%_75%)] max-w-2xl mx-auto">
            Select a flow below and click <strong>Run Demo</strong> to watch
            real API calls execute step-by-step. All data is sandboxed — no
            real transactions occur.
          </p>
          <div className="flex items-center justify-center gap-6 pt-2">
            {[
              { icon: Shield, text: "Sandboxed & Safe" },
              { icon: Globe2, text: "8 Currencies Supported" },
              { icon: Zap, text: "Real Edge Functions" },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-1.5 text-sm text-[hsl(217_40%_70%)]"
              >
                <Icon size={14} className="text-[hsl(142_76%_60%)]" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Flow selector + runner ── */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        {/* Tabs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-10">
          {(Object.values(FLOWS) as typeof FLOWS[ActiveFlow][]).map((f) => {
            const Icon = f.icon;
            const active = activeFlow === f.id;
            return (
              <button
                key={f.id}
                onClick={() => switchFlow(f.id as ActiveFlow)}
                className={cn(
                  "flex-1 flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200",
                  active
                    ? "border-[hsl(217_91%_35%)] bg-[hsl(217_91%_35%/0.08)] shadow-md"
                    : "border-border bg-card hover:border-[hsl(217_91%_35%/0.4)] hover:bg-muted/50"
                )}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: active ? f.color : "hsl(var(--muted))" }}
                >
                  <Icon
                    size={18}
                    className={active ? "text-white" : "text-muted-foreground"}
                  />
                </div>
                <div>
                  <p
                    className={cn(
                      "font-semibold text-sm",
                      active ? "text-primary" : "text-foreground"
                    )}
                  >
                    {f.label}
                  </p>
                  <Badge
                    variant="secondary"
                    className="text-xs mt-0.5 font-mono"
                  >
                    {f.badge}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>

        {/* Main card */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: description + controls */}
          <div className="space-y-5">
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: flow.color }}
                >
                  <flow.icon size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-foreground">
                    {flow.label}
                  </h2>
                  <p className="text-sm text-muted-foreground">{flow.tagline}</p>
                </div>
              </div>

              {/* Step preview */}
              <div className="space-y-2">
                {flow.steps.map((s, i) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <span className="w-5 h-5 rounded-full bg-muted text-xs flex items-center justify-center font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    {s.label}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={runDemo}
                  disabled={running}
                  className="flex-1 gap-2"
                >
                  {running ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Running…
                    </>
                  ) : done ? (
                    <>
                      <RefreshCw size={16} />
                      Run Again
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      Run Demo
                    </>
                  )}
                </Button>
                {steps.length > 0 && !running && (
                  <Button variant="outline" onClick={resetDemo} size="icon">
                    <RefreshCw size={16} />
                  </Button>
                )}
              </div>
            </div>

            {/* Info cards */}
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                What's happening
              </p>
              {activeFlow === "account" && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your app requests an <strong>AISP consent</strong>, which the
                  end-user approves. The API then returns live balance and the
                  last 5 transactions from the connected bank account.
                </p>
              )}
              {activeFlow === "payment" && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  A <strong>Stripe Payment Intent</strong> is created for 10,000
                  XAF. The client confirms with a card element. A webhook fires
                  when Stripe confirms the payment — all within seconds.
                </p>
              )}
              {activeFlow === "mobile-money" && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The API calls Flutterwave to charge the user's{" "}
                  <strong>MTN or Orange Money</strong> wallet. The user approves
                  on their phone, and a push notification confirms the credit.
                  Supports XAF, NGN, GHS, KES and more.
                </p>
              )}
            </div>
          </div>

          {/* Right: live step feed */}
          <div ref={resultRef} className="rounded-2xl border bg-card p-6 shadow-sm min-h-[300px]">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-semibold text-foreground">
                API Execution Log
              </p>
              {done && (
                <Badge className="bg-[hsl(142_76%_36%/0.15)] text-[hsl(142_76%_36%)] border border-[hsl(142_76%_36%/0.3)] text-xs">
                  <CheckCircle2 size={10} className="mr-1" /> All steps
                  completed
                </Badge>
              )}
            </div>

            {steps.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-52 text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <Play size={22} className="text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Press <strong>Run Demo</strong> to start the simulation
                </p>
              </div>
            ) : (
              <div>
                {steps.map((step, i) => (
                  <StepItem key={step.id} step={step} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-t bg-muted/30 py-10 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: "8", label: "Currencies supported", suffix: "+" },
            { value: "135", label: "Stripe currencies", suffix: "+" },
            { value: "25", label: "Connected banks", suffix: "+" },
            { value: "<2s", label: "Avg. API response time" },
          ].map(({ value, label, suffix }) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-bold text-primary">
                {value}
                {suffix ?? ""}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 px-6 text-center bg-background">
        <div className="max-w-xl mx-auto space-y-4">
          <h3 className="text-2xl font-bold text-foreground">
            Ready to integrate?
          </h3>
          <p className="text-muted-foreground">
            Get sandbox credentials and start building in minutes.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Button asChild>
              <a href="/developer/quick-start">
                Get API Keys <ArrowRight size={16} className="ml-1" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/developer">Read the Docs</a>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
