import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Code2, Search, Ban, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface DevApp {
  id: string;
  client_id: string;
  client_name: string;
  developer_user_id: string | null;
  developer_email: string | null;
  developer_company: string | null;
  api_environment: string;
  rate_limit_tier: string;
  is_active: boolean;
  requests_used: number;
  monthly_requests_limit: number;
  created_at: string;
  last_request_at: string | null;
}

interface DevUser {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  app_count: number;
}

export default function DeveloperManagement() {
  const [apps, setApps] = useState<DevApp[]>([]);
  const [users, setUsers] = useState<DevUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data: appRows, error } = await supabase
        .from("api_clients")
        .select("id,client_id,client_name,developer_user_id,developer_email,developer_company,api_environment,rate_limit_tier,is_active,requests_used,monthly_requests_limit,created_at,last_request_at")
        .not("developer_user_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = (appRows || []) as DevApp[];
      setApps(list);

      // Aggregate developer users
      const ids = Array.from(new Set(list.map((a) => a.developer_user_id).filter(Boolean) as string[]));
      let profiles: any[] = [];
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,email,full_name,created_at")
          .in("id", ids);
        profiles = profs || [];
      }
      const counts = new Map<string, number>();
      list.forEach((a) => a.developer_user_id && counts.set(a.developer_user_id, (counts.get(a.developer_user_id) || 0) + 1));
      const devUsers: DevUser[] = ids.map((id) => {
        const p = profiles.find((x) => x.id === id);
        return {
          id,
          email: p?.email ?? list.find((a) => a.developer_user_id === id)?.developer_email ?? null,
          full_name: p?.full_name ?? null,
          created_at: p?.created_at ?? "",
          app_count: counts.get(id) || 0,
        };
      });
      setUsers(devUsers);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load developer data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (app: DevApp) => {
    const { error } = await supabase
      .from("api_clients")
      .update({ is_active: !app.is_active })
      .eq("id", app.id);
    if (error) return toast.error(error.message);
    toast.success(`App ${!app.is_active ? "enabled" : "disabled"}`);
    load();
  };

  const filteredApps = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return apps;
    return apps.filter((a) =>
      [a.client_name, a.client_id, a.developer_email, a.developer_company]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(s))
    );
  }, [apps, q]);

  const filteredUsers = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) =>
      [u.email, u.full_name].filter(Boolean).some((v) => String(v).toLowerCase().includes(s))
    );
  }, [users, q]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Code2}
        title="Developer Management"
        description="Oversee registered developers, their apps, environments, and usage"
      >
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </AdminPageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Developers" value={users.length} />
        <StatCard label="Apps" value={apps.length} />
        <StatCard label="Active Apps" value={apps.filter((a) => a.is_active).length} />
        <StatCard label="Production Apps" value={apps.filter((a) => a.api_environment === "production").length} />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search developers, apps, emails…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="apps">
        <TabsList>
          <TabsTrigger value="apps">Apps ({filteredApps.length})</TabsTrigger>
          <TabsTrigger value="developers">Developers ({filteredUsers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="apps">
          <Card>
            <CardHeader><CardTitle className="text-base">Registered Apps</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App</TableHead>
                    <TableHead>Developer</TableHead>
                    <TableHead>Env</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApps.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.client_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{a.client_id}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{a.developer_email || "—"}</div>
                        {a.developer_company && (
                          <div className="text-xs text-muted-foreground">{a.developer_company}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.api_environment === "production" ? "default" : "secondary"}>
                          {a.api_environment}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant="outline">{a.rate_limit_tier}</Badge></TableCell>
                      <TableCell className="text-sm">
                        {a.requests_used.toLocaleString()} / {a.monthly_requests_limit.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {a.is_active ? (
                          <Badge className="bg-green-600 hover:bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>
                        ) : (
                          <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => toggleActive(a)}>
                          {a.is_active ? "Disable" : "Enable"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filteredApps.length && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {loading ? "Loading…" : "No developer apps found"}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="developers">
          <Card>
            <CardHeader><CardTitle className="text-base">Developers</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Apps</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.full_name || "—"}</TableCell>
                      <TableCell className="text-sm">{u.email || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{u.app_count}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filteredUsers.length && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {loading ? "Loading…" : "No developers found"}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
