import { motion } from "framer-motion";
import { Sparkles, ArrowRight, ShieldCheck, TrendingUp, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";

interface NoCreditScoreCTAProps {
  /** Visual variant for the host app */
  variant?: "customer" | "banking" | "dashboard";
  /** Optional click handler (defaults to running an initial assessment) */
  onStart?: () => void;
  /** Cache keys to invalidate after a successful assessment */
  invalidateKeys?: readonly (readonly unknown[])[];
  className?: string;
}

/**
 * Professional, friendly call-to-action shown when the user does not yet have a CrediQ score.
 * Triggers an initial computation via the deterministic event-sourced engine.
 */
export function NoCreditScoreCTA({
  variant = "customer",
  onStart,
  invalidateKeys = [],
  className = "",
}: NoCreditScoreCTAProps) {
  const queryClient = useQueryClient();

  const startMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("credit-recompute", { body: {} });
      if (error) throw error;
      if (data?.error && data.error !== "rate_limited") throw new Error(data.message || data.error);
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.score) {
        toast.success(`Your CrediQ score is ${data.score}`, {
          description: "We've started building your credit profile.",
        });
      } else {
        toast.success("Assessment started", {
          description: "Add savings, njangi or rent payments to begin building your score.",
        });
      }
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: [...key] as unknown[] }));
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, "Could not start assessment")),
  });

  const handleClick = () => {
    if (onStart) return onStart();
    startMutation.mutate();
  };

  // Customer mobile (warm pastel surface)
  if (variant === "customer") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl bg-[hsl(210,80%,93%)] border border-foreground p-5 ${className}`}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background">
            <Sparkles className="h-5 w-5 text-[hsl(210,60%,45%)]" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Get Your CrediQ Score</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              You don't have a credit score yet. Run a free, no-impact assessment to unlock loans,
              overdrafts and personalized offers.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { icon: ShieldCheck, label: "Soft check", sub: "No score impact" },
            { icon: TrendingUp, label: "Free", sub: "Always" },
            { icon: Sparkles, label: "60 sec", sub: "Instant result" },
          ].map((b) => (
            <div key={b.label} className="flex flex-col items-center gap-1 rounded-2xl bg-background/70 p-2.5">
              <b.icon className="h-3.5 w-3.5 text-foreground" strokeWidth={1.5} />
              <p className="text-[10px] font-bold text-foreground">{b.label}</p>
              <p className="text-[9px] text-muted-foreground">{b.sub}</p>
            </div>
          ))}
        </div>
        <button
          onClick={handleClick}
          disabled={startMutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-3 text-sm font-bold text-background active:scale-[0.98] transition disabled:opacity-50"
        >
          {startMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Starting assessment…
            </>
          ) : (
            <>
              Start my free assessment <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </>
          )}
        </button>
      </motion.div>
    );
  }

  // Banking mobile (matches the bank palette tokens)
  if (variant === "banking") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`rounded-3xl bg-[hsl(var(--bank-sky))] p-6 ${className}`}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
            <Sparkles className="h-5 w-5 text-white" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-base font-bold text-white">No Credit Score Yet</p>
            <p className="text-xs text-white/80">Take 60 seconds to get assessed.</p>
          </div>
        </div>
        <p className="text-xs text-white/90 leading-relaxed mb-4">
          Your CrediQ score helps lenders pre-approve you for loans, overdrafts and tailored
          banking products. The first assessment is free and won't affect any existing score.
        </p>
        <button
          onClick={handleClick}
          disabled={startMutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-bold text-foreground active:scale-[0.98] transition disabled:opacity-60"
        >
          {startMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Starting…
            </>
          ) : (
            <>
              Start free assessment <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </>
          )}
        </button>
      </motion.div>
    );
  }

  // Dashboard / web (uses semantic tokens)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-border bg-card p-5 ${className}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">No CrediQ score on file</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Get instantly assessed to unlock pre-approved loans and overdraft offers.
            Free and won't impact any existing score.
          </p>
        </div>
        <button
          onClick={handleClick}
          disabled={startMutation.isPending}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {startMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              Start <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
