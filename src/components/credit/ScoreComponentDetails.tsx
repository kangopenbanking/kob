import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, DollarSign, Clock, BarChart, Sparkles, Wallet, CreditCard, Shield } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ComponentData {
  name: string;
  value: number;
  maxValue: number;
  weight: string;
  icon: any;
  color: string;
  description: string;
  whatsMeasured: string;
  improvementTips: string[];
}

interface ScoreComponentDetailsProps {
  components: {
    payment_history_score: number;
    amounts_owed_score: number;
    credit_history_score: number;
    credit_mix_score: number;
    new_credit_score: number;
    savings_behavior_score: number;
    transaction_pattern_score: number;
    kyc_compliance_score: number;
  };
}

const ScoreComponentDetails = ({ components }: ScoreComponentDetailsProps) => {
  const componentData: ComponentData[] = [
    {
      name: 'Payment History',
      value: components.payment_history_score || 0,
      maxValue: 35,
      weight: '35%',
      icon: CheckCircle,
      color: 'hsl(var(--chart-1))',
      description: 'Your track record of on-time loan payments. Most important factor in your score.',
      whatsMeasured: 'On-time payment rate, late payments, defaults',
      improvementTips: [
        'Make all payments on time',
        'Set up payment reminders or auto-pay',
        'Contact lender if you anticipate payment issues'
      ]
    },
    {
      name: 'Amounts Owed',
      value: components.amounts_owed_score || 0,
      maxValue: 30,
      weight: '30%',
      icon: DollarSign,
      color: 'hsl(var(--chart-2))',
      description: 'How much you currently owe compared to your borrowing capacity.',
      whatsMeasured: 'Outstanding loan balances, debt-to-income ratio, credit utilization',
      improvementTips: [
        'Pay down existing loans',
        'Keep balances low relative to limits',
        'Increase savings to improve debt ratios'
      ]
    },
    {
      name: 'Credit History Length',
      value: components.credit_history_score || 0,
      maxValue: 15,
      weight: '15%',
      icon: Clock,
      color: 'hsl(var(--chart-3))',
      description: 'How long you\'ve maintained accounts and financial relationships.',
      whatsMeasured: 'Average account age, oldest account age',
      improvementTips: [
        'Keep old accounts active',
        'Build long-term relationships with lenders',
        'Avoid closing oldest accounts'
      ]
    },
    {
      name: 'Credit Mix',
      value: components.credit_mix_score || 0,
      maxValue: 10,
      weight: '10%',
      icon: BarChart,
      color: 'hsl(var(--chart-4))',
      description: 'Variety of credit products you manage successfully.',
      whatsMeasured: 'Diversity of loans and savings products',
      improvementTips: [
        'Maintain different types of accounts',
        'Show responsible use across product types',
        'Consider diversifying your financial portfolio'
      ]
    },
    {
      name: 'New Credit',
      value: components.new_credit_score || 0,
      maxValue: 10,
      weight: '10%',
      icon: Sparkles,
      color: 'hsl(142 76% 36%)',
      description: 'Recent credit inquiries and new accounts opened.',
      whatsMeasured: 'Recent loan applications (last 6 months)',
      improvementTips: [
        'Limit new loan applications',
        'Space out credit inquiries',
        'Only apply when you need credit'
      ]
    },
    {
      name: 'Savings Behavior',
      value: components.savings_behavior_score || 0,
      maxValue: 10,
      weight: '5%',
      icon: Wallet,
      color: 'hsl(var(--chart-5))',
      description: 'Your savings discipline and balance growth.',
      whatsMeasured: 'Savings account balances, deposit consistency',
      improvementTips: [
        'Maintain regular savings deposits',
        'Grow account balances over time',
        'Keep consistent savings habits'
      ]
    },
    {
      name: 'Transaction Pattern',
      value: components.transaction_pattern_score || 0,
      maxValue: 5,
      weight: '3%',
      icon: CreditCard,
      color: 'hsl(262 83% 58%)',
      description: 'Your overall financial activity and transaction regularity.',
      whatsMeasured: 'Transaction frequency, average amounts',
      improvementTips: [
        'Maintain consistent financial activity',
        'Use accounts regularly',
        'Show stable transaction patterns'
      ]
    },
    {
      name: 'KYC Compliance',
      value: components.kyc_compliance_score || 0,
      maxValue: 2,
      weight: '2%',
      icon: Shield,
      color: 'hsl(221 83% 53%)',
      description: 'Your identity verification level and profile completeness.',
      whatsMeasured: 'KYC approval status, document verification',
      improvementTips: [
        'Complete KYC verification',
        'Keep documents current',
        'Update profile information regularly'
      ]
    }
  ];

  return (
    <div className="space-y-4">
      {componentData.map((component, index) => {
        const Icon = component.icon;
        const percentage = (component.value / component.maxValue) * 100;
        
        return (
          <ComponentCard
            key={index}
            component={component}
            Icon={Icon}
            percentage={percentage}
          />
        );
      })}
    </div>
  );
};

const ComponentCard = ({ component, Icon, percentage }: { component: ComponentData; Icon: any; percentage: number }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${component.color}20` }}
                >
                  <Icon className="h-5 w-5" style={{ color: component.color }} />
                </div>
                <div className="text-left flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-base">{component.name}</CardTitle>
                    <Badge variant="secondary" className="text-xs">{component.weight}</Badge>
                  </div>
                  <CardDescription className="text-sm">{component.description}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-bold" style={{ color: component.color }}>
                    {component.value}
                  </div>
                  <div className="text-xs text-muted-foreground">/ {component.maxValue}</div>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
            <div className="mt-3">
              <Progress value={percentage} className="h-2" />
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>{percentage.toFixed(0)}% of maximum</span>
                <span>{component.maxValue - component.value} points to gain</span>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-4 pt-4 border-t">
              <div>
                <h4 className="font-semibold text-sm mb-2">What's Measured</h4>
                <p className="text-sm text-muted-foreground">{component.whatsMeasured}</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm mb-2">How to Improve</h4>
                <ul className="space-y-1">
                  {component.improvementTips.map((tip, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default ScoreComponentDetails;
