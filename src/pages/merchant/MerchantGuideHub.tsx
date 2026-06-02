import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen, Search, ChevronRight, ArrowLeft, MessageSquare, Phone, Mail, ExternalLink, Sparkles, ArrowRight,
} from "lucide-react";
import { merchantGuides, type MerchantGuide } from "@/components/merchant/merchant-guide-content";

const SUPPORT_PHONE_RAW = "237622022567";
const SUPPORT_EMAIL = "support@kangopenbanking.com";

const SECTIONS: { label: string; match: (g: MerchantGuide) => boolean }[] = [
  { label: "Getting started", match: g => ["dashboard", "kyb", "profile", "register"].includes(g.slug) },
  { label: "Accept payments", match: g => ["payment-links", "qr-acceptance", "pos-till", "pay-by-bank", "storefront", "woo-sync"].includes(g.slug) },
  { label: "Money movement", match: g => ["fund-wallet", "payouts", "settlements", "settlement-accounts", "refunds", "escrow", "subaccounts", "fees"].includes(g.slug) },
  { label: "Customers & operations", match: g => ["customers", "subscriptions", "plans", "disputes", "transactions", "notification-history", "locations"].includes(g.slug) },
  { label: "Integration & developer", match: g => ["api-keys", "webhooks", "webhook-deliveries", "api-key-management", "white-label", "branding", "bulk-operations", "export-center"].includes(g.slug) },
  { label: "Analytics", match: g => ["analytics", "advanced-analytics"].includes(g.slug) },
  { label: "Travel services", match: g => g.slug.startsWith("travel-") },
];

export default function MerchantGuideHub() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  // ---- Detail view ----
  if (slug) {
    const guide = merchantGuides.find(g => g.slug === slug);
    if (!guide) {
      return (
        <div className="max-w-3xl mx-auto py-12 text-center space-y-4">
          <h1 className="text-2xl font-bold">Guide not found</h1>
          <Button onClick={() => navigate("/merchant/guide")}>Back to guides</Button>
        </div>
      );
    }
    const Icon = guide.icon;
    return (
      <div className="max-w-3xl mx-auto py-2 animate-fade-in">
        <button
          onClick={() => navigate("/merchant/guide")}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All guides
        </button>

        <header className="flex items-start gap-4 mb-8">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1">
              <Sparkles className="h-3 w-3" /> Merchant guide
            </p>
            <h1 className="text-3xl font-bold tracking-tight">{guide.title}</h1>
            <p className="text-muted-foreground mt-2">{guide.summary}</p>
          </div>
        </header>

        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Step by step</h2>
            <ol className="space-y-4">
              {guide.steps.map((step, i) => (
                <li
                  key={i}
                  className="flex gap-4 animate-fade-in"
                  style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed pt-1">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {guide.tips && guide.tips.length > 0 && (
          <Card className="mb-6 border-primary/30 bg-primary/[0.03]">
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">Pro tips</h2>
              <ul className="space-y-2">
                {guide.tips.map((t, i) => (
                  <li key={i} className="text-sm leading-relaxed flex gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardContent className="p-6 space-y-3">
            <h2 className="text-sm font-semibold">Take action</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Button asChild className="h-11 justify-between">
                <Link to={guide.route}>
                  <span>Open {guide.title}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              {guide.fullGuide && (
                <Button variant="outline" asChild className="h-11 justify-between">
                  <Link to={guide.fullGuide}>
                    <span>Developer docs</span>
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Need a hand?
            </h2>
            <div className="grid sm:grid-cols-3 gap-2">
              <Button variant="outline" asChild className="h-10 justify-start">
                <Link to="/support-agent"><MessageSquare className="h-4 w-4 mr-2" />Live chat</Link>
              </Button>
              <Button variant="outline" asChild className="h-10 justify-start">
                <a href={`https://wa.me/${SUPPORT_PHONE_RAW}`} target="_blank" rel="noopener noreferrer">
                  <Phone className="h-4 w-4 mr-2" />WhatsApp
                </a>
              </Button>
              <Button variant="outline" asChild className="h-10 justify-start">
                <a href={`mailto:${SUPPORT_EMAIL}`}><Mail className="h-4 w-4 mr-2" />Email</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Hub view ----
  const filtered = useMemo(() => {
    if (!query.trim()) return merchantGuides;
    const q = query.toLowerCase();
    return merchantGuides.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.summary.toLowerCase().includes(q) ||
      g.steps.some(s => s.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <div className="max-w-6xl mx-auto py-2 animate-fade-in">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
          <BookOpen className="h-3 w-3" /> Merchant guide
        </p>
        <h1 className="text-3xl font-bold tracking-tight">How to use the Merchant Portal</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Short, practical walkthroughs for every feature in your dashboard. Look for the help button at the bottom-right of any page for the same guide in context.
        </p>
      </header>

      <div className="relative mb-8 max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search guides…"
          className="pl-10 h-11"
        />
      </div>

      {query.trim() ? (
        <GuideGrid guides={filtered} />
      ) : (
        <div className="space-y-10">
          {SECTIONS.map(section => {
            const items = merchantGuides.filter(section.match);
            if (items.length === 0) return null;
            return (
              <section key={section.label}>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">{section.label}</h2>
                <GuideGrid guides={items} />
              </section>
            );
          })}
        </div>
      )}

      <Separator className="my-12" />

      <Card className="bg-muted/40">
        <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="font-semibold">Still stuck?</h3>
            <p className="text-sm text-muted-foreground">Our team replies within minutes during business hours.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild><Link to="/support-agent"><MessageSquare className="h-4 w-4 mr-2" />Live chat</Link></Button>
            <Button variant="outline" asChild>
              <a href={`https://wa.me/${SUPPORT_PHONE_RAW}`} target="_blank" rel="noopener noreferrer">
                <Phone className="h-4 w-4 mr-2" />WhatsApp
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GuideGrid({ guides }: { guides: MerchantGuide[] }) {
  if (guides.length === 0) {
    return <p className="text-sm text-muted-foreground">No guides match your search.</p>;
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {guides.map((g, i) => {
        const Icon = g.icon;
        return (
          <Link
            key={g.slug}
            to={`/merchant/guide/${g.slug}`}
            className="group rounded-xl border border-border bg-card p-4 hover:border-primary hover:shadow-md transition-all duration-200 hover-scale animate-fade-in"
            style={{ animationDelay: `${i * 30}ms`, animationFillMode: "backwards" }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm truncate">{g.title}</h3>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{g.summary}</p>
                {g.fullGuide && (
                  <Badge variant="secondary" className="mt-2 text-[10px]">Developer docs</Badge>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
