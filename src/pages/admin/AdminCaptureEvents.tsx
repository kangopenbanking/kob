/**
 * AdminCaptureEvents — admin-only inspector for the
 * `security_capture_events` audit log produced by ScreenshotGuard,
 * SecureField, and the native SecureView plugin.
 *
 * Lets compliance review who has been triggering capture attempts and
 * visibility blurs across the Consumer and Banking apps, scoped by
 * time window and user. Reads use RLS (admin role required).
 */
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Loader2, ShieldAlert, Search, Download } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuthenticatedUser } from "@/hooks/useAuthenticatedUser";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  id: string;
  user_id: string | null;
  app_context: "consumer" | "banking";
  kind: string;
  pathname: string;
  trace_id: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const WINDOWS = [
  { value: "1h", label: "Last 1 hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

function sinceTimestamp(window: string): string {
  const now = Date.now();
  const ms =
    window === "1h" ? 60 * 60 * 1000 :
    window === "24h" ? 24 * 60 * 60 * 1000 :
    window === "7d" ? 7 * 24 * 60 * 60 * 1000 :
    30 * 24 * 60 * 60 * 1000;
  return new Date(now - ms).toISOString();
}

function kindTone(kind: string): "destructive" | "default" | "secondary" {
  if (kind.startsWith("key:") || kind === "copy" || kind === "native:capture_detected") return "destructive";
  if (kind === "contextmenu") return "default";
  return "secondary";
}

export default function AdminCaptureEvents() {
  const { user, loading: userLoading } = useAuthenticatedUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [windowKey, setWindowKey] = useState<typeof WINDOWS[number]["value"]>("24h");
  const [appFilter, setAppFilter] = useState<"all" | "consumer" | "banking">("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [userQuery, setUserQuery] = useState("");

  // Admin role check
  useEffect(() => {
    if (userLoading) return;
    if (!user?.id) { setIsAdmin(false); return; }
    (async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      setIsAdmin(Boolean(data));
    })();
  }, [user?.id, userLoading]);

  // Load rows
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    setLoading(true);
    setErrorMsg(null);
    (async () => {
      let q = supabase
        .from("security_capture_events")
        .select("*")
        .gte("created_at", sinceTimestamp(windowKey))
        .order("created_at", { ascending: false })
        .limit(500);
      if (appFilter !== "all") q = q.eq("app_context", appFilter);
      if (kindFilter !== "all") q = q.eq("kind", kindFilter);
      if (userQuery.trim()) q = q.eq("user_id", userQuery.trim());

      const { data, error } = await q;
      if (!alive) return;
      if (error) {
        setErrorMsg(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as Row[]);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [isAdmin, windowKey, appFilter, kindFilter, userQuery]);

  const kinds = useMemo(() => {
    const s = new Set<string>(rows.map((r) => r.kind));
    return Array.from(s).sort();
  }, [rows]);

  const byUser = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.user_id) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [rows]);

  const exportCsv = () => {
    const header = ["created_at", "app_context", "kind", "pathname", "user_id", "ip_hash", "trace_id"];
    const lines = [header.join(",")].concat(
      rows.map((r) => [
        r.created_at,
        r.app_context,
        r.kind,
        JSON.stringify(r.pathname),
        r.user_id ?? "",
        r.ip_hash ?? "",
        r.trace_id ?? "",
      ].join(",")),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `capture-events-${windowKey}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (userLoading || isAdmin === null) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" strokeWidth={1.75} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
        <h1 className="text-lg font-semibold text-foreground">Admin access required</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          You need the admin role to view the screen-capture audit log.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5">
      <Helmet>
        <title>Capture Events · Admin · Kang</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Capture-attempt audit log</h1>
        <p className="text-sm text-muted-foreground">
          Screenshot key presses, right-clicks, visibility blurs and native capture detections
          across the Consumer and Banking apps.
        </p>
      </header>

      <RetentionCard />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Time window</label>
            <Select value={windowKey} onValueChange={(v) => setWindowKey(v as typeof WINDOWS[number]["value"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WINDOWS.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">App</label>
            <Select value={appFilter} onValueChange={(v) => setAppFilter(v as "all" | "consumer" | "banking")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All apps</SelectItem>
                <SelectItem value="consumer">Consumer</SelectItem>
                <SelectItem value="banking">Banking</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Event kind</label>
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All kinds</SelectItem>
                {kinds.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">User id (uuid)</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
              <Input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="00000000-0000-..."
                className="pl-8"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {loading ? "Loading…" : `${rows.length} event${rows.length === 1 ? "" : "s"} loaded`}
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="mr-2 h-4 w-4" strokeWidth={1.75} />
            Export CSV
          </Button>
        </div>
      </Card>

      {byUser.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Top suspicious users in window</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {byUser.map(([uid, count]) => (
              <li key={uid} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-xs">
                <button
                  type="button"
                  onClick={() => setUserQuery(uid)}
                  className="truncate text-left font-mono text-foreground hover:underline"
                >
                  {uid}
                </button>
                <Badge variant={count >= 10 ? "destructive" : "secondary"}>{count}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-0">
        {errorMsg && (
          <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {errorMsg}
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>App</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Pathname</TableHead>
              <TableHead>User</TableHead>
              <TableHead>IP hash</TableHead>
              <TableHead>Trace</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  No capture events in this window.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs tabular-nums">
                  {format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss")}
                </TableCell>
                <TableCell><Badge variant="outline">{r.app_context}</Badge></TableCell>
                <TableCell><Badge variant={kindTone(r.kind)}>{r.kind}</Badge></TableCell>
                <TableCell className="max-w-[260px] truncate font-mono text-xs" title={r.pathname}>{r.pathname}</TableCell>
                <TableCell className="max-w-[200px] truncate font-mono text-xs" title={r.user_id ?? "anonymous"}>
                  {r.user_id ?? <span className="italic text-muted-foreground">anonymous</span>}
                </TableCell>
                <TableCell className="font-mono text-xs">{r.ip_hash?.slice(0, 10) ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.trace_id?.slice(0, 8) ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
