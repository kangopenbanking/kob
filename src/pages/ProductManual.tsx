import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Search, BookOpen, Download, ChevronRight, Loader2, ArrowLeft, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { useRegulatoryPdfExport } from '@/hooks/useRegulatoryPdfExport';
import { BrandName } from '@/components/BrandName';
import { motion } from 'framer-motion';

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

const manualMeta: Record<string, { title: string; subtitle: string; code: string }> = {
  banks: { title: 'Banking & FI Manual', subtitle: 'Comprehensive guide for banks and financial institutions using Kang Open Banking', code: 'KOB-MAN-BANK' },
  customers: { title: 'Customer Guide', subtitle: 'Everything you need to know about using the Kang app', code: 'KOB-MAN-CUST' },
  developers: { title: 'Developer Manual', subtitle: 'API documentation, SDKs, and integration guides', code: 'KOB-MAN-DEV' },
};

const ProductManual: React.FC = () => {
  const { type } = useParams<{ type: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSlug = searchParams.get('section');

  const [sections, setSections] = useState<ManualSection[]>([]);
  const [glossary, setGlossary] = useState<GlossaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showGlossary, setShowGlossary] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const { exportToPdf } = useRegulatoryPdfExport();
  const meta = manualMeta[type || ''] || manualMeta.customers;

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: s }, { data: g }] = await Promise.all([
        (supabase.from('product_manuals') as any)
          .select('id, section_title, section_slug, content, sort_order')
          .eq('manual_type', type || 'customers')
          .eq('is_active', true)
          .order('sort_order'),
        (supabase.from('product_glossary') as any)
          .select('term, definition')
          .or(`manual_type.eq.${type || 'customers'},manual_type.eq.all`)
          .order('term'),
      ]);
      if (s) setSections(s);
      if (g) setGlossary(g);
      setLoading(false);
    };
    load();
  }, [type]);

  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.toLowerCase();
    return sections.filter(s =>
      s.section_title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
    );
  }, [sections, search]);

  const filteredGlossary = useMemo(() => {
    if (!search.trim()) return glossary;
    const q = search.toLowerCase();
    return glossary.filter(g =>
      g.term.toLowerCase().includes(q) || g.definition.toLowerCase().includes(q)
    );
  }, [glossary, search]);

  const activeSection = sections.find(s => s.section_slug === activeSlug);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <span>Manuals</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{meta.title}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="h-7 w-7 text-primary" />
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{meta.title}</h1>
              </div>
              <p className="text-muted-foreground">{meta.subtitle}</p>
            </div>

            <div className="flex gap-2">
              {isAuthenticated ? (
                <Button onClick={handleDownloadPdf} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              ) : (
                <Link to="/login">
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Sign in to Download
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Manual type tabs */}
          <div className="flex gap-1 mt-6">
            {Object.entries(manualMeta).map(([key, m]) => (
              <Link
                key={key}
                to={`/manual/${key}`}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  type === key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {m.title}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Search */}
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search manual..."
              className="pl-10"
            />
          </div>
          <Button
            variant={showGlossary ? 'default' : 'outline'}
            onClick={() => { setShowGlossary(!showGlossary); setShowToc(false); }}
            className="gap-2"
          >
            <BookOpen className="h-4 w-4" />
            Glossary
          </Button>
          <Button
            variant={showToc ? 'default' : 'outline'}
            onClick={() => { setShowToc(!showToc); setShowGlossary(false); }}
            className="gap-2 hidden md:flex"
          >
            <List className="h-4 w-4" />
            Contents
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar / TOC */}
          <div className={`md:col-span-1 ${showToc ? '' : 'hidden md:block'}`}>
            <div className="sticky top-4 rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold text-foreground mb-3">Table of Contents</h3>
              <nav className="flex flex-col gap-1">
                {sections.map(s => (
                  <button
                    key={s.section_slug}
                    onClick={() => {
                      setSearchParams({ section: s.section_slug });
                      setShowToc(false);
                    }}
                    className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                      activeSlug === s.section_slug
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {s.section_title}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main content */}
          <div className="md:col-span-3">
            {showGlossary ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-border bg-card p-6"
              >
                <h2 className="text-xl font-bold text-foreground mb-4">Glossary</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredGlossary.map(g => (
                    <div key={g.term} className="rounded-lg border border-border p-4">
                      <p className="font-semibold text-foreground text-sm mb-1">{g.term}</p>
                      <p className="text-xs text-muted-foreground">{g.definition}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : activeSection ? (
              <motion.div
                key={activeSection.section_slug}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-card p-6"
              >
                <button
                  onClick={() => setSearchParams({})}
                  className="flex items-center gap-1 text-sm text-primary mb-4 hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" /> All Sections
                </button>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      h2: ({ children }) => <h2 className="text-xl font-bold text-foreground mt-6 mb-3">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-bold text-foreground mt-4 mb-2">{children}</h3>,
                      p: ({ children }) => <p className="text-sm text-muted-foreground leading-relaxed mb-3">{children}</p>,
                      ul: ({ children }) => <ul className="text-sm text-muted-foreground space-y-1 mb-3 pl-5 list-disc">{children}</ul>,
                      ol: ({ children }) => <ol className="text-sm text-muted-foreground space-y-1 mb-3 pl-5 list-decimal">{children}</ol>,
                      li: ({ children }) => <li className="text-sm text-muted-foreground">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                      code: ({ children, className }) => {
                        if (className) {
                          return (
                            <pre className="bg-muted rounded-lg p-4 overflow-x-auto mb-3">
                              <code className="text-xs font-mono text-foreground">{children}</code>
                            </pre>
                          );
                        }
                        return <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>;
                      },
                      pre: ({ children }) => <>{children}</>,
                      table: ({ children }) => (
                        <div className="overflow-x-auto rounded-lg border border-border mb-3">
                          <table className="w-full text-sm">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
                      th: ({ children }) => <th className="px-3 py-2 text-left text-xs font-semibold text-foreground">{children}</th>,
                      td: ({ children }) => <td className="px-3 py-2 border-t border-border text-xs text-muted-foreground">{children}</td>,
                    }}
                  >
                    {activeSection.content}
                  </ReactMarkdown>
                </div>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSections.map((s, i) => (
                  <motion.button
                    key={s.section_slug}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSearchParams({ section: s.section_slug })}
                    className="text-left rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-muted-foreground">Chapter {i + 1}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-1">{s.section_title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {s.content.split('\n').find(l => l.trim() && !l.startsWith('#'))?.replace(/[#*`]/g, '').trim()}
                    </p>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductManual;
