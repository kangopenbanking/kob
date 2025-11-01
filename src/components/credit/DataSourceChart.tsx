import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Globe } from 'lucide-react';

interface DataSourceChartProps {
  scoringModel: 'baseline' | 'internal' | 'blended';
  externalBureauUsed?: boolean;
}

const DataSourceChart = ({ scoringModel, externalBureauUsed }: DataSourceChartProps) => {
  const getConfig = () => {
    switch (scoringModel) {
      case 'blended':
        return {
          sources: [
            { name: 'KOB Internal Data', percentage: 70, color: 'hsl(var(--chart-1))', icon: Building2 },
            { name: 'NjangiBox Bureau', percentage: 30, color: 'hsl(var(--chart-2))', icon: Globe }
          ],
          title: 'Hybrid Score Calculation',
          description: '70% Internal + 30% External for maximum accuracy'
        };
      case 'internal':
        return {
          sources: [
            { name: 'KOB Internal Data', percentage: 100, color: 'hsl(var(--chart-1))', icon: Building2 }
          ],
          title: 'Internal Score Calculation',
          description: 'Based entirely on your KOB transaction history'
        };
      case 'baseline':
        return {
          sources: [
            { name: 'Questionnaire Data', percentage: 100, color: 'hsl(var(--muted-foreground))', icon: Building2 }
          ],
          title: 'Baseline Score Calculation',
          description: 'Based on questionnaire responses only'
        };
    }
  };

  const config = getConfig();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{config.title}</CardTitle>
        <CardDescription className="text-sm">{config.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Visual Bar */}
          <div className="relative h-12 rounded-lg overflow-hidden flex">
            {config.sources.map((source, index) => (
              <div
                key={index}
                className="relative flex items-center justify-center text-white font-semibold text-sm transition-all hover:opacity-90"
                style={{
                  width: `${source.percentage}%`,
                  backgroundColor: source.color
                }}
              >
                {source.percentage}%
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="space-y-3">
            {config.sources.map((source, index) => {
              const Icon = source.icon;
              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: source.color }}
                    />
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{source.name}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{source.percentage}%</span>
                </div>
              );
            })}
          </div>

          {scoringModel === 'blended' && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                Your score combines KOB's internal analysis with NjangiBox credit bureau data for the most comprehensive assessment.
                {externalBureauUsed && ' External data is cached for 30 days.'}
              </p>
            </div>
          )}

          {scoringModel === 'internal' && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                Complete KYC verification to unlock blended scoring with NjangiBox bureau data for higher accuracy.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DataSourceChart;
