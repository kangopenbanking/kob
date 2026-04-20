import React from 'react';
import ReactMarkdown from 'react-markdown';
import { MermaidDiagram } from '@/components/developer/MermaidDiagram';
import { Info, AlertTriangle, Lightbulb, Flag, CheckCircle2, ArrowRight } from 'lucide-react';

const headingId = (children: any) => {
  const text = (Array.isArray(children) ? children.join('') : String(children || '')).toLowerCase();
  return text.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
};

const calloutFromText = (text: string) => {
  const m = text.match(/^\s*(Tip|Note|Important|Warning|Flag|Example|In Simple Terms|Real Example|Best Practice):\s*/i);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const body = text.slice(m[0].length);
  const map: Record<string, { icon: React.ElementType; tone: string; label: string }> = {
    'tip':              { icon: Lightbulb,    tone: 'border-primary/40 bg-primary/5',           label: 'Tip' },
    'note':             { icon: Info,         tone: 'border-border bg-muted/40',                label: 'Note' },
    'important':        { icon: AlertTriangle,tone: 'border-amber-500/40 bg-amber-500/5',       label: 'Important' },
    'warning':          { icon: AlertTriangle,tone: 'border-amber-500/40 bg-amber-500/5',       label: 'Warning' },
    'flag':             { icon: Flag,         tone: 'border-destructive/40 bg-destructive/5',   label: 'Flag' },
    'example':          { icon: ArrowRight,   tone: 'border-border bg-muted/40',                label: 'Example' },
    'real example':     { icon: ArrowRight,   tone: 'border-border bg-muted/40',                label: 'Real Example' },
    'in simple terms':  { icon: CheckCircle2, tone: 'border-primary/40 bg-primary/5',           label: 'In Simple Terms' },
    'best practice':    { icon: CheckCircle2, tone: 'border-primary/40 bg-primary/5',           label: 'Best Practice' },
  };
  return { ...map[kind], body };
};

const components = {
  h1: ({ children }: any) => <h1 id={headingId(children)} className="text-2xl md:text-3xl font-extrabold text-foreground mt-2 mb-4 leading-tight tracking-tight">{children}</h1>,
  h2: ({ children }: any) => <h2 id={headingId(children)} className="text-xl md:text-2xl font-bold text-foreground mt-10 mb-3 pb-2 border-b border-border scroll-mt-24 tracking-tight">{children}</h2>,
  h3: ({ children }: any) => <h3 id={headingId(children)} className="text-lg font-bold text-foreground mt-7 mb-2 scroll-mt-24">{children}</h3>,
  p:  ({ children }: any) => <p className="text-[15.5px] text-foreground/85 leading-[1.8] mb-4">{children}</p>,
  ul: ({ children }: any) => <ul className="text-[15.5px] text-foreground/85 space-y-2 mb-4 pl-5 list-disc marker:text-primary">{children}</ul>,
  ol: ({ children }: any) => <ol className="text-[15.5px] text-foreground/85 space-y-2 mb-4 pl-5 list-decimal marker:text-primary">{children}</ol>,
  li: ({ children }: any) => <li className="text-[15.5px] text-foreground/85 leading-relaxed">{children}</li>,
  strong: ({ children }: any) => <strong className="font-semibold text-foreground">{children}</strong>,
  blockquote: ({ children }: any) => {
    // Try to detect a labelled callout (Tip:, Note:, etc.)
    const text = React.Children.toArray(children)
      .map((c: any) => typeof c === 'string' ? c : (c?.props?.children?.toString?.() ?? ''))
      .join(' ');
    const callout = calloutFromText(text.replace(/\*\*/g, ''));
    if (callout) {
      const Icon = callout.icon;
      return (
        <div className={`my-5 rounded-xl border ${callout.tone} px-4 py-3.5 flex gap-3`}>
          <Icon className="h-4.5 w-4.5 text-primary mt-0.5 shrink-0" />
          <div className="text-[15px] text-foreground leading-relaxed">
            <span className="font-semibold mr-1.5">{callout.label}:</span>
            {callout.body}
          </div>
        </div>
      );
    }
    return (
      <blockquote className="border-l-4 border-primary/50 bg-muted/40 rounded-r-lg px-5 py-4 my-5 text-[15px] text-foreground">
        {children}
      </blockquote>
    );
  },
  code: ({ children, className }: any) => {
    const lang = (className || '').replace('language-', '');
    if (lang === 'mermaid') {
      const chart = String(children).trim();
      return <MermaidDiagram chart={chart} />;
    }
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
  td: ({ children }: any) => <td className="px-4 py-3 border-t border-border text-sm text-foreground/85">{children}</td>,
  hr: () => <hr className="border-border my-8" />,
};

export const ManualMarkdown: React.FC<{ content: string }> = ({ content }) => (
  <div className="prose prose-sm dark:prose-invert max-w-none">
    <ReactMarkdown components={components as any}>{content}</ReactMarkdown>
  </div>
);

export default ManualMarkdown;
