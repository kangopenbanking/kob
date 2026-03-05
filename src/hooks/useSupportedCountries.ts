import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRY_CODES } from "@/lib/country-codes";

export type AppType = "consumer" | "banking";

export interface SupportedCountry {
  id: string;
  code: string;
  country: string;
  flag: string;
  dial_code: string;
  enabled_consumer_app: boolean;
  enabled_banking_app: boolean;
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
        console.error("Failed to fetch supported countries, falling back to static list:", error);
        // Fallback to static list
        return COUNTRY_CODES.map((cc, i) => ({
          code: cc.code,
          country: cc.country,
          flag: cc.flag,
          dial_code: cc.code,
          enabled_consumer_app: true,
          enabled_banking_app: true,
          sort_order: i,
          id: `static-${i}`,
        })) as SupportedCountry[];
      }

      let countries = (data || []) as SupportedCountry[];

      if (appType === "consumer") {
        countries = countries.filter((c) => c.enabled_consumer_app);
      } else if (appType === "banking") {
        countries = countries.filter((c) => c.enabled_banking_app);
      }

      return countries;
    },
    staleTime: 5 * 60 * 1000, // Cache 5 min
  });
}
