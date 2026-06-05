import React, { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

export interface FlowStep {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  iconColor: string;
}

interface HowItWorksFlowProps {
  steps: FlowStep[];
  title?: string;
  defaultOpen?: boolean;
  /**
   * If provided, the open/collapsed state is persisted to localStorage under
   * `how-it-works:{storageKey}` so it survives navigation and reloads.
   */
  storageKey?: string;
}

export const HowItWorksFlow: React.FC<HowItWorksFlowProps> = ({
  steps,
  title = 'How it works',
  defaultOpen = false,
  storageKey,
}) => {
  const tr = useHarvestedT('customer');
  const reactId = useId();
  const contentId = `how-it-works-${storageKey ?? reactId}`;
  const lsKey = storageKey ? `how-it-works:${storageKey}` : null;

  const [open, setOpen] = useState<boolean>(() => {
    if (!lsKey || typeof window === 'undefined') return defaultOpen;
    try {
      const v = window.localStorage.getItem(lsKey);
      return v === null ? defaultOpen : v === '1';
    } catch {
      return defaultOpen;
    }
  });

  useEffect(() => {
    if (!lsKey || typeof window === 'undefined') return;
    try { window.localStorage.setItem(lsKey, open ? '1' : '0'); } catch { /* ignore */ }
  }, [open, lsKey]);

  const toggle = () => setOpen((o) => !o);
  const translatedTitle = tr(title);

  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={`${translatedTitle} — ${open ? 'collapse' : 'expand'}`}
        className="flex w-full items-center justify-between p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-3xl"
      >
        <span className="text-sm font-bold text-foreground">{translatedTitle}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={contentId}
            role="region"
            aria-label={translatedTitle}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <ol className="px-4 pb-5 pt-0 list-none m-0">
              <div className="relative flex flex-col gap-0">
                {steps.map((step, i) => {
                  const Icon = step.icon;
                  const isLast = i === steps.length - 1;

                  return (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.12, duration: 0.35 }}
                      className="flex gap-3 relative"
                    >
                      <div className="flex flex-col items-center" aria-hidden="true">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.12 + 0.1, type: 'spring', stiffness: 300 }}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl z-10"
                          style={{ backgroundColor: step.color }}
                        >
                          <Icon
                            className="h-5 w-5"
                            style={{ color: step.iconColor }}
                            strokeWidth={1.5}
                          />
                        </motion.div>
                        {!isLast && (
                          <motion.div
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            transition={{ delay: i * 0.12 + 0.2, duration: 0.3 }}
                            className="w-0.5 flex-1 origin-top"
                            style={{ backgroundColor: step.color, minHeight: 20 }}
                          />
                        )}
                      </div>

                      <div className={`pt-1.5 ${isLast ? 'pb-0' : 'pb-5'}`}>
                        <p className="text-xs font-bold text-foreground">
                          <span className="sr-only">Step {i + 1}: </span>
                          {tr(step.title)}
                        </p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground mt-0.5">
                          {tr(step.description)}
                        </p>
                      </div>
                    </motion.li>
                  );
                })}
              </div>
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
