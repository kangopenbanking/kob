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
import { Shield, FileText, CheckCircle, XCircle, Clock, ExternalLink, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";

export default function KYCVerificationReview() {
  const [selectedKYC, setSelectedKYC] = useState<any | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected">("approved");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: kycSubmissions, isLoading } = useQuery({
    queryKey: ["kyc-submissions-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kyc_verifications")
        .select("*")
        .is("institution_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const { error } = await supabase
        .from("kyc_verifications")
        .update({ status, updated_at: new Date().toISOString(), rejection_reason: notes })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kyc-submissions"] });
      toast({ title: "KYC Review Complete", description: `Submission has been ${reviewAction}.` });
      setReviewDialogOpen(false);
      setSelectedKYC(null);
      setReviewNotes("");
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleReview = (kyc: any, action: "approved" | "rejected") => {
    setSelectedKYC(kyc);
    setReviewAction(action);
    setReviewDialogOpen(true);
  };

  const submitReview = () => {
    if (selectedKYC) {
      reviewMutation.mutate({ id: selectedKYC.id, status: reviewAction, notes: reviewNotes });
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

  const filterByStatus = (status: string) => kycSubmissions?.filter((kyc) => kyc.status === status) || [];

  const DocButton = ({ url, label }: { url: string | null; label: string }) => (
    <Button
      variant="outline"
      size="sm"
      disabled={!url}
      onClick={() => {
        if (url) {
          if (url.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)) {
            setPreviewUrl(url);
          } else {
            window.open(url, "_blank");
          }
        }
      }}
    >
      <ImageIcon className="h-4 w-4 mr-1" />
      {label}
      {url && <ExternalLink className="h-3 w-3 ml-1" />}
    </Button>
  );

  const KYCCard = ({ kyc }: { kyc: any }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{kyc.first_name} {kyc.last_name}</CardTitle>
            <CardDescription>{kyc.document_type} • {kyc.document_number}</CardDescription>
          </div>
          {getStatusBadge(kyc.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Submitted:</span>
            <span>{format(new Date(kyc.created_at), "PPp")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">User ID:</span>
            <span className="font-mono text-xs">{kyc.user_id?.slice(0, 8)}...</span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <DocButton url={kyc.document_front_url} label="ID Front" />
          <DocButton url={kyc.document_back_url} label="ID Back" />
          <DocButton url={kyc.selfie_url} label="Selfie" />
        </div>

        {kyc.status === "pending" && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={() => handleReview(kyc, "approved")} className="flex-1">
              <CheckCircle className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => handleReview(kyc, "rejected")} className="flex-1">
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
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">KYC Verification Review</h1>
          <p className="text-muted-foreground">Review and approve individual KYC submissions</p>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending ({filterByStatus("pending").length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({filterByStatus("approved").length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({filterByStatus("rejected").length})</TabsTrigger>
          <TabsTrigger value="all">All ({kycSubmissions?.length || 0})</TabsTrigger>
        </TabsList>

        {["pending", "approved", "rejected", "all"].map((status) => (
          <TabsContent key={status} value={status} className="space-y-4">
            {isLoading && status === "pending" ? (
              <p className="text-muted-foreground">Loading submissions...</p>
            ) : (status === "all" ? kycSubmissions : filterByStatus(status))?.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No {status === "all" ? "" : status} KYC submissions</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(status === "all" ? kycSubmissions : filterByStatus(status))?.map((kyc) => (
                  <KYCCard key={kyc.id} kyc={kyc} />
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
            <DialogTitle>{reviewAction === "approved" ? "Approve" : "Reject"} KYC Submission</DialogTitle>
            <DialogDescription>
              {reviewAction === "approved" ? "Approve to verify the user's identity." : "Reject if documents are invalid or fraudulent."}
            </DialogDescription>
          </DialogHeader>
          {selectedKYC && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-semibold">{selectedKYC.first_name} {selectedKYC.last_name}</p>
                <p className="text-sm text-muted-foreground">{selectedKYC.document_type} • {selectedKYC.document_number}</p>
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
