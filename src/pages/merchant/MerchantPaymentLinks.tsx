import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";

export default function MerchantPaymentLinks() {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      const { data } = await supabase.from("gateway_payment_links").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setLinks(data || []);
    }
    setLoading(false);
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/pay/${slug}`);
    toast.success("Payment link copied!");
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Payment Links</h1><p className="text-muted-foreground">Create and manage shareable payment links</p></div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="text-left py-3 px-4">Title</th><th className="text-left py-3 px-4">Amount</th><th className="text-left py-3 px-4">Status</th><th className="text-left py-3 px-4">Created</th><th className="text-left py-3 px-4">Actions</th></tr></thead>
              <tbody>
                {links.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No payment links yet</td></tr> : links.map(l => (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3 px-4 font-medium">{l.title}</td>
                    <td className="py-3 px-4">{l.amount ? `${Number(l.amount).toLocaleString()} ${l.currency}` : "Flexible"}</td>
                    <td className="py-3 px-4"><Badge variant={l.is_active ? "default" : "secondary"}>{l.is_active ? "Active" : "Inactive"}</Badge></td>
                    <td className="py-3 px-4">{l.created_at ? format(new Date(l.created_at), "MMM d, yyyy") : "-"}</td>
                    <td className="py-3 px-4"><Button variant="ghost" size="sm" onClick={() => copyLink(l.slug)}><Copy className="h-3.5 w-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
