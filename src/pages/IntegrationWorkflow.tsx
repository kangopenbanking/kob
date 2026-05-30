import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import { motion, useScroll, useSpring } from "framer-motion";
import {
  ArrowRight,
  UserCheck,
  Key,
  Code,
  CreditCard,
  Shield,
  Calculator,
  Book,
  Activity,
  TestTube,
  Rocket,
  Headphones,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  LineChart,
  Users,
} from "lucide-react";
import { IntegrationFlowDiagram } from "@/components/workflow/IntegrationFlowDiagram";
import { OAuthFlowDiagram } from "@/components/workflow/OAuthFlowDiagram";
import { FeeCalculationDiagram } from "@/components/workflow/FeeCalculationDiagram";
import { SystemArchitectureDiagram } from "@/components/workflow/SystemArchitectureDiagram";
import { TimelineEstimator } from "@/components/workflow/TimelineEstimator";
import { DocNavigation } from "@/components/developer/DocNavigation";

import kobSecurity from "@/assets/integration/kob-security.png";
import kobOnboarding from "@/assets/integration/kob-onboarding.png";
import kobChannels from "@/assets/integration/kob-channels.png";
import kobOrb from "@/assets/integration/kob-orb.png";
import kobCommunity from "@/assets/integration/kob-community.jpg";

const phases = [
  {
    number: 1,
    title: "Registration & Onboarding",
    duration: "Week 1-2",
    icon: UserCheck,
    color: "bg-blue-500",
    description: "Register your institution and complete KYC verification",
    tasks: [
      "Submit institution registration form",
      "Upload required documents (Business license, Tax ID, COBAC certification)",
      "Complete KYC/AML verification",
      "Receive approval notification (2-3 business days)",
    ],
    status: "critical",
  },
  {
    number: 2,
    title: "Access & Credentials",
    duration: "Week 2",
    icon: Key,
    color: "bg-blue-500",
    description: "Obtain API credentials and access the FI Portal",
    tasks: [
      "Access FI Portal dashboard",
      "Generate sandbox API credentials (Client ID, Client Secret)",
      "Review API documentation and integration guides",
      "Set up webhook endpoints (optional)",
    ],
    status: "critical",
  },
  {
    number: 3,
    title: "Technical Integration",
    duration: "Week 3-6",
    icon: Code,
    color: "bg-green-500",
    description: "Implement OAuth 2.0 authentication and core APIs",
    tasks: [
      "Implement OAuth 2.0 + FAPI 1.0 authentication flow",
      "Integrate AISP APIs (accounts, balances, transactions)",
      "Integrate PISP APIs (payment initiation, status)",
      "Implement error handling and retry logic",
      "Set up webhook listeners for async notifications",
    ],
    status: "development",
  },
  {
    number: 4,
    title: "Payment Processing",
    duration: "Week 4-6",
    icon: CreditCard,
    color: "bg-green-500",
    description: "Enable payment channels and transaction processing",
    tasks: [
      "Integrate Mobile Money (MTN, Orange) for XAF",
      "Set up card payments via Stripe (optional)",
      "Configure bank transfer gateway (optional)",
      "Implement mobile-to-bank transfer flows",
      "Test payment reconciliation",
    ],
    status: "development",
  },
  {
    number: 5,
    title: "Compliance & Customer Management",
    duration: "Week 5-7",
    icon: Shield,
    color: "bg-orange-500",
    description: "Implement KYC, AML, and regulatory compliance",
    tasks: [
      "Set up KYC/AML verification workflows",
      "Implement sanctions screening (OFAC, UN, EU)",
      "Configure Strong Customer Authentication (SCA)",
      "Set up transaction monitoring and alerts",
      "Enable consent management for GDPR compliance",
      "Configure audit trail logging",
    ],
    status: "compliance",
  },
  {
    number: 6,
    title: "Fee Management",
    duration: "Week 6-8",
    icon: Calculator,
    color: "bg-purple-500",
    description: "Configure fee structures and billing",
    tasks: [
      "Review pricing models (fixed, percentage, tiered)",
      "Configure custom fee structures for your institution",
      "Set up automated invoice generation",
      "Test fee calculation workflows",
      "Configure waiver rules (optional)",
    ],
    status: "operations",
  },
  {
    number: 7,
    title: "Developer Tools",
    duration: "Week 6-8",
    icon: Book,
    color: "bg-green-500",
    description: "Familiarize with developer resources",
    tasks: [
      "Explore API Console for live testing",
      "Review code examples (Node.js, Python, PHP)",
      "Set up SDKs in your development environment",
      "Configure webhook event subscriptions",
      "Access API status page for monitoring",
    ],
    status: "development",
  },
  {
    number: 8,
    title: "Monitoring & Analytics",
    duration: "Week 7-8",
    icon: Activity,
    color: "bg-gray-500",
    description: "Set up monitoring and analytics dashboards",
    tasks: [
      "Configure system health monitoring",
      "Set up alerting for critical events",
      "Review analytics dashboard for API usage",
      "Configure error tracking and logging",
      "Set up performance monitoring",
    ],
    status: "monitoring",
  },
  {
    number: 9,
    title: "Testing & Certification",
    duration: "Week 8-10",
    icon: TestTube,
    color: "bg-green-500",
    description: "Comprehensive testing and security audit",
    tasks: [
      "Complete functional testing in sandbox",
      "Perform security penetration testing",
      "Conduct vulnerability assessment",
      "Complete compliance audit checklist",
      "Load testing for production readiness",
      "Submit certification application",
    ],
    status: "testing",
  },
  {
    number: 10,
    title: "Production Deployment",
    duration: "Week 10",
    icon: Rocket,
    color: "bg-purple-500",
    description: "Go live with production credentials",
    tasks: [
      "Receive production API credentials",
      "Update configuration to production endpoints",
      "Perform smoke testing in production",
      "Monitor initial transactions closely",
      "Confirm go-live with Kang Open Banking team",
    ],
    status: "production",
  },
  {
    number: 11,
    title: "Ongoing Operations",
    duration: "Ongoing",
    icon: Headphones,
    color: "bg-gray-500",
    description: "Continuous monitoring and support",
    tasks: [
      "Monitor API health and performance",
      "Review monthly analytics reports",
      "Stay updated with API changes via changelog",
      "Access 24/7 technical support",
      "Participate in quarterly business reviews",
    ],
    status: "monitoring",
  },
];

const statusConfig = {
  critical: { label: "Critical", class: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  development: { label: "Development", class: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  compliance: { label: "Compliance", class: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  operations: { label: "Operations", class: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  testing: { label: "Testing", class: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  production: { label: "Production", class: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  monitoring: { label: "Monitoring", class: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
};

// Reusable scroll-reveal wrapper
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.2, 0.65, 0.3, 0.95] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const highlightImagery: Record<number, string> = {
  1: kobOnboarding,
  3: kobChannels,
  5: kobSecurity,
  11: kobCommunity,
};

export default function IntegrationWorkflow() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 25, mass: 0.4 });

  return (
    <>
      {/* Top scroll-progress bar */}
      <motion.div
        aria-hidden
        style={{ scaleX: progress, transformOrigin: "0% 50%" }}
        className="fixed left-0 right-0 top-0 z-50 h-[3px] bg-primary"
      />

      <div className="container mx-auto px-4 py-10 max-w-6xl">
        {/* Announcement banner */}
        <Reveal>
          <div
            role="region"
            aria-label="Integration programme announcement"
            className="mb-10 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary/40 bg-primary/5 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm">
              <span className="font-medium">Q3 2026 cohort is open.</span>{" "}
              <span className="text-muted-foreground">
                Average institution goes live in 8.4 weeks with our guided sandbox track.
              </span>
            </p>
            <div className="ml-auto flex gap-2">
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link to="/developer/sandbox/api">Try sandbox</Link>
              </Button>
              <Button asChild size="sm" className="h-8">
                <Link to="/register">
                  Join the cohort <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>

        {/* Hero with illustration */}
        <section
          aria-label="Integration workflow overview"
          className="relative mb-16 overflow-hidden rounded-2xl border border-border bg-card"
        >
          {/* Decorative orb image (uses an asset, no CSS gradients) */}
          <img
            src={kobOrb}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-[460px] w-[460px] object-cover opacity-40 dark:opacity-25 hidden md:block"
            loading="lazy"
          />
          <div className="relative grid gap-10 p-8 md:grid-cols-[1.2fr_1fr] md:p-12">
            <div className="space-y-6">
              <Badge variant="outline" className="uppercase tracking-wider">
                Integration guide
              </Badge>
              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.2, 0.65, 0.3, 0.95] }}
                className="text-4xl font-bold leading-tight tracking-tight md:text-5xl"
              >
                A measured path from registration to production.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="max-w-xl text-lg text-muted-foreground"
              >
                Eleven defined phases. Clear deliverables. Compliance, payments,
                and operations engineered together so your team ships with
                confidence.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.18 }}
                className="flex flex-wrap gap-3"
              >
                <Button asChild size="lg">
                  <Link to="/register">
                    Start integration <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/developer/getting-started">Developer docs</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/pricing">View pricing</Link>
                </Button>
              </motion.div>

              {/* Live stat strip */}
              <div className="grid grid-cols-3 gap-4 border-t border-border pt-6">
                {[
                  { label: "Avg. go-live", value: "8.4 wk" },
                  { label: "Sandbox uptime", value: "99.97%" },
                  { label: "Institutions onboarded", value: "42+" },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.25 + i * 0.07 }}
                  >
                    <div className="text-2xl font-semibold tracking-tight">{stat.value}</div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      {stat.label}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Illustration card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.2, 0.65, 0.3, 0.95] }}
              className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-[#0a1633]"
            >
              <img
                src={kobSecurity}
                alt="Signed, verified, encrypted credentials illustration"
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-x-4 bottom-4 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white backdrop-blur-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Shield className="h-3.5 w-3.5" />
                  FAPI 1.0 Advanced · mTLS · PAR · PKCE
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Themed illustration row using uploads */}
        <Reveal>
          <div className="mb-16 grid gap-6 md:grid-cols-3">
            {[
              {
                img: kobOnboarding,
                bg: "bg-[#dbe5ff]",
                Icon: Users,
                title: "Two-sided onboarding",
                copy: "Institution KYB and end-user KYC run in parallel so customers never wait on paperwork.",
              },
              {
                img: kobChannels,
                bg: "bg-[#0a1633]",
                Icon: LineChart,
                title: "Every channel, one ledger",
                copy: "Mobile Money, cards, bank rails and recurring billing reconciled to a single source of truth.",
              },
              {
                img: kobSecurity,
                bg: "bg-[#0a1633]",
                Icon: Shield,
                title: "Compliance-grade by default",
                copy: "Signed artifacts, audited APIs and FAPI 1.0 Advanced security profile across the entire stack.",
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.55, delay: i * 0.08 }}
                whileHover={{ y: -3 }}
                className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
              >
                <div className={`relative aspect-[16/10] overflow-hidden ${card.bg}`}>
                  <img
                    src={card.img}
                    alt=""
                    aria-hidden
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="space-y-2 p-5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <card.Icon className="h-4 w-4 text-primary" />
                    {card.title}
                  </div>
                  <p className="text-sm text-muted-foreground">{card.copy}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Reveal>

        {/* Timeline Estimator */}
        <Reveal>
          <div className="mb-16">
            <TimelineEstimator />
          </div>
        </Reveal>

        {/* Main Integration Flow Diagram */}
        <Reveal>
          <Card className="mb-12">
            <CardHeader>
              <CardTitle>Complete integration flow</CardTitle>
              <CardDescription>
                Visual overview of all 11 phases from registration to ongoing operations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IntegrationFlowDiagram />
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Badge className="bg-blue-500">Registration & Setup</Badge>
                <Badge className="bg-green-500">Development</Badge>
                <Badge className="bg-orange-500">Compliance & Security</Badge>
                <Badge className="bg-purple-500">Operations & Billing</Badge>
                <Badge className="bg-gray-500">Monitoring & Support</Badge>
              </div>
            </CardContent>
          </Card>
        </Reveal>

        {/* Technical Architecture */}
        <Reveal>
          <Card className="mb-12">
            <CardHeader>
              <CardTitle>System architecture</CardTitle>
              <CardDescription>
                High-level overview of the Kang Open Banking platform architecture.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SystemArchitectureDiagram />
              <div className="mt-6 rounded-lg bg-muted p-4">
                <p className="text-sm">
                  <strong>Architecture highlights:</strong> The platform uses a
                  microservices architecture with dedicated services for AISP,
                  PISP, Mobile Money, Banking Operations, KYC/AML and Fee
                  Management. All services are protected by OAuth 2.0 + FAPI 1.0
                  Advanced authentication with rate limiting and response
                  caching.
                </p>
              </div>
            </CardContent>
          </Card>
        </Reveal>

        {/* Tabbed Technical Details */}
        <Reveal>
          <Tabs defaultValue="phases" className="mb-12">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="phases">Integration phases</TabsTrigger>
              <TabsTrigger value="oauth">OAuth flow</TabsTrigger>
              <TabsTrigger value="fees">Fee processing</TabsTrigger>
            </TabsList>

            <TabsContent value="phases" className="mt-6 space-y-6">
              {phases.map((phase, idx) => {
                const Icon = phase.icon;
                const status = statusConfig[phase.status as keyof typeof statusConfig];
                const illustration = highlightImagery[phase.number];

                return (
                  <motion.div
                    key={phase.number}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.5, delay: Math.min(idx, 4) * 0.04 }}
                  >
                    <Card
                      className="border-l-4 transition-shadow hover:shadow-md"
                      style={{ borderLeftColor: phase.color.replace("bg-", "#").replace("-500", "") }}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className={`${phase.color} rounded-lg p-3`}>
                              <Icon className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <CardTitle className="text-xl">
                                  Phase {phase.number}: {phase.title}
                                </CardTitle>
                                <Badge variant="outline" className={status.class}>
                                  {status.label}
                                </Badge>
                              </div>
                              <CardDescription className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                {phase.duration}
                              </CardDescription>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div
                          className={`grid gap-6 ${
                            illustration ? "md:grid-cols-[1fr_220px]" : ""
                          }`}
                        >
                          <div>
                            <p className="mb-4 text-muted-foreground">{phase.description}</p>
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold">Key tasks:</h4>
                              <ul className="space-y-2">
                                {phase.tasks.map((task, index) => (
                                  <li key={index} className="flex items-start gap-2 text-sm">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                                    <span>{task}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          {illustration && (
                            <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                              <img
                                src={illustration}
                                alt=""
                                aria-hidden
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </TabsContent>

            <TabsContent value="oauth" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>OAuth 2.0 + FAPI 1.0 authentication flow</CardTitle>
                  <CardDescription>
                    Secure authentication using OAuth 2.0 with Financial-grade API
                    (FAPI) 1.0 Advanced profile.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <OAuthFlowDiagram />
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg bg-muted p-4">
                      <h4 className="mb-2 flex items-center gap-2 font-semibold">
                        <Shield className="h-4 w-4 text-primary" />
                        Security features
                      </h4>
                      <ul className="list-inside list-disc space-y-1 text-sm">
                        <li>Pushed Authorization Request (PAR)</li>
                        <li>JWT-secured Authorization Request (JAR)</li>
                        <li>Mutual TLS (mTLS) for client authentication</li>
                        <li>PKCE for authorization code flow</li>
                        <li>Token binding and rotation</li>
                      </ul>
                    </div>
                    <div className="rounded-lg bg-muted p-4">
                      <h4 className="mb-2 flex items-center gap-2 font-semibold">
                        <Code className="h-4 w-4 text-primary" />
                        Implementation steps
                      </h4>
                      <ul className="list-inside list-disc space-y-1 text-sm">
                        <li>Register your OAuth client</li>
                        <li>Implement PAR endpoint call</li>
                        <li>Handle authorization redirect</li>
                        <li>Exchange code for tokens</li>
                        <li>Use access token for API calls</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-4">
                    <Button asChild variant="outline">
                      <Link to="/guides/security">Security guide</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/developer/getting-started">Get started</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fees" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Fee calculation & billing workflow</CardTitle>
                  <CardDescription>
                    Automated fee calculation, waiver application, and monthly
                    invoice generation.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FeeCalculationDiagram />
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg bg-muted p-4">
                      <h4 className="mb-2 font-semibold">Fee models</h4>
                      <ul className="space-y-2 text-sm">
                        <li><strong>Fixed:</strong> Set amount per transaction (e.g., 500 XAF)</li>
                        <li><strong>Percentage:</strong> % of transaction value (e.g., 0.5%)</li>
                        <li><strong>Hybrid:</strong> Fixed + Percentage (e.g., 200 XAF + 0.3%)</li>
                        <li><strong>Tiered:</strong> Volume-based pricing with breakpoints</li>
                      </ul>
                    </div>
                    <div className="rounded-lg bg-muted p-4">
                      <h4 className="mb-2 font-semibold">Waiver rules</h4>
                      <ul className="space-y-2 text-sm">
                        <li><strong>Promotional:</strong> Time-limited fee waivers</li>
                        <li><strong>Volume-based:</strong> Discounts for high-volume clients</li>
                        <li><strong>Partner:</strong> Special rates for strategic partners</li>
                        <li><strong>Custom:</strong> Negotiated waiver agreements</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-6">
                    <Button asChild variant="outline">
                      <Link to="/pricing">View pricing details</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </Reveal>

        {/* Implementation Guidelines */}
        <Reveal>
          <Card className="mb-12">
            <CardHeader>
              <CardTitle>Implementation guidelines</CardTitle>
              <CardDescription>
                Best practices and recommendations for successful integration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-3 flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Prerequisites
                  </h3>
                  <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                    <li>Valid business registration in Cameroon</li>
                    <li>COBAC licensing (for banks/FIs)</li>
                    <li>Technical team with OAuth 2.0 experience</li>
                    <li>Dedicated server/infrastructure for production</li>
                    <li>SSL/TLS certificates for mTLS</li>
                  </ul>
                </div>
                <div>
                  <h3 className="mb-3 flex items-center gap-2 font-semibold">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    Common pitfalls to avoid
                  </h3>
                  <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                    <li>Skipping sandbox testing phase</li>
                    <li>Inadequate error handling and retry logic</li>
                    <li>Not implementing webhook listeners</li>
                    <li>Ignoring rate limiting guidelines</li>
                    <li>Insufficient security audit before production</li>
                  </ul>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="mb-3 font-semibold">Testing strategy</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { title: "Unit testing", copy: "Test individual API endpoints, authentication flows, and data validation." },
                    { title: "Integration testing", copy: "Test end-to-end workflows including payments, reconciliation, and webhooks." },
                    { title: "Load testing", copy: "Simulate production traffic to ensure performance under load." },
                  ].map((t, i) => (
                    <motion.div
                      key={t.title}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.06 }}
                    >
                      <Card className="h-full border-primary/20 transition-shadow hover:shadow-md">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">{t.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">{t.copy}</CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Community-style CTA using merchant photo */}
              <div className="grid overflow-hidden rounded-xl border border-border md:grid-cols-[1.4fr_1fr]">
                <div className="space-y-3 p-6">
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    <Rocket className="h-5 w-5 text-primary" />
                    Ready to start integration?
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Register your institution to receive sandbox credentials and
                    begin your integration journey today. Our solutions team
                    pairs every cohort with a dedicated integration engineer.
                  </p>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Button asChild>
                      <Link to="/register">Register now</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/contact">Contact sales</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/developer/console">API console</Link>
                    </Button>
                  </div>
                </div>
                <div className="relative hidden min-h-[180px] md:block">
                  <img
                    src={kobCommunity}
                    alt="Customers using Kang Open Banking on their phones"
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </Reveal>

        {/* Resources Section */}
        <Reveal>
          <Card>
            <CardHeader>
              <CardTitle>Additional resources</CardTitle>
              <CardDescription>
                Helpful links and documentation for your integration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { to: "/developer/getting-started", Icon: Book, title: "Getting started guide", copy: "Step-by-step tutorial for your first API integration." },
                  { to: "/developer/api/aisp", Icon: Code, title: "API reference", copy: "Complete API documentation with examples." },
                  { to: "/developer/code-examples", Icon: Code, title: "Code examples", copy: "Sample code in Node.js, Python, PHP, and more." },
                ].map((r) => (
                  <Link key={r.to} to={r.to} className="group">
                    <Card className="h-full border-primary/20 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
                      <CardHeader>
                        <r.Icon className="mb-2 h-8 w-8 text-primary" />
                        <CardTitle className="text-base">{r.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">{r.copy}</CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </Reveal>

        {/* Navigation Footer */}
        <DocNavigation
          nextPage={{
            title: "Getting Started",
            path: "/developer/getting-started",
          }}
        />
      </div>
    </>
  );
}
