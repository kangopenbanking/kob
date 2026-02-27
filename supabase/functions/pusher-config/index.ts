import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Return only publishable config - no secrets
  const config = {
    pusher_key: Deno.env.get("PUSHER_KEY") || "",
    pusher_cluster: Deno.env.get("PUSHER_CLUSTER") || "eu",
  };

  return new Response(JSON.stringify(config), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
