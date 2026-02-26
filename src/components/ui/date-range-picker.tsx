import * as React from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const presets: { label: string; range: () => DateRange }[] = [
  { label: "Today", range: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: "Last 7 days", range: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
  { label: "Last 30 days", range: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
  { label: "Last 90 days", range: () => ({ from: startOfDay(subDays(new Date(), 89)), to: endOfDay(new Date()) }) },
  { label: "This month", range: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }) },
  { label: "Last month", range: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
];

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-start text-left font-normal gap-2 h-9", className)}>
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            {format(value.from, "MMM d")} – {format(value.to, "MMM d, yyyy")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          <div className="border-r p-2 space-y-1">
            {presets.map(p => (
              <Button
                key={p.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => { onChange(p.range()); setOpen(false); }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="p-2">
            <Calendar
              mode="range"
              selected={{ from: value.from, to: value.to }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  onChange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                  setOpen(false);
                } else if (range?.from) {
                  onChange({ from: startOfDay(range.from), to: endOfDay(range.from) });
                }
              }}
              numberOfMonths={1}
              className={cn("pointer-events-auto")}
              disabled={(date) => date > new Date()}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
