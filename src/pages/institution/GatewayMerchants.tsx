import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, Key, Landmark, Plus, Shield, Eye, Copy, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export default function GatewayMerchants() {
  const [search, setSearch] = useState("");
  const [selectedMerchant, setSelectedMerchant] = useState<any>(null);

  const { data: merchants, isLoading } = useQuery({
    queryKey: ["gateway-merchants"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = (supabase as any)
        ? await (supabase as any).from("gateway_merchants").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
        : { data: [] };
      return data || [];
    },
  });

  const { data: apiKeys } = useQuery({
    queryKey: ["gateway-merchant-keys", selectedMerchant?.id],
    queryFn: async () => {
      if (!selectedMerchant) return [];
      const { data } = await (supabase as any)
        .from("gateway_merchant_api_keys")
        .select("*")
        .eq("merchant_id", selectedMerchant.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedMerchant,
  });

  const { data: settlements } = useQuery({
    queryKey: ["gateway-merchant-settlements", selectedMerchant?.id],
    queryFn: async () => {
      if (!selectedMerchant) return [];
      const { data } = await (supabase as any)
        .from("gateway_merchant_settlement_accounts")
        .select("*")
        .eq("merchant_id", selectedMerchant.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedMerchant,
  });

  const filtered = (merchants || []).filter((m: any) =>
    m.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.business_email?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default", verified: "default", draft: "secondary",
      submitted: "outline", under_review: "outline",
      suspended: "destructive", rejected: "destructive", closed: "destructive",
    };
    return map[status] || "secondary";
  };

  const kybColor = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      approved: "default", submitted: "outline", not_submitted: "secondary",
      rejected: "destructive",
    };
    return map[status] || "secondary";
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Merchant Accounts</h1>
          <p className="text-muted-foreground">Manage your gateway merchant profiles, KYB, API keys, and settlement accounts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{merchants?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total Merchants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{merchants?.filter((m: any) => m.status === "active" || m.status === "verified").length || 0}</p>
                <p className="text-xs text-muted-foreground">Active / Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{merchants?.filter((m: any) => m.kyb_status === "submitted").length || 0}</p>
                <p className="text-xs text-muted-foreground">KYB Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{merchants?.filter((m: any) => m.environment === "production").length || 0}</p>
                <p className="text-xs text-muted-foreground">Production</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <Input placeholder="Search merchants..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" /> Merchants ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>KYB</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No merchants found. Create a merchant via the API to get started.</TableCell></TableRow>
              ) : filtered.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.business_name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.business_email}</TableCell>
                  <TableCell><Badge variant={statusColor(m.status)}>{m.status}</Badge></TableCell>
                  <TableCell><Badge variant={kybColor(m.kyb_status)}>{m.kyb_status?.replace("_", " ")}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{m.environment}</Badge></TableCell>
                  <TableCell>{new Date(m.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedMerchant(m)}>
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{m.business_name}</DialogTitle>
                          <DialogDescription>Merchant ID: {m.id}</DialogDescription>
                        </DialogHeader>
                        <Tabs defaultValue="details" className="mt-4">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="details">Details</TabsTrigger>
                            <TabsTrigger value="keys">API Keys</TabsTrigger>
                            <TabsTrigger value="settlement">Settlement</TabsTrigger>
                          </TabsList>

                          <TabsContent value="details" className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div><span className="text-muted-foreground">Status</span><div><Badge variant={statusColor(m.status)}>{m.status}</Badge></div></div>
                              <div><span className="text-muted-foreground">KYB Status</span><div><Badge variant={kybColor(m.kyb_status)}>{m.kyb_status?.replace("_", " ")}</Badge></div></div>
                              <div><span className="text-muted-foreground">Email</span><p>{m.business_email}</p></div>
                              <div><span className="text-muted-foreground">Phone</span><p>{m.business_phone || "—"}</p></div>
                              <div><span className="text-muted-foreground">Environment</span><p>{m.environment}</p></div>
                              <div><span className="text-muted-foreground">Fee Bearer</span><p>{m.fee_bearer || "merchant"}</p></div>
                              <div><span className="text-muted-foreground">Daily Charge Limit</span><p>{m.daily_charge_limit?.toLocaleString() || "—"}</p></div>
                              <div><span className="text-muted-foreground">Single Charge Limit</span><p>{m.single_charge_limit?.toLocaleString() || "—"}</p></div>
                              <div><span className="text-muted-foreground">Webhook URL</span><p className="truncate">{m.webhook_url || "Not set"}</p></div>
                              <div><span className="text-muted-foreground">Created</span><p>{new Date(m.created_at).toLocaleString()}</p></div>
                            </div>
                          </TabsContent>

                          <TabsContent value="keys" className="space-y-4 mt-4">
                            {!apiKeys?.length ? (
                              <p className="text-sm text-muted-foreground py-4 text-center">No API keys generated yet. Use the API to create keys.</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Prefix</TableHead>
                                    <TableHead>Label</TableHead>
                                    <TableHead>Environment</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Last Used</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {apiKeys.map((k: any) => (
                                    <TableRow key={k.id}>
                                      <TableCell className="font-mono text-xs">
                                        <span className="flex items-center gap-1">
                                          {k.api_key_prefix}...
                                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => copyText(k.api_key_prefix)}>
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        </span>
                                      </TableCell>
                                      <TableCell>{k.label || "—"}</TableCell>
                                      <TableCell><Badge variant="outline">{k.environment}</Badge></TableCell>
                                      <TableCell><Badge variant={k.is_active ? "default" : "destructive"}>{k.is_active ? "Active" : "Revoked"}</Badge></TableCell>
                                      <TableCell>{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </TabsContent>

                          <TabsContent value="settlement" className="space-y-4 mt-4">
                            {!settlements?.length ? (
                              <p className="text-sm text-muted-foreground py-4 text-center">No settlement accounts configured. Use the API to add one.</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Bank / Provider</TableHead>
                                    <TableHead>Account</TableHead>
                                    <TableHead>Currency</TableHead>
                                    <TableHead>Default</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {settlements.map((s: any) => (
                                    <TableRow key={s.id}>
                                      <TableCell className="capitalize">{s.account_type?.replace("_", " ")}</TableCell>
                                      <TableCell>{s.bank_name || "—"}</TableCell>
                                      <TableCell className="font-mono text-xs">{s.account_number || s.phone_number || "—"}</TableCell>
                                      <TableCell>{s.currency}</TableCell>
                                      <TableCell>{s.is_default ? "✓" : "—"}</TableCell>
                                      <TableCell><Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </TabsContent>
                        </Tabs>
                      </DialogContent>
                    </Dialog>
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
