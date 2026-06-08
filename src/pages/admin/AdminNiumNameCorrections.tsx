// Admin review queue for Nium beneficiary-name correction requests.
// Implements maker-checker validation by routing approve/reject actions
// through the `nium-request-name-correction` edge function with stage:
// 'maker' (first reviewer proposes) and stage: 'checker' (second reviewer
// confirms). The edge function rejects same-user maker+checker.
// COMPLIANCE CHECK: name changes only land in profiles.full_name after
// the checker stage approves — the UI cannot bypass this rule.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShieldCheck, CheckCircle2, XCircle, FileText, ExternalLink, UserCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useNameCorrectionRoles } from "@/hooks/useNameCorrectionRoles";

interface CorrectionRequest {
  id: string;
  user_id: string;
  current_full_name: string;
  requested_full_name: string;
  reason: string;
  document_type: string;
  document_number: string | null;
  document_front_url: string;
  document_back_url: string | null;
  selfie_url: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  maker_id: string | null;
  maker_at: string | null;
  maker_decision: "approved" | "rejected" | null;
  maker_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_note: string | null;
  affected_account_ids: string[];
  created_at: string;
}

const STATUS_VARIANT: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-900 border-amber-200" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  rejected: { label: "Rejected", className: "bg-rose-100 text-rose-900 border-rose-200" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

export default function AdminNiumNameCorrections() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CorrectionRequest[]>([]);
  const roles = useNameCorrectionRoles();
  const currentUserId = roles.userId;
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [active, setActive] = useState<CorrectionRequest | null>(null);
  const [stage, setStage] = useState<"maker" | "checker">("maker");
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("nium_name_correction_requests" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error("Failed to load requests", { description: error.message });
      setRows([]);
    } else {
      setRows((data ?? []) as unknown as CorrectionRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => (tab === "pending" ? rows.filter((r) => r.status === "pending") : rows),
    [rows, tab],
  );

  const openReview = (row: CorrectionRequest) => {
    setActive(row);
    // If there is no maker yet, this admin acts as maker. Otherwise as checker.
    const nextStage: "maker" | "checker" = row.maker_id ? "checker" : "maker";
    setStage(nextStage);
    setDecision(row.maker_decision ?? "approved");
    setNote("");
  };

  const sameAsMaker = !!(active && currentUserId && active.maker_id === currentUserId);

  const submit = async () => {
    if (!active) return;
    if (stage === "checker" && sameAsMaker) {
      toast.error("Maker-checker violation", {
        description: "A different admin must perform the checker step.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("nium-request-name-correction", {
        body: {
          action: "decide",
          request_id: active.id,
          stage,
          decision,
          decision_note: note.trim() || undefined,
        },
      });
      if (error || (data as any)?.error) {
        const msg = (data as any)?.error || error?.message || "Action failed";
        toast.error("Could not record decision", { description: msg });
      } else {
        toast.success(
          stage === "maker"
            ? `Maker proposal recorded (${decision})`
            : `Request ${decision}`,
        );
        setActive(null);
        setNote("");
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={ShieldCheck}
        title="Name Correction Requests"
        description="Review beneficiary-name corrections for Nium global accounts. Two different admins must approve every change."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "all")}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            <Badge variant="secondary" className="ml-2">
              {rows.filter((r) => r.status === "pending").length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                No {tab === "pending" ? "pending" : ""} requests.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filtered.map((r) => {
                const variant = STATUS_VARIANT[r.status] ?? STATUS_VARIANT.pending;
                const youAreMaker = !!currentUserId && r.maker_id === currentUserId;
                return (
                  <Card key={r.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <CardTitle className="text-base">
                            {r.current_full_name || "(unset)"}{" "}
                            <span className="text-muted-foreground font-normal">→</span>{" "}
                            <span className="text-primary">{r.requested_full_name}</span>
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Submitted {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })} ·{" "}
                            {r.document_type.replace("_", " ")} ·{" "}
                            {r.affected_account_ids?.length || 0} affected account(s)
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className={variant.className}>
                          {variant.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="rounded-md bg-muted/50 p-3">
                        <div className="font-medium mb-1">Reason</div>
                        <p className="text-muted-foreground">{r.reason}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <a
                          href={r.document_front_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border hover:bg-muted"
                        >
                          <FileText className="h-3 w-3" /> Document front <ExternalLink className="h-3 w-3" />
                        </a>
                        {r.document_back_url && (
                          <a
                            href={r.document_back_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border hover:bg-muted"
                          >
                            <FileText className="h-3 w-3" /> Document back <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {r.selfie_url && (
                          <a
                            href={r.selfie_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border hover:bg-muted"
                          >
                            <FileText className="h-3 w-3" /> Selfie <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      {r.maker_id && (
                        <div className="text-xs flex items-center gap-2 text-muted-foreground">
                          <UserCheck className="h-3.5 w-3.5" />
                          Maker proposed{" "}
                          <span className="font-medium text-foreground">{r.maker_decision}</span>{" "}
                          {r.maker_at && `· ${formatDistanceToNow(new Date(r.maker_at), { addSuffix: true })}`}
                          {youAreMaker && <Badge variant="outline" className="ml-1">you</Badge>}
                          {r.maker_note && <span className="ml-1">· "{r.maker_note}"</span>}
                        </div>
                      )}

                      {r.status === "pending" && (
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={() => {
                              openReview(r);
                              setDecision("approved");
                            }}
                            disabled={youAreMaker && !!r.maker_id}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            {r.maker_id ? "Confirm (Checker)" : "Approve (Maker)"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              openReview(r);
                              setDecision("rejected");
                            }}
                            disabled={youAreMaker && !!r.maker_id}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                          {youAreMaker && (
                            <span className="text-xs text-muted-foreground self-center">
                              Waiting for a second admin to confirm
                            </span>
                          )}
                        </div>
                      )}

                      {r.status !== "pending" && r.decision_note && (
                        <div className="text-xs text-muted-foreground">
                          Decision note: {r.decision_note}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {stage === "maker" ? "Maker decision" : "Checker confirmation"}
            </DialogTitle>
            <DialogDescription>
              {stage === "maker"
                ? "Record your proposed decision. A different admin must confirm before any change takes effect."
                : "Confirm the maker's decision. You cannot confirm a request you reviewed as the maker."}
            </DialogDescription>
          </DialogHeader>

          {active && (
            <div className="space-y-4 text-sm">
              <div className="rounded-md border p-3">
                <div className="text-muted-foreground">Current name</div>
                <div className="font-medium">{active.current_full_name || "(unset)"}</div>
                <div className="text-muted-foreground mt-2">Requested name</div>
                <div className="font-medium text-primary">{active.requested_full_name}</div>
              </div>

              {stage === "checker" && active.maker_decision && active.maker_decision !== decision && (
                <div className="text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-2">
                  Your selected decision differs from the maker's ({active.maker_decision}). The
                  request will be rejected by the server unless decisions match.
                </div>
              )}

              {sameAsMaker && stage === "checker" && (
                <div className="text-xs rounded-md border border-rose-300 bg-rose-50 text-rose-900 p-2">
                  Maker-checker violation: you already acted as maker. A different admin must confirm.
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={decision === "approved" ? "default" : "outline"}
                  onClick={() => setDecision("approved")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant={decision === "rejected" ? "default" : "outline"}
                  onClick={() => setDecision("rejected")}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
              </div>

              <div>
                <Label htmlFor="note">Note (optional, shared with the customer on rejection)</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. Document image is blurry — please resubmit a clearer photo."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setActive(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || (stage === "checker" && sameAsMaker)}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {stage === "maker" ? "Record proposal" : `Confirm ${decision}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
