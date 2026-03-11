import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  Eye, 
  AlertCircle,
  DollarSign,
  Building2
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'score_change' | 'inquiry' | 'alert' | 'loan' | 'savings';
  title: string;
  description: string;
  timestamp: string;
  impact?: 'positive' | 'negative' | 'neutral';
}

interface CreditActivityFeedProps {
  activities: ActivityItem[];
}

const CreditActivityFeed = ({ activities }: CreditActivityFeedProps) => {
  const getIcon = (type: string, impact?: string) => {
    const className = "w-5 h-5";
    
    switch (type) {
      case 'score_change':
        return impact === 'positive' ? 
          <TrendingUp className={`${className} text-green-600`} /> : 
          <TrendingDown className={`${className} text-red-600`} />;
      case 'inquiry':
        return <Eye className={`${className} text-blue-600`} />;
      case 'alert':
        return <AlertCircle className={`${className} text-orange-600`} />;
      case 'loan':
        return <CreditCard className={`${className} text-purple-600`} />;
      case 'savings':
        return <DollarSign className={`${className} text-green-600`} />;
      case 'pre_approved':
        return <Building2 className={`${className} text-emerald-600`} />;
      case 'hard_check':
        return <Eye className={`${className} text-red-600`} />;
      default:
        return <Building2 className={className} />;
    }
  };

  const getImpactBadge = (impact?: string) => {
    if (!impact || impact === 'neutral') return null;
    
    return (
      <Badge 
        variant={impact === 'positive' ? 'default' : 'destructive'}
        className="ml-2"
      >
        {impact === 'positive' ? 'Positive' : 'Negative'}
      </Badge>
    );
  };

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent activity to display
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div 
              key={activity.id} 
              className="flex gap-4 pb-4 border-b last:border-0 last:pb-0"
            >
              <div className="shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                {getIcon(activity.type, activity.impact)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm truncate">
                    {activity.title}
                  </h4>
                  {getImpactBadge(activity.impact)}
                </div>
                
                <p className="text-sm text-muted-foreground mb-1">
                  {activity.description}
                </p>
                
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CreditActivityFeed;
