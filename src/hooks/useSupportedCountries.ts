import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppType = "consumer" | "banking" | "desktop";

export interface SupportedCountry {
  id: string;
  code: string;
  country: string;
  flag: string;
  dial_code: string;
  enabled_consumer_app: boolean;
  enabled_banking_app: boolean;
  enabled_desktop_app: boolean;
  sort_order: number;
}

export function useSupportedCountries(appType?: AppType) {
  return useQuery({
    queryKey: ["supported-countries", appType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supported_countries")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Failed to fetch supported countries:", error);
        return [] as SupportedCountry[];
      }

      let countries = (data || []) as SupportedCountry[];

      if (appType === "consumer") {
        countries = countries.filter((c) => c.enabled_consumer_app);
      } else if (appType === "banking") {
        countries = countries.filter((c) => c.enabled_banking_app);
      }

      return countries;
    },
    staleTime: 5 * 60 * 1000,
  });
}
