import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CreditCard, Copy, RefreshCw, Code2 } from "lucide-react";
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

export default function MerchantPayByBank() {
  const tr = useHarvestedT('merchant');
  const [intents, setIntents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchantId, setMerchantId] = useState<string | null>(null);

  useEffect(() => {
    loadMerchantAndIntents();
  }, []);

  const loadMerchantAndIntents = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: merchant } = await supabase
      .from("gateway_merchants")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (merchant) {
      setMerchantId(merchant.id);
      const { data } = await supabase.functions.invoke("pay-by-bank", {
        body: { action: "list_intents", merchant_id: merchant.id },
      });
      if (data?.intents) setIntents(data.intents);
    }
    setLoading(false);
  };

  const copySnippet = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard");
  };

  const nodeSnippet = `const kob = new KangOpenBanking({ clientId: 'YOUR_CLIENT_ID', clientSecret: 'YOUR_SECRET' });
await kob.getToken();

const intent = await kob.payByBank.createIntent({
  merchant_id: '${merchantId || "YOUR_MERCHANT_ID"}',
  amount: 50000,
  currency: 'XAF',
  redirect_uri: 'https://yoursite.com/payment/callback',
  state: 'order_123',
  description: 'Order #123'
});

// Redirect user to: intent.authorization_url`;

  const phpSnippet = `$kob = new KangOpenBanking(['client_id' => 'YOUR_ID', 'client_secret' => 'YOUR_SECRET']);
$kob->getToken();

$intent = $kob->payByBank->createIntent([
    'merchant_id' => '${merchantId || "YOUR_MERCHANT_ID"}',
    'amount' => 50000,
    'currency' => 'XAF',
    'redirect_uri' => 'https://yoursite.com/payment/callback',
    'state' => 'order_123',
]);

// Redirect: $intent['authorization_url']`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6 text-primary" /> {tr('Pay by Bank')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{tr('Accept direct bank payments with redirect-based SCA')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadMerchantAndIntents}><RefreshCw className="h-4 w-4 mr-2" /> {tr('Refresh')}</Button>
      </div>

      {/* Integration Guide */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Code2 className="h-4 w-4" /> {tr('Quick Integration')}</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="nodejs">
            <TabsList><TabsTrigger value="nodejs">{tr('Node.js')}</TabsTrigger><TabsTrigger value="php">PHP</TabsTrigger></TabsList>
            <TabsContent value="nodejs">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">{nodeSnippet}</pre>
                <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => copySnippet(nodeSnippet)}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            </TabsContent>
            <TabsContent value="php">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">{phpSnippet}</pre>
                <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => copySnippet(phpSnippet)}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Intent List */}
      <Card>
        <CardHeader><CardTitle className="text-base">{tr('Payment Intents')}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : intents.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{tr('No payment intents yet. Use the API to create your first one.')}</p>
          ) : (
            <div className="space-y-2">
              {intents.map((intent: any, i: number) => (
                <motion.div key={intent.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50"
                >
                  <div>
                    <p className="font-medium">{intent.currency} {Number(intent.amount).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{intent.description || "No description"} • {new Date(intent.created_at).toLocaleDateString()}</p>
                  </div>
                  <Badge variant="outline">{intent.status}</Badge>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
