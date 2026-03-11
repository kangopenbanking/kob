import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, TrendingUp, CheckCircle2, Pause, Ban, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

const RISK_COLORS: Record<string, string> = {
  A: "bg-green-500/10 text-green-600", B: "bg-blue-500/10 text-blue-600",
  C: "bg-amber-500/10 text-amber-600", D: "bg-orange-500/10 text-orange-600",
  F: "bg-red-500/10 text-red-600",
};

const STATUS_BADGES: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  suspended: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  revoked: "bg-red-500/10 text-red-600 border-red-500/20",
  pending_approval: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  inactive: "bg-muted text-muted-foreground",
};

export default function InstitutionOverdraft() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<{ type: string; accountId: string; profile: any } | null>(null);
  const [approvedLimit, setApprovedLimit] = useState("");
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);

  useEffect(() => { resolveAndLoad(); }, []);

  const resolveAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: inst } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
    let id = inst?.id;
    if (!id) {
      const { data: staffId } = await supabase.rpc("get_staff_institution_id", { _user_id: user.id });
      id = staffId;
    }
    if (id) { setInstitutionId(id); loadProfiles(id); }
    else setLoading(false);
  };

  const loadProfiles = async (instId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("account_overdraft_profiles")
      .select("*, accounts(account_holder_name, account_id, currency)")
      .eq("institution_id", instId)
      .order("created_at", { ascending: false });
    if (!error) setProfiles(data || []);
    setLoading(false);
  };

  const handleAction = async (type: string, accountId: string) => {
    setActing(true);
    const body: any = { action: type, account_id: accountId };
    if (type === "approve") body.approved_limit = Number(approvedLimit);
    if (type === "reinstate") body.new_limit = Number(approvedLimit) || undefined;
    body.reason = reason;
    body.comments = reason;

    const { data, error } = await supabase.functions.invoke("overdraft-ops", { body });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || "Action failed", variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Overdraft ${type}d successfully` });
      setActionDialog(null);
      if (institutionId) loadProfiles(institutionId);
    }
    setActing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fi-green/10 border border-fi-green/20">
            <TrendingUp className="h-5 w-5 text-fi-green" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Overdraft Management</h1>
            <p className="text-sm text-muted-foreground">Review overdraft eligibility, approve limits, and manage facilities</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => institutionId && loadProfiles(institutionId)} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active", count: profiles.filter(p => p.status === "active").length, color: "text-green-600" },
          { label: "Pending", count: profiles.filter(p => p.status === "pending_approval").length, color: "text-blue-600" },
          { label: "Suspended", count: profiles.filter(p => p.status === "suspended").length, color: "text-amber-600" },
          { label: "Total Profiles", count: profiles.length, color: "text-foreground" },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Overdraft Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No overdraft profiles found. Profiles are created when customers check overdraft eligibility.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Risk Band</TableHead>
                  <TableHead>Recommended</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Utilised</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div>
                        <p className="text-xs font-medium">{(p.accounts as any)?.account_holder_name || "—"}</p>
                        <p className="text-[10px] text-muted-foreground">{(p.accounts as any)?.account_id?.substring(0, 12)}...</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={RISK_COLORS[p.risk_band] || ""}>{p.risk_band || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{Number(p.recommended_limit).toLocaleString()} XAF</TableCell>
                    <TableCell className="text-xs font-medium">{Number(p.approved_limit).toLocaleString()} XAF</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-xs">{Number(p.utilised_amount).toLocaleString()} XAF</p>
                        {p.approved_limit > 0 && (
                          <Progress value={(p.utilised_amount / p.approved_limit) * 100} className="h-1" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGES[p.status] || ""}>{p.status?.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(p.status === "pending_approval" || p.status === "inactive") && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" title="Approve"
                            onClick={() => { setActionDialog({ type: "approve", accountId: p.account_id, profile: p }); setApprovedLimit(String(p.recommended_limit)); setReason(""); }}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {p.status === "active" && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-600" title="Suspend"
                            onClick={() => { setActionDialog({ type: "suspend", accountId: p.account_id, profile: p }); setReason(""); }}>
                            <Pause className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(p.status === "active" || p.status === "suspended") && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" title="Revoke"
                            onClick={() => { setActionDialog({ type: "revoke", accountId: p.account_id, profile: p }); setReason(""); }}>
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(p.status === "suspended" || p.status === "revoked") && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" title="Reinstate"
                            onClick={() => { setActionDialog({ type: "reinstate", accountId: p.account_id, profile: p }); setApprovedLimit(String(p.recommended_limit)); setReason(""); }}>
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{actionDialog?.type} Overdraft</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(actionDialog?.type === "approve" || actionDialog?.type === "reinstate") && (
              <div>
                <label className="text-sm font-medium">Approved Limit (XAF)</label>
                <Input type="number" value={approvedLimit} onChange={e => setApprovedLimit(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Recommended: {Number(actionDialog?.profile?.recommended_limit).toLocaleString()} XAF</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Reason / Comments</label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Provide reason..." />
            </div>
            <Button onClick={() => actionDialog && handleAction(actionDialog.type, actionDialog.accountId)} disabled={acting} className="w-full">
              {acting ? "Processing..." : `Confirm ${actionDialog?.type}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
