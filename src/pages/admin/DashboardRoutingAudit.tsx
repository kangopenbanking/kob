import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Mismatch {
  user_id: string;
  email: string;
  has_developer_org: boolean;
  has_developer_role: boolean;
  has_developer_institution: boolean;
  has_merchant: boolean;
  has_merchant_role: boolean;
  has_institution: boolean;
  expected_dashboard: string;
  issues: string[];
}

interface AuditRow {
  id: string;
  user_id: string;
  target_path: string;
  reason: string;
  context: string | null;
  created_at: string;
}

export default function DashboardRoutingAudit() {
  const [mismatches, setMismatches] = useState<Mismatch[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [repairingId, setRepairingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [mm, ar] = await Promise.all([
      supabase.rpc("get_dashboard_mismatches" as any),
      supabase
        .from("dashboard_redirect_audit")
        .select("id,user_id,target_path,reason,context,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (mm.error) toast.error(mm.error.message);
    else setMismatches((mm.data as any) ?? []);
    if (!ar.error) setAudit((ar.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const repair = async (userId: string) => {
    setRepairingId(userId);
    const { data, error } = await supabase.rpc("repair_user_routing" as any, { _user_id: userId });
    setRepairingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Repaired: ${(data as any)?.actions?.join(", ") || "no-op"}`);
    load();
  };

  const repairAll = async () => {
    for (const m of mismatches) await repair(m.user_id);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard Routing Audit</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button onClick={repairAll} disabled={loading || mismatches.length === 0}>
            <Wrench className="h-4 w-4 mr-2" /> Repair all
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mismatches ({mismatches.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : mismatches.length === 0 ? (
            <p className="text-muted-foreground">All users consistent.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Issues</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mismatches.map((m) => (
                  <TableRow key={m.user_id}>
                    <TableCell className="font-mono text-xs">{m.email}</TableCell>
                    <TableCell><Badge variant="outline">{m.expected_dashboard}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.issues.map((i) => <Badge key={i} variant="destructive">{i}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => repair(m.user_id)} disabled={repairingId === m.user_id}>
                        {repairingId === m.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Fix"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent redirects (last 100)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Context</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs">{a.user_id.slice(0, 8)}…</TableCell>
                  <TableCell><Badge variant="outline">{a.target_path}</Badge></TableCell>
                  <TableCell className="text-xs">{a.reason}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.context}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
