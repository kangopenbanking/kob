import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Smartphone } from "lucide-react";

export default function MerchantSettlementAccounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      const { data } = await supabase.from("gateway_merchant_settlement_accounts").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setAccounts(data || []);
    }
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Settlement Accounts</h1><p className="text-muted-foreground">Manage your bank accounts and mobile money for payouts</p></div>
      {accounts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No settlement accounts configured</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map(a => (
            <Card key={a.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {a.account_type === "mobile_money" ? <Smartphone className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                    <CardTitle className="text-base">{a.account_name || a.bank_name || "Account"}</CardTitle>
                  </div>
                  {a.is_default && <Badge>Default</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Type:</span> {a.account_type}</p>
                {a.bank_name && <p><span className="text-muted-foreground">Bank:</span> {a.bank_name}</p>}
                {a.account_number && <p><span className="text-muted-foreground">Account:</span> ****{a.account_number?.slice(-4)}</p>}
                {a.momo_number && <p><span className="text-muted-foreground">MoMo:</span> {a.momo_number}</p>}
                <p><span className="text-muted-foreground">Currency:</span> {a.currency}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
