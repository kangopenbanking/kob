import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link2, Plus, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function GatewayPaymentLinks() {
  const [search, setSearch] = useState("");

  const { data: links, isLoading } = useQuery({
    queryKey: ["gateway-payment-links"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("gateway_payment_links")
        .select("*, gateway_merchants!inner(user_id, business_name)")
        .order("created_at", { ascending: false });
      return (data || []).filter((l: any) => l.gateway_merchants?.user_id === user.id);
    },
  });

  const filtered = (links || []).filter((l: any) =>
    l.title?.toLowerCase().includes(search.toLowerCase())
  );

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/pay/${slug}`);
    toast.success("Payment link copied!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment Links</h1>
          <p className="text-muted-foreground">Create and manage shareable payment links</p>
        </div>
      </div>

      <div className="flex gap-4">
        <Input placeholder="Search links..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" /> Payment Links ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No payment links found</TableCell></TableRow>
              ) : filtered.map((link: any) => (
                <TableRow key={link.id}>
                  <TableCell className="font-medium">{link.title}</TableCell>
                  <TableCell>{link.amount?.toLocaleString()}</TableCell>
                  <TableCell>{link.currency}</TableCell>
                  <TableCell>
                    <Badge variant={link.status === "active" ? "default" : "secondary"}>{link.status}</Badge>
                  </TableCell>
                  <TableCell>{link.current_uses || 0}{link.max_uses ? `/${link.max_uses}` : ""}</TableCell>
                  <TableCell>{new Date(link.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => copyLink(link.slug)}><Copy className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" asChild><a href={`/pay/${link.slug}`} target="_blank"><ExternalLink className="h-4 w-4" /></a></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
