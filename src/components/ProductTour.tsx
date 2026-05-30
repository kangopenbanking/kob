import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Database,
  Zap,
  Smartphone,
  CreditCard,
  Shield,
  Building2,
  ArrowRight,
  ArrowLeft,
  X,
  Play,
  Globe,
  BarChart3,
  Users,
  Landmark,
  Briefcase,
  UserCircle,
  Webhook,
  FileCode2,
  MessageCircle,
  Banknote,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";

type Segment = "all" | "banks" | "business" | "personal";

interface TourStep {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  bgFrom: string;
  bgTo: string;
  link: string;
  segment: Segment[];
  benefits: string[];
}

const steps: TourStep[] = [
  {
    icon: Database,
    title: "Account Information (AISP)",
    description: "Aggregate balances and transactions from 25+ banks with a single API call. Real-time account data for smarter financial decisions.",
    color: "hsl(210, 70%, 50%)",
    bgFrom: "hsl(210, 80%, 95%)",
    bgTo: "hsl(210, 60%, 88%)",
    link: "/guides/aisp",
    segment: ["all", "banks", "business", "personal"],
    benefits: ["Multi-bank aggregation", "Real-time balances", "Transaction categorisation"],
  },
  {
    icon: Zap,
    title: "Payment Initiation (PISP)",
    description: "Trigger instant bank-to-bank and mobile money payments with Strong Customer Authentication built in.",
    color: "hsl(40, 90%, 45%)",
    bgFrom: "hsl(40, 90%, 94%)",
    bgTo: "hsl(40, 70%, 86%)",
    link: "/guides/pisp",
    segment: ["all", "banks", "business"],
    benefits: ["Instant transfers", "SCA compliant", "Multi-currency support"],
  },
  {
    icon: Banknote,
    title: "Pay by Bank (Redirect SCA)",
    description: "Redirect-based checkout with Strong Customer Authentication. Merchants create a payment intent, users approve in-app or on a hosted page.",
    color: "hsl(160, 60%, 40%)",
    bgFrom: "hsl(160, 60%, 93%)",
    bgTo: "hsl(160, 45%, 85%)",
    link: "/developer/pay-by-bank",
    segment: ["all", "business"],
    benefits: ["Merchant checkout integration", "Hosted authorization page", "Webhook status updates"],
  },
  {
    icon: Smartphone,
    title: "Mobile Money",
    description: "Connect MTN MoMo and Orange Money for collections, disbursements, and wallet-to-bank transfers across CEMAC.",
    color: "hsl(25, 90%, 50%)",
    bgFrom: "hsl(25, 90%, 94%)",
    bgTo: "hsl(25, 70%, 87%)",
    link: "/developer/api/mobile-money",
    segment: ["all", "business", "personal"],
    benefits: ["MTN MoMo & Orange Money", "Collections & payouts", "Wallet-to-bank bridge"],
  },
  {
    icon: CreditCard,
    title: "Virtual Cards",
    description: "Issue Visa/Mastercard virtual cards funded from local XAF accounts for global payments, subscriptions and e-commerce.",
    color: "hsl(270, 60%, 55%)",
    bgFrom: "hsl(270, 60%, 94%)",
    bgTo: "hsl(270, 45%, 87%)",
    link: "/virtual-cards",
    segment: ["all", "business", "personal"],
    benefits: ["Instant issuance", "Spending controls", "Global acceptance"],
  },
  {
    icon: Shield,
    title: "CrediQ Credit Scoring",
    description: "AI-powered alternative credit scoring using transaction data and behavioural analytics for faster, fairer lending decisions.",
    color: "hsl(145, 55%, 40%)",
    bgFrom: "hsl(145, 55%, 93%)",
    bgTo: "hsl(145, 40%, 86%)",
    link: "/crediq",
    segment: ["all", "banks"],
    benefits: ["Alternative data scoring", "Risk band classification", "Overdraft eligibility"],
  },
  {
    icon: Globe,
    title: "International Remittance",
    description: "Cross-border payments with competitive FX rates, real-time tracking, and full compliance with CEMAC regulations.",
    color: "hsl(195, 70%, 45%)",
    bgFrom: "hsl(195, 70%, 93%)",
    bgTo: "hsl(195, 55%, 86%)",
    link: "/remittance",
    segment: ["all", "business", "personal"],
    benefits: ["Competitive FX rates", "Real-time tracking", "Regulatory compliant"],
  },
  {
    icon: Building2,
    title: "Banking Operations",
    description: "Reconciliation, SWIFT messaging, ISO 20022, fee management, and regulatory compliance reporting for financial institutions.",
    color: "hsl(220, 25%, 45%)",
    bgFrom: "hsl(220, 25%, 93%)",
    bgTo: "hsl(220, 20%, 86%)",
    link: "/banking-ops",
    segment: ["all", "banks"],
    benefits: ["Automated reconciliation", "ISO 20022 ready", "Fee management suite"],
  },
  {
    icon: Webhook,
    title: "Webhooks & Events",
    description: "HMAC-SHA256 signed webhooks with 24+ event types, automatic retries, and real-time delivery tracking for reliable integrations.",
    color: "hsl(330, 60%, 50%)",
    bgFrom: "hsl(330, 60%, 94%)",
    bgTo: "hsl(330, 45%, 87%)",
    link: "/developer/webhooks",
    segment: ["all", "business"],
    benefits: ["24+ event types", "HMAC verification", "Automatic retries"],
  },
  {
    icon: FileCode2,
    title: "SDKs & No-Code Tools",
    description: "Official SDKs for Node.js, Python and PHP/Laravel plus plug-and-play integrations with Zapier, Make.com, Bubble.io and Retool.",
    color: "hsl(180, 50%, 40%)",
    bgFrom: "hsl(180, 50%, 93%)",
    bgTo: "hsl(180, 35%, 86%)",
    link: "/developer/sdks",
    segment: ["all", "business"],
    benefits: ["3 official SDKs", "No-code integrations", "Postman collection"],
  },
  {
    icon: MessageCircle,
    title: "Live Support Chat",
    description: "Built-in multi-department support chat with file uploads, agent assignment, real-time messaging and SLA tracking.",
    color: "hsl(260, 55%, 55%)",
    bgFrom: "hsl(260, 55%, 94%)",
    bgTo: "hsl(260, 40%, 87%)",
    link: "/help-centre",
    segment: ["all", "business", "personal"],
    benefits: ["Department routing", "File & image uploads", "15-min response SLA"],
  },
  {
    icon: BarChart3,
    title: "Analytics & Insights",
    description: "Real-time dashboards with transaction analytics, revenue tracking, API usage metrics and downloadable reports.",
    color: "hsl(15, 80%, 50%)",
    bgFrom: "hsl(15, 80%, 94%)",
    bgTo: "hsl(15, 60%, 87%)",
    link: "/developer/api-explorer",
    segment: ["all", "banks", "business"],
    benefits: ["Real-time dashboards", "Revenue tracking", "Exportable reports"],
  },
];

const segmentTabs: { key: Segment; label: string; icon: React.ElementType }[] = [
  { key: "all", label: "All Features", icon: Globe },
  { key: "banks", label: "For Banks", icon: Landmark },
  { key: "business", label: "For Business", icon: Briefcase },
  { key: "personal", label: "For You", icon: UserCircle },
];

export const ProductTour = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [segment, setSegment] = useState<Segment>("all");
  const [direction, setDirection] = useState(1);

  const filtered = steps.filter((s) => s.segment.includes(segment));

  const goTo = useCallback(
    (idx: number) => {
      setDirection(idx > current ? 1 : -1);
      setCurrent(idx);
    },
    [current],
  );

  const next = () => {
    if (current < filtered.length - 1) goTo(current + 1);
  };
  const prev = () => {
    if (current > 0) goTo(current - 1);
  };

  // Reset when segment changes
  useEffect(() => {
    setCurrent(0);
    setDirection(1);
  }, [segment]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (!isOpen) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
        className="fixed bottom-6 right-6 z-50 print:hidden"
      >
        <Button
          size="lg"
          onClick={() => {
            setCurrent(0);
            setSegment("all");
            setIsOpen(true);
          }}
          className="group rounded-full shadow-2xl px-6 gap-2 text-primary-foreground"
          style={{
            background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
          }}
        >
          <Play className="h-4 w-4 transition-transform group-hover:scale-110" />
          Take a Tour
        </Button>
      </motion.div>
    );
  }

  const step = filtered[current];
  if (!step) return null;
  const isLast = current === filtered.length - 1;
  const progress = ((current + 1) / filtered.length) * 100;

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0, scale: 0.96 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0, scale: 0.96 }),
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md print:hidden"
        onClick={() => setIsOpen(false)}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xl mx-4 overflow-hidden rounded-3xl shadow-2xl border border-border/30"
          style={{ background: "hsl(var(--card))" }}
        >
          {/* Header with close and progress */}
          <div className="relative px-5 pt-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{ background: step.color }}
                >
                  <Play className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-foreground">KOB v1 API Tour</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Smooth progress bar */}
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: step.color }}
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
              />
            </div>
          </div>

          {/* Segment tabs */}
          <div className="px-5 pb-3">
            <div className="flex gap-1.5 p-1 rounded-xl bg-muted/60">
              {segmentTabs.map((tab) => {
                const active = segment === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setSegment(tab.key)}
                    className={`relative flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="tour-segment-bg"
                        className="absolute inset-0 rounded-lg bg-background shadow-sm"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <tab.icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content slide */}
          <div className="px-5 pb-4 overflow-hidden" style={{ minHeight: 280 }}>
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={`${segment}-${current}`}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                {/* Gradient card header */}
                <div
                  className="rounded-2xl p-5 mb-4"
                  style={{
                    background: `linear-gradient(135deg, ${step.bgFrom}, ${step.bgTo})`,
                  }}
                >
                  <div className="flex items-start gap-4">
                    <motion.div
                      initial={{ rotate: -10, scale: 0.8 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 250, delay: 0.1 }}
                      className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                      style={{ backgroundColor: step.color }}
                    >
                      <step.icon className="h-7 w-7 text-white" strokeWidth={1.5} />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium mb-1" style={{ color: step.color }}>
                        {current + 1} of {filtered.length}
                      </div>
                      <h3
                        className="text-lg font-bold leading-tight mb-1"
                        style={{ color: "hsl(var(--foreground))" }}
                      >
                        {step.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Benefits pills */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {step.benefits.map((b, i) => (
                    <motion.span
                      key={b}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.07 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border"
                      style={{
                        borderColor: `${step.color}30`,
                        backgroundColor: `${step.bgFrom}`,
                        color: step.color,
                      }}
                    >
                      <ChevronRight className="h-3 w-3" />
                      {b}
                    </motion.span>
                  ))}
                </div>

                {/* Descriptive deep link to the feature being highlighted */}
                <Link
                  to={step.link}
                  onClick={() => setIsOpen(false)}
                  aria-label={`Explore ${step.title}`}
                  className="inline-flex items-center gap-1 text-sm font-medium hover:underline transition-colors"
                  style={{ color: step.color }}
                >
                  Explore {step.title} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer dots + nav */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-border/50 bg-muted/20">
            {/* Dots */}
            <div className="flex items-center gap-1">
              {filtered.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className="p-0.5"
                  aria-label={`Go to step ${i + 1}`}
                >
                  <motion.div
                    className="rounded-full"
                    animate={{
                      width: i === current ? 20 : 6,
                      height: 6,
                      backgroundColor: i === current ? step.color : "hsl(var(--muted-foreground) / 0.25)",
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                </button>
              ))}
            </div>

            {/* Nav buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={prev}
                disabled={current === 0}
                className="rounded-full h-9 w-9 p-0 border-secondary bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {isLast ? (
                <Button
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full px-5 text-primary-foreground"
                  style={{
                    background: `linear-gradient(135deg, ${step.color}, ${step.color}cc)`,
                  }}
                >
                  Finish Tour
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={next}
                  className="rounded-full px-5 gap-1 text-primary-foreground"
                  style={{
                    background: `linear-gradient(135deg, ${step.color}, ${step.color}cc)`,
                  }}
                >
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
