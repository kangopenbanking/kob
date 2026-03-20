import { ConnectorPageHeader } from "@/components/institution/connector/ConnectorPageHeader";
import { StatusBadge } from "@/components/institution/connector/StatusBadge";
import { ConnectorEmptyState } from "@/components/institution/connector/ConnectorEmptyState";
import { useBankConnector } from "@/hooks/useBankConnector";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollText, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function ConnectorAudit() {
  const { bankId, loading: bankLoading } = useBankConnector();

  const { data: uploads } = useQuery({
    queryKey: ["connector-audit-uploads", bankId],
    queryFn: async () => {
      if (!bankId) return [];
      const { data } = await supabase
        .from("bank_file_uploads")
        .select("id, file_type, original_filename, status, received_at, uploaded_by, uploader_user_id, correlation_id")
        .eq("bank_id", bankId)
        .order("received_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!bankId,
  });

  const { data: runs } = useQuery({
    queryKey: ["connector-audit-runs", bankId],
    queryFn: async () => {
      if (!bankId) return [];
      const { data } = await supabase
        .from("ingestion_runs")
        .select("id, status, started_at, finished_at, totals_json, correlation_id, file_id")
        .eq("bank_id", bankId)
        .order("started_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!bankId,
  });

  // Merge into unified audit trail
  type AuditEntry = { time: string; actor: string; action: string; entity: string; entityId: string; result: string; correlationId: string | null };

  const auditEntries: AuditEntry[] = [
    ...(uploads?.map((u) => ({
      time: u.received_at,
      actor: u.uploaded_by,
      action: "file_upload",
      entity: `${u.file_type} file`,
      entityId: u.id,
      result: u.status,
      correlationId: u.correlation_id,
    })) ?? []),
    ...(runs?.map((r) => ({
      time: r.started_at ?? "",
      actor: "system",
      action: "ingestion_run",
      entity: "ingestion",
      entityId: r.id,
      result: r.status,
      correlationId: r.correlation_id,
    })) ?? []),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const isLoading = !uploads && !runs;

  if (bankLoading) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={ScrollText} title="Audit Log" description="Loading..." />
        <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!bankId) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={ScrollText} title="Audit Log" description="Trace connector actions for compliance" />
        <ConnectorEmptyState icon={ScrollText} title="No Bank Connected" description="Link a bank profile to view audit logs." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConnectorPageHeader icon={ScrollText} title="Audit Log" description="Complete activity trail for connector operations" />

      <Card>
        <CardContent className="p-0">
          {auditEntries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Time</th>
                    <th className="text-left p-3 font-medium">Actor</th>
                    <th className="text-left p-3 font-medium">Action</th>
                    <th className="text-left p-3 font-medium">Entity</th>
                    <th className="text-left p-3 font-medium">Result</th>
                    <th className="text-left p-3 font-medium">Correlation ID</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.map((e, i) => (
                    <tr key={`${e.entityId}-${i}`} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 whitespace-nowrap">{e.time ? format(new Date(e.time), "MMM d, HH:mm:ss") : "—"}</td>
                      <td className="p-3 capitalize">{e.actor}</td>
                      <td className="p-3">{e.action.replace(/_/g, " ")}</td>
                      <td className="p-3">{e.entity}</td>
                      <td className="p-3"><StatusBadge status={e.result} /></td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{e.correlationId?.slice(0, 12) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ConnectorEmptyState
              icon={ScrollText}
              title="No Audit Entries"
              description="Actions like file uploads, ingestion runs, and batch operations will appear here."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
