import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";

type Entity = "merchant" | "developer" | "institution";

const TABLE: Record<Entity, string> = {
  merchant: "gateway_merchants",
  developer: "developer_orgs",
  institution: "institutions",
};

interface Props {
  entity: Entity;
  /** Optional entity row id. When omitted the caller's owned row is used. */
  entityId?: string | null;
}

/**
 * Go Live toggle. Disabled until KYB is approved. Enabling flips
 * live_mode_enabled which is required by edge functions to mint
 * production API keys.
 */
export function GoLiveToggle({ entity, entityId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kybStatus, setKybStatus] = useState<string>("not_submitted");
  const [liveMode, setLiveMode] = useState(false);
  const [resolvedId, setResolvedId] = useState<string | null>(entityId ?? null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const table = TABLE[entity];
        let q: any = (supabase as any).from(table).select("id, kyb_status, live_mode_enabled");
        if (entityId) q = q.eq("id", entityId);
        else q = q.eq("user_id", user.id);
        const { data } = await q.maybeSingle();
        if (data) {
          setResolvedId(data.id);
          setKybStatus(data.kyb_status ?? "not_submitted");
          setLiveMode(!!data.live_mode_enabled);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [entity, entityId]);

  const onToggle = async (next: boolean) => {
    if (next && kybStatus !== "approved") {
      toast.error("Complete KYB approval before going live.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("toggle-live-mode", {
        body: { entity, entity_id: resolvedId, enable: next },
      });
      if (error) throw new Error(extractEdgeFunctionError(error, "Failed to update Go Live mode"));
      if (data?.error || data?.detail) throw new Error(data.error || data.detail);
      setLiveMode(next);
      toast.success(next ? "Live mode enabled. You can now create production API keys." : "Live mode disabled.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update Go Live mode");
    } finally {
      setSaving(false);
    }
  };

  const kybBadge =
    kybStatus === "approved" ? <Badge>Approved</Badge>
    : kybStatus === "under_review" ? <Badge variant="secondary">Under Review</Badge>
    : kybStatus === "rejected" ? <Badge variant="destructive">Rejected</Badge>
    : <Badge variant="outline">Not Submitted</Badge>;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Go Live Mode
            </CardTitle>
            <CardDescription>
              Production API keys can only be created when KYB is approved and Go Live mode is enabled.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (
              <Switch checked={liveMode} disabled={saving || kybStatus !== "approved"} onCheckedChange={onToggle} />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">KYB status:</span>
          {kybBadge}
        </div>
        {kybStatus !== "approved" && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" />
            KYB approval required
          </div>
        )}
      </CardContent>
    </Card>
  );
}
