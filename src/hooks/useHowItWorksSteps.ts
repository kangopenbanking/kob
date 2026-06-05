import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveIcon } from "@/components/daily-needs/iconRegistry";
import type { FlowStep } from "@/components/customer-app/HowItWorksFlow";

export type Vertical = "food" | "pharmacy";

export function useHowItWorksSteps(vertical: Vertical, fallback: FlowStep[]) {
  const [steps, setSteps] = useState<FlowStep[]>(fallback);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("daily_needs_how_it_works_steps")
        .select("position, title, description, icon, bg_color, icon_color")
        .eq("vertical", vertical)
        .order("position", { ascending: true });
      if (cancelled) return;
      if (error || !data || data.length === 0) return;
      setSteps(
        data.map((r: any) => ({
          icon: resolveIcon(r.icon),
          title: r.title,
          description: r.description,
          color: r.bg_color,
          iconColor: r.icon_color,
        }))
      );
    })();
    return () => { cancelled = true; };
  }, [vertical]);

  return steps;
}
