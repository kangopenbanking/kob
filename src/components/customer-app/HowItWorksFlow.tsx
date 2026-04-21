import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

export interface FlowStep {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string; // HSL bg color e.g. "hsl(210,80%,93%)"
  iconColor: string; // HSL icon color e.g. "hsl(210,60%,45%)"
}

interface HowItWorksFlowProps {
  steps: FlowStep[];
  title?: string;
  defaultOpen?: boolean;
}

export const HowItWorksFlow: React.FC<HowItWorksFlowProps> = ({
  steps,
  title = 'How it works',
  defaultOpen = false,
}) => {
  const tr = useHarvestedT('customer');
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4"
      >
        <span className="text-sm font-bold text-foreground">{tr(title)}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 pt-0">
              <div className="relative flex flex-col gap-0">
                {steps.map((step, i) => {
                  const Icon = step.icon;
                  const isLast = i === steps.length - 1;

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.12, duration: 0.35 }}
                      className="flex gap-3 relative"
                    >
                      {/* Vertical connector line */}
                      <div className="flex flex-col items-center">
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

                      {/* Content */}
                      <div className={`pt-1.5 ${isLast ? 'pb-0' : 'pb-5'}`}>
                        <p className="text-xs font-bold text-foreground">{tr(step.title)}</p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground mt-0.5">
                          {tr(step.description)}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
