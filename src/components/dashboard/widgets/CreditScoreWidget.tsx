import { DashboardWidget } from "../DashboardWidget";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface CreditScoreWidgetProps {
  id: string;
  score: number;
  maxScore?: number;
  change?: number;
  lastUpdated?: string;
  onHide?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function CreditScoreWidget({
  id,
  score,
  maxScore = 850,
  change = 0,
  lastUpdated,
  onHide,
  onRemove,
}: CreditScoreWidgetProps) {
  const navigate = useNavigate();
  
  const getScoreColor = (score: number) => {
    if (score >= 720) return "text-green-600";
    if (score >= 650) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 720) return "Excellent";
    if (score >= 650) return "Good";
    if (score >= 580) return "Fair";
    return "Needs Improvement";
  };

  const progressPercentage = (score / maxScore) * 100;

  return (
    <DashboardWidget
      id={id}
      title="Credit Score"
      description="Your financial health"
      size="medium"
      onHide={onHide}
      onRemove={onRemove}
      className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-5xl font-bold ${getScoreColor(score)}`}>
              {score}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              out of {maxScore}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{getScoreLabel(score)}</p>
            {change !== 0 && (
              <div className="flex items-center gap-1 text-sm mt-1">
                {change > 0 ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">+{change}</span>
                  </>
                ) : change < 0 ? (
                  <>
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span className="text-red-600">{change}</span>
                  </>
                ) : (
                  <>
                    <Minus className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">No change</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Progress value={progressPercentage} className="h-2" />
          {lastUpdated && (
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(lastUpdated).toLocaleDateString()}
            </p>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => navigate("/credit-score")}
        >
          View Full Report
        </Button>
      </div>
    </DashboardWidget>
  );
}
