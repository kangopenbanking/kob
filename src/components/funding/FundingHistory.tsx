import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ArrowUpRight, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface FundingHistoryProps {
  scope: "end_user" | "merchant" | "institution";
  merchantId?: string;
  accountId?: string;
  fmt: (n: number) => string;
}

const statusColors: Record<string, string> = {
  succeeded: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
  pending_provider: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  pending_customer_action: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  pending_verification: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  created: "bg-muted text-muted-foreground",
};

export const FundingHistory = ({ scope, merchantId, accountId, fmt }: FundingHistoryProps) => {
  const { data: intents, isLoading } = useQuery({
    queryKey: ["funding-history", scope, merchantId, accountId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from("funding_intents")
        .select("id, amount, currency, method, provider, status, reference, created_at, fee_amount")
        .eq("user_id", user.id)
        .eq("funding_scope", scope)
        .order("created_at", { ascending: false })
        .limit(10);

      if (merchantId) query = query.eq("merchant_id", merchantId);
      if (accountId) query = query.eq("account_id", accountId);

      const { data } = await query;
      return data || [];
    },
    refetchInterval: 15000,
  });

  if (isLoading || !intents?.length) return null;

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Recent Funding History
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {intents.map((intent: any) => (
            <div key={intent.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {fmt(intent.amount)}
                    <span className="text-xs text-muted-foreground ml-1.5">{intent.method?.replace(/_/g, " ")}</span>
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(intent.created_at), { addSuffix: true })}
                    <span className="opacity-50">•</span>
                    <span className="font-mono">{intent.reference?.slice(-12)}</span>
                  </div>
                </div>
              </div>
              <Badge variant="secondary" className={`text-[10px] shrink-0 ${statusColors[intent.status] || ""}`}>
                {intent.status?.replace(/_/g, " ")}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
