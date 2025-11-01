import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';

interface ScoreHistoryPoint {
  id: string;
  score: number;
  calculated_at: string;
}

interface ScoreTrendChartProps {
  history: ScoreHistoryPoint[];
}

const ScoreTrendChart = ({ history }: ScoreTrendChartProps) => {
  const chartData = history.map(point => ({
    date: format(new Date(point.calculated_at), 'MMM dd'),
    fullDate: format(new Date(point.calculated_at), 'PPP'),
    score: point.score,
  })).reverse();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <Card className="p-3 shadow-lg">
          <p className="font-semibold text-lg">{payload[0].value}</p>
          <p className="text-sm text-muted-foreground">{payload[0].payload.fullDate}</p>
        </Card>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <YAxis 
            domain={[300, 850]}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="score"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            fill="url(#scoreGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ScoreTrendChart;
