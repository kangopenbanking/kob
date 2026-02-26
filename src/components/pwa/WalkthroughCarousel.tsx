import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CreditCard, SendHorizontal, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTenant } from './TenantProvider';

interface WalkthroughSlide {
  icon: React.ElementType;
  title: string;
  description: string;
}

const defaultSlides: WalkthroughSlide[] = [
  {
    icon: Shield,
    title: 'Secure Banking',
    description: 'Your accounts are protected with bank-grade security and real-time monitoring.',
  },
  {
    icon: SendHorizontal,
    title: 'Instant Transfers',
    description: 'Send money to anyone, anywhere. Mobile money, bank transfers, and QR payments.',
  },
  {
    icon: CreditCard,
    title: 'Virtual Cards',
    description: 'Create virtual cards for online shopping. Control spending with instant freeze.',
  },
];

interface WalkthroughCarouselProps {
  slides?: WalkthroughSlide[];
  onComplete: () => void;
}

export const WalkthroughCarousel: React.FC<WalkthroughCarouselProps> = ({
  slides = defaultSlides,
  onComplete,
}) => {
  const [current, setCurrent] = useState(0);
  const tenant = useTenant();
  const isLast = current === slides.length - 1;

  const next = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrent((p) => p + 1);
    }
  };

  const SlideIcon = slides[current].icon;

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-12">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onComplete} className="text-muted-foreground">
          Skip
        </Button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-6 text-center"
          >
            <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-primary/10">
              <SlideIcon className="h-14 w-14 text-primary" strokeWidth={1.5} />
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {slides[current].title}
            </h2>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {slides[current].description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-2 pb-6">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'
            }`}
          />
        ))}
      </div>

      <Button onClick={next} className="w-full gap-2" size="lg">
        {isLast ? 'Get Started' : 'Next'}
        <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
      </Button>
    </div>
  );
};
