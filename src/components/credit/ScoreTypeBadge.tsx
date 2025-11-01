import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, Building2, Link2 } from 'lucide-react';

interface ScoreTypeBadgeProps {
  scoringModel: 'baseline' | 'internal' | 'blended';
  confidenceLevel?: number;
}

const ScoreTypeBadge = ({ scoringModel, confidenceLevel }: ScoreTypeBadgeProps) => {
  const getConfig = () => {
    switch (scoringModel) {
      case 'baseline':
        return {
          label: 'Baseline Score',
          icon: FileText,
          variant: 'secondary' as const,
          className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-200',
          description: 'Based on questionnaire data only',
          details: 'This is a preliminary score based on your survey responses. Complete transactions to get a more accurate score.',
          confidence: 'Low confidence (30%)'
        };
      case 'internal':
        return {
          label: 'Internal Score',
          icon: Building2,
          variant: 'default' as const,
          className: 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200',
          description: 'Based on KOB transaction data',
          details: 'This score is calculated from your transaction history, loan payments, and savings behavior with KOB.',
          confidence: 'Medium confidence (60-80%)'
        };
      case 'blended':
        return {
          label: 'Blended Score',
          icon: Link2,
          variant: 'default' as const,
          className: 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200',
          description: 'KOB Data + NjangiBox Bureau',
          details: 'This is your most accurate score, combining internal data (70%) with external credit bureau data (30%) from NjangiBox.',
          confidence: 'High confidence (80-100%)'
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={config.variant} className={`gap-1.5 cursor-help ${config.className}`}>
            <Icon className="h-3.5 w-3.5" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs" side="bottom">
          <div className="space-y-2">
            <p className="font-semibold">{config.description}</p>
            <p className="text-sm text-muted-foreground">{config.details}</p>
            <div className="pt-2 border-t">
              <p className="text-xs font-medium">{config.confidence}</p>
              {confidenceLevel && (
                <p className="text-xs text-muted-foreground">
                  Current: {(confidenceLevel * 100).toFixed(0)}%
                </p>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ScoreTypeBadge;
