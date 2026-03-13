import { motion } from 'framer-motion';
import { 
  Clock, CreditCard, AlertTriangle, Calendar, Building2, Search 
} from 'lucide-react';

interface CreditFactor {
  name: string;
  value: string;
  impact: 'high' | 'medium' | 'low';
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface CreditFactorGridProps {
  components?: Record<string, any>;
}

const IMPACT_LABELS: Record<string, { label: string; dots: number; color: string }> = {
  high: { label: 'High Impact', dots: 3, color: 'text-emerald-500' },
  medium: { label: 'Med Impact', dots: 2, color: 'text-amber-500' },
  low: { label: 'Low Impact', dots: 1, color: 'text-muted-foreground' },
};

export default function CreditFactorGrid({ components }: CreditFactorGridProps) {
  const factors: CreditFactor[] = [
    {
      name: 'Payment History',
      value: components?.payment_history?.score_text || '95%',
      impact: 'high',
      icon: Clock,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
    },
    {
      name: 'Credit Utilization',
      value: components?.amounts_owed?.score_text || '28%',
      impact: 'high',
      icon: CreditCard,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
    },
    {
      name: 'Derogatory Marks',
      value: components?.derogatory_marks?.score_text || '0',
      impact: 'high',
      icon: AlertTriangle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      name: 'Credit Age',
      value: components?.credit_history?.score_text || '2 yrs',
      impact: 'medium',
      icon: Calendar,
      color: 'text-violet-600',
      bgColor: 'bg-violet-500/10',
    },
    {
      name: 'Total Accounts',
      value: components?.total_accounts?.score_text || '4',
      impact: 'low',
      icon: Building2,
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10',
    },
    {
      name: 'Hard Inquiries',
      value: components?.hard_inquiries?.score_text || '1',
      impact: 'low',
      icon: Search,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {factors.map((factor, i) => {
        const impactInfo = IMPACT_LABELS[factor.impact];
        const Icon = factor.icon;
        return (
          <motion.div
            key={factor.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07, duration: 0.4 }}
            whileHover={{ scale: 1.03, y: -2 }}
            className="rounded-2xl border border-border/50 bg-card p-4 cursor-default transition-shadow hover:shadow-md"
          >
            <div className={`h-9 w-9 rounded-xl ${factor.bgColor} flex items-center justify-center mb-3`}>
              <Icon className={`h-4.5 w-4.5 ${factor.color}`} strokeWidth={2} />
            </div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
              {factor.name}
            </p>
            <p className="text-2xl font-bold text-foreground leading-none mb-2">
              {factor.value}
            </p>
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[1, 2, 3].map(dot => (
                  <span
                    key={dot}
                    className={`h-1.5 w-1.5 rounded-full ${
                      dot <= impactInfo.dots ? impactInfo.color.replace('text-', 'bg-') : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              <span className={`text-[10px] font-semibold ${impactInfo.color}`}>
                {impactInfo.label}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
