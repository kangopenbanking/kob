import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, IdCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface KangIdBadgeProps {
  kangId: string | null | undefined;
  variant?: "inline" | "card";
  className?: string;
}

/**
 * Read-only display of a user's permanent KANG ID (KANG-XXXXXXXX) with copy-to-clipboard.
 * Use `inline` for headers/lists; use `card` for prominent profile placement.
 */
export function KangIdBadge({ kangId, variant = "inline", className }: KangIdBadgeProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!kangId) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(kangId);
      setCopied(true);
      toast({ title: "KANG ID copied", description: kangId });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Could not copy", description: "Please copy manually.", variant: "destructive" });
    }
  };

  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm",
          className,
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded-lg border border-border bg-muted/40 p-2">
            <IdCard className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Your KANG ID</p>
            <p className="truncate font-mono text-base font-semibold tracking-tight text-foreground">
              {kangId}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="shrink-0"
          aria-label="Copy KANG ID"
        >
          {copied ? <Check className="h-4 w-4" strokeWidth={1.75} /> : <Copy className="h-4 w-4" strokeWidth={1.75} />}
          <span className="ml-2 hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 font-mono text-xs font-medium text-foreground transition hover:bg-muted",
        className,
      )}
      aria-label={`Copy KANG ID ${kangId}`}
    >
      <IdCard className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
      <span className="tracking-tight">{kangId}</span>
      {copied ? <Check className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} /> : <Copy className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />}
    </button>
  );
}
