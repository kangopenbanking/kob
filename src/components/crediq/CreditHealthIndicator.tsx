import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";

interface CreditHealthIndicatorProps {
  label: string;
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  description?: string;
}

export function CreditHealthIndicator({ label, score, status, description }: CreditHealthIndicatorProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'excellent':
        return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Excellent' };
      case 'good':
        return { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Good' };
      case 'fair':
        return { icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Fair' };
      case 'poor':
        return { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Needs Work' };
      default:
        return { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Unknown' };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-full ${config.bg}`}>
            <Icon className={`h-4 w-4 ${config.color}`} />
          </div>
          <div>
            <h4 className="font-semibold text-sm">{label}</h4>
            <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
          </div>
        </div>
        <Progress value={score} className="h-2" />
        {description && (
          <p className="text-xs text-muted-foreground mt-2">{description}</p>
        )}
      </div>
      <div className="ml-4 text-right">
        <span className="text-2xl font-bold">{score}</span>
        <span className="text-sm text-muted-foreground">/100</span>
      </div>
    </div>
  );
}
