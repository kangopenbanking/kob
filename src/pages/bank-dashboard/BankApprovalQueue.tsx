import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Clock } from "lucide-react";

export default function BankApprovalQueue() {
  const { data: requests } = useQuery({
    queryKey: ["approval-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("approval_requests")
        .select("*")
        .in("status", ["submitted", "pending_assistant_manager", "pending_branch_manager"])
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Approval Queue</h1>
        <p className="text-muted-foreground">Review and approve pending transactions for Manual Console connector banks</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border border-border/50">
          <CardContent className="pt-6 text-center">
            <Clock className="mx-auto h-8 w-8 text-yellow-500" />
            <p className="mt-2 text-2xl font-bold">{requests?.filter(r => r.status === "pending").length || 0}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="border border-border/50">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-2 text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Approved Today</p>
          </CardContent>
        </Card>
        <Card className="border border-border/50">
          <CardContent className="pt-6 text-center">
            <XCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-2xl font-bold">0</p>
            <p className="text-sm text-muted-foreground">Rejected Today</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          {!requests?.length ? (
            <p className="text-center text-sm text-muted-foreground py-8">No pending approvals at this time.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((req: any) => (
                <div key={req.id} className="flex items-center justify-between rounded-lg border border-border/30 p-4">
                  <div>
                    <p className="font-medium text-sm">{req.request_type?.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">Entity: {req.entity_type} -- {req.entity_id?.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={req.status === "pending" ? "secondary" : "default"}>{req.status}</Badge>
                    <Button size="sm" variant="outline">
                      <CheckCircle className="mr-1 h-3.5 w-3.5" />
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
