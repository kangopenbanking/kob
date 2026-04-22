// Renders dynamic per-department intake fields configured in `support_departments.intake_fields`.
import React from 'react';
import { Input } from '@/components/ui/input';

export interface IntakeField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'textarea';
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

interface IntakeFieldsProps {
  fields: IntakeField[];
  values: Record<string, string>;
  errors?: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export const IntakeFields: React.FC<IntakeFieldsProps> = ({ fields, values, errors, onChange }) => {
  if (!fields?.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <label htmlFor={`intake-${f.key}`} className="text-[11px] font-medium text-foreground">
            {f.label}{f.required && <span className="text-destructive"> *</span>}
          </label>
          {f.type === 'select' ? (
            <select
              id={`intake-${f.key}`}
              value={values[f.key] || ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select…</option>
              {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea
              id={`intake-${f.key}`}
              value={values[f.key] || ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={2}
              className="resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          ) : (
            <Input
              id={`intake-${f.key}`}
              value={values[f.key] || ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="rounded-xl"
              maxLength={200}
            />
          )}
          {errors?.[f.key] && <p className="text-[11px] text-destructive">{errors[f.key]}</p>}
        </div>
      ))}
    </div>
  );
};
