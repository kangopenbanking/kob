import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CircularScoreDisplayProps {
  score: number;
  previousScore?: number;
  maxScore?: number;
  size?: number;
}

const CircularScoreDisplay = ({ 
  score, 
  previousScore, 
  maxScore = 850,
  size = 280 
}: CircularScoreDisplayProps) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  const scorePercentage = (score / maxScore) * 100;
  const radius = (size - 40) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scorePercentage / 100) * circumference;

  const scoreChange = previousScore ? score - previousScore : 0;
  const hasChange = scoreChange !== 0;

  // Determine color based on score range
  const getScoreColor = (score: number) => {
    if (score >= 800) return 'hsl(var(--chart-1))'; // Excellent - blue
    if (score >= 740) return 'hsl(var(--chart-2))'; // Very Good - green
    if (score >= 670) return 'hsl(var(--chart-3))'; // Good - yellow
    if (score >= 580) return 'hsl(var(--chart-4))'; // Fair - orange
    return 'hsl(var(--destructive))'; // Poor - red
  };

  const scoreColor = getScoreColor(score);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Background Circle */}
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth="20"
          fill="none"
        />
        {/* Animated Score Circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={scoreColor}
          strokeWidth="20"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 2, ease: 'easeInOut' }}
        />
      </svg>

      {/* Center Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-center"
        >
          <motion.div
            className="text-6xl font-bold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            style={{ color: scoreColor }}
          >
            {Math.round(animatedScore)}
          </motion.div>
          
          <div className="text-sm text-muted-foreground mt-1">
            out of {maxScore}
          </div>

          {hasChange && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
              className={`flex items-center gap-1 mt-2 text-sm font-medium ${
                scoreChange > 0 ? 'text-green-600' : scoreChange < 0 ? 'text-red-600' : 'text-muted-foreground'
              }`}
            >
              {scoreChange > 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : scoreChange < 0 ? (
                <TrendingDown className="w-4 h-4" />
              ) : (
                <Minus className="w-4 h-4" />
              )}
              <span>
                {scoreChange > 0 ? '+' : ''}{scoreChange} points
              </span>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default CircularScoreDisplay;
