import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';

interface ConfidenceIndicatorProps {
  confidenceLevel: number;
  scoringModel: 'baseline' | 'internal' | 'blended';
  kycVerified?: boolean;
  externalDataUsed?: boolean;
}

const ConfidenceIndicator = ({ 
  confidenceLevel, 
  scoringModel, 
  kycVerified,
  externalDataUsed 
}: ConfidenceIndicatorProps) => {
  const percentage = confidenceLevel * 100;
  
  const getConfidenceConfig = () => {
    if (percentage >= 80) {
      return {
        label: 'High Confidence',
        color: 'text-green-600',
        bgColor: 'bg-green-100 dark:bg-green-900',
        icon: CheckCircle2,
        description: 'This score is highly reliable and based on comprehensive data.',
        progressColor: 'bg-green-600'
      };
    } else if (percentage >= 50) {
      return {
        label: 'Medium Confidence',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900',
        icon: TrendingUp,
        description: 'This score is reliable but could be more accurate with additional data.',
        progressColor: 'bg-yellow-600'
      };
    } else {
      return {
        label: 'Low Confidence',
        color: 'text-orange-600',
        bgColor: 'bg-orange-100 dark:bg-orange-900',
        icon: AlertCircle,
        description: 'This is a preliminary score. Complete more activities to improve accuracy.',
        progressColor: 'bg-orange-600'
      };
    }
  };

  const config = getConfidenceConfig();
  const Icon = config.icon;

  const improvementActions = [];
  if (!kycVerified) {
    improvementActions.push('Complete KYC verification');
  }
  if (scoringModel === 'baseline') {
    improvementActions.push('Complete financial transactions');
    improvementActions.push('Apply for and manage loans');
  }
  if (scoringModel === 'internal' && !externalDataUsed) {
    improvementActions.push('Link external credit bureau data');
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Confidence Level</CardTitle>
          <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0`}>
            <Icon className="h-3.5 w-3.5 mr-1" />
            {config.label}
          </Badge>
        </div>
        <CardDescription className="text-sm">{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Accuracy</span>
            <span className="font-semibold">{percentage.toFixed(0)}%</span>
          </div>
          <div className="relative">
            <Progress value={percentage} className="h-3" />
            <div 
              className="absolute inset-0 rounded-full h-3"
              style={{
                background: `linear-gradient(to right, ${config.progressColor} ${percentage}%, transparent ${percentage}%)`,
                opacity: 0.8
              }}
            />
          </div>
        </div>

        {improvementActions.length > 0 && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-semibold mb-2">Improve Confidence By:</h4>
            <ul className="space-y-1.5">
              {improvementActions.map((action, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-0.5">→</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-4 border-t">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Baseline</div>
              <div className="text-sm font-semibold">30%</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Internal</div>
              <div className="text-sm font-semibold">60-80%</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Blended</div>
              <div className="text-sm font-semibold">80-100%</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConfidenceIndicator;
