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
    <section className="relative overflow-hidden min-h-[520px] md:min-h-[600px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
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
            className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent"
            style={{ opacity: slide.overlay_opacity }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="container mx-auto px-4 py-24 md:py-40 relative z-10">
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
                <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight text-foreground drop-shadow-md">
                  {slide.title}
                </h1>
              )}
              {slide.subtitle && (
                <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed max-w-xl">
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
