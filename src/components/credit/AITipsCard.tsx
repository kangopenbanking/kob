import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Tip {
  id: string;
  tip_content: string;
  estimated_impact: number;
  priority: 'high' | 'medium' | 'low';
  tip_category: 'quick_win' | 'medium_term' | 'long_term';
  is_completed: boolean;
}

interface AITipsCardProps {
  tips: Tip[];
  onTipComplete?: () => void;
}

const AITipsCard = ({ tips, onTipComplete }: AITipsCardProps) => {
  const [completingId, setCompletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleMarkComplete = async (tipId: string) => {
    setCompletingId(tipId);
    
    try {
      const { error } = await supabase
        .from('credit_score_tips')
        .update({ 
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', tipId);

      if (error) throw error;

      toast({
        title: 'Great job! 🎉',
        description: 'Tip marked as completed. Keep up the good work!',
      });

      if (onTipComplete) onTipComplete();
    } catch (error) {
      console.error('Error marking tip complete:', error);
      toast({
        title: 'Error',
        description: 'Failed to update tip status',
        variant: 'destructive',
      });
    } finally {
      setCompletingId(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'quick_win': return '30 days';
      case 'medium_term': return '3-6 months';
      case 'long_term': return '6-12 months';
      default: return category;
    }
  };

  const activeTips = tips.filter(tip => !tip.is_completed);
  const completedTips = tips.filter(tip => tip.is_completed);

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle>AI-Powered Improvement Tips</CardTitle>
          </div>
          <CardDescription>
            Personalized recommendations to boost your credit score
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeTips.length === 0 && completedTips.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tips available. Generate tips to get personalized recommendations.
            </p>
          )}

          {activeTips.map((tip) => (
            <Card key={tip.id} className="border-l-4 border-l-primary">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getPriorityColor(tip.priority)}>
                        {tip.priority.toUpperCase()} Impact
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getCategoryLabel(tip.tip_category)}
                      </Badge>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        +{tip.estimated_impact} points
                      </Badge>
                    </div>
                    
                    <p className="text-sm leading-relaxed">
                      {tip.tip_content}
                    </p>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleMarkComplete(tip.id)}
                    disabled={completingId === tip.id}
                    className="shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {completedTips.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                Completed ({completedTips.length})
              </h4>
              {completedTips.map((tip) => (
                <div key={tip.id} className="text-sm text-muted-foreground line-through py-1">
                  {tip.tip_content}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AITipsCard;
