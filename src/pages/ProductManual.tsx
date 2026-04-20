import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Search, BookOpen, Download, ChevronRight, ChevronLeft,
  Loader2, GraduationCap, CheckCircle2, Circle, List, X,
  Landmark, Smartphone, Code, ClipboardList, Store, ShoppingBag,
  Plane, ShieldCheck, TrendingUp, Clock, BarChart3, ChevronDown,
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { useRegulatoryPdfExport } from '@/hooks/useRegulatoryPdfExport';
import { motion, AnimatePresence } from 'framer-motion';

interface ManualSection {
  id: string;
  section_title: string;
  section_slug: string;
  content: string;
  sort_order: number;
}

interface GlossaryItem {
  term: string;
  definition: string;
}

const manualMeta: Record<string, { title: string; subtitle: string; code: string; icon: React.ElementType; level: 'Beginner' | 'Intermediate' | 'Advanced' }> = {
  customers:          { title: 'Customer Manual',           subtitle: 'Use the Kang app from start to finish',                code: 'KOB-MAN-CUST',  icon: Smartphone,  level: 'Beginner' },
  merchants:          { title: 'Merchant Manual',           subtitle: 'Run your storefront, staff, and payments',             code: 'KOB-MAN-MERCH', icon: Store,       level: 'Intermediate' },
  pos_cashier:        { title: 'POS & Cashier Manual',      subtitle: 'Daily operations for in-store staff',                  code: 'KOB-MAN-POS',   icon: ShoppingBag, level: 'Beginner' },
  travel_agent:       { title: 'Travel Agent Manual',       subtitle: 'Booking flows for agencies and trips',                 code: 'KOB-MAN-TRV',   icon: Plane,       level: 'Beginner' },
  banks:              { title: 'Banking & FI Manual',       subtitle: 'Connect your institution to the open banking layer',   code: 'KOB-MAN-BANK',  icon: Landmark,    level: 'Advanced' },
  compliance_officer: { title: 'Compliance Officer Manual', subtitle: 'KYC, KYB, AML and regulator operations',               code: 'KOB-MAN-COMP',  icon: ShieldCheck, level: 'Advanced' },
  developers:         { title: 'Developer Manual',          subtitle: 'API integration with hands-on examples',               code: 'KOB-MAN-DEV',   icon: Code,        level: 'Intermediate' },
  investors:          { title: 'Investors & Partners',      subtitle: 'A plain-English overview of what we built',            code: 'KOB-MAN-INV',   icon: TrendingUp,  level: 'Beginner' },
};

const COMPLETED_KEY = 'kob-manual-completed';

const getCompleted = (type: string): Set<string> => {
  try {
    const raw = localStorage.getItem(`${COMPLETED_KEY}-${type}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};

const saveCompleted = (type: string, set: Set<string>) => {
  localStorage.setItem(`${COMPLETED_KEY}-${type}`, JSON.stringify([...set]));
};

// Reading-time helper: ~200 wpm
const readingTime = (content: string) => {
  const words = content.replace(/[#*`>|\-]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
};

// Extract H2/H3 headings as in-lesson TOC
const extractHeadings = (content: string): { id: string; text: string; level: 2 | 3 }[] => {
  const lines = content.split('\n');
  const out: { id: string; text: string; level: 2 | 3 }[] = [];
  for (const l of lines) {
    const m2 = l.match(/^##\s+(.+)/);
    const m3 = l.match(/^###\s+(.+)/);
    if (m2) {
      const text = m2[1].trim();
      out.push({ id: text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), text, level: 2 });
    } else if (m3) {
      const text = m3[1].trim();
      out.push({ id: text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), text, level: 3 });
    }
  }
  return out;
};

const headingId = (children: any) => {
  const text = (Array.isArray(children) ? children.join('') : String(children || '')).toLowerCase();
  return text.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
};

const mdComponents = {
  h1: ({ children }: any) => <h1 id={headingId(children)} className="text-2xl md:text-3xl font-extrabold text-foreground mt-2 mb-4 leading-tight tracking-tight">{children}</h1>,
  h2: ({ children }: any) => <h2 id={headingId(children)} className="text-xl md:text-2xl font-bold text-foreground mt-10 mb-3 pb-2 border-b border-border scroll-mt-24 tracking-tight">{children}</h2>,
  h3: ({ children }: any) => <h3 id={headingId(children)} className="text-lg font-bold text-foreground mt-7 mb-2 scroll-mt-24">{children}</h3>,
  p:  ({ children }: any) => <p className="text-[15.5px] text-muted-foreground leading-[1.8] mb-4">{children}</p>,
  ul: ({ children }: any) => <ul className="text-[15.5px] text-muted-foreground space-y-2 mb-4 pl-5 list-disc marker:text-primary">{children}</ul>,
  ol: ({ children }: any) => <ol className="text-[15.5px] text-muted-foreground space-y-2 mb-4 pl-5 list-decimal marker:text-primary">{children}</ol>,
  li: ({ children }: any) => <li className="text-[15.5px] text-muted-foreground leading-relaxed">{children}</li>,
  strong: ({ children }: any) => <strong className="font-semibold text-foreground">{children}</strong>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-primary/50 bg-muted/40 rounded-r-lg px-5 py-4 my-5 text-[15px] text-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children, className }: any) => {
    if (className) {
      return (
        <pre className="bg-muted rounded-lg p-5 overflow-x-auto mb-4 border border-border">
          <code className="text-xs font-mono text-foreground leading-relaxed">{children}</code>
        </pre>
      );
    }
    return <code className="bg-muted text-foreground px-1.5 py-0.5 rounded text-sm font-mono border border-border">{children}</code>;
  },
  pre: ({ children }: any) => <>{children}</>,
  table: ({ children }: any) => (
    <div className="overflow-x-auto rounded-lg border border-border mb-5">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }: any) => <th className="px-4 py-2.5 text-left text-xs font-bold text-foreground uppercase tracking-wide">{children}</th>,
  td: ({ children }: any) => <td className="px-4 py-3 border-t border-border text-sm text-muted-foreground">{children}</td>,
  hr: () => <hr className="border-border my-8" />,
};

const ProductManual: React.FC = () => {
  const { type } = useParams<{ type: string }>();
  const manualType = type || 'customers';

  const [sections, setSections] = useState<ManualSection[]>([]);
  const [glossary, setGlossary] = useState<GlossaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [showSidebar, setShowSidebar] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [direction, setDirection] = useState(1);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeHeading, setActiveHeading] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);

  const { exportToPdf } = useRegulatoryPdfExport();
  const meta = manualMeta[manualType] || manualMeta.customers;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setIsAuthenticated(!!user));
  }, []);

  useEffect(() => {
    setCurrentIndex(-1);
    setCompleted(getCompleted(manualType));
    setLoading(true);
    Promise.all([
      (supabase.from('product_manuals') as any)
        .select('id, section_title, section_slug, content, sort_order')
        .eq('manual_type', manualType)
        .eq('is_active', true)
        .order('sort_order'),
      (supabase.from('product_glossary') as any)
        .select('term, definition')
        .or(`manual_type.eq.${manualType},manual_type.eq.all`)
        .order('term'),
    ]).then(([{ data: s }, { data: g }]) => {
      if (s) setSections(s);
      if (g) setGlossary(g);
      setLoading(false);
    });
  }, [manualType]);

  // Scroll-spy for in-lesson TOC
  const currentSection = currentIndex >= 0 ? sections[currentIndex] : null;
  const headings = useMemo(() => currentSection ? extractHeadings(currentSection.content) : [], [currentSection]);

  useEffect(() => {
    if (!currentSection || headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveHeading(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px' }
    );
    headings.forEach(h => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [currentSection, headings]);

  const progressPct = sections.length > 0 ? Math.round((completed.size / sections.length) * 100) : 0;

  const goTo = (idx: number) => {
    setDirection(idx > currentIndex ? 1 : -1);
    setCurrentIndex(idx);
    setShowSidebar(false);
    setShowGlossary(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const markComplete = (slug: string) => {
    const next = new Set(completed);
    if (next.has(slug)) next.delete(slug); else next.add(slug);
    setCompleted(next);
    saveCompleted(manualType, next);
  };

  const goNext = () => {
    if (currentIndex < sections.length - 1) {
      if (currentIndex >= 0) {
        const curr = sections[currentIndex];
        if (!completed.has(curr.section_slug)) markComplete(curr.section_slug);
      }
      goTo(currentIndex + 1);
    }
  };

  const goPrev = () => { if (currentIndex > -1) goTo(currentIndex - 1); };

  const filteredGlossary = useMemo(() => {
    if (!search.trim()) return glossary;
    const q = search.toLowerCase();
    return glossary.filter(g => g.term.toLowerCase().includes(q) || g.definition.toLowerCase().includes(q));
  }, [glossary, search]);

  const handleDownloadPdf = () => {
    if (!isAuthenticated) return;
    exportToPdf({
      title: meta.title,
      documentCode: meta.code,
      subtitle: meta.subtitle,
      sections: sections.map(s => ({
        heading: s.section_title,
        content: s.content.split('\n').filter(l => l.trim() && !l.startsWith('#')),
      })),
    });
  };

  // SEO + JSON-LD
  const seoTitle = currentSection
    ? `${currentSection.section_title} — ${meta.title} | Kang Open Banking`
    : `${meta.title} | Kang Open Banking`;
  const seoDesc = currentSection
    ? currentSection.content.replace(/[#*>`|\-\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 155)
    : meta.subtitle;
  const courseJsonLd = !currentSection ? {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: meta.title,
    description: meta.subtitle,
    provider: { '@type': 'Organization', name: 'Kang Open Banking', url: 'https://kangopenbanking.com' },
    educationalLevel: meta.level,
    numberOfCredits: sections.length,
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'Online', courseWorkload: `PT${sections.reduce((a, s) => a + readingTime(s.content), 0)}M` },
  } : null;
  const lessonJsonLd = currentSection ? {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: currentSection.section_title,
    description: seoDesc,
    inLanguage: 'en',
    timeRequired: `PT${readingTime(currentSection.content)}M`,
    isPartOf: { '@type': 'Course', name: meta.title },
    learningResourceType: 'Lesson',
    educationalLevel: meta.level,
  } : null;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDesc} />
        <link rel="canonical" href={`https://kangopenbanking.com/manual/${manualType}`} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDesc} />
        <meta property="og:type" content="article" />
        {(courseJsonLd || lessonJsonLd) && (
          <script type="application/ld+json">{JSON.stringify(courseJsonLd || lessonJsonLd)}</script>
        )}
      </Helmet>

      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-md">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="md:hidden p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Toggle outline"
              >
                <List className="h-5 w-5 text-foreground" />
              </button>
              <meta.icon className="h-5 w-5 text-primary shrink-0" />
              <div className="hidden sm:block min-w-0">
                <h1 className="text-sm font-semibold text-foreground leading-tight truncate">{meta.title}</h1>
                <p className="text-xs text-muted-foreground">
                  {currentSection
                    ? `Lesson ${currentIndex + 1} of ${sections.length} · ${readingTime(currentSection.content)} min read`
                    : `${sections.length} lessons · ${progressPct}% complete`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={showGlossary ? 'default' : 'ghost'}
                onClick={() => { setShowGlossary(!showGlossary); setCurrentIndex(-1); }}
                className="gap-1.5 text-xs h-8"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Glossary</span>
              </Button>
              {isAuthenticated && (
                <Button size="sm" variant="ghost" onClick={handleDownloadPdf} className="gap-1.5 text-xs h-8">
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </Button>
              )}
            </div>
          </div>
          <Progress value={progressPct} className="h-0.5 -mb-px rounded-none" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Scalable manual picker (dropdown instead of horizontal pills) */}
        <div className="relative mb-6 max-w-md">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="flex items-center justify-between w-full gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted shrink-0">
                <meta.icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{meta.title}</p>
                <p className="text-xs text-muted-foreground truncate">{meta.subtitle}</p>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showPicker && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 right-0 mt-2 z-20 rounded-xl border border-border bg-popover shadow-lg overflow-hidden"
              >
                {Object.entries(manualMeta).map(([key, m]) => {
                  const Active = key === manualType;
                  return (
                    <Link
                      key={key}
                      to={`/manual/${key}`}
                      onClick={() => setShowPicker(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${Active ? 'bg-muted' : 'hover:bg-muted/50'}`}
                    >
                      <m.icon className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.subtitle}</p>
                      </div>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide shrink-0">{m.level}</span>
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex gap-6">
          {/* Sidebar — course outline */}
          <aside className={`
            fixed inset-y-0 left-0 z-40 w-80 bg-background border-r border-border p-5 pt-20 overflow-y-auto transition-transform
            md:static md:z-auto md:w-72 md:shrink-0 md:rounded-xl md:border md:bg-card md:pt-5 md:translate-x-0
            ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
          `}>
            <div className="flex items-center justify-between mb-4 md:hidden">
              <h3 className="text-sm font-bold text-foreground">Outline</h3>
              <button onClick={() => setShowSidebar(false)} className="p-1 rounded hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-lg bg-muted/50 border border-border p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">Progress</span>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={progressPct} className="h-1.5 flex-1" />
                <span className="text-xs font-bold text-primary tabular-nums">{progressPct}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {completed.size} of {sections.length} lessons
              </p>
            </div>

            <nav className="flex flex-col gap-0.5">
              <button
                onClick={() => goTo(-1)}
                className={`text-left text-sm px-3 py-2 rounded-md transition-colors flex items-center gap-2 ${
                  currentIndex === -1 && !showGlossary ? 'bg-muted text-foreground font-semibold' : 'text-muted-foreground hover:bg-muted/60'
                }`}
              >
                <ClipboardList className="h-4 w-4 text-primary shrink-0" />
                Overview
              </button>
              {sections.map((s, i) => {
                const done = completed.has(s.section_slug);
                const isCurrent = currentIndex === i;
                return (
                  <button
                    key={s.section_slug}
                    onClick={() => goTo(i)}
                    className={`text-left text-sm px-3 py-2 rounded-md transition-colors flex items-center gap-2.5 ${
                      isCurrent ? 'bg-muted text-foreground font-semibold' : 'text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    {done
                      ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      : <Circle className={`h-4 w-4 shrink-0 ${isCurrent ? 'text-primary' : 'text-muted-foreground/40'}`} />
                    }
                    <span className="truncate">
                      <span className="text-xs text-muted-foreground/70 font-mono mr-1.5 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                      {s.section_title}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {showSidebar && (
            <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setShowSidebar(false)} />
          )}

          {/* Main + in-lesson TOC */}
          <main className="flex-1 min-w-0 flex gap-6">
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait" custom={direction}>
                {showGlossary ? (
                  <motion.div
                    key="glossary"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-xl border border-border bg-card p-6 md:p-8"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <BookOpen className="h-6 w-6 text-primary" />
                      <h2 className="text-xl font-bold text-foreground tracking-tight">Glossary</h2>
                    </div>
                    <div className="relative mb-6">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search terms..."
                        className="pl-10"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filteredGlossary.map(g => (
                        <div key={g.term} className="rounded-lg border border-border p-4 hover:border-primary/40 transition-colors">
                          <p className="font-semibold text-foreground text-sm mb-1">{g.term}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{g.definition}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : currentSection ? (
                  <motion.div
                    key={currentSection.section_slug}
                    custom={direction}
                    initial={{ opacity: 0, x: direction * 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -24 }}
                    transition={{ duration: 0.2 }}
                    ref={contentRef}
                  >
                    {/* Lesson hero */}
                    <div className="rounded-xl border border-border bg-card p-6 md:p-8 mb-4">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-foreground text-xs font-semibold">
                          <GraduationCap className="h-3.5 w-3.5 text-primary" />
                          Lesson {currentIndex + 1} / {sections.length}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-foreground text-xs font-medium">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {readingTime(currentSection.content)} min read
                        </span>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-muted text-foreground text-xs font-medium uppercase tracking-wide">
                          {meta.level}
                        </span>
                        {completed.has(currentSection.section_slug) && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Completed
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight tracking-tight">
                        {currentSection.section_title}
                      </h2>
                    </div>

                    {/* Lesson body */}
                    <article className="rounded-xl border border-border bg-card p-6 md:p-10">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown components={mdComponents}>
                          {currentSection.content}
                        </ReactMarkdown>
                      </div>
                    </article>

                    {/* Footer nav */}
                    <div className="flex items-center justify-between mt-6 gap-3">
                      <Button variant="outline" onClick={goPrev} disabled={currentIndex <= 0} className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:inline truncate max-w-[140px]">
                          {currentIndex > 0 ? sections[currentIndex - 1].section_title : 'Overview'}
                        </span>
                        <span className="sm:hidden">Prev</span>
                      </Button>
                      <Button
                        variant={completed.has(currentSection.section_slug) ? 'outline' : 'default'}
                        onClick={() => markComplete(currentSection.section_slug)}
                        className="gap-2 shrink-0"
                      >
                        {completed.has(currentSection.section_slug)
                          ? <><CheckCircle2 className="h-4 w-4" /> Completed</>
                          : <><Circle className="h-4 w-4" /> Mark Complete</>
                        }
                      </Button>
                      <Button onClick={goNext} disabled={currentIndex >= sections.length - 1} className="gap-2">
                        <span className="hidden sm:inline truncate max-w-[140px]">
                          {currentIndex < sections.length - 1 ? sections[currentIndex + 1].section_title : ''}
                        </span>
                        <span className="sm:hidden">Next</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  /* Overview — clean, no gradient */
                  <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="rounded-2xl border border-border bg-card p-8 md:p-10 mb-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-muted">
                          <meta.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">{meta.title}</h1>
                          <p className="text-muted-foreground mt-1">{meta.subtitle}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4" /> {sections.length} lessons</span>
                        <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4" /> {sections.reduce((a, s) => a + readingTime(s.content), 0)} min total</span>
                        <span className="inline-flex items-center gap-2"><GraduationCap className="h-4 w-4" /> {meta.level}</span>
                        <span className="inline-flex items-center gap-2 font-medium text-primary tabular-nums">{progressPct}% complete</span>
                      </div>
                      {sections.length > 0 && (
                        <Button onClick={() => goTo(0)} className="mt-6 gap-2" size="lg">
                          {completed.size > 0 ? 'Continue Learning' : 'Start Course'}
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <h2 className="text-base font-semibold text-foreground mb-3 px-1">Course outline</h2>
                    <div className="flex flex-col gap-2">
                      {sections.map((s, i) => {
                        const done = completed.has(s.section_slug);
                        return (
                          <motion.button
                            key={s.section_slug}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.025 }}
                            onClick={() => goTo(i)}
                            className="text-left rounded-xl border border-border bg-card p-4 md:p-5 hover:border-primary/40 hover:bg-muted/30 transition-colors group flex items-center gap-4"
                          >
                            <div className={`flex items-center justify-center h-10 w-10 rounded-lg shrink-0 ${done ? 'bg-primary/10' : 'bg-muted'}`}>
                              {done ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <span className="text-sm font-bold text-muted-foreground tabular-nums">{String(i + 1).padStart(2, '0')}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm md:text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                                {s.section_title}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {s.content.split('\n').find(l => l.trim() && !l.startsWith('#'))?.replace(/[#*`]/g, '').trim()}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground hidden sm:inline tabular-nums">{readingTime(s.content)} min</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* In-lesson TOC (sticky, desktop only) */}
            {currentSection && headings.length > 0 && (
              <aside className="hidden xl:block w-56 shrink-0">
                <div className="sticky top-20">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-3">On this page</p>
                  <nav className="flex flex-col gap-0.5">
                    {headings.map(h => (
                      <a
                        key={h.id}
                        href={`#${h.id}`}
                        className={`text-xs px-3 py-1.5 rounded-md transition-colors border-l-2 ${
                          activeHeading === h.id
                            ? 'border-primary text-foreground font-semibold bg-muted/50'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        } ${h.level === 3 ? 'pl-6' : ''}`}
                      >
                        {h.text}
                      </a>
                    ))}
                  </nav>
                </div>
              </aside>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default ProductManual;
