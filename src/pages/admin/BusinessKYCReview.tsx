import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, FileText, ExternalLink, CheckCircle, XCircle, Clock, Users, ImageIcon } from "lucide-react";
import { format } from "date-fns";

export default function BusinessKYCReview() {
  const [selectedKYB, setSelectedKYB] = useState<any | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected">("approved");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: kybSubmissions, isLoading } = useQuery({
    queryKey: ["business-kyc-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_kyc")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const { error } = await supabase
        .from("business_kyc")
        .update({ verification_status: status, updated_at: new Date().toISOString(), rejection_reason: notes })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-kyc-submissions"] });
      toast({ title: "Business KYC Review Complete", description: `Submission has been ${reviewAction}.` });
      setReviewDialogOpen(false);
      setSelectedKYB(null);
      setReviewNotes("");
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleReview = (kyb: any, action: "approved" | "rejected") => {
    setSelectedKYB(kyb);
    setReviewAction(action);
    setReviewDialogOpen(true);
  };

  const submitReview = () => {
    if (selectedKYB) {
      reviewMutation.mutate({ id: selectedKYB.id, status: reviewAction, notes: reviewNotes });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary", approved: "default", rejected: "destructive",
    };
    const icons = {
      pending: <Clock className="h-3 w-3 mr-1" />,
      approved: <CheckCircle className="h-3 w-3 mr-1" />,
      rejected: <XCircle className="h-3 w-3 mr-1" />,
    };
    return (
      <Badge variant={variants[status] || "outline"} className="flex items-center w-fit">
        {icons[status as keyof typeof icons]}{status?.toUpperCase()}
      </Badge>
    );
  };

  const filterByStatus = (status: string) => kybSubmissions?.filter((kyb) => kyb.verification_status === status) || [];

  const DocButton = ({ url, label }: { url: string | null; label: string }) => (
    <Button
      variant="outline"
      size="sm"
      disabled={!url}
      onClick={() => {
        if (url) {
          // Check if it's an image to preview inline
          if (url.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)) {
            setPreviewUrl(url);
          } else {
            window.open(url, "_blank");
          }
        }
      }}
    >
      <FileText className="h-4 w-4 mr-1" />
      {label}
      {url && <ExternalLink className="h-3 w-3 ml-1" />}
    </Button>
  );

  const KYBCard = ({ kyb }: { kyb: any }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{kyb.business_name}</CardTitle>
            <CardDescription>{kyb.business_type} • {kyb.registration_number}</CardDescription>
          </div>
          {getStatusBadge(kyb.verification_status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Submitted:</span>
            <span>{format(new Date(kyb.created_at), "PPp")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Account ID:</span>
            <span className="font-mono text-xs">{kyb.account_id?.slice(0, 8) || "N/A"}...</span>
          </div>
          {kyb.beneficial_owners && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{Array.isArray(kyb.beneficial_owners) ? kyb.beneficial_owners.length : 0} Beneficial Owners</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <DocButton url={kyb.registration_certificate_url} label="Certificate" />
          <DocButton url={kyb.articles_of_association_url} label="Articles" />
          <DocButton url={kyb.tax_certificate_url} label="Tax Cert" />
          <DocButton url={kyb.proof_of_address_url} label="Address Proof" />
          <DocButton url={kyb.bank_statement_url} label="Bank Stmt" />
        </div>

        {kyb.verification_status === "pending" && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={() => handleReview(kyb, "approved")} className="flex-1">
              <CheckCircle className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => handleReview(kyb, "rejected")} className="flex-1">
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Business KYC (KYB) Review</h1>
          <p className="text-muted-foreground">Review and approve business KYC submissions</p>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending ({filterByStatus("pending").length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({filterByStatus("approved").length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({filterByStatus("rejected").length})</TabsTrigger>
          <TabsTrigger value="all">All ({kybSubmissions?.length || 0})</TabsTrigger>
        </TabsList>

        {["pending", "approved", "rejected", "all"].map((status) => (
          <TabsContent key={status} value={status} className="space-y-4">
            {isLoading && status === "pending" ? (
              <p className="text-muted-foreground">Loading submissions...</p>
            ) : (status === "all" ? kybSubmissions : filterByStatus(status))?.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No {status === "all" ? "" : status} business KYC submissions</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(status === "all" ? kybSubmissions : filterByStatus(status))?.map((kyb) => (
                  <KYBCard key={kyb.id} kyb={kyb} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewAction === "approved" ? "Approve" : "Reject"} Business KYC</DialogTitle>
            <DialogDescription>
              {reviewAction === "approved" ? "Approve this business KYC submission." : "Reject if documents are invalid or incomplete."}
            </DialogDescription>
          </DialogHeader>
          {selectedKYB && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-semibold">{selectedKYB.business_name}</p>
                <p className="text-sm text-muted-foreground">{selectedKYB.business_type} • {selectedKYB.registration_number}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-notes">Review Notes</Label>
                <Textarea id="review-notes" placeholder="Add notes..." value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={4} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitReview} variant={reviewAction === "approved" ? "default" : "destructive"}>
              {reviewAction === "approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img src={previewUrl} alt="Document" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
