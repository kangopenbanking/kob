import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Key, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function MerchantApiKeys() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      const { data } = await supabase.from("gateway_merchant_api_keys").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setKeys(data || []);
    }
    setLoading(false);
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">API Keys</h1><p className="text-muted-foreground">Manage your sandbox and production API keys</p></div>
      {keys.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No API keys configured yet</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {keys.map(k => (
            <Card key={k.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{k.label || "API Key"}</CardTitle>
                    <Badge variant={k.environment === "production" ? "default" : "secondary"}>{k.environment}</Badge>
                  </div>
                  <Badge variant={k.is_active ? "default" : "outline"}>{k.is_active ? "Active" : "Revoked"}</Badge>
                </div>
                <CardDescription>Created {k.created_at ? format(new Date(k.created_at), "MMM d, yyyy") : "—"} · Last used {k.last_used_at ? format(new Date(k.last_used_at), "MMM d, yyyy HH:mm") : "never"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 font-mono text-sm bg-muted/50 p-3 rounded-md">
                  <span className="flex-1 truncate">{visibleKeys.has(k.id) ? k.key_prefix + "..." : "••••••••••••••••"}</span>
                  <Button variant="ghost" size="sm" onClick={() => toggleVisibility(k.id)}>
                    {visibleKeys.has(k.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
