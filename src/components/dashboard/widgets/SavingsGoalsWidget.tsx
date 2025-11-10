import { DashboardWidget } from "../DashboardWidget";
import { Target, Plus } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  deadline?: string;
}

interface SavingsGoalsWidgetProps {
  id: string;
  goals: SavingsGoal[];
  onHide?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function SavingsGoalsWidget({
  id,
  goals,
  onHide,
  onRemove,
}: SavingsGoalsWidgetProps) {
  const navigate = useNavigate();

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getDaysRemaining = (deadline?: string) => {
    if (!deadline) return null;
    const today = new Date();
    const end = new Date(deadline);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <DashboardWidget
      id={id}
      title="Savings Goals"
      description="Track your progress"
      size="medium"
      onHide={onHide}
      onRemove={onRemove}
    >
      <div className="space-y-4">
        {goals.length > 0 ? (
          goals.slice(0, 3).map((goal) => {
            const progress = getProgressPercentage(
              goal.currentAmount,
              goal.targetAmount
            );
            const daysRemaining = getDaysRemaining(goal.deadline);

            return (
              <div
                key={goal.id}
                className="p-3 rounded-lg border hover:bg-accent/50 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <p className="font-medium text-sm">{goal.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {progress.toFixed(0)}%
                  </p>
                </div>

                <Progress value={progress} className="h-2" />

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {formatCurrency(goal.currentAmount, goal.currency)} of{" "}
                    {formatCurrency(goal.targetAmount, goal.currency)}
                  </span>
                  {daysRemaining !== null && (
                    <span className="text-muted-foreground">
                      {daysRemaining > 0
                        ? `${daysRemaining} days left`
                        : "Overdue"}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <Target className="h-12 w-12 mx-auto mb-2 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">No savings goals yet</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/savings")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Goal
            </Button>
          </div>
        )}

        {goals.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigate("/savings")}
          >
            View All Goals
          </Button>
        )}
      </div>
    </DashboardWidget>
  );
}
