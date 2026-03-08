import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink, BookOpen, Code2, Webhook, Shield, Terminal, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

const docSections = [
  {
    title: "Getting Started",
    description: "Quick start guide for integrating with the Kang Open Banking API",
    icon: Zap,
    color: "text-fi-green bg-fi-green/10 border-fi-green/20",
    links: [
      { label: "Authentication Guide", path: "/developer/guides/authentication" },
      { label: "API Overview", path: "/developer/guides/overview" },
      { label: "Sandbox Setup", path: "/developer/sandbox" },
    ],
  },
  {
    title: "API Reference",
    description: "Complete endpoint documentation with request/response examples",
    icon: Code2,
    color: "text-fi-blue bg-fi-blue/10 border-fi-blue/20",
    links: [
      { label: "Accounts API", path: "/developer/reference/accounts" },
      { label: "Payments API", path: "/developer/reference/payments" },
      { label: "Transactions API", path: "/developer/reference/transactions" },
    ],
  },
  {
    title: "Webhooks",
    description: "Configure and manage webhook endpoints for real-time event notifications",
    icon: Webhook,
    color: "text-fi-amber bg-fi-amber/10 border-fi-amber/20",
    links: [
      { label: "Webhook Setup", path: "/developer/guides/webhooks" },
      { label: "Manage Webhooks", path: "/fi-portal/webhooks" },
    ],
  },
  {
    title: "Security & Compliance",
    description: "mTLS certificates, OAuth2 flows, and compliance documentation",
    icon: Shield,
    color: "text-fi-teal bg-fi-teal/10 border-fi-teal/20",
    links: [
      { label: "OAuth2 & OIDC", path: "/developer/guides/authentication" },
      { label: "Error Codes", path: "/developer/reference/errors" },
      { label: "Rate Limits", path: "/developer/reference/rate-limits" },
    ],
  },
  {
    title: "Testing & Sandbox",
    description: "Test your integration with sandbox tools and simulated data",
    icon: Terminal,
    color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    links: [
      { label: "API Playground", path: "/developer/playground" },
      { label: "Sandbox Dashboard", path: "/developer/sandbox" },
      { label: "Payout Simulator", path: "/developer/payout-simulator" },
    ],
  },
  {
    title: "SDKs & Tools",
    description: "Download SDKs, Postman collections, and integration tools",
    icon: BookOpen,
    color: "text-pink-500 bg-pink-500/10 border-pink-500/20",
    links: [
      { label: "Postman Collection", path: "/developer/tools" },
      { label: "OpenAPI Spec", path: "/developer/openapi" },
    ],
  },
];

export default function InstitutionApiDocs() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fi-blue/10 border border-fi-blue/20">
            <FileText className="h-5 w-5 text-fi-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">API Documentation</h1>
            <p className="text-sm text-muted-foreground">Browse guides, references, and integration resources</p>
          </div>
        </div>
        <Button size="sm" onClick={() => window.open("/developer", "_blank")}>
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
          Open Full Developer Portal
        </Button>
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp}>
        <Card className="border-fi-blue/20 bg-fi-blue/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Badge className="text-[10px] bg-fi-blue/20 text-fi-blue border-fi-blue/30">V1 API</Badge>
              <p className="text-sm text-muted-foreground">
                The Kang Open Banking API follows <strong>OpenAPI 3.4.0</strong> standards with RFC 7807 error handling, OAuth2 authentication, and full OIDC compliance.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {docSections.map((section, idx) => (
          <motion.div key={section.title} initial="hidden" animate="visible" custom={idx + 2} variants={fadeUp}>
            <Card className="border-border/60 h-full hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${section.color}`}>
                    <section.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
                  </div>
                </div>
                <CardDescription className="text-xs">{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {section.links.map(link => (
                  <Button
                    key={link.label}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-8 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      if (link.path.startsWith("/fi-portal")) {
                        navigate(link.path);
                      } else {
                        navigate(link.path);
                      }
                    }}
                  >
                    <FileText className="h-3 w-3 mr-2 shrink-0" />
                    {link.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Links */}
      <motion.div initial="hidden" animate="visible" custom={8} variants={fadeUp}>
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Quick Access</CardTitle>
            <CardDescription className="text-xs">Jump to commonly used resources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "API Clients", path: "/fi-portal/api-clients" },
                { label: "API Keys", path: "/fi-portal/api-keys" },
                { label: "Webhooks", path: "/fi-portal/webhooks" },
                { label: "Credit API", path: "/fi-portal/credit-api" },
                { label: "API Status", path: "/developer/status" },
              ].map(link => (
                <Button key={link.label} variant="outline" size="sm" className="text-xs h-8" onClick={() => navigate(link.path)}>
                  {link.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
