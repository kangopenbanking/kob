import { cn } from "@/lib/utils";
import { Smartphone, CreditCard, Globe, Building2 } from "lucide-react";

const methods = [
  { value: "mobile_money", label: "Mobile Money", icon: Smartphone, description: "MTN, Orange Money" },
  { value: "card", label: "Card", icon: CreditCard, description: "Visa, Mastercard" },
  { value: "paypal", label: "PayPal", icon: Globe, description: "PayPal account" },
  { value: "bank_transfer", label: "Bank Transfer", icon: Building2, description: "Wire transfer" },
] as const;

interface PaymentMethodSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const PaymentMethodSelector = ({ value, onChange }: PaymentMethodSelectorProps) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {methods.map((m) => {
      const Icon = m.icon;
      const selected = value === m.value;
      return (
        <button
          key={m.value}
          type="button"
          onClick={() => onChange(m.value)}
          className={cn(
            "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 hover:shadow-md",
            selected
              ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
              : "border-border bg-card hover:border-primary/40"
          )}
        >
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
            selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <span className={cn("text-sm font-semibold", selected ? "text-primary" : "text-foreground")}>{m.label}</span>
          <span className="text-[11px] text-muted-foreground leading-tight">{m.description}</span>
          {selected && (
            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
              <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </button>
      );
    })}
  </div>
);
