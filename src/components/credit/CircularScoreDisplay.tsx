import { useEffect, useState, useId } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface CircularScoreDisplayProps {
  score: number;
  previousScore?: number;
  maxScore?: number;
  size?: number;
  showLabel?: boolean;
}

const SCORE_BANDS = [
  { min: 800, label: 'Excellent', gradient: ['#10b981', '#059669'], glow: '#10b98140' },
  { min: 740, label: 'Very Good', gradient: ['#3b82f6', '#2563eb'], glow: '#3b82f640' },
  { min: 670, label: 'Good', gradient: ['#8b5cf6', '#7c3aed'], glow: '#8b5cf640' },
  { min: 580, label: 'Fair', gradient: ['#f59e0b', '#d97706'], glow: '#f59e0b40' },
  { min: 0, label: 'Poor', gradient: ['#ef4444', '#dc2626'], glow: '#ef444440' },
];

function getBand(score: number) {
  return SCORE_BANDS.find(b => score >= b.min) || SCORE_BANDS[SCORE_BANDS.length - 1];
}

const CircularScoreDisplay = ({
  score,
  previousScore,
  maxScore = 850,
  size = 280,
  showLabel = true,
}: CircularScoreDisplayProps) => {
  const uid = useId();
  const gradientId = `score-grad-${uid}`;
  const glowId = `score-glow-${uid}`;
  const pulseId = `score-pulse-${uid}`;

  const motionScore = useMotionValue(0);
  const [rendered, setRendered] = useState(0);

  useEffect(() => {
    const controls = animate(motionScore, score, {
      duration: 2.2,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate: v => setRendered(Math.round(v)),
    });
    return controls.stop;
  }, [score, motionScore]);

  const band = getBand(score);
  const scoreChange = previousScore ? score - previousScore : 0;

  const strokeW = size > 200 ? 16 : 10;
  const radius = (size - strokeW * 2 - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / maxScore, 1);
  const dashOffset = circumference * (1 - pct);

  const dotAngle = (-90 + pct * 360) * (Math.PI / 180);
  const dotX = size / 2 + radius * Math.cos(dotAngle);
  const dotY = size / 2 + radius * Math.sin(dotAngle);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={band.gradient[0]} />
            <stop offset="100%" stopColor={band.gradient[1]} />
          </linearGradient>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feFlood floodColor={band.glow} result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={pulseId}>
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feFlood floodColor={band.gradient[0]} floodOpacity="0.6" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={strokeW}
          fill="none"
          opacity={0.35}
        />

        {/* Score arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeW}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 2.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          filter={`url(#${glowId})`}
        />

        {/* Pulsing indicator dot */}
        <motion.circle
          cx={dotX}
          cy={dotY}
          r={strokeW / 2 + 4}
          fill={band.gradient[1]}
          stroke="hsl(var(--background))"
          strokeWidth={3}
          filter={`url(#${pulseId})`}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 1], scale: [0, 1.3, 1] }}
          transition={{ delay: 1.8, duration: 0.6, ease: 'backOut' }}
        />

        {/* Outer pulse ring */}
        <motion.circle
          cx={dotX}
          cy={dotY}
          r={strokeW / 2 + 4}
          fill="none"
          stroke={band.gradient[0]}
          strokeWidth={2}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 0.5, 0], scale: [1, 2, 2.5] }}
          transition={{ delay: 2.4, duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.7, type: 'spring', stiffness: 200, damping: 20 }}
          className="text-center"
        >
          <div
            className="font-black tracking-tight leading-none"
            style={{
              fontSize: size > 200 ? '3.5rem' : '2.5rem',
              background: `linear-gradient(135deg, ${band.gradient[0]}, ${band.gradient[1]})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {rendered}
          </div>

          {showLabel && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
            >
              <span
                className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase"
                style={{
                  background: `${band.gradient[0]}18`,
                  color: band.gradient[1],
                }}
              >
                {band.label}
              </span>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-[11px] text-muted-foreground mt-1.5 tracking-wide"
          >
            out of {maxScore}
          </motion.div>

          {scoreChange !== 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6 }}
              className={`flex items-center justify-center gap-1 mt-2 text-xs font-semibold ${
                scoreChange > 0 ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {scoreChange > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{scoreChange > 0 ? '+' : ''}{scoreChange} pts</span>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default CircularScoreDisplay;
