import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';

interface ScoreComponent {
  name: string;
  value: number;
  maxValue: number;
  color: string;
}

interface ScoreBreakdownChartProps {
  components: {
    payment_history_score: number;
    amounts_owed_score: number;
    credit_history_score: number;
    credit_mix_score: number;
    new_credit_score: number;
    savings_behavior_score: number;
    transaction_pattern_score: number;
    kyc_compliance_score: number;
  };
}

const ScoreBreakdownChart = ({ components }: ScoreBreakdownChartProps) => {
  const chartData: ScoreComponent[] = [
    {
      name: 'Payment History',
      value: components.payment_history_score || 0,
      maxValue: 35,
      color: 'hsl(var(--chart-1))',
    },
    {
      name: 'Amounts Owed',
      value: components.amounts_owed_score || 0,
      maxValue: 30,
      color: 'hsl(var(--chart-2))',
    },
    {
      name: 'Credit History',
      value: components.credit_history_score || 0,
      maxValue: 15,
      color: 'hsl(var(--chart-3))',
    },
    {
      name: 'Credit Mix',
      value: components.credit_mix_score || 0,
      maxValue: 10,
      color: 'hsl(var(--chart-4))',
    },
    {
      name: 'Savings',
      value: components.savings_behavior_score || 0,
      maxValue: 10,
      color: 'hsl(var(--chart-5))',
    },
    {
      name: 'New Credit',
      value: components.new_credit_score || 0,
      maxValue: 10,
      color: 'hsl(142 76% 36%)',
    },
    {
      name: 'Transactions',
      value: components.transaction_pattern_score || 0,
      maxValue: 5,
      color: 'hsl(262 83% 58%)',
    },
    {
      name: 'KYC',
      value: components.kyc_compliance_score || 0,
      maxValue: 2,
      color: 'hsl(221 83% 53%)',
    },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = ((data.value / data.maxValue) * 100).toFixed(0);
      
      return (
        <Card className="p-3 shadow-lg">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.value}/{data.maxValue} points ({percentage}%)
          </p>
        </Card>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            layout="vertical" 
            align="right" 
            verticalAlign="middle"
            formatter={(value, entry: any) => {
              const percentage = ((entry.payload.value / entry.payload.maxValue) * 100).toFixed(0);
              return `${value}: ${percentage}%`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ScoreBreakdownChart;
