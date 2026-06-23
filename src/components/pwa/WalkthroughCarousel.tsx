import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CreditCard, SendHorizontal, ChevronRight } from 'lucide-react';
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
  walkthroughConfig?: WalkthroughConfig;
  slideSourceId?: string;
}

export const WalkthroughCarousel: React.FC<WalkthroughCarouselProps> = ({
  slides: propSlides,
  onComplete,
  walkthroughConfig: propWConfig,
  slideSourceId,
}) => {
  const [current, setCurrent] = useState(0);
  const [dbSlides, setDbSlides] = useState<WalkthroughSlide[] | null>(null);
  const tenant = useTenant();
  const { institutionId } = useParams();

  const resolvedSourceId = slideSourceId || institutionId;
  const wConfig = propWConfig ?? tenant.walkthroughConfig ?? {};

  useEffect(() => {
    if (!resolvedSourceId || propSlides) return;
    const fetchSlides = async () => {
      const { data } = await supabase
        .from('institution_walkthroughs')
        .select('*')
        .eq('institution_id', resolvedSourceId)
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
  }, [resolvedSourceId, propSlides]);

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

  const hasImage = mediaType === 'image' && slide.media_url;
  const hasVideo = mediaType === 'video' && slide.media_url;
  const hasMedia = hasImage || hasVideo;

  const bgStyle: React.CSSProperties = {};
  if (!hasMedia) {
    if (slide.bg_color) bgStyle.backgroundColor = slide.bg_color;
    else if (wConfig.bg_color) bgStyle.backgroundColor = wConfig.bg_color;
  }

  const textStyle: React.CSSProperties = {};
  if (slide.text_color) textStyle.color = slide.text_color;
  else if (wConfig.text_color) textStyle.color = wConfig.text_color;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ ...bgStyle, backgroundColor: bgStyle.backgroundColor || 'hsl(var(--background))' }}
    >
      {/* Top media section — covers full width, responsive height */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`media-${current}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="relative w-full shrink-0 overflow-hidden"
          style={{
            height: '60vh',
            minHeight: '320px',
            maxHeight: '720px',
            backgroundColor: slide.bg_color || wConfig.bg_color || 'hsl(var(--muted))',
          }}
        >
          {hasImage && (
            <img
              src={slide.media_url!}
              alt={slide.title}
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
          )}

          {hasVideo && (
            <video
              src={slide.media_url!}
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted
              playsInline
              loop
              preload="auto"
            />
          )}

          {mediaType === 'icon' && (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                backgroundColor: slide.bg_color || wConfig.bg_color || 'hsl(var(--primary) / 0.06)',
              }}
            >
              <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-primary/10">
                <SlideIcon className="h-14 w-14 text-primary" strokeWidth={1.5} />
              </div>
            </div>
          )}

          {/* Skip button overlaid on media */}
          {wConfig.skip_enabled !== false && (
            <div className="absolute right-4 top-4 z-10">
              <Button
                variant="ghost"
                size="sm"
                onClick={onComplete}
                className="rounded-full bg-background/60 text-foreground backdrop-blur-sm hover:bg-background/80"
              >
                Skip
              </Button>
            </div>
          )}

          {/* Logo overlaid on media */}
          {(wConfig.logo_url || tenant.logoUrl) && (
            <div className="absolute left-4 top-4 z-10">
              <img
                src={wConfig.logo_url || tenant.logoUrl || '/kfs-logo.png'}
                alt="Logo"
                className="h-8 w-auto rounded-lg object-contain bg-background/60 p-1 backdrop-blur-sm"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== window.location.origin + '/kfs-logo.png') {
                    target.src = '/kfs-logo.png';
                  }
                }}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bottom content section */}
      <div className="flex flex-1 flex-col justify-between px-6 pb-8 pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`text-${current}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
          >
            <h2 className="text-2xl font-semibold tracking-tight" style={textStyle}>
              {slide.title}
            </h2>
            <p
              className="max-w-xs text-sm leading-relaxed text-muted-foreground"
              style={slide.text_color ? { color: `${slide.text_color}99` } : undefined}
            >
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 pb-4 pt-4">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'
              }`}
              style={
                i === current && wConfig.accent_color
                  ? { backgroundColor: wConfig.accent_color }
                  : undefined
              }
            />
          ))}
        </div>

        <Button
          onClick={next}
          className="w-full gap-2"
          size="lg"
          style={wConfig.accent_color ? { backgroundColor: wConfig.accent_color } : undefined}
        >
          {isLast ? 'Get Started' : 'Next'}
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  );
};
