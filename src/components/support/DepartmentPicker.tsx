import React from 'react';
import { Headphones, CreditCard, Shield, Code, Receipt, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export interface Department {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  intake_fields?: Array<{ key: string; label: string; type: 'text' | 'select' | 'textarea'; required?: boolean; placeholder?: string; options?: string[] }>;
  sla_target_minutes?: number;
}

interface DepartmentPickerProps {
  departments: Department[];
  loading?: boolean;
  onSelect: (dept: Department) => void;
}

const iconMap: Record<string, React.ElementType> = {
  headphones: Headphones,
  'credit-card': CreditCard,
  shield: Shield,
  code: Code,
  receipt: Receipt,
};

export const DepartmentPicker: React.FC<DepartmentPickerProps> = ({ departments, loading, onSelect }) => {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-sm font-medium text-foreground">How can we help you?</p>
      <p className="text-xs text-muted-foreground">Choose a department to get started</p>
      <div className="mt-2 grid gap-2">
        {departments.map((dept, i) => {
          const Icon = iconMap[dept.icon || 'headphones'] || Headphones;
          return (
            <motion.button
              key={dept.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onSelect(dept)}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{dept.name}</p>
                {dept.description && <p className="truncate text-xs text-muted-foreground">{dept.description}</p>}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
