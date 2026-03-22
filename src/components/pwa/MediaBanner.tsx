import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, ExternalLink, Pause, Volume2, VolumeX } from 'lucide-react';

export type BannerAspect = 'landscape' | 'portrait';

export interface MediaSection {
  id: string;
  type: 'image' | 'video';
  url: string;
  provider?: 'youtube' | 'vimeo' | 'facebook' | 'x' | 'instagram' | 'linkedin' | 'custom';
  video_id?: string;
  title?: string;
  position: number;
  aspect?: BannerAspect;
  link_url?: string;
}

function getEmbedUrl(item: MediaSection): string {
  const vid = item.video_id || '';
  switch (item.provider) {
    case 'youtube':
      return `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&rel=0&loop=1&playlist=${vid}`;
    case 'vimeo':
      return `https://player.vimeo.com/video/${vid}?autoplay=1&muted=1&byline=0&portrait=0`;
    case 'facebook':
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(item.url)}&show_text=false&autoplay=true&muted=true`;
    case 'x':
      return item.url;
    case 'instagram':
      return `https://www.instagram.com/p/${vid}/embed`;
    case 'linkedin':
      return item.url;
    case 'custom':
      return item.url;
    default:
      return item.url;
  }
}

function detectProvider(url: string): { provider: MediaSection['provider']; video_id: string } {
  if (!url) return { provider: 'custom', video_id: '' };
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { provider: 'youtube', video_id: ytMatch[1] };
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { provider: 'vimeo', video_id: vimeoMatch[1] };
  if (url.includes('facebook.com') || url.includes('fb.watch')) return { provider: 'facebook', video_id: '' };
  if (url.includes('twitter.com') || url.includes('x.com')) return { provider: 'x', video_id: '' };
  const igMatch = url.match(/instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+)/);
  if (igMatch) return { provider: 'instagram', video_id: igMatch[1] };
  if (url.includes('linkedin.com')) return { provider: 'linkedin', video_id: '' };
  return { provider: 'custom', video_id: '' };
}

export { detectProvider };

const AUTO_ADVANCE_MS = 5000;

interface MediaBannerProps {
  items: MediaSection[];
  cardSize?: 'small' | 'medium' | 'large';
  aspect?: BannerAspect;
}

export const MediaBanner: React.FC<MediaBannerProps> = ({ items, cardSize = 'medium', aspect }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  if (!items || items.length === 0) return null;

  const sorted = [...items].sort((a, b) => a.position - b.position);
  const current = sorted[currentIndex];
  const effectiveAspect = current.aspect || aspect || 'landscape';

  const getHeightClass = () => {
    if (effectiveAspect === 'portrait') {
      return cardSize === 'small' ? 'h-64' : cardSize === 'large' ? 'h-[480px]' : 'h-96';
    }
    return cardSize === 'small' ? 'h-36' : cardSize === 'large' ? 'h-60' : 'h-48';
  };
  const heightClass = getHeightClass();

  const goNext = useCallback(() => setCurrentIndex((i) => (i + 1) % sorted.length), [sorted.length]);
  const goPrev = useCallback(() => setCurrentIndex((i) => (i - 1 + sorted.length) % sorted.length), [sorted.length]);

  // IntersectionObserver for autoplay
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Auto-play video when in view
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isInView && isPlaying) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [isInView, isPlaying, currentIndex]);

  // Auto-advance carousel
  useEffect(() => {
    if (sorted.length <= 1) return;
    if (!isInView) return;
    // Don't auto-advance if current is a playing custom video
    if (current.type === 'video' && current.provider === 'custom' && isPlaying) return;

    timerRef.current = setInterval(goNext, AUTO_ADVANCE_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sorted.length, isInView, goNext, current.type, current.provider, isPlaying]);

  const handleImageClick = (item: MediaSection) => {
    if (item.link_url) {
      window.open(item.link_url, '_blank', 'noopener,noreferrer');
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted((m) => !m);
    if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying((p) => !p);
  };

  const isCustomVideo = current.type === 'video' && current.provider === 'custom';
  const isEmbedVideo = current.type === 'video' && current.provider !== 'custom' && current.provider !== 'x' && current.provider !== 'linkedin';
  const isLinkOutVideo = current.type === 'video' && (current.provider === 'x' || current.provider === 'linkedin');

  return (
    <div ref={containerRef} className="relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className={`relative w-full overflow-hidden rounded-2xl shadow-lg ${heightClass}`}
        >
          {/* Image slide */}
          {current.type === 'image' && (
            <div
              onClick={() => handleImageClick(current)}
              className={`h-full w-full ${current.link_url ? 'cursor-pointer' : ''}`}
            >
              <img
                src={current.url}
                alt={current.title || 'Banner'}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {/* Subtle gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
              {current.link_url && (
                <div className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 shadow-md backdrop-blur-sm">
                  <ExternalLink className="h-3.5 w-3.5 text-foreground" strokeWidth={2} />
                </div>
              )}
            </div>
          )}

          {/* Custom (direct) video */}
          {isCustomVideo && current.url && (
            <>
              <video
                ref={videoRef}
                src={current.url}
                className="h-full w-full object-cover"
                playsInline
                muted={isMuted}
                loop
                preload="metadata"
                onClick={togglePlay}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
              {/* Video controls overlay */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={togglePlay}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-background/80 shadow-md backdrop-blur-sm"
                >
                  {isPlaying ? (
                    <Pause className="h-3.5 w-3.5 text-foreground" strokeWidth={2} />
                  ) : (
                    <Play className="h-3.5 w-3.5 text-foreground ml-0.5" strokeWidth={2} />
                  )}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleMute}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-background/80 shadow-md backdrop-blur-sm"
                >
                  {isMuted ? (
                    <VolumeX className="h-3.5 w-3.5 text-foreground" strokeWidth={2} />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5 text-foreground" strokeWidth={2} />
                  )}
                </motion.button>
              </div>
            </>
          )}

          {/* Embed video (YouTube, Vimeo, Facebook, Instagram) */}
          {isEmbedVideo && (
            <iframe
              src={isInView ? getEmbedUrl(current) : undefined}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={current.title || 'Video'}
            />
          )}

          {/* Link-out video (X, LinkedIn) */}
          {isLinkOutVideo && (
            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full w-full items-center justify-center bg-muted"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Play className="h-7 w-7 text-primary ml-1" strokeWidth={2} />
                </div>
                <span className="text-sm font-semibold text-foreground">
                  Watch on {current.provider === 'x' ? 'X' : 'LinkedIn'}
                </span>
              </div>
            </a>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Title */}
      {current.title && (
        <motion.p
          key={`title-${current.id}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-xs font-semibold text-foreground px-1"
        >
          {current.title}
        </motion.p>
      )}

      {/* Navigation + dots */}
      {sorted.length > 1 && (
        <>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 shadow-md backdrop-blur-sm"
          >
            <ChevronLeft className="h-4 w-4 text-foreground" strokeWidth={2} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 shadow-md backdrop-blur-sm"
          >
            <ChevronRight className="h-4 w-4 text-foreground" strokeWidth={2} />
          </motion.button>

          {/* Progress dots */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
            {sorted.map((_, i) => (
              <motion.button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === currentIndex ? 'w-5 h-1.5 bg-primary-foreground' : 'w-1.5 h-1.5 bg-primary-foreground/40'
                }`}
                whileTap={{ scale: 0.8 }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
