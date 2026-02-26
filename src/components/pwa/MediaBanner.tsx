import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';

export interface MediaSection {
  id: string;
  type: 'image' | 'video';
  url: string;
  provider?: 'youtube' | 'vimeo' | 'facebook' | 'x' | 'instagram' | 'linkedin' | 'custom';
  video_id?: string;
  title?: string;
  position: number;
}

function getEmbedUrl(item: MediaSection): string {
  const vid = item.video_id || '';
  switch (item.provider) {
    case 'youtube':
      return `https://www.youtube.com/embed/${vid}?autoplay=0&rel=0`;
    case 'vimeo':
      return `https://player.vimeo.com/video/${vid}?byline=0&portrait=0`;
    case 'facebook':
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(item.url)}&show_text=false`;
    case 'x':
      // X/Twitter doesn't support standard embeds; link out
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
  
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { provider: 'youtube', video_id: ytMatch[1] };
  
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { provider: 'vimeo', video_id: vimeoMatch[1] };
  
  // Facebook
  if (url.includes('facebook.com') || url.includes('fb.watch')) return { provider: 'facebook', video_id: '' };
  
  // X/Twitter
  if (url.includes('twitter.com') || url.includes('x.com')) return { provider: 'x', video_id: '' };
  
  // Instagram
  const igMatch = url.match(/instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+)/);
  if (igMatch) return { provider: 'instagram', video_id: igMatch[1] };
  
  // LinkedIn
  if (url.includes('linkedin.com')) return { provider: 'linkedin', video_id: '' };
  
  return { provider: 'custom', video_id: '' };
}

export { detectProvider };

interface MediaBannerProps {
  items: MediaSection[];
  cardSize?: 'small' | 'medium' | 'large';
}

export const MediaBanner: React.FC<MediaBannerProps> = ({ items, cardSize = 'medium' }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!items || items.length === 0) return null;

  const sorted = [...items].sort((a, b) => a.position - b.position);
  const current = sorted[currentIndex];
  const heightClass = cardSize === 'small' ? 'h-32' : cardSize === 'large' ? 'h-56' : 'h-44';

  const goNext = () => setCurrentIndex((i) => (i + 1) % sorted.length);
  const goPrev = () => setCurrentIndex((i) => (i - 1 + sorted.length) % sorted.length);

  return (
    <div className="relative">
      <motion.div
        key={current.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`w-full overflow-hidden rounded-2xl ${heightClass}`}
      >
        {current.type === 'image' ? (
          <img
            src={current.url}
            alt={current.title || 'Banner'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : current.provider === 'custom' && current.url ? (
          <video
            src={current.url}
            className="h-full w-full object-cover"
            controls
            playsInline
          />
        ) : current.provider === 'x' || current.provider === 'linkedin' ? (
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-full w-full items-center justify-center bg-muted"
          >
            <div className="flex flex-col items-center gap-2">
              <Play className="h-10 w-10 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Watch on {current.provider === 'x' ? 'X' : 'LinkedIn'}
              </span>
            </div>
          </a>
        ) : (
          <iframe
            src={getEmbedUrl(current)}
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={current.title || 'Video'}
          />
        )}
      </motion.div>

      {current.title && (
        <p className="mt-1.5 text-xs font-medium text-muted-foreground px-1">{current.title}</p>
      )}

      {sorted.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 shadow"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 shadow"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {sorted.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentIndex ? 'w-4 bg-background' : 'w-1.5 bg-background/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
