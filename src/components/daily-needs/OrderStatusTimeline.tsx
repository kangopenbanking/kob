import { Check, Circle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "received",   label: "Pending" },
  { key: "accepted",   label: "Accepted" },
  { key: "preparing",  label: "Processing" },
  { key: "ready",      label: "Ready" },
  { key: "picked_up",  label: "Picked up" },
  { key: "on_the_way", label: "On the way" },
  { key: "arriving",   label: "Arriving" },
  { key: "delivered",  label: "Delivered" },
];

const CANCELLED_STATES = new Set(["cancelled", "canceled", "refunded"]);

export function OrderStatusTimeline({ status }: { status: string }) {
  if (CANCELLED_STATES.has(status)) {
    return (
      <ol className="space-y-3">
        <li className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-full border bg-destructive border-destructive text-destructive-foreground">
            <X className="size-4" />
          </span>
          <span className="text-sm font-semibold text-foreground capitalize">
            Order {status === "refunded" ? "refunded" : "canceled"}
          </span>
        </li>
        <li className="text-xs text-muted-foreground pl-10">
          This order will no longer be processed or delivered.
        </li>
      </ol>
    );
  }

  const currentIdx = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="space-y-3">
      {STEPS.map((s, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <li key={s.key} className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border",
                done ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" /> : <Circle className="size-3" />}
            </span>
            <span className={cn("text-sm", active ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground")}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
