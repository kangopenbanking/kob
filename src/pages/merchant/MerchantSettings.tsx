import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck, Bell, Lock, Smartphone, Building2, Key, AlertTriangle, ChevronRight, Settings as SettingsIcon,
} from "lucide-react";
import { toast } from "sonner";

interface Row {
  icon: React.ReactNode;
  label: string;
  desc: string;
  right?: React.ReactNode;
  href?: string;
}

const Section = ({ title, rows }: { title: string; rows: Row[] }) => (
  <div>
    <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    <Card className="divide-y divide-border border-border bg-card">
      {rows.map((r, i) => {
        const content = (
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">{r.icon}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{r.label}</p>
              <p className="truncate text-xs text-muted-foreground">{r.desc}</p>
            </div>
            {r.right ?? (r.href ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : null)}
          </div>
        );
        return r.href ? (
          <Link key={i} to={r.href} className="block transition-colors hover:bg-muted/40">{content}</Link>
        ) : (
          <div key={i}>{content}</div>
        );
      })}
    </Card>
  </div>
);

export default function MerchantSettings() {
  const [twoFA, setTwoFA] = useState(false);
  const [orderAlerts, setOrderAlerts] = useState(true);
  const [payoutAlerts, setPayoutAlerts] = useState(true);
  const [disputeAlerts, setDisputeAlerts] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase.from("user_preferences") as any)
        .select("two_factor_enabled, notify_orders, notify_payouts, notify_disputes")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setTwoFA(!!data.two_factor_enabled);
        setOrderAlerts(data.notify_orders ?? true);
        setPayoutAlerts(data.notify_payouts ?? true);
        setDisputeAlerts(data.notify_disputes ?? true);
      }
    })();
  }, []);

  const upsert = async (patch: Record<string, any>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await (supabase.from("user_preferences") as any).upsert(
      { user_id: user.id, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (error) toast.error("Failed to save preference");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <SettingsIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Security, notifications and preferences</p>
        </div>
      </div>

      <div className="space-y-6">
        <Section
          title="Business"
          rows={[
            { icon: <Building2 className="h-4 w-4" />, label: "Business profile", desc: "Name, address, contact details", href: "/merchant/profile" },
            { icon: <ShieldCheck className="h-4 w-4" />, label: "KYB verification", desc: "Documents and compliance status", href: "/merchant/kyb" },
          ]}
        />

        <Section
          title="Security"
          rows={[
            {
              icon: <Smartphone className="h-4 w-4" />, label: "Two-factor authentication",
              desc: twoFA ? "Enabled" : "Add an extra layer at sign-in",
              right: <Switch checked={twoFA} onCheckedChange={async (v) => { setTwoFA(v); await upsert({ two_factor_enabled: v }); toast.success(v ? "2FA enabled" : "2FA disabled"); }} />,
            },
            { icon: <Key className="h-4 w-4" />, label: "API keys", desc: "Manage live and rotation keys", href: "/merchant/api-keys" },
            { icon: <Lock className="h-4 w-4" />, label: "Webhook secrets", desc: "Rotate and verify webhook endpoints", href: "/merchant/webhooks" },
          ]}
        />

        <Section
          title="Notifications"
          rows={[
            {
              icon: <Bell className="h-4 w-4" />, label: "Order alerts", desc: "New orders and fulfillment events",
              right: <Switch checked={orderAlerts} onCheckedChange={async (v) => { setOrderAlerts(v); await upsert({ notify_orders: v }); }} />,
            },
            {
              icon: <Bell className="h-4 w-4" />, label: "Payout alerts", desc: "Settlements and transfers",
              right: <Switch checked={payoutAlerts} onCheckedChange={async (v) => { setPayoutAlerts(v); await upsert({ notify_payouts: v }); }} />,
            },
            {
              icon: <Bell className="h-4 w-4" />, label: "Dispute alerts", desc: "Chargebacks and customer disputes",
              right: <Switch checked={disputeAlerts} onCheckedChange={async (v) => { setDisputeAlerts(v); await upsert({ notify_disputes: v }); }} />,
            },
            { icon: <Bell className="h-4 w-4" />, label: "Inbox", desc: "View all merchant notifications", href: "/merchant/notifications" },
          ]}
        />

        <div>
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Danger zone</p>
          <Card className="border-destructive/30 bg-card p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Close merchant account</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Closing your account stops all payments and payouts. Outstanding balances must be withdrawn first. Contact support to proceed.
                </p>
              </div>
            </div>
            <Separator />
            <Button variant="outline" className="w-full" asChild>
              <Link to="/merchant/help">Contact support</Link>
            </Button>
          </Card>
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          Account status <Badge variant="outline" className="ml-1">Active</Badge>
        </p>
      </div>
    </div>
  );
}
