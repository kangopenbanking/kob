import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Building2,
  Smartphone,
  CreditCard,
  Shield,
  Code2,
  ArrowRight,
  Landmark,
  Wifi,
  Globe,
  Zap,
  Lock,
  BarChart3,
  X,
  ChevronRight,
  Wallet,
  Repeat,
  Receipt,
  ScrollText,
  Send,
  KeyRound,
  Webhook,
  Network,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { cn } from "@/lib/utils";
import { KOB_API_VERSION } from "@/config/version";

// ── Types ──────────────────────────────────────────────────────────────────
type NodeId =
  | "banks"
  | "mobile-money"
  | "kob-core"
  | "fintechs"
  | "regulators"
  | "developers"
  | "compliance"
  | "payments";

type NodeData = {
  id: NodeId;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  description: string;
  items: string[];
  connections: NodeId[];
  badge?: string;
};

// ── Node definitions ───────────────────────────────────────────────────────
const NODES: Record<NodeId, NodeData> = {
  banks: {
    id: "banks",
    label: "Commercial Banks",
    sublabel: "25+ institutions",
    icon: Building2,
    color: "hsl(217 91% 60%)",
    bg: "hsl(217 91% 35% / 0.08)",
    border: "hsl(217 91% 35% / 0.3)",
    description:
      "KOB connects directly to commercial banks across Central Africa, enabling real-time balance reads, transaction history, and direct debit via AISP/PISP consent flows.",
    items: [
      "Afriland First Bank",
      "BICEC",
      "SCB Cameroon",
      "UBA Cameroon",
      "20+ more banks",
    ],
    connections: ["kob-core"],
    badge: "AISP / PISP",
  },
  "mobile-money": {
    id: "mobile-money",
    label: "Mobile Money",
    sublabel: "MTN · Orange",
    icon: Smartphone,
    color: "hsl(38 92% 50%)",
    bg: "hsl(38 92% 50% / 0.08)",
    border: "hsl(38 92% 50% / 0.3)",
    description:
      "Native integration with MTN Mobile Money and Orange Money wallets across 8 currencies. Supports charge (collection), transfer (payout), and mobile-to-bank flows.",
    items: [
      "MTN Mobile Money",
      "Orange Money",
      "XAF · NGN · GHS · KES",
      "UGX · TZS · ZAR · RWF",
      "Flutterwave powered",
    ],
    connections: ["kob-core"],
    badge: "8 Currencies",
  },
  "kob-core": {
    id: "kob-core",
    label: "KOB Core Platform",
    sublabel: "The unifying layer",
    icon: Zap,
    color: "hsl(142 76% 40%)",
    bg: "hsl(142 76% 36% / 0.10)",
    border: "hsl(142 76% 36% / 0.4)",
    description:
      "The central intelligence layer. KOB normalises data from every connected source, enforces consent, handles security, and exposes a single unified API for all downstream consumers.",
    items: [
      "OAuth 2.0 + PKCE Auth",
      "Consent Management (AISP/PISP)",
      "Fee & Settlement Engine",
      "Webhook Delivery",
      "ISO 20022 / SWIFT messaging",
      "CrediQ Credit Scoring",
    ],
    connections: ["fintechs", "developers", "compliance", "payments"],
    badge: "Core",
  },
  payments: {
    id: "payments",
    label: "Payment Rails",
    sublabel: "Stripe · Flutterwave",
    icon: CreditCard,
    color: "hsl(258 90% 60%)",
    bg: "hsl(258 90% 60% / 0.08)",
    border: "hsl(258 90% 60% / 0.3)",
    description:
      "Card payments via Stripe (135+ currencies, 3DS2, SCA) and bank transfers via Flutterwave. Virtual cards issued in USD for global e-commerce spending.",
    items: [
      "Stripe Payment Intents",
      "Virtual Card Issuance",
      "Flutterwave Bank Transfer",
      "PCI DSS Level 1",
      "Real-time webhook confirmation",
    ],
    connections: ["kob-core"],
    badge: "PCI DSS",
  },
  fintechs: {
    id: "fintechs",
    label: "Fintechs & Businesses",
    sublabel: "TPP integrations",
    icon: Code2,
    color: "hsl(199 89% 48%)",
    bg: "hsl(199 89% 48% / 0.08)",
    border: "hsl(199 89% 48% / 0.3)",
    description:
      "Third-party providers and businesses consume KOB APIs to build financial products — from lending apps to payroll systems — using our sandbox, SDKs, and no-code connectors.",
    items: [
      "REST API (v1 OpenAPI 3.1)",
      "Sandbox environment",
      "Zapier / Make / Bubble",
      "WooCommerce plugin",
      "JS / Python / PHP SDKs",
    ],
    connections: ["kob-core"],
    badge: "TPP",
  },
  developers: {
    id: "developers",
    label: "Developer Portal",
    sublabel: "Build & test",
    icon: Globe,
    color: "hsl(168 83% 40%)",
    bg: "hsl(168 83% 40% / 0.08)",
    border: "hsl(168 83% 40% / 0.3)",
    description:
      "A full developer experience: interactive API playground, sandbox data generator, webhook testing, certificate management, and comprehensive reference documentation.",
    items: [
      "Interactive API Console",
      "Sandbox Data Generator",
      "Webhook Inspector",
      "mTLS Certificate Mgmt",
      "30+ guide pages",
    ],
    connections: ["kob-core"],
    badge: "DevEx",
  },
  regulators: {
    id: "regulators",
    label: "Regulators",
    sublabel: "COBAC · BEAC · CEMAC",
    icon: Landmark,
    color: "hsl(0 84% 55%)",
    bg: "hsl(0 84% 55% / 0.08)",
    border: "hsl(0 84% 55% / 0.3)",
    description:
      "KOB is built for Central African regulatory compliance. Real-time reporting pipelines feed COBAC and BEAC with transaction data, AML flags, and consent audit trails.",
    items: [
      "COBAC reporting",
      "BEAC settlement data",
      "CEMAC compliance",
      "AML / CFT screening",
      "Audit trail export",
    ],
    connections: ["compliance"],
    badge: "Compliance",
  },
  compliance: {
    id: "compliance",
    label: "Compliance Engine",
    sublabel: "KYC · AML · Audit",
    icon: Shield,
    color: "hsl(351 88% 46%)",
    bg: "hsl(351 88% 46% / 0.08)",
    border: "hsl(351 88% 46% / 0.3)",
    description:
      "End-to-end compliance infrastructure: KYC/KYB identity verification, AML transaction screening, sanctions checks, consent event logging, and automated regulatory report generation.",
    items: [
      "KYC / KYB Verification",
      "Sanctions Screening",
      "Consent Event Log",
      "Compliance Report Gen",
      "Risk Scoring Engine",
    ],
    connections: ["kob-core", "regulators"],
    badge: "KYC / AML",
  },
};

// ── Layout positions (percent-based on a 1200×700 canvas) ─────────────────
const POSITIONS: Record<NodeId, { x: number; y: number }> = {
  banks: { x: 4, y: 30 },
  "mobile-money": { x: 4, y: 62 },
  "kob-core": { x: 36, y: 44 },
  payments: { x: 68, y: 62 },
  fintechs: { x: 68, y: 14 },
  developers: { x: 68, y: 38 },
  compliance: { x: 36, y: 14 },
  regulators: { x: 4, y: 5 },
};

// Connection pairs [from, to]
const CONNECTIONS: [NodeId, NodeId][] = [
  ["banks", "kob-core"],
  ["mobile-money", "kob-core"],
  ["payments", "kob-core"],
  ["kob-core", "fintechs"],
  ["kob-core", "developers"],
  ["kob-core", "compliance"],
  ["compliance", "regulators"],
];

// ── SVG arrow between two nodes ────────────────────────────────────────────
const NODE_W = 22; // % of canvas width
const NODE_H = 14; // % of canvas height

function Arrow({
  from,
  to,
  active,
  highlight,
}: {
  from: NodeId;
  to: NodeId;
  active: boolean;
  highlight: boolean;
}) {
  const f = POSITIONS[from];
  const t = POSITIONS[to];
  // Center of each node
  const fx = f.x + NODE_W / 2;
  const fy = f.y + NODE_H / 2;
  const tx = t.x + NODE_W / 2;
  const ty = t.y + NODE_H / 2;

  // Bezier control points
  const mx = (fx + tx) / 2;
  const d = `M ${fx} ${fy} C ${mx} ${fy}, ${mx} ${ty}, ${tx} ${ty}`;

  const color = highlight
    ? "hsl(142 76% 40%)"
    : active
    ? "hsl(217 91% 60%)"
    : "hsl(214 32% 80%)";

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={highlight ? 0.6 : 0.35}
        strokeDasharray={highlight ? "none" : "2 2"}
        opacity={highlight || active ? 1 : 0.5}
        vectorEffect="non-scaling-stroke"
      />
      {/* arrowhead */}
      <marker id={`arrow-${from}-${to}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
        <path d="M 0 0 L 6 3 L 0 6 Z" fill={color} />
      </marker>
    </g>
  );
}

// ── Single node card ───────────────────────────────────────────────────────
function DiagramNode({
  node,
  selected,
  onClick,
}: {
  node: NodeData;
  selected: boolean;
  onClick: () => void;
}) {
  const pos = POSITIONS[node.id];
  const Icon = node.icon;
  const isCore = node.id === "kob-core";

  return (
    <motion.div
      style={{
        position: "absolute",
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        width: `${NODE_W}%`,
      }}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: Object.keys(POSITIONS).indexOf(node.id) * 0.06 }}
    >
      <button
        onClick={onClick}
        className={cn(
          "w-full rounded-xl border p-3 text-left transition-all duration-200 group",
          "hover:shadow-md hover:-translate-y-0.5",
          selected
            ? "shadow-lg ring-2 ring-offset-1"
            : "hover:border-opacity-60",
          isCore && "shadow-md"
        )}
        style={{
          background: selected ? node.bg : isCore ? node.bg : "hsl(var(--card))",
          borderColor: selected ? node.color : isCore ? node.border : "hsl(var(--border))",
          // @ts-ignore
          "--tw-ring-color": node.color,
        }}
      >
        <div className="flex items-start gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: node.color }}
          >
            <Icon size={14} className="text-white" />
          </div>
          <div className="min-w-0">
            <p
              className={cn(
                "font-semibold text-xs leading-tight truncate",
                isCore ? "text-sm" : ""
              )}
              style={{ color: selected || isCore ? node.color : undefined }}
            >
              {node.label}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {node.sublabel}
            </p>
            {node.badge && (
              <span
                className="inline-block mt-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: `${node.color}20`, color: node.color }}
              >
                {node.badge}
              </span>
            )}
          </div>
        </div>
      </button>
    </motion.div>
  );
}

// ── Stat chips ─────────────────────────────────────────────────────────────
const STATS = [
  { icon: Building2, value: "25+", label: "Banks" },
  { icon: Smartphone, value: "2", label: "MNOs" },
  { icon: Code2, value: "155+", label: "Edge Functions" },
  { icon: CreditCard, value: "135+", label: "Currencies" },
  { icon: Lock, value: "PCI DSS", label: "Level 1" },
  { icon: BarChart3, value: "<2s", label: "API Latency" },
];

// ── Flow steps for the animated legend ────────────────────────────────────
const FLOWS = [
  {
    label: "A fintech app requests account data",
    path: ["fintechs", "kob-core", "banks"],
    color: "hsl(199 89% 48%)",
  },
  {
    label: "User pays via Mobile Money",
    path: ["mobile-money", "kob-core", "payments"],
    color: "hsl(38 92% 50%)",
  },
  {
    label: "Regulator receives compliance report",
    path: ["kob-core", "compliance", "regulators"],
    color: "hsl(351 88% 46%)",
  },
];

// ── Main page ──────────────────────────────────────────────────────────────
export default function Architecture() {
  const [selected, setSelected] = useState<NodeId | null>("kob-core");
  const [activeFlow, setActiveFlow] = useState<number | null>(null);

  const selectedNode = selected ? NODES[selected] : null;

  const toggle = (id: NodeId) => setSelected((prev) => (prev === id ? null : id));

  const highlightedNodes = new Set<NodeId>();
  const highlightedEdges = new Set<string>();
  if (activeFlow !== null) {
    const path = FLOWS[activeFlow].path as NodeId[];
    path.forEach((n) => highlightedNodes.add(n));
    for (let i = 0; i < path.length - 1; i++) {
      highlightedEdges.add(`${path[i]}-${path[i + 1]}`);
      highlightedEdges.add(`${path[i + 1]}-${path[i]}`);
    }
  }

  return (
    <>
      <SEO
        title="Platform Architecture | KOB Open Banking"
        description="Visual diagram of how KOB connects banks, mobile money operators, fintechs, and regulators in one unified platform."
      />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[hsl(217_91%_12%)] py-16 px-6 text-center">
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 70% 50% at 50% 50%, hsl(217 91% 55%), transparent)",
          }}
        />
        <div className="relative max-w-3xl mx-auto space-y-4">
          <Badge className="bg-[hsl(142_76%_36%/0.2)] text-[hsl(142_76%_60%)] border border-[hsl(142_76%_36%/0.4)] uppercase tracking-widest text-xs">
            <Wifi size={10} className="mr-1" /> Platform Architecture
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            One API.{" "}
            <span className="text-[hsl(142_76%_60%)]">Every Connection.</span>
          </h1>
          <p className="text-[hsl(217_40%_72%)] text-lg max-w-2xl mx-auto">
            KOB sits at the centre of the financial ecosystem — normalising data
            from banks, mobile money, and payment rails into a single secure API
            surface for fintechs and regulators alike.
          </p>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <div className="border-b bg-muted/30 py-4 px-6 overflow-x-auto">
        <div className="flex items-center justify-center gap-8 min-w-max mx-auto">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <Icon size={14} className="text-primary flex-shrink-0" />
              <span className="font-bold text-foreground">{value}</span>
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main diagram ── */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">

          {/* Diagram canvas */}
          <div>
            {/* Flow highlights */}
            <div className="flex gap-2 flex-wrap mb-4">
              <span className="text-xs text-muted-foreground self-center mr-1 font-medium">Highlight a flow:</span>
              {FLOWS.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setActiveFlow(activeFlow === i ? null : i)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border transition-all duration-150",
                    activeFlow === i
                      ? "text-white border-transparent shadow-sm"
                      : "border-border text-muted-foreground hover:border-primary/50 bg-card"
                  )}
                  style={activeFlow === i ? { background: f.color, borderColor: f.color } : {}}
                >
                  {f.label}
                </button>
              ))}
              {activeFlow !== null && (
                <button onClick={() => setActiveFlow(null)} className="text-xs text-muted-foreground hover:text-foreground ml-1">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Relative canvas */}
            <div
              className="relative bg-gradient-to-br from-muted/20 to-muted/5 rounded-2xl border overflow-hidden"
              style={{ paddingTop: "58%" }}
            >
              {/* SVG lines layer */}
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <defs>
                  <marker id="arrowhead" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
                    <polygon points="0 0, 4 2, 0 4" fill="hsl(214 32% 70%)" />
                  </marker>
                  <marker id="arrowhead-active" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
                    <polygon points="0 0, 4 2, 0 4" fill="hsl(142 76% 40%)" />
                  </marker>
                </defs>
                {CONNECTIONS.map(([from, to]) => {
                  const key1 = `${from}-${to}`;
                  const key2 = `${to}-${from}`;
                  const isHL = highlightedEdges.has(key1) || highlightedEdges.has(key2);
                  const isActive = !activeFlow || isHL;

                  const f = POSITIONS[from];
                  const t = POSITIONS[to];
                  const fx = f.x + NODE_W / 2;
                  const fy = f.y + NODE_H / 2;
                  const tx = t.x + NODE_W / 2;
                  const ty = t.y + NODE_H / 2;
                  const mx = (fx + tx) / 2;

                  const stroke = isHL
                    ? "hsl(142 76% 40%)"
                    : "hsl(214 32% 75%)";

                  return (
                    <path
                      key={key1}
                      d={`M ${fx} ${fy} C ${mx} ${fy}, ${mx} ${ty}, ${tx} ${ty}`}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={isHL ? 0.7 : 0.3}
                      strokeDasharray={isHL ? "none" : "1.5 1.5"}
                      opacity={activeFlow !== null && !isHL ? 0.2 : 0.8}
                      vectorEffect="non-scaling-stroke"
                      markerEnd={isHL ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                    />
                  );
                })}
              </svg>

              {/* Node cards */}
              <div className="absolute inset-0">
                {(Object.values(NODES) as NodeData[]).map((node) => (
                  <DiagramNode
                    key={node.id}
                    node={node}
                    selected={selected === node.id}
                    onClick={() => toggle(node.id)}
                  />
                ))}
              </div>

              {/* Grid background lines */}
              <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-px bg-[hsl(214_32%_70%)]" style={{ backgroundImage: "repeating-linear-gradient(90deg,hsl(214 32% 70%) 0,hsl(214 32% 70%) 3px,transparent 3px,transparent 6px)" }} />
                Data / API channel
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-0.5 bg-[hsl(142_76%_40%)]" />
                Active flow
              </div>
              <div className="flex items-center gap-1.5 ml-auto italic">
                Click any node to learn more
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {selectedNode ? (
                <motion.div
                  key={selectedNode.id}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl border bg-card shadow-sm overflow-hidden"
                >
                  {/* Header */}
                  <div
                    className="p-5"
                    style={{ background: selectedNode.bg, borderBottom: `1px solid ${selectedNode.border}` }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: selectedNode.color }}
                      >
                        <selectedNode.icon size={18} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground">{selectedNode.label}</h3>
                        <p className="text-sm text-muted-foreground">{selectedNode.sublabel}</p>
                      </div>
                      <button
                        onClick={() => setSelected(null)}
                        className="ml-auto text-muted-foreground hover:text-foreground"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedNode.description}
                    </p>

                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Includes
                      </p>
                      <ul className="space-y-1.5">
                        {selectedNode.items.map((item) => (
                          <li
                            key={item}
                            className="flex items-center gap-2 text-sm text-foreground"
                          >
                            <ChevronRight
                              size={12}
                              style={{ color: selectedNode.color }}
                              className="flex-shrink-0"
                            />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {selectedNode.connections.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Connects to
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedNode.connections.map((cid) => {
                            const cn2 = NODES[cid];
                            return (
                              <button
                                key={cid}
                                onClick={() => toggle(cid)}
                                className="text-xs px-2 py-1 rounded-lg border transition-colors hover:opacity-80"
                                style={{
                                  background: cn2.bg,
                                  borderColor: cn2.border,
                                  color: cn2.color,
                                }}
                              >
                                {cn2.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border bg-card p-6 text-center text-muted-foreground text-sm"
                >
                  <Globe size={32} className="mx-auto mb-3 opacity-30" />
                  Click any node in the diagram to explore its role in the
                  KOB ecosystem.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Node index */}
            <div className="rounded-2xl border bg-card p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                All Layers
              </p>
              {(Object.values(NODES) as NodeData[]).map((n) => (
                <button
                  key={n.id}
                  onClick={() => toggle(n.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 p-2 rounded-lg text-left text-sm transition-colors",
                    selected === n.id
                      ? "bg-muted font-medium"
                      : "hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: n.color }}
                  >
                    <n.icon size={10} className="text-white" />
                  </div>
                  {n.label}
                  {n.badge && (
                    <span
                      className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                      style={{ background: `${n.color}20`, color: n.color }}
                    >
                      {n.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-muted/30 border-t py-14 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10 text-foreground">
            How a transaction flows through KOB
          </h2>
          <div className="grid md:grid-cols-5 gap-0">
            {[
              { n: "1", icon: Code2, color: "hsl(199 89% 48%)", label: "Fintech app", sub: "calls KOB API with OAuth token" },
              { n: "→", icon: null, color: "", label: "", sub: "" },
              { n: "2", icon: Zap, color: "hsl(142 76% 40%)", label: "KOB Core", sub: "validates consent, routes request" },
              { n: "→", icon: null, color: "", label: "", sub: "" },
              { n: "3", icon: Building2, color: "hsl(217 91% 35%)", label: "Bank / MNO", sub: "executes transaction, returns data" },
            ].map((step, i) =>
              step.icon ? (
                <div key={i} className="flex flex-col items-center text-center gap-2">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                    style={{ background: step.color }}
                  >
                    <step.icon size={22} className="text-white" />
                  </div>
                  <p className="font-semibold text-sm text-foreground">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.sub}</p>
                </div>
              ) : (
                <div key={i} className="flex items-center justify-center">
                  <ArrowRight size={20} className="text-muted-foreground" />
                </div>
              )
            )}
          </div>

          <div className="mt-10 grid sm:grid-cols-3 gap-4">
            {[
              { icon: Lock, label: "Security at every hop", text: "mTLS, OAuth 2.0 PKCE, request signing, and IP allowlisting protect every API call." },
              { icon: Shield, label: "Consent enforced", text: "No data leaves the platform without an active, user-granted AISP or PISP consent on file." },
              { icon: BarChart3, label: "Full audit trail", text: "Every API call, consent grant, and payment event is logged for COBAC/BEAC reporting." },
            ].map(({ icon: Icon, label, text }) => (
              <div key={label} className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon size={14} className="text-primary" />
                  </div>
                  <p className="font-semibold text-sm text-foreground">{label}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Glossary ── */}
      <section className="py-14 px-6 bg-muted/30 border-t">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-foreground mb-2 text-center">Glossary</h3>
          <p className="text-muted-foreground text-center mb-8 text-sm">Full meaning of abbreviations used on this page</p>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            {[
              ["AISP", "Account Information Service Provider", "Licensed entity that accesses bank account data on behalf of users with their consent."],
              ["AML", "Anti-Money Laundering", "Regulations and procedures to prevent criminals from disguising illegally obtained funds."],
              ["API", "Application Programming Interface", "A set of rules that allows software applications to communicate with each other."],
              ["AUP", "Acceptable Use Policy", "Rules defining how a platform's services may and may not be used."],
              ["BEAC", "Bank of Central African States", "The central bank for CEMAC member states, responsible for monetary policy and currency issuance."],
              ["BICEC", "Banque Internationale du Cameroun pour l'Épargne et le Crédit", "A major commercial bank operating in Cameroon."],
              ["CBCA", "Canada Business Corporations Act", "Federal legislation governing the incorporation and regulation of businesses in Canada."],
              ["CEMAC", "Central African Economic and Monetary Community", "An economic union of six Central African countries sharing the CFA franc."],
              ["CFT", "Combating the Financing of Terrorism", "Measures to detect and prevent funds from being used to support terrorist activities."],
              ["COBAC", "Central African Banking Commission", "The regional banking supervisor that regulates financial institutions across CEMAC."],
              ["DevEx", "Developer Experience", "The overall quality of tools, docs, and workflows provided to software developers."],
              ["DSS", "Data Security Standard", "A set of security requirements for organisations that handle payment card data."],
              ["GHS", "Ghanaian Cedi", "The official currency of Ghana."],
              ["ISO 20022", "International Standard for Electronic Financial Messaging", "A universal messaging framework for financial transactions including payments and securities."],
              ["JS", "JavaScript", "A widely used programming language for web and server-side development."],
              ["KES", "Kenyan Shilling", "The official currency of Kenya."],
              ["KOB", "Kang Open Banking", "Cameroon's unified open banking platform connecting banks, mobile money, and fintechs."],
              ["KYB", "Know Your Business", "Due-diligence process to verify the identity and legitimacy of a business entity."],
              ["KYC", "Know Your Customer", "Identity verification process required before onboarding individual customers."],
              ["MNO", "Mobile Network Operator", "A telecoms company that provides mobile phone and data services (e.g. MTN, Orange)."],
              ["mTLS", "Mutual Transport Layer Security", "Two-way certificate authentication ensuring both client and server verify each other's identity."],
              ["NGN", "Nigerian Naira", "The official currency of Nigeria."],
              ["OAuth", "Open Authorization", "An industry-standard protocol for delegated access without sharing passwords."],
              ["OpenAPI", "Open API Specification", "A machine-readable format for describing, producing, and consuming REST APIs."],
              ["PCI", "Payment Card Industry", "A global council that sets security standards for organisations handling card payments."],
              ["PHP", "PHP: Hypertext Preprocessor", "A server-side scripting language widely used for web development."],
              ["PISP", "Payment Initiation Service Provider", "Licensed entity that initiates bank payments on behalf of users with their consent."],
              ["PKCE", "Proof Key for Code Exchange", "An OAuth 2.0 extension that prevents authorization code interception attacks."],
              ["REST", "Representational State Transfer", "An architectural style for building scalable web APIs using standard HTTP methods."],
              ["RWF", "Rwandan Franc", "The official currency of Rwanda."],
              ["SCA", "Strong Customer Authentication", "Multi-factor authentication required for electronic payments to reduce fraud."],
              ["SCB", "Société Commerciale de Banque", "A commercial bank operating in Cameroon, part of the Attijariwafa Bank group."],
              ["SDK", "Software Development Kit", "A collection of tools, libraries, and documentation for building applications on a platform."],
              ["SLA", "Service Level Agreement", "A formal commitment defining uptime, response times, and support guarantees."],
              ["SWIFT", "Society for Worldwide Interbank Financial Telecommunication", "A global messaging network used by banks to securely exchange financial instructions."],
              ["3DS2", "3-D Secure Version 2", "A fraud-prevention protocol that adds an extra verification step for online card payments."],
              ["TPP", "Third-Party Provider", "An external company authorised to access bank data or initiate payments via open banking APIs."],
              ["TZS", "Tanzanian Shilling", "The official currency of Tanzania."],
              ["UBA", "United Bank for Africa", "A pan-African financial services group operating in 20+ countries."],
              ["UGX", "Ugandan Shilling", "The official currency of Uganda."],
              ["USD", "United States Dollar", "The official currency of the United States and the world's primary reserve currency."],
              ["USSD", "Unstructured Supplementary Service Data", "A mobile protocol enabling real-time, session-based communication without internet access."],
              ["XAF", "Central African CFA Franc", "The common currency of CEMAC member states, pegged to the euro."],
              ["ZAR", "South African Rand", "The official currency of South Africa."],
            ].map(([abbr, full, meaning]) => (
              <div key={abbr} className="py-2 border-b border-border/50">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono font-bold text-primary whitespace-nowrap">{abbr}</span>
                  <span className="font-medium text-foreground">{full}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{meaning}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-14 px-6 text-center bg-background">
        <div className="max-w-lg mx-auto space-y-4">
          <h3 className="text-2xl font-bold text-foreground">Ready to connect?</h3>
          <p className="text-muted-foreground">Get sandbox access and integrate in minutes.</p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Button asChild>
              <a href="/developer/quick-start">
                Get API Keys <ArrowRight size={16} className="ml-1" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/demo">Try the Live Demo</a>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
