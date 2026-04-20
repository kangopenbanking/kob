import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Info, ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export interface PageGuideStep {
  title: string;
  description: string;
}

export interface PageGuideProps {
  /** Page title (also used as <title> when seoTitle is not set) */
  title: string;
  /** Short purpose statement (1–2 sentences) shown in the strip */
  summary: string;
  /** Step-by-step actions a user can take on this page */
  steps: PageGuideStep[];
  /** Optional SEO meta description (defaults to summary) */
  seoDescription?: string;
  /** Optional SEO browser title (defaults to `${title} · Kang Business`) */
  seoTitle?: string;
  /** Optional learn-more documentation link */
  learnMoreHref?: string;
  /** Optional learn-more label */
  learnMoreLabel?: string;
  /** Optional canonical URL */
  canonical?: string;
  className?: string;
}

/**
 * PageGuide — compact, professional, expandable info strip rendered at the top
 * of dashboard pages. Provides a one-line purpose + an expandable step list,
 * plus per-page SEO metadata and HowTo JSON-LD for international discoverability.
 */
export const PageGuide: React.FC<PageGuideProps> = ({
  title,
  summary,
  steps,
  seoDescription,
  seoTitle,
  learnMoreHref,
  learnMoreLabel = 'Learn more',
  canonical,
  className,
}) => {
  const [open, setOpen] = useState(false);

  const metaTitle = seoTitle ?? `${title} · Kang Business`;
  const metaDesc = (seoDescription ?? summary).slice(0, 158);

  // HowTo JSON-LD for SEO
  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: title,
    description: summary,
    step: steps.map((s, idx) => ({
      '@type': 'HowToStep',
      position: idx + 1,
      name: s.title,
      text: s.description,
    })),
  };

  return (
    <>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDesc} />
        {canonical && <link rel="canonical" href={canonical} />}
        <script type="application/ld+json">{JSON.stringify(howToJsonLd)}</script>
      </Helmet>

      <section
        aria-label={`${title} guide`}
        className={cn(
          'mb-4 rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm',
          'transition-colors hover:border-border',
          className,
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="page-guide-body"
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background">
            <Info className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">{title}</span>
            <span className="block truncate text-xs text-muted-foreground">{summary}</span>
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
            strokeWidth={1.75}
          />
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id="page-guide-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="border-t border-border/60 px-4 py-3">
                <ol className="space-y-2.5">
                  {steps.map((s, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-background text-[10px] font-semibold text-foreground">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{s.title}</p>
                        <p className="text-xs text-muted-foreground">{s.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                {learnMoreHref && (
                  <a
                    href={learnMoreHref}
                    target={learnMoreHref.startsWith('http') ? '_blank' : undefined}
                    rel={learnMoreHref.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
                  >
                    {learnMoreLabel}
                    <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </>
  );
};

export default PageGuide;
