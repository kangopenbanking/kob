/**
 * ValidatedAccountInput — Input with inline API validation indicator
 * 
 * Shows green checkmark on valid, red X with error message on invalid.
 * Validates on blur via POST /v1/standards/validate/* endpoints.
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ValidatedAccountInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onValidate: () => Promise<boolean>;
  validation: { valid: boolean; error?: string; loading: boolean };
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const ValidatedAccountInput: React.FC<ValidatedAccountInputProps> = ({
  label,
  value,
  onChange,
  onValidate,
  validation,
  placeholder,
  disabled,
  className,
}) => {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-sm font-medium">{label}</Label>
      <div className="relative">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={() => { if (value.trim()) onValidate(); }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'pr-10',
            validation.valid && 'border-[hsl(150,60%,40%)] focus-visible:ring-[hsl(150,60%,40%)]',
            validation.error && 'border-destructive focus-visible:ring-destructive'
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {validation.loading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={1.5} />
          )}
          {!validation.loading && validation.valid && (
            <CheckCircle2 className="h-4 w-4 text-[hsl(150,60%,40%)]" strokeWidth={1.5} />
          )}
          {!validation.loading && validation.error && (
            <XCircle className="h-4 w-4 text-destructive" strokeWidth={1.5} />
          )}
        </div>
      </div>
      {validation.error && (
        <p className="text-xs text-destructive">{validation.error}</p>
      )}
    </div>
  );
};
