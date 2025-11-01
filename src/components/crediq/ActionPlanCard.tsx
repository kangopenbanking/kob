import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, AlertCircle, TrendingUp } from "lucide-react";

interface Action {
  id: string;
  action_title: string;
  action_description: string;
  estimated_impact: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  due_date?: string;
}

interface ActionPlanCardProps {
  actions: Action[];
  onActionStart?: (actionId: string) => void;
}

export function ActionPlanCard({ actions, onActionStart }: ActionPlanCardProps) {
  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'high':
        return { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'High Priority' };
      case 'medium':
        return { icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Medium' };
      case 'low':
        return { icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Low Priority' };
      default:
        return { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Normal' };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  if (actions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
        <h3 className="font-semibold text-lg mb-2">All Caught Up!</h3>
        <p className="text-muted-foreground">
          You're doing great! Keep up the good work with your credit health.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {actions.map((action) => {
        const priorityConfig = getPriorityConfig(action.priority);
        const PriorityIcon = priorityConfig.icon;

        return (
          <Card key={action.id} className="p-6 hover:shadow-md transition-all">
            <div className="flex items-start gap-4">
              <div className="mt-1">
                {getStatusIcon(action.status)}
              </div>
              
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="font-semibold text-lg">{action.action_title}</h3>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${priorityConfig.bg}`}>
                      <PriorityIcon className={`h-3 w-3 ${priorityConfig.color}`} />
                      <span className={`text-xs font-medium ${priorityConfig.color}`}>
                        {priorityConfig.label}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-green-600">
                      +{action.estimated_impact} pts
                    </span>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground mb-3">
                  {action.action_description}
                </p>
                
                {action.due_date && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Due: {new Date(action.due_date).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </p>
                )}
                
                {action.status === 'pending' && onActionStart && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onActionStart(action.id)}
                  >
                    Start Action
                  </Button>
                )}
                
                {action.status === 'completed' && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>Completed</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
