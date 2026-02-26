import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CreditCard, SendHorizontal, ChevronRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTenant, type WalkthroughConfig } from './TenantProvider';
import { supabase } from '@/integrations/supabase/client';
import { useParams } from 'react-router-dom';

// Dynamic icon map for DB-driven slides
import * as LucideIcons from 'lucide-react';

interface WalkthroughSlide {
  icon?: React.ElementType;
  icon_name?: string;
  title: string;
  description: string;
  media_type?: 'icon' | 'image' | 'video';
  media_url?: string | null;
  bg_color?: string | null;
  text_color?: string | null;
}

const defaultSlides: WalkthroughSlide[] = [
  { icon: Shield, title: 'Secure Banking', description: 'Your accounts are protected with bank-grade security and real-time monitoring.' },
  { icon: SendHorizontal, title: 'Instant Transfers', description: 'Send money to anyone, anywhere. Mobile money, bank transfers, and QR payments.' },
  { icon: CreditCard, title: 'Virtual Cards', description: 'Create virtual cards for online shopping. Control spending with instant freeze.' },
];

interface WalkthroughCarouselProps {
  slides?: WalkthroughSlide[];
  onComplete: () => void;
}

export const WalkthroughCarousel: React.FC<WalkthroughCarouselProps> = ({
  slides: propSlides,
  onComplete,
}) => {
  const [current, setCurrent] = useState(0);
  const [dbSlides, setDbSlides] = useState<WalkthroughSlide[] | null>(null);
  const tenant = useTenant();
  const { institutionId } = useParams();
  const wConfig = tenant.walkthroughConfig || {};

  useEffect(() => {
    if (!institutionId || propSlides) return;
    const fetchSlides = async () => {
      const { data } = await supabase
        .from('institution_walkthroughs')
        .select('*')
        .eq('institution_id', institutionId)
        .order('slide_order');
      if (data && data.length > 0) {
        setDbSlides(data.map((s: any) => ({
          icon_name: s.icon_name,
          title: s.title,
          description: s.description,
          media_type: s.media_type || 'icon',
          media_url: s.media_url,
          bg_color: s.bg_color,
          text_color: s.text_color,
        })));
      }
    };
    fetchSlides();
  }, [institutionId, propSlides]);

  const slides = propSlides || dbSlides || defaultSlides;
  const isLast = current === slides.length - 1;

  const next = () => {
    if (isLast) onComplete();
    else setCurrent((p) => p + 1);
  };

  const slide = slides[current];
  const iconName = slide.icon_name || 'Shield';
  const SlideIcon = slide.icon || (LucideIcons as any)[iconName] || Shield;
  const mediaType = slide.media_type || 'icon';

  const bgStyle: React.CSSProperties = {};
  if (slide.bg_color) bgStyle.backgroundColor = slide.bg_color;
  else if (wConfig.bg_color) bgStyle.backgroundColor = wConfig.bg_color;

  const textStyle: React.CSSProperties = {};
  if (slide.text_color) textStyle.color = slide.text_color;
  else if (wConfig.text_color) textStyle.color = wConfig.text_color;

  return (
    <div className="flex min-h-screen flex-col px-6 py-12" style={{ ...bgStyle, backgroundColor: bgStyle.backgroundColor || 'hsl(var(--background))' }}>
      {wConfig.skip_enabled !== false && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onComplete} className="text-muted-foreground">Skip</Button>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        {wConfig.logo_url && (
          <img src={wConfig.logo_url} alt="Logo" className="h-10 w-auto object-contain" />
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-6 text-center"
          >
            {mediaType === 'icon' && (
              <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-primary/10">
                <SlideIcon className="h-14 w-14 text-primary" strokeWidth={1.5} />
              </div>
            )}

            {mediaType === 'image' && slide.media_url && (
              <img src={slide.media_url} alt={slide.title} className="h-48 w-48 rounded-3xl object-cover" />
            )}

            {mediaType === 'video' && slide.media_url && (
              <div className="h-48 w-64 overflow-hidden rounded-2xl">
                <video src={slide.media_url} className="h-full w-full object-cover" controls playsInline />
              </div>
            )}

            <h2 className="text-2xl font-semibold tracking-tight" style={textStyle}>
              {slide.title}
            </h2>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground" style={slide.text_color ? { color: `${slide.text_color}99` } : undefined}>
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-2 pb-6">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-2 rounded-full transition-all duration-300 ${i === current ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'}`}
            style={i === current && wConfig.accent_color ? { backgroundColor: wConfig.accent_color } : undefined}
          />
        ))}
      </div>

      <Button onClick={next} className="w-full gap-2" size="lg"
        style={wConfig.accent_color ? { backgroundColor: wConfig.accent_color } : undefined}
      >
        {isLast ? 'Get Started' : 'Next'}
        <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
      </Button>
    </div>
  );
};
