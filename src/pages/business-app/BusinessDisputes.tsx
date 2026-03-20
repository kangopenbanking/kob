import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantContext } from "@/contexts/MerchantContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert, Upload, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function BusinessDisputes() {
  const navigate = useNavigate();
  const { merchantId } = useMerchantContext();
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [evidence, setEvidence] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: disputes, isLoading, refetch } = useQuery({
    queryKey: ["biz-disputes", merchantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("gateway_disputes" as any)
        .select("*")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data as any[]) || [];
    },
    enabled: !!merchantId,
  });

  const submitEvidence = async () => {
    if (!selectedDispute || !evidence.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("gateway-submit-dispute-evidence", {
        body: { dispute_id: selectedDispute.id, merchant_id: merchantId, evidence_text: evidence },
      });
      if (error) throw error;
      toast({ title: "Evidence submitted", description: "Your dispute response has been recorded." });
      setEvidence("");
      setSelectedDispute(null);
      refetch();
    } catch (err: any) {
      toast({ title: "Failed to submit", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (s: string) => {
    if (s === "won") return "default";
    if (s === "lost") return "destructive";
    if (s === "under_review" || s === "evidence_submitted") return "secondary";
    return "outline";
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl font-bold">Disputes</h1>
          <p className="text-sm text-muted-foreground">Manage chargebacks & respond with evidence</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : !disputes?.length ? (
        <Card><CardContent className="py-12 text-center">
          <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No disputes</p>
          <p className="text-sm text-muted-foreground mt-1">You're in good shape — no chargebacks or disputes on file.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {disputes.map((d: any) => (
            <Card key={d.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{d.reason || "Chargeback"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {d.currency || "XAF"} {Number(d.amount || 0).toLocaleString()} · {d.created_at ? format(new Date(d.created_at), "MMM d, yyyy") : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">Charge: {d.charge_id?.slice(0, 8) || "—"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant={statusColor(d.status)}>{(d.status || "open").replace(/_/g, " ")}</Badge>
                    {d.status !== "won" && d.status !== "lost" && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setSelectedDispute(d)}>
                            <Upload className="h-3 w-3" /> Respond
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Submit Evidence</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">Provide evidence to challenge this dispute. Include order details, delivery proof, or communication records.</p>
                            <div><Label>Evidence</Label><Textarea value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="Describe your evidence and attach relevant details..." rows={5} /></div>
                            <Button className="w-full" onClick={submitEvidence} disabled={submitting || !evidence.trim()}>
                              {submitting ? "Submitting..." : "Submit Evidence"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
