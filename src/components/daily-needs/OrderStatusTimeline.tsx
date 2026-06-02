import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "received",   label: "Order received" },
  { key: "accepted",   label: "Accepted" },
  { key: "preparing",  label: "Preparing" },
  { key: "ready",      label: "Ready" },
  { key: "picked_up",  label: "Picked up" },
  { key: "on_the_way", label: "On the way" },
  { key: "arriving",   label: "Arriving" },
  { key: "delivered",  label: "Delivered" },
];

export function OrderStatusTimeline({ status }: { status: string }) {
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
