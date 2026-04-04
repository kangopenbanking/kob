import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowUpDown, Send } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function BankTransferManager() {
  const [sourceAccount, setSourceAccount] = useState("");
  const [destAccount, setDestAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    if (!sourceAccount || !destAccount || !amount) {
      toast.error("All fields are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("banking-api-router", {
        body: {
          action: "internal_transfer",
          source_account_id: sourceAccount,
          destination_account_id: destAccount,
          amount: parseFloat(amount),
          currency: "XAF",
          narration,
          idempotency_key: `transfer-${Date.now()}`,
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      toast.success("Transfer initiated successfully");
      setSourceAccount("");
      setDestAccount("");
      setAmount("");
      setNarration("");
    } catch (err: any) {
      toast.error(err.message || "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Transfer Manager</h1>
        <p className="text-muted-foreground">Initiate and manage internal and external bank transfers</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5 text-primary" />
              Internal Transfer
            </CardTitle>
            <CardDescription>Transfer between accounts within the same connected bank</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Source Account ID</Label>
              <Input
                placeholder="Enter source account ID"
                value={sourceAccount}
                onChange={(e) => setSourceAccount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Destination Account ID</Label>
              <Input
                placeholder="Enter destination account ID"
                value={destAccount}
                onChange={(e) => setDestAccount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Amount (XAF)</Label>
              <Input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Narration</Label>
              <Input
                placeholder="Transfer description"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
              />
            </div>
            <Button onClick={handleTransfer} disabled={loading} className="w-full">
              <Send className="mr-2 h-4 w-4" />
              {loading ? "Processing..." : "Initiate Transfer"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              External Transfer
            </CardTitle>
            <CardDescription>Cross-bank transfers via ISO 20022 interbank messaging</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ArrowUpDown className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-sm text-muted-foreground">
              External transfers are routed through the KOB Interbank Engine using ISO 20022 pain.001 messages.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Contact your integration manager to enable cross-bank transfers.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
