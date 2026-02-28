import React, { useState, useRef, useCallback } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  threshold = 80,
  maxPull = 120,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();

  const isAtTop = useCallback(() => {
    if (!containerRef.current) return true;
    // Check if the scrollable content is at the top
    let el: HTMLElement | null = containerRef.current;
    while (el) {
      if (el.scrollTop > 0) return false;
      el = el.parentElement;
    }
    return true;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isRefreshing) return;
      if (isAtTop()) {
        startY.current = e.touches[0].clientY;
      }
    },
    [isRefreshing, isAtTop]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startY.current === null || isRefreshing) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;
      if (diff > 0 && isAtTop()) {
        // Apply resistance
        const distance = Math.min(diff * 0.5, maxPull);
        setPullDistance(distance);
      } else {
        startY.current = null;
        setPullDistance(0);
      }
    },
    [isRefreshing, isAtTop, maxPull]
  );

  const handleTouchEnd = useCallback(async () => {
    if (startY.current === null) return;
    startY.current = null;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.6);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  const triggered = pullDistance >= threshold;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex items-center justify-center overflow-hidden transition-opacity"
        style={{
          height: pullDistance || isRefreshing ? Math.max(pullDistance, isRefreshing ? 48 : 0) : 0,
          opacity: pullDistance > 10 || isRefreshing ? 1 : 0,
        }}
      >
        <motion.div
          animate={{
            rotate: isRefreshing ? 360 : triggered ? 180 : pullDistance * 1.8,
            scale: isRefreshing ? 1 : Math.min(pullDistance / threshold, 1),
          }}
          transition={isRefreshing ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : { duration: 0 }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shadow-sm"
        >
          <Loader2
            className={`h-4 w-4 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`}
            strokeWidth={2}
          />
        </motion.div>
      </div>

      {/* Content with pull offset */}
      <div
        style={{
          transform: `translateY(${pullDistance || (isRefreshing ? 48 : 0)}px)`,
          transition: pullDistance === 0 && !isRefreshing ? 'transform 0.3s ease' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};
