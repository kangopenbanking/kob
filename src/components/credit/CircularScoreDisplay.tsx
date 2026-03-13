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
  { min: 800, label: 'Excellent', color: '#22c55e' },
  { min: 700, label: 'Very Good', color: '#84cc16' },
  { min: 580, label: 'Good', color: '#eab308' },
  { min: 450, label: 'Fair', color: '#f97316' },
  { min: 0, label: 'Poor', color: '#ef4444' },
];

const ARC_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

function getBand(score: number) {
  return SCORE_BANDS.find(b => score >= b.min) || SCORE_BANDS[SCORE_BANDS.length - 1];
}

const CircularScoreDisplay = ({
  score,
  previousScore,
  maxScore = 850,
  size = 300,
  showLabel = true,
}: CircularScoreDisplayProps) => {
  const uid = useId();
  const motionScore = useMotionValue(0);
  const [rendered, setRendered] = useState(0);

  useEffect(() => {
    const controls = animate(motionScore, score, {
      duration: 2,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate: v => setRendered(Math.round(v)),
    });
    return controls.stop;
  }, [score, motionScore]);

  const band = getBand(score);
  const scoreChange = previousScore ? score - previousScore : 0;

  const minScore = 300;
  const cx = size / 2;
  const cy = size * 0.55;
  const radius = size * 0.38;
  const strokeW = size * 0.065;
  const startAngle = 180;
  const endAngle = 0;
  const totalAngle = 180;
  const segmentCount = ARC_COLORS.length;
  const segmentAngle = totalAngle / segmentCount;
  const gap = 3;

  const polarToCartesian = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy - radius * Math.sin(rad) };
  };

  const arcPath = (startA: number, endA: number) => {
    const s = polarToCartesian(startA);
    const e = polarToCartesian(endA);
    const largeArc = Math.abs(startA - endA) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 0 ${e.x} ${e.y}`;
  };

  // Score labels around the arc
  const scoreLabels = [300, 450, 580, 700, 850];
  const labelPositions = scoreLabels.map(val => {
    const pct = (val - minScore) / (maxScore - minScore);
    const angle = startAngle - pct * totalAngle;
    const labelRadius = radius + strokeW + 14;
    const rad = (angle * Math.PI) / 180;
    return {
      val,
      x: cx + labelRadius * Math.cos(rad),
      y: cy - labelRadius * Math.sin(rad),
    };
  });

  // Needle position
  const scorePct = Math.max(0, Math.min(1, (score - minScore) / (maxScore - minScore)));
  const needleAngle = startAngle - scorePct * totalAngle;
  const needleRad = (needleAngle * Math.PI) / 180;
  const needleLength = radius - strokeW;
  const needleTipX = cx + needleLength * Math.cos(needleRad);
  const needleTipY = cy - needleLength * Math.sin(needleRad);

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size * 0.65 }}>
        <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
          {/* Arc segments with wavy/organic feel */}
          {ARC_COLORS.map((color, i) => {
            const segStart = startAngle - i * segmentAngle - gap / 2;
            const segEnd = startAngle - (i + 1) * segmentAngle + gap / 2;
            return (
              <motion.path
                key={i}
                d={arcPath(segStart, segEnd)}
                fill="none"
                stroke={color}
                strokeWidth={strokeW}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.6, delay: i * 0.12, ease: 'easeOut' }}
              />
            );
          })}

          {/* Score labels */}
          {labelPositions.map(lp => (
            <text
              key={lp.val}
              x={lp.x}
              y={lp.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-muted-foreground"
              style={{ fontSize: size * 0.04, fontWeight: 500 }}
            >
              {lp.val}
            </text>
          ))}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center" style={{ top: size * 0.22 }}>
          {/* Score change badge */}
          {scoreChange !== 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.4 }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold mb-2 ${
                scoreChange > 0
                  ? 'bg-crediq-green/15 text-crediq-green'
                  : 'bg-crediq-red/15 text-crediq-red'
              }`}
            >
              {scoreChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {scoreChange > 0 ? '+' : ''}{scoreChange} pts
            </motion.div>
          )}

          {/* Large score number */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.7, type: 'spring', stiffness: 200, damping: 20 }}
            className="font-black text-foreground leading-none"
            style={{ fontSize: size * 0.16 }}
          >
            {rendered}
          </motion.div>
        </div>
      </div>

      {/* Update button area */}
      {showLabel && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="-mt-2"
        >
          <span
            className="inline-block px-3 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase"
            style={{
              background: `${band.color}18`,
              color: band.color,
            }}
          >
            {band.label}
          </span>
        </motion.div>
      )}
    </div>
  );
};

export default CircularScoreDisplay;
