import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Search, BookOpen, Download, ChevronRight, ChevronLeft,
  Loader2, GraduationCap, CheckCircle2, Circle, List, X,
  Landmark, Smartphone, Code, ClipboardList, Store,
} from 'lucide-react';
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

const manualMeta: Record<string, { title: string; subtitle: string; code: string; icon: React.ElementType }> = {
  banks: { title: 'Banking & FI Training', subtitle: 'Step-by-step guide for banks and financial institutions', code: 'KOB-MAN-BANK', icon: Landmark },
  customers: { title: 'Customer Training', subtitle: 'Learn how to use the Kang app from start to finish', code: 'KOB-MAN-CUST', icon: Smartphone },
  merchants: { title: 'Merchant & Staff Training', subtitle: 'Travel services, staff management, and role-based access', code: 'KOB-MAN-MERCH', icon: Store },
  developers: { title: 'Developer Training', subtitle: 'API integration course with hands-on examples', code: 'KOB-MAN-DEV', icon: Code },
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

const mdComponents = {
  h1: ({ children }: any) => <h1 className="text-2xl md:text-3xl font-extrabold text-foreground mt-2 mb-4 leading-tight">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-xl md:text-2xl font-bold text-foreground mt-8 mb-3 pb-2 border-b border-border">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-lg font-bold text-foreground mt-6 mb-2">{children}</h3>,
  p: ({ children }: any) => <p className="text-[15px] text-muted-foreground leading-[1.8] mb-4">{children}</p>,
  ul: ({ children }: any) => <ul className="text-[15px] text-muted-foreground space-y-2 mb-4 pl-5 list-disc marker:text-primary">{children}</ul>,
  ol: ({ children }: any) => <ol className="text-[15px] text-muted-foreground space-y-2 mb-4 pl-5 list-decimal marker:text-primary">{children}</ol>,
  li: ({ children }: any) => <li className="text-[15px] text-muted-foreground leading-relaxed">{children}</li>,
  strong: ({ children }: any) => <strong className="font-semibold text-foreground">{children}</strong>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-primary/40 bg-primary/5 rounded-r-xl px-5 py-4 my-4 text-sm text-foreground italic">
      {children}
    </blockquote>
  ),
  code: ({ children, className }: any) => {
    if (className) {
      return (
        <pre className="bg-muted rounded-xl p-5 overflow-x-auto mb-4 border border-border">
          <code className="text-xs font-mono text-foreground leading-relaxed">{children}</code>
        </pre>
      );
    }
    return <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>;
  },
  pre: ({ children }: any) => <>{children}</>,
  table: ({ children }: any) => (
    <div className="overflow-x-auto rounded-xl border border-border mb-4">
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
  const [currentIndex, setCurrentIndex] = useState(-1); // -1 = overview
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [showSidebar, setShowSidebar] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [direction, setDirection] = useState(1);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

  const progressPct = sections.length > 0
    ? Math.round((completed.size / sections.length) * 100)
    : 0;

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
      // auto-mark current as completed when advancing
      if (currentIndex >= 0) {
        const curr = sections[currentIndex];
        if (!completed.has(curr.section_slug)) markComplete(curr.section_slug);
      }
      goTo(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > -1) goTo(currentIndex - 1);
  };

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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentSection = currentIndex >= 0 ? sections[currentIndex] : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-md">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <List className="h-5 w-5 text-foreground" />
              </button>
              <meta.icon className="h-5 w-5 text-primary" />
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-foreground leading-tight">{meta.title}</h1>
                <p className="text-xs text-muted-foreground">
                  {currentSection
                    ? `Lesson ${currentIndex + 1} of ${sections.length}`
                    : `${sections.length} lessons · ${progressPct}% complete`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={showGlossary ? 'default' : 'ghost'}
                onClick={() => { setShowGlossary(!showGlossary); setCurrentIndex(-1); }}
                className="gap-1.5 text-xs"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Glossary</span>
              </Button>
              {isAuthenticated && (
                <Button size="sm" variant="ghost" onClick={handleDownloadPdf} className="gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <Progress value={progressPct} className="h-1 -mb-px rounded-none" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Manual type switcher */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {Object.entries(manualMeta).map(([key, m]) => (
            <Link
              key={key}
              to={`/manual/${key}`}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                manualType === key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <m.icon className="h-4 w-4" />
              {m.title}
            </Link>
          ))}
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className={`
            fixed inset-y-0 left-0 z-40 w-80 bg-card border-r border-border p-5 pt-20 overflow-y-auto transition-transform
            md:static md:z-auto md:w-72 md:shrink-0 md:rounded-xl md:border md:pt-5 md:translate-x-0
            ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
          `}>
            <div className="flex items-center justify-between mb-4 md:hidden">
              <h3 className="text-sm font-bold text-foreground">Course Outline</h3>
              <button onClick={() => setShowSidebar(false)} className="p-1 rounded hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Progress summary */}
            <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-foreground">Your Progress</span>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={progressPct} className="h-2 flex-1" />
                <span className="text-xs font-bold text-primary">{progressPct}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {completed.size} of {sections.length} lessons completed
              </p>
            </div>

            {/* Lesson list */}
            <nav className="flex flex-col gap-0.5">
              <button
                onClick={() => goTo(-1)}
                className={`text-left text-sm px-3 py-2.5 rounded-lg transition-all flex items-center gap-2 ${
                  currentIndex === -1 && !showGlossary
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted'
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
                    className={`text-left text-sm px-3 py-2.5 rounded-lg transition-all flex items-center gap-2.5 ${
                      isCurrent
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {done
                      ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      : <Circle className={`h-4 w-4 shrink-0 ${isCurrent ? 'text-primary' : 'text-muted-foreground/40'}`} />
                    }
                    <span className="truncate">
                      <span className="text-xs text-muted-foreground font-mono mr-1.5">{i + 1}.</span>
                      {s.section_title}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Mobile sidebar overlay */}
          {showSidebar && (
            <div
              className="fixed inset-0 bg-black/40 z-30 md:hidden"
              onClick={() => setShowSidebar(false)}
            />
          )}

          {/* Main content area */}
          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait" custom={direction}>
              {showGlossary ? (
                <motion.div
                  key="glossary"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-xl border border-border bg-card p-6 md:p-8"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <BookOpen className="h-6 w-6 text-primary" />
                    <h2 className="text-xl font-bold text-foreground">Glossary</h2>
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
                      <div key={g.term} className="rounded-xl border border-border p-4 hover:border-primary/20 transition-colors">
                        <p className="font-bold text-foreground text-sm mb-1">{g.term}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{g.definition}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : currentSection ? (
                <motion.div
                  key={currentSection.section_slug}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -40 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Lesson header */}
                  <div className="rounded-xl border border-border bg-card p-6 md:p-8 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        <GraduationCap className="h-3.5 w-3.5" />
                        Lesson {currentIndex + 1} of {sections.length}
                      </span>
                      {completed.has(currentSection.section_slug) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight">
                      {currentSection.section_title}
                    </h2>
                  </div>

                  {/* Lesson content */}
                  <div className="rounded-xl border border-border bg-card p-6 md:p-10">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown components={mdComponents}>
                        {currentSection.content}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* Navigation footer */}
                  <div className="flex items-center justify-between mt-6 gap-4">
                    <Button
                      variant="outline"
                      onClick={goPrev}
                      disabled={currentIndex <= 0}
                      className="gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        {currentIndex > 0 ? sections[currentIndex - 1].section_title : 'Overview'}
                      </span>
                      <span className="sm:hidden">Previous</span>
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

                    <Button
                      onClick={goNext}
                      disabled={currentIndex >= sections.length - 1}
                      className="gap-2"
                    >
                      <span className="hidden sm:inline">
                        {currentIndex < sections.length - 1 ? sections[currentIndex + 1].section_title : ''}
                      </span>
                      <span className="sm:hidden">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ) : (
                /* Overview / landing */
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {/* Hero card */}
                  <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-8 md:p-10 mb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <meta.icon className="h-9 w-9 text-primary" />
                      <div>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">{meta.title}</h1>
                        <p className="text-muted-foreground mt-1">{meta.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-5">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <BookOpen className="h-4 w-4" />
                        {sections.length} lessons
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <GraduationCap className="h-4 w-4" />
                        {completed.size} completed
                      </div>
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        {progressPct}% progress
                      </div>
                    </div>
                    {sections.length > 0 && (
                      <Button onClick={() => goTo(0)} className="mt-6 gap-2" size="lg">
                        {completed.size > 0 ? 'Continue Learning' : 'Start Course'}
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Course outline cards */}
                  <h2 className="text-lg font-bold text-foreground mb-4">Course Outline</h2>
                  <div className="flex flex-col gap-2">
                    {sections.map((s, i) => {
                      const done = completed.has(s.section_slug);
                      return (
                        <motion.button
                          key={s.section_slug}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          onClick={() => goTo(i)}
                          className="text-left rounded-xl border border-border bg-card p-4 md:p-5 hover:border-primary/30 transition-all group flex items-center gap-4"
                        >
                          <div className={`flex items-center justify-center h-10 w-10 rounded-xl shrink-0 ${
                            done ? 'bg-primary/10' : 'bg-muted'
                          }`}>
                            {done
                              ? <CheckCircle2 className="h-5 w-5 text-primary" />
                              : <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm md:text-base font-bold text-foreground group-hover:text-primary transition-colors">
                              {s.section_title}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {s.content.split('\n').find(l => l.trim() && !l.startsWith('#'))?.replace(/[#*`]/g, '').trim()}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
};

export default ProductManual;
