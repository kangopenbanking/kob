import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Key, FileText, ExternalLink, CheckCircle, XCircle, Clock, Shield } from "lucide-react";
import { format } from "date-fns";

interface TPPRegistration {
  id: string;
  client_id: string;
  client_name: string;
  institution_id: string;
  tpp_roles?: string[];
  environment: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function TPPRegistrationReview() {
  const [selectedTPP, setSelectedTPP] = useState<TPPRegistration | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected">("approved");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tppRegistrations, isLoading } = useQuery({
    queryKey: ["tpp-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tpp_registrations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TPPRegistration[];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: boolean; notes: string }) => {
      const { error } = await supabase
        .from("tpp_registrations")
        .update({ 
          is_active: status, 
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tpp-registrations"] });
      toast({
        title: "TPP Review Complete",
        description: `TPP registration has been ${reviewAction}.`,
      });
      setReviewDialogOpen(false);
      setSelectedTPP(null);
      setReviewNotes("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleReview = (tpp: TPPRegistration, action: "approved" | "rejected") => {
    setSelectedTPP(tpp);
    setReviewAction(action);
    setReviewDialogOpen(true);
  };

  const submitReview = () => {
    if (selectedTPP) {
      reviewMutation.mutate({
        id: selectedTPP.id,
        status: reviewAction === "approved",
        notes: reviewNotes,
      });
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge variant={isActive ? "default" : "secondary"} className="flex items-center w-fit">
        {isActive ? <CheckCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
        {isActive ? "ACTIVE" : "INACTIVE"}
      </Badge>
    );
  };

  const filterByStatus = (status: string) => {
    if (status === "all") return tppRegistrations || [];
    if (status === "approved") return tppRegistrations?.filter((tpp) => tpp.is_active) || [];
    return tppRegistrations?.filter((tpp) => !tpp.is_active) || [];
  };

  const TPPCard = ({ tpp }: { tpp: TPPRegistration }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{tpp.client_name}</CardTitle>
            <CardDescription>
              {tpp.environment} • {tpp.client_id.slice(0, 12)}...
            </CardDescription>
          </div>
          {getStatusBadge(tpp.is_active)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span>{format(new Date(tpp.created_at), "PPp")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Institution:</span>
            <span className="font-mono text-xs">{tpp.institution_id?.slice(0, 8)}...</span>
          </div>
          {tpp.tpp_roles && tpp.tpp_roles.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Roles:</span>
              <div className="flex gap-1 flex-wrap">
                {tpp.tpp_roles.map((role, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {!tpp.is_active && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => handleReview(tpp, "approved")}
              className="flex-1"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Activate
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleReview(tpp, "rejected")}
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Deactivate
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Key className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">TPP Registration Review</h1>
            <p className="text-muted-foreground">
              Review and approve Third Party Provider registrations
            </p>
          </div>
        </div>

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">
              Pending ({filterByStatus("pending").length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved ({filterByStatus("approved").length})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected ({filterByStatus("rejected").length})
            </TabsTrigger>
            <TabsTrigger value="all">
              All ({tppRegistrations?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {isLoading ? (
              <p className="text-muted-foreground">Loading registrations...</p>
            ) : filterByStatus("pending").length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No pending TPP registrations</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filterByStatus("pending").map((tpp) => (
                  <TPPCard key={tpp.id} tpp={tpp} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filterByStatus("approved").map((tpp) => (
                <TPPCard key={tpp.id} tpp={tpp} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filterByStatus("rejected").map((tpp) => (
                <TPPCard key={tpp.id} tpp={tpp} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tppRegistrations?.map((tpp) => (
                <TPPCard key={tpp.id} tpp={tpp} />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {reviewAction === "approved" ? "Approve" : "Reject"} TPP Registration
              </DialogTitle>
              <DialogDescription>
                {reviewAction === "approved"
                  ? "Approve this TPP registration to grant API access."
                  : "Reject this TPP registration if certificates are invalid or incomplete."}
              </DialogDescription>
            </DialogHeader>

            {selectedTPP && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-semibold">{selectedTPP.client_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTPP.environment} • {selectedTPP.client_id}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="review-notes">Review Notes</Label>
                  <Textarea
                    id="review-notes"
                    placeholder="Add notes about your decision..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={submitReview}
                variant={reviewAction === "approved" ? "default" : "destructive"}
              >
                {reviewAction === "approved" ? "Approve" : "Reject"}
              </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
);
}
