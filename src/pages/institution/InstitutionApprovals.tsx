import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle2, XCircle, ArrowUpRight, ClipboardList } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  executed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
};

export default function InstitutionApprovals() {
  const { toast } = useToast();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState<{ type: string; id: string } | null>(null);
  const [comments, setComments] = useState("");
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
    if (id) { setInstitutionId(id); loadApprovals(id); }
    else setLoading(false);
  };

  const loadApprovals = async (instId: string) => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("banking-ops", {
      body: { action: "list-approvals", institution_id: instId },
    });
    if (!error && !data?.error) setApprovals(data?.approvals || []);
    setLoading(false);
  };

  const handleAction = async (type: string, approvalId: string) => {
    setActing(true);
    const actionMap: Record<string, string> = { approve: "approve", reject: "reject", escalate: "escalate" };
    const { data, error } = await supabase.functions.invoke("banking-ops", {
      body: { action: actionMap[type], approval_id: approvalId, comments },
    });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || "Action failed", variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Request ${type}d successfully` });
      setActionDialog(null);
      setComments("");
      if (institutionId) loadApprovals(institutionId);
    }
    setActing(false);
  };

  const isPending = (status: string) => status?.startsWith("pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fi-purple/10 border border-fi-purple/20">
            <ClipboardList className="h-5 w-5 text-fi-purple" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Approval Queue</h1>
            <p className="text-sm text-muted-foreground">Review and manage pending withdrawal and overdraft approvals</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => institutionId && loadApprovals(institutionId)} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pending", count: approvals.filter(a => isPending(a.status)).length, color: "text-amber-600" },
          { label: "Approved", count: approvals.filter(a => a.status === "approved" || a.status === "executed").length, color: "text-green-600" },
          { label: "Rejected", count: approvals.filter(a => a.status === "rejected").length, color: "text-red-600" },
          { label: "Total", count: approvals.length, color: "text-foreground" },
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
          <CardTitle className="text-sm">All Approval Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No approval requests found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Required Role</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-xs">{a.request_type?.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[a.status] || "bg-amber-500/10 text-amber-600 border-amber-500/20"}>
                        {a.status?.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{a.required_role?.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{a.reason || "—"}</TableCell>
                    <TableCell className="text-xs">{a.created_at ? format(new Date(a.created_at), "MMM d, HH:mm") : "—"}</TableCell>
                    <TableCell>
                      {isPending(a.status) && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => { setActionDialog({ type: "approve", id: a.id }); setComments(""); }}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => { setActionDialog({ type: "reject", id: a.id }); setComments(""); }}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" onClick={() => { setActionDialog({ type: "escalate", id: a.id }); setComments(""); }}>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
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
            <DialogTitle className="capitalize">{actionDialog?.type} Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Comments</label>
              <Textarea value={comments} onChange={e => setComments(e.target.value)} placeholder="Add comments or reason..." />
            </div>
            <Button onClick={() => actionDialog && handleAction(actionDialog.type, actionDialog.id)} disabled={acting} className="w-full">
              {acting ? "Processing..." : `Confirm ${actionDialog?.type}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
