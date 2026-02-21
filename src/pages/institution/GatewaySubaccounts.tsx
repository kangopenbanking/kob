import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2 } from "lucide-react";

export default function GatewaySubaccounts() {
  const { data: subaccounts, isLoading } = useQuery({
    queryKey: ["gateway-subaccounts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("gateway_subaccounts")
        .select("*, gateway_merchants!inner(user_id, business_name)")
        .order("created_at", { ascending: false });
      return (data || []).filter((s: any) => s.gateway_merchants?.user_id === user.id);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subaccounts</h1>
        <p className="text-muted-foreground">Manage split payment subaccounts for marketplace distribution</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Subaccounts ({(subaccounts || []).length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Split Type</TableHead>
                <TableHead>Split Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (subaccounts || []).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No subaccounts found</TableCell></TableRow>
              ) : (subaccounts || []).map((sub: any) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">{sub.subaccount_name}</TableCell>
                  <TableCell>{sub.settlement_bank || "—"}</TableCell>
                  <TableCell>{sub.account_number || "—"}</TableCell>
                  <TableCell className="capitalize">{sub.split_type}</TableCell>
                  <TableCell>{sub.split_value}{sub.split_type === "percentage" ? "%" : ` ${sub.currency || "XAF"}`}</TableCell>
                  <TableCell><Badge variant={sub.is_active ? "default" : "secondary"}>{sub.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell>{new Date(sub.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
