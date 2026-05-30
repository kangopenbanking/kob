import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RefreshCw, Send, Inbox } from "lucide-react";
import { toast } from "sonner";

interface DLQRow {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  error_message: string | null;
  created_at: string;
}

interface RedeliveryRow {
  id: string;
  original_message_id: string;
  new_message_id: string;
  template_name: string;
  recipient_email: string;
  redelivery_attempt: number;
  triggered_by: string;
  result_status: string | null;
  error_message: string | null;
  created_at: string;
}

export default function EmailDLQReplay() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [replaying, setReplaying] = useState(false);

  const dlqQuery = useQuery({
    queryKey: ["email-dlq-rows"],
    queryFn: async (): Promise<DLQRow[]> => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("id, message_id, template_name, recipient_email, error_message, created_at")
        .eq("status", "dlq")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as DLQRow[];
    },
  });

  const auditQuery = useQuery({
    queryKey: ["email-dlq-audit"],
    queryFn: async (): Promise<RedeliveryRow[]> => {
      const { data, error } = await supabase
        .from("email_dlq_redeliveries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as RedeliveryRow[];
    },
  });

  const rows = useMemo(() => {
    const all = dlqQuery.data ?? [];
    if (!filter.trim()) return all;
    const f = filter.toLowerCase();
    return all.filter(r =>
      r.recipient_email.toLowerCase().includes(f) ||
      r.template_name.toLowerCase().includes(f) ||
      (r.error_message ?? "").toLowerCase().includes(f),
    );
  }, [dlqQuery.data, filter]);

  const allChecked = rows.length > 0 && rows.every(r => r.message_id && selected.has(r.message_id));

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(rows.map(r => r.message_id!).filter(Boolean)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const replay = async (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    setReplaying(true);
    try {
      const body = messageIds.length === 1
        ? { triggered_by: "admin", message_id: messageIds[0] }
        : { triggered_by: "admin", message_ids: messageIds };
      const { data, error } = await supabase.functions.invoke("email-dlq-redelivery", { body });
      if (error) throw error;
      const queued = (data as any)?.queued ?? 0;
      const skipped = (data as any)?.skipped ?? 0;
      toast.success(`Replay complete — ${queued} queued, ${skipped} skipped`);
      setSelected(new Set());
      await Promise.all([dlqQuery.refetch(), auditQuery.refetch()]);
    } catch (e: any) {
      toast.error(e?.message || "Replay failed");
    } finally {
      setReplaying(false);
    }
  };

  const total = rows.length;
  const selectedCount = selected.size;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Email DLQ Replay</h1>
          <p className="text-sm text-muted-foreground">
            Dead-letter queue from the last 7 days. Replay individually or in bulk.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => dlqQuery.refetch()} disabled={dlqQuery.isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${dlqQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">DLQ entries</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Selected</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{selectedCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Recent replays</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{auditQuery.data?.length ?? 0}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Dead-letter queue</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filter recipient / template / error"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="h-9 w-72"
            />
            <Button
              size="sm"
              disabled={selectedCount === 0 || replaying}
              onClick={() => replay(Array.from(selected))}
            >
              <Send className="h-4 w-4 mr-2" />
              Replay {selectedCount > 0 ? `(${selectedCount})` : "selected"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dlqQuery.isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  <Inbox className="h-6 w-6 mx-auto mb-2 opacity-60" />
                  No DLQ entries in the last 7 days.
                </TableCell></TableRow>
              ) : rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox
                      checked={r.message_id ? selected.has(r.message_id) : false}
                      onCheckedChange={() => r.message_id && toggleOne(r.message_id)}
                      disabled={!r.message_id}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">{r.template_name}</TableCell>
                  <TableCell className="text-sm">{r.recipient_email}</TableCell>
                  <TableCell className="max-w-[360px] text-xs text-muted-foreground truncate" title={r.error_message ?? ""}>
                    {r.error_message ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!r.message_id || replaying}
                      onClick={() => r.message_id && replay([r.message_id])}
                    >
                      Replay
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent replay attempts</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditQuery.isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
              ) : (auditQuery.data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No replay history.</TableCell></TableRow>
              ) : (auditQuery.data ?? []).map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{a.template_name}</TableCell>
                  <TableCell className="text-sm">{a.recipient_email}</TableCell>
                  <TableCell>{a.redelivery_attempt}</TableCell>
                  <TableCell><Badge variant="outline">{a.triggered_by}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={a.result_status === "queued" ? "default" : "destructive"}>
                      {a.result_status ?? "—"}
                    </Badge>
                    {a.error_message && (
                      <div className="text-xs text-muted-foreground mt-1 max-w-[280px] truncate" title={a.error_message}>
                        {a.error_message}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
