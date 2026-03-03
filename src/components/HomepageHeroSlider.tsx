import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type ReactNode } from "react";

interface HeroSlide {
  id: string;
  title: string | null;
  subtitle: string | null;
  media_url: string;
  media_type: string;
  cta_text: string | null;
  cta_link: string | null;
  overlay_opacity: number;
  font_color: string | null;
  font_size: string | null;
  font_alignment: string | null;
  subtitle_font_size: string | null;
  subtitle_font_color: string | null;
}

export function HomepageHeroSlider({ fallback }: { fallback?: ReactNode }) {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("homepage_hero_slides")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setSlides((data as any[]) || []);
        setLoaded(true);
      });
  }, []);

  // Auto-advance
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((p) => (p + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const goTo = useCallback((i: number) => {
    setCurrent(((i % slides.length) + slides.length) % slides.length);
  }, [slides.length]);

  // If no slides from DB, render fallback
  if (loaded && slides.length === 0) return <>{fallback}</>;
  if (!loaded) return <>{fallback}</>;

  const slide = slides[current];

  return (
    <section className="relative overflow-hidden min-h-[520px] md:min-h-[600px] bg-black">
      <AnimatePresence initial={false}>
        <motion.div
          key={slide.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 z-[1]"
        >
          {slide.media_type === "video" ? (
            <video
              src={slide.media_url}
              className="w-full h-full object-cover"
              autoPlay loop muted playsInline
            />
          ) : (
            <img
              src={slide.media_url}
              alt={slide.title || ""}
              className="w-full h-full object-cover"
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to right, rgba(0,0,0,${slide.overlay_opacity ?? 0.4}), rgba(0,0,0,${(slide.overlay_opacity ?? 0.4) * 0.6}), transparent)`
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className={`container mx-auto px-4 py-24 md:py-40 relative z-10 ${
        slide.font_alignment === 'center' ? 'text-center flex justify-center' :
        slide.font_alignment === 'right' ? 'text-right flex justify-end' :
        'text-left'
      }`}>
        <div className="max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id + "-content"}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              {slide.title && (
                <h1
                  className={`font-bold mb-4 leading-tight drop-shadow-md ${
                    slide.font_size === 'small' ? 'text-2xl md:text-4xl' :
                    slide.font_size === 'large' ? 'text-5xl md:text-7xl' :
                    slide.font_size === 'xlarge' ? 'text-6xl md:text-8xl' :
                    'text-4xl md:text-6xl'
                  }`}
                  style={{ color: slide.font_color || '#ffffff' }}
                >
                  {slide.title}
                </h1>
              )}
              {slide.subtitle && (
                <p
                  className={`mb-8 leading-relaxed max-w-xl ${
                    (slide.subtitle_font_size || 'default') === 'small' ? 'text-sm md:text-base' :
                    (slide.subtitle_font_size || 'default') === 'large' ? 'text-xl md:text-2xl' :
                    (slide.subtitle_font_size || 'default') === 'xlarge' ? 'text-2xl md:text-3xl' :
                    'text-lg md:text-xl'
                  }`}
                  style={{ color: slide.subtitle_font_color || (slide.font_color ? `${slide.font_color}cc` : '#ffffffcc') }}
                >
                  {slide.subtitle}
                </p>
              )}
              {slide.cta_text && slide.cta_link && (
                <Link to={slide.cta_link}>
                  <Button size="lg" className="text-lg px-8">
                    {slide.cta_text}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Nav controls */}
      {slides.length > 1 && (
        <>
          <button
            onClick={() => goTo(current - 1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/60 backdrop-blur flex items-center justify-center hover:bg-background/80 transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => goTo(current + 1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/60 backdrop-blur flex items-center justify-center hover:bg-background/80 transition"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all ${
                  i === current ? "w-8 bg-primary" : "w-2 bg-foreground/30"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
