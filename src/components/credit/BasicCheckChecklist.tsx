import { CheckCircle2, Circle, ArrowRight, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface BasicCheckChecklistProps {
  missing?: string[] | null;
  variant?: "customer" | "dashboard";
  className?: string;
}

const ITEMS: { key: string; label: string; description: string; route: string }[] = [
  { key: "profile", label: "Create your profile", description: "We need a basic profile record on file.", route: "/app/profile" },
  { key: "full_name", label: "Add your full legal name", description: "First and last name as on your ID.", route: "/app/profile" },
  { key: "date_of_birth", label: "Add your date of birth", description: "Required for identity verification.", route: "/app/profile" },
  { key: "country", label: "Confirm your country", description: "Used for regulatory compliance.", route: "/app/profile" },
  { key: "phone_verification", label: "Verify your phone number", description: "We send a one-time code by SMS.", route: "/app/profile" },
  { key: "kyc", label: "Complete identity verification (KYC)", description: "Upload a government-issued ID and a selfie.", route: "/app/kyc" },
];

/**
 * Visual checklist shown when a customer does not yet qualify for a CrediQ
 * score because their basic identity check is incomplete.
 */
export function BasicCheckChecklist({ missing, variant = "customer", className = "" }: BasicCheckChecklistProps) {
  const navigate = useNavigate();
  const missingSet = new Set(missing || []);

  const done = ITEMS.filter((i) => !missingSet.has(i.key)).length;
  const total = ITEMS.length;
  const pct = Math.round((done / total) * 100);
  const isCustomer = variant === "customer";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl border ${isCustomer ? "bg-[hsl(210,80%,93%)] border-foreground" : "bg-card border-border"} p-5 ${className}`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isCustomer ? "bg-background" : "bg-primary/10"}`}>
          <ShieldCheck className={`h-5 w-5 ${isCustomer ? "text-[hsl(210,60%,45%)]" : "text-primary"}`} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Complete your basic check</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            Your CrediQ score becomes available once we have verified your basic identity. This protects you and our lending partners.
          </p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-[11px] font-semibold text-foreground mb-1.5">
          <span>{done} of {total} complete</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-background/60 overflow-hidden">
          <div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="space-y-2">
        {ITEMS.map((item) => {
          const isDone = !missingSet.has(item.key);
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => !isDone && navigate(item.route)}
                disabled={isDone}
                className={`w-full flex items-start gap-3 rounded-2xl border p-3 text-left transition ${
                  isDone
                    ? "bg-background/40 border-transparent opacity-70 cursor-default"
                    : "bg-background/70 border-foreground/10 hover:bg-background active:scale-[0.99]"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-foreground" strokeWidth={2} />
                ) : (
                  <Circle className="h-4 w-4 mt-0.5 text-muted-foreground" strokeWidth={1.8} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                </div>
                {!isDone && <ArrowRight className="h-3.5 w-3.5 text-foreground mt-1" />}
              </button>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
