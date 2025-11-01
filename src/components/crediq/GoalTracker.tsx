import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Award } from "lucide-react";

interface GoalTrackerProps {
  currentScore: number;
  targetScore: number;
  goalTitle?: string;
  onSetNewGoal?: () => void;
}

export function GoalTracker({ currentScore, targetScore, goalTitle, onSetNewGoal }: GoalTrackerProps) {
  const progress = Math.min(100, (currentScore / targetScore) * 100);
  const pointsRemaining = Math.max(0, targetScore - currentScore);
  const isAchieved = currentScore >= targetScore;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        {isAchieved ? (
          <div className="p-3 rounded-full bg-green-100">
            <Award className="h-6 w-6 text-green-600" />
          </div>
        ) : (
          <div className="p-3 rounded-full bg-primary/10">
            <Target className="h-6 w-6 text-primary" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-lg">
            {goalTitle || 'Credit Score Goal'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isAchieved ? 'Goal achieved! 🎉' : `${pointsRemaining} points to go`}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Current Score</p>
            <p className="text-3xl font-bold">{currentScore}</p>
          </div>
          <div className="text-center px-4">
            <TrendingUp className={`h-8 w-8 mx-auto mb-1 ${isAchieved ? 'text-green-600' : 'text-primary'}`} />
            <p className="text-xs text-muted-foreground">
              {Math.round(progress)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-1">Target Score</p>
            <p className="text-3xl font-bold text-primary">{targetScore}</p>
          </div>
        </div>

        <Progress value={progress} className="h-3" />

        {isAchieved ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800 mb-2">
              🎊 Congratulations! You've reached your goal!
            </p>
            {onSetNewGoal && (
              <Button size="sm" onClick={onSetNewGoal}>
                Set a New Goal
              </Button>
            )}
          </div>
        ) : (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Keep making progress! Every on-time payment and financial activity brings you closer to your goal.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
