import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  ShieldCheck,
  Layers,
  Wallet,
  Zap,
  GitBranch,
  Lock,
  Activity,
  CheckCircle2,
  KeyRound,
  Cog,
  PlayCircle,
  ChartNoAxesCombined,
} from "lucide-react";

const benefits = [
  {
    icon: Wallet,
    title: "Lower per-transaction cost",
    body: "Settle directly with MTN or Orange under your own commercial agreement. Skip the aggregator margin on every charge.",
  },
  {
    icon: ShieldCheck,
    title: "Full credential ownership",
    body: "Your provider keys never leave the encrypted vault. AES-GCM at rest, server-mediated calls, zero browser exposure.",
  },
  {
    icon: GitBranch,
    title: "Automatic Flutterwave fallback",
    body: "If your direct rail fails, KOB transparently retries on the managed Flutterwave route. No silent reroutes — every attempt is auditable.",
  },
  {
    icon: Activity,
    title: "Per-rail health monitoring",
    body: "Continuous health checks surface degraded rails before they break a customer charge. Auto-disable and notify on N consecutive failures.",
  },
];

const steps = [
  {
    number: "01",
    icon: KeyRound,
    title: "Obtain your provider credentials",
    body: "Sign your direct merchant agreement with MTN MoMo or Orange Money. Collect your subscription key, API user, API key, and target environment (or Orange client_id, client_secret, and merchant_key).",
  },
  {
    number: "02",
    icon: Cog,
    title: "Register the connector in KOB",
    body: "From your dashboard's Payment Connectors panel — or the tenant-connectors-manage API — add the credentials. They are encrypted at rest and never returned through any read endpoint.",
  },
  {
    number: "03",
    icon: PlayCircle,
    title: "Test the rail end-to-end",
    body: "Run the built-in health check. Send a sandbox charge through payment-router-charge to verify routing order, then promote to live in one toggle.",
  },
  {
    number: "04",
    icon: ChartNoAxesCombined,
    title: "Route production traffic safely",
    body: "Set priorities per country. KOB will try your rails in order and fall back to managed Flutterwave on any failure. Every attempt is recorded in the response audit trail.",
  },
];

const why = [
  "Direct merchant relationships with mobile-money operators are increasingly required by regulators in CEMAC.",
  "Some institutions need the lower fees of a direct rail; others need the resilience of a managed default — KOB now offers both, side by side.",
  "Aggregator outages should never become merchant outages. Multi-rail routing with deterministic fallback is a baseline expectation for production payments infrastructure.",
];

const guarantees = [
  "Existing mobile-money-charge callers see zero behavior change.",
  "All connector calls are server-side; no credentials ever reach the client.",
  "Every credential create / update / delete is recorded in the audit log.",
  "Credentials are encrypted with AES-GCM using a platform-managed key.",
  "Health failures auto-disable the rail and notify the owning tenant.",
];

export default function ByoMobileMoney() {
  return (
    <>
      <SEO
        title="Bring Your Own Mobile Money | Kang Open Banking"
        description="Use your own MTN MoMo or Orange Money credentials with Kang Open Banking. Direct settlement, lower fees, and automatic Flutterwave fallback for resilience."
        keywords="BYO mobile money, MTN MoMo API, Orange Money API, multi-rail payments, CEMAC payments, Kang Open Banking connectors"
        canonical="https://kangopenbanking.com/products/byo-mobile-money"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Products", url: "/" },
          { name: "Bring Your Own Mobile Money", url: "/products/byo-mobile-money" },
        ]}
      />

      <div className="min-h-screen bg-background">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-border/60 bg-primary text-primary-foreground">
          <div className="container mx-auto max-w-6xl px-4 py-20 md:py-28">
            <div className="max-w-3xl animate-fade-in">
              <Badge
                variant="secondary"
                className="mb-6 bg-primary-foreground text-primary border-none font-semibold tracking-wide"
              >
                NEW · Multi-Rail Routing
              </Badge>
              <h1 className="text-4xl md:text-6xl font-black leading-[1.05] tracking-tight mb-6">
                Bring Your Own
                <br />
                Mobile Money Rail.
              </h1>
              <p className="text-lg md:text-xl leading-relaxed mb-10 opacity-90 max-w-2xl">
                Connect your own MTN MoMo or Orange Money credentials to KOB.
                Settle directly, pay lower fees, and keep the managed Flutterwave
                rail as a guaranteed fallback — all behind one API.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-semibold"
                >
                  <Link to="/developer/connectors/byo-mobile-money">
                    Read the integration guide
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <Link to="/developer/api/mobile-money">View API reference</Link>
                </Button>
              </div>
            </div>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-primary-foreground/10 blur-3xl"
          />
        </section>

        {/* WHY KOB BUILT THIS */}
        <section className="py-20 md:py-24 px-4 bg-background">
          <div className="container mx-auto max-w-5xl">
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div className="animate-fade-in">
                <p className="text-sm font-semibold tracking-widest text-primary uppercase mb-4">
                  Why we built it
                </p>
                <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-6">
                  KOB is no longer just an API.
                  <br />
                  It is your routing engine.
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed">
                  For most callers, Flutterwave (managed by KOB) remains the
                  default mobile-money middleware — nothing changes. For the
                  institutions, businesses and developers who hold their own
                  provider agreements, KOB now exposes a clean, opt-in path to
                  use those rails first, with deterministic fallback to the
                  managed default.
                </p>
              </div>
              <ul className="space-y-4">
                {why.map((reason) => (
                  <li
                    key={reason}
                    className="flex gap-4 p-5 rounded-lg border-2 border-border bg-card hover:border-primary transition-colors"
                  >
                    <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm leading-relaxed">{reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* BENEFITS */}
        <section className="py-20 md:py-24 px-4 bg-muted/40 border-y border-border/60">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-14">
              <p className="text-sm font-semibold tracking-widest text-primary uppercase mb-3">
                Benefits
              </p>
              <h2 className="text-3xl md:text-4xl font-bold">
                Direct rails, without the operational risk
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {benefits.map((b, i) => {
                const Icon = b.icon;
                return (
                  <Card
                    key={b.title}
                    className="border-2 border-border hover:border-primary transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-fade-in"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <CardContent className="p-7">
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground mb-5">
                        <Icon className="h-6 w-6" strokeWidth={2} />
                      </div>
                      <h3 className="text-xl font-bold mb-2">{b.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {b.body}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS — STEPS */}
        <section className="py-20 md:py-24 px-4">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-14">
              <p className="text-sm font-semibold tracking-widest text-primary uppercase mb-3">
                Implementation
              </p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Four steps from credentials to live traffic
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Each step is server-mediated, audited, and reversible. You can
                roll back to the managed default rail at any time with a single
                toggle.
              </p>
            </div>

            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute left-7 top-2 bottom-2 w-0.5 bg-border hidden md:block"
              />
              <ol className="space-y-6">
                {steps.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <li
                      key={s.number}
                      className="relative animate-fade-in"
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      <div className="flex gap-5 md:gap-8 items-start">
                        <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-lg shadow-md">
                          {s.number}
                        </div>
                        <Card className="flex-1 border-2 border-border hover:border-primary transition-colors">
                          <CardContent className="p-6">
                            <div className="flex items-start gap-3 mb-2">
                              <Icon className="h-5 w-5 text-primary shrink-0 mt-1" />
                              <h3 className="text-xl font-bold">{s.title}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed pl-8">
                              {s.body}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </section>

        {/* ROUTING DIAGRAM */}
        <section className="py-20 md:py-24 px-4 bg-foreground text-background">
          <div className="container mx-auto max-w-5xl">
            <div className="text-center mb-12">
              <p className="text-sm font-semibold tracking-widest uppercase mb-3 opacity-80">
                Routing model
              </p>
              <h2 className="text-3xl md:text-4xl font-bold">
                Deterministic, never silent
              </h2>
            </div>
            <Card className="bg-background/5 border-background/20 text-background">
              <CardContent className="p-6 md:p-10">
                <pre className="text-xs md:text-sm font-mono whitespace-pre overflow-x-auto leading-relaxed">
{`Caller (institution / business / developer)
       │
       ▼
mobile-money-charge   ← UNCHANGED · default = Flutterwave
       │   opt-in: payment-router-charge
       ▼
payment-router-charge ← NEW
       │
       ├── tenant connectors (priority order)
       │       MTN MoMo → Orange Money → tenant Flutterwave
       │
       ▼   on every failure
   KOB-managed Flutterwave (fallback, fully audited)`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* SECURITY GUARANTEES */}
        <section className="py-20 md:py-24 px-4">
          <div className="container mx-auto max-w-5xl">
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <p className="text-sm font-semibold tracking-widest text-primary uppercase mb-3">
                  Security
                </p>
                <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-6">
                  Built to the same standard as the rest of KOB.
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  BYO connectors inherit every guarantee that powers the
                  platform — encrypted credentials, server-side execution,
                  immutable audit trail, and tenant-level isolation through Row
                  Level Security.
                </p>
              </div>
              <ul className="space-y-3">
                {guarantees.map((g) => (
                  <li
                    key={g}
                    className="flex items-start gap-3 p-4 rounded-md border-2 border-border bg-card"
                  >
                    <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm leading-relaxed">{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 md:py-24 px-4 bg-primary text-primary-foreground">
          <div className="container mx-auto max-w-4xl text-center">
            <Layers className="h-12 w-12 mx-auto mb-6 opacity-90" />
            <h2 className="text-3xl md:text-5xl font-black mb-6 leading-tight">
              Ready to take direct ownership of your rails?
            </h2>
            <p className="text-lg opacity-90 mb-10 max-w-2xl mx-auto">
              Start in sandbox in under 10 minutes. Promote to live with a
              single toggle. Keep Flutterwave as your safety net, always.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-semibold"
              >
                <Link to="/developer/connectors/byo-mobile-money">
                  Open the developer guide
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Link to="/contact">Talk to our team</Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs uppercase tracking-widest opacity-80">
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4" /> Opt-in, additive only
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> AES-GCM encrypted
              </span>
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4" /> Audited every call
              </span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
