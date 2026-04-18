// CrediQ Premium upsell card — used on consumer credit pages
// to surface paid features (full report, AI tips, alerts).
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, FileText, Bell, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Status {
  active: boolean;
  current_period_end: string | null;
  amount: number;
  currency: string;
  auto_renew: boolean;
}

export function CrediQPremiumCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('crediq-subscription', {
        body: { action: 'status' },
      });
      if (error) throw error;
      setStatus(data as Status);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function subscribe() {
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke('crediq-subscription', {
        body: { action: 'subscribe' },
      });
      if (error) throw error;
      toast.success("CrediQ Premium activated", {
        description: `Active until ${new Date(data.period_end).toLocaleDateString()}`,
      });
      await load();
    } catch (e: any) {
      toast.error("Could not activate Premium", {
        description: e?.message || "Please try again or contact support.",
      });
    } finally {
      setWorking(false);
    }
  }

  async function cancel() {
    setWorking(true);
    try {
      const { error } = await supabase.functions.invoke('crediq-subscription', {
        body: { action: 'cancel' },
      });
      if (error) throw error;
      toast.success("Auto-renew disabled", {
        description: "Premium remains active until the end of the period.",
      });
      await load();
    } catch (e: any) {
      toast.error("Could not cancel", { description: e?.message });
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  const active = status?.active;

  return (
    <Card className="p-6 border-border">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">CrediQ Premium</h3>
            <p className="text-xs text-muted-foreground">
              {active ? "Your full credit toolkit is unlocked" : "Unlock the full credit toolkit"}
            </p>
          </div>
        </div>
        {active ? (
          <Badge variant="outline" className="border-border">Active</Badge>
        ) : (
          <Badge variant="outline" className="border-border">1,500 XAF / month</Badge>
        )}
      </div>

      <ul className="space-y-2 mb-5 text-sm">
        <li className="flex items-center gap-2 text-foreground">
          <FileText className="w-4 h-4 text-muted-foreground" /> Full credit report with bureau-grade detail
        </li>
        <li className="flex items-center gap-2 text-foreground">
          <Sparkles className="w-4 h-4 text-muted-foreground" /> AI-powered tips to grow your score
        </li>
        <li className="flex items-center gap-2 text-foreground">
          <Bell className="w-4 h-4 text-muted-foreground" /> Weekly digests + instant change alerts
        </li>
      </ul>

      {active ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {status?.auto_renew ? "Renews" : "Ends"} on {status?.current_period_end ? new Date(status.current_period_end).toLocaleDateString() : "—"}
          </p>
          {status?.auto_renew && (
            <Button variant="outline" className="w-full" onClick={cancel} disabled={working}>
              {working ? <Loader2 className="w-4 h-4 animate-spin" /> : "Disable auto-renew"}
            </Button>
          )}
        </div>
      ) : (
        <Button className="w-full" onClick={subscribe} disabled={working}>
          {working ? <Loader2 className="w-4 h-4 animate-spin" /> : "Activate Premium"}
        </Button>
      )}
      <p className="text-[11px] text-muted-foreground mt-3">
        One-time report purchases (2,500 XAF / 30-day access) remain available.
      </p>
    </Card>
  );
}
