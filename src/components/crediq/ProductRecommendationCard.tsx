import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Wallet, CreditCard, Shield, CheckCircle } from "lucide-react";

interface Recommendation {
  id: string;
  product_type: string;
  product_name: string;
  recommendation_reason: string;
  eligibility_score: number;
  estimated_apr?: number;
  key_benefits?: string[];
}

interface ProductRecommendationCardProps {
  recommendations: Recommendation[];
  onApply?: (recommendationId: string) => void;
}

export function ProductRecommendationCard({ recommendations, onApply }: ProductRecommendationCardProps) {
  const getProductIcon = (type: string) => {
    switch (type) {
      case 'loan':
        return <TrendingUp className="h-6 w-6 text-primary" />;
      case 'savings':
        return <Wallet className="h-6 w-6 text-primary" />;
      case 'credit_card':
        return <CreditCard className="h-6 w-6 text-primary" />;
      case 'insurance':
        return <Shield className="h-6 w-6 text-primary" />;
      default:
        return <TrendingUp className="h-6 w-6 text-primary" />;
    }
  };

  const getEligibilityBadge = (score: number) => {
    if (score >= 80) return { label: 'Excellent Match', variant: 'default' as const, color: 'bg-green-600' };
    if (score >= 60) return { label: 'Good Match', variant: 'secondary' as const, color: 'bg-blue-600' };
    if (score >= 40) return { label: 'Fair Match', variant: 'outline' as const, color: 'bg-orange-600' };
    return { label: 'Consider Later', variant: 'outline' as const, color: 'bg-gray-600' };
  };

  if (recommendations.length === 0) {
    return (
      <Card className="p-8 text-center">
        <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="font-semibold text-lg mb-2">No Recommendations Yet</h3>
        <p className="text-muted-foreground text-sm">
          Keep improving your credit score to unlock personalized product recommendations
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((rec) => {
        const eligibility = getEligibilityBadge(rec.eligibility_score);
        
        return (
          <Card key={rec.id} className="p-6 hover:shadow-md transition-all">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                {getProductIcon(rec.product_type)}
              </div>
              
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{rec.product_name}</h3>
                    <Badge variant={eligibility.variant} className={eligibility.color}>
                      {eligibility.label} - {rec.eligibility_score}% match
                    </Badge>
                  </div>
                  {rec.estimated_apr && (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{rec.estimated_apr}%</p>
                      <p className="text-xs text-muted-foreground">APR</p>
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground mb-3">
                  {rec.recommendation_reason}
                </p>
                
                {rec.key_benefits && rec.key_benefits.length > 0 && (
                  <ul className="space-y-1 mb-4">
                    {rec.key_benefits.slice(0, 3).map((benefit, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                )}
                
                {onApply && rec.eligibility_score >= 40 && (
                  <Button 
                    size="sm"
                    onClick={() => onApply(rec.id)}
                    disabled={rec.eligibility_score < 60}
                  >
                    {rec.eligibility_score >= 80 ? `Apply for ${rec.product_name}` : `See ${rec.product_name} requirements`}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
