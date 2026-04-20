import { ReactNode, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Clock, BookOpen, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export interface GuideSection {
  id: string;
  label: string;
}

interface GuidePageShellProps {
  /** Short eyebrow label, e.g. "Quickstart" */
  eyebrow?: string;
  /** Page title (H1) */
  title: string;
  /** One-line description shown under the title */
  description: string;
  /** SEO meta title (defaults to title) */
  seoTitle?: string;
  /** SEO meta description (defaults to description) */
  seoDescription?: string;
  /** Estimated reading time, e.g. "5 min read" */
  readTime?: string;
  /** Difficulty: Beginner / Intermediate / Advanced */
  level?: "Beginner" | "Intermediate" | "Advanced";
  /** Optional table-of-contents anchors (rendered on lg+) */
  toc?: GuideSection[];
  /** Primary call-to-action button shown in hero */
  primaryCta?: { label: string; to: string };
  /** Secondary call-to-action button shown in hero */
  secondaryCta?: { label: string; to: string };
  /** Hide the bottom prev/next auto-navigation */
  hideAutoNav?: boolean;
  children: ReactNode;
}

/**
 * Apple-style documentation shell used by every guide page.
 * Provides: SEO, animated hero, optional TOC, content area, prev/next nav.
 */
export function GuidePageShell({
  eyebrow,
  title,
  description,
  seoTitle,
  seoDescription,
  readTime,
  level,
  toc,
  primaryCta,
  secondaryCta,
  hideAutoNav,
  children,
}: GuidePageShellProps) {
  const [activeId, setActiveId] = useState<string | null>(toc?.[0]?.id ?? null);

  useEffect(() => {
    if (!toc || toc.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    toc.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [toc]);

  return (
    <>
      <SEO title={seoTitle ?? `${title} | Kang Open Banking`} description={seoDescription ?? description} />

      <div className="bg-background">
        {/* Hero */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-12 md:py-16 max-w-5xl animate-fade-in">
            {eyebrow && (
              <Badge variant="outline" className="mb-4 inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                {eyebrow}
              </Badge>
            )}
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-[1.1]">
              {title}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl leading-relaxed">
              {description}
            </p>

            {(readTime || level) && (
              <div className="flex flex-wrap items-center gap-3 mt-6 text-sm text-muted-foreground">
                {readTime && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> {readTime}
                  </span>
                )}
                {level && (
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" /> {level}
                  </span>
                )}
              </div>
            )}

            {(primaryCta || secondaryCta) && (
              <div className="flex flex-wrap gap-3 mt-8">
                {primaryCta && (
                  <Button asChild className="hover-scale">
                    <Link to={primaryCta.to}>
                      {primaryCta.label}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}
                {secondaryCta && (
                  <Button asChild variant="outline" className="hover-scale">
                    <Link to={secondaryCta.to}>{secondaryCta.label}</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Body */}
        <div className="container mx-auto px-4 py-12 max-w-5xl">
          <div className={toc && toc.length > 0 ? "lg:grid lg:grid-cols-[1fr_220px] lg:gap-12" : ""}>
            <article className="min-w-0 space-y-10 animate-fade-in">{children}</article>

            {toc && toc.length > 0 && (
              <aside className="hidden lg:block">
                <div className="sticky top-24 text-sm">
                  <p className="font-semibold mb-3 text-foreground">On this page</p>
                  <nav className="space-y-1.5 border-l">
                    {toc.map((s) => (
                      <a
                        key={s.id}
                        href={`#${s.id}`}
                        className={`block pl-4 py-1 -ml-px border-l transition-colors ${
                          activeId === s.id
                            ? "border-primary text-primary font-medium"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {s.label}
                      </a>
                    ))}
                  </nav>
                </div>
              </aside>
            )}
          </div>

          {!hideAutoNav && (
            <div className="mt-16 pt-8 border-t">
              <AutoDocNavigation />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Section wrapper with anchor id so the TOC can highlight it.
 */
export function GuideSectionBlock({
  id,
  title,
  children,
}: {
  id: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      {title && <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">{title}</h2>}
      <div className="space-y-4 text-base leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

/**
 * Numbered step card used inside guides.
 */
export function GuideStep({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 transition-all hover:shadow-md animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <div className="text-muted-foreground space-y-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Simple callout (info / success / warning).
 */
export function GuideCallout({
  variant = "info",
  title,
  children,
}: {
  variant?: "info" | "success" | "warning";
  title?: string;
  children: ReactNode;
}) {
  const styles =
    variant === "success"
      ? "border-l-4 border-l-primary bg-primary/5"
      : variant === "warning"
      ? "border-l-4 border-l-destructive bg-destructive/5"
      : "border-l-4 border-l-muted-foreground/40 bg-muted/40";
  return (
    <div className={`rounded-md ${styles} p-4`}>
      {title && <p className="font-semibold mb-1">{title}</p>}
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
