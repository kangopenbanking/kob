import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, subMonths, isAfter } from 'date-fns';

interface ScoreHistoryPoint {
  id: string;
  score: number;
  calculated_at: string;
}

interface ScoreTrendChartProps {
  history: ScoreHistoryPoint[];
  darkMode?: boolean;
}

const TIME_RANGES = [
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
];

const ScoreTrendChart = ({ history, darkMode = false }: ScoreTrendChartProps) => {
  const [range, setRange] = useState(6);

  const chartData = useMemo(() => {
    const cutoff = subMonths(new Date(), range);
    return history
      .filter(p => isAfter(new Date(p.calculated_at), cutoff))
      .map(point => ({
        date: format(new Date(point.calculated_at), 'MMM dd'),
        fullDate: format(new Date(point.calculated_at), 'PPP'),
        score: point.score,
      }))
      .reverse();
  }, [history, range]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <Card className="p-3 shadow-lg border-border/50">
          <p className="font-bold text-lg text-foreground">{payload[0].value}</p>
          <p className="text-xs text-muted-foreground">{payload[0].payload.fullDate}</p>
        </Card>
      );
    }
    return null;
  };

  const bgClass = darkMode ? 'bg-card/80 backdrop-blur' : '';

  return (
    <div className={`rounded-2xl ${bgClass}`}>
      {/* Time range toggles */}
      <div className="flex gap-1 mb-4">
        {TIME_RANGES.map(tr => (
          <Button
            key={tr.label}
            variant={range === tr.months ? 'default' : 'ghost'}
            size="sm"
            className={`rounded-full h-8 px-4 text-xs font-semibold ${
              range === tr.months ? '' : 'text-muted-foreground'
            }`}
            onClick={() => setRange(tr.months)}
          >
            {tr.label}
          </Button>
        ))}
      </div>

      <div className="w-full h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="scoreTrendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[300, 850]}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              fill="url(#scoreTrendGradient)"
              dot={false}
              activeDot={{ r: 6, stroke: 'hsl(var(--background))', strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ScoreTrendChart;
