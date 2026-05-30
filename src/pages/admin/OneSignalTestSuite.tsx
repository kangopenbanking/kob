import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Bell, Send, UserCheck, ExternalLink, RefreshCw } from "lucide-react";

declare global {
  interface Window {
    OneSignal?: any;
    OneSignalDeferred?: Array<(os: any) => void | Promise<void>>;
  }
}

type LogRow = {
  id: string;
  created_at: string;
  title: string;
  message: string;
  url: string | null;
  onesignal_id: string | null;
  recipients: number | null;
  status: string;
  error: any;
  elapsed_ms: number | null;
  target_external_user_id: string | null;
};

const OneSignalTestSuite: React.FC = () => {
  const [userId, setUserId] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [subscriptionId, setSubscriptionId] = useState<string>("");
  const [optedIn, setOptedIn] = useState<boolean | null>(null);
  const [externalId, setExternalId] = useState<string>("");
  const [permission, setPermission] = useState<string>("");

  const [title, setTitle] = useState("Test push from Kang Admin");
  const [message, setMessage] = useState("If you see this, OneSignal delivery is working end to end.");
  const [deepLink, setDeepLink] = useState(`${window.location.origin}/admin/onesignal-test-suite`);

  const [sending, setSending] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email ?? "");
      }
    })();
    refreshOneSignalState();
    loadLogs();
  }, []);

  async function refreshOneSignalState() {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        setPermission(OneSignal?.Notifications?.permission ? "granted" : (Notification?.permission ?? "default"));
        setOptedIn(Boolean(OneSignal?.User?.PushSubscription?.optedIn));
        setSubscriptionId(OneSignal?.User?.PushSubscription?.id ?? "");
        setExternalId(OneSignal?.User?.externalId ?? "");
      } catch (e) {
        console.warn("[OneSignal] state read failed", e);
      }
    });
  }

  async function loadLogs() {
    setLoadingLogs(true);
    const { data, error } = await supabase
      .from("push_test_log" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    if (!error && data) setLogs(data as unknown as LogRow[]);
    setLoadingLogs(false);
  }

  async function handleRegister() {
    if (!userId) { toast.error("No authenticated user"); return; }
    setRegistering(true);
    try {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        if (!OneSignal) { toast.error("OneSignal SDK unavailable"); return; }
        try {
          // Median bridge fallback for native shell — runs only if median wrapper is loaded.
          const median = (window as any).median;
          if (median?.onesignal?.login) {
            await median.onesignal.login({ externalId: userId, email: userEmail });
          }
          await OneSignal.login(userId);
          if (userEmail && OneSignal.User?.addEmail) await OneSignal.User.addEmail(userEmail);
          if (OneSignal.User?.PushSubscription?.optIn) {
            await OneSignal.User.PushSubscription.optIn();
          } else {
            await OneSignal.Notifications?.requestPermission?.();
          }
          toast.success("Registered with OneSignal as " + userId);
          setTimeout(refreshOneSignalState, 800);
        } catch (e: any) {
          toast.error("OneSignal login failed: " + (e?.message ?? String(e)));
        } finally {
          setRegistering(false);
        }
      });
    } catch (e: any) {
      setRegistering(false);
      toast.error(e?.message ?? "Failed to register");
    }
  }

  async function handleSend(withDeepLink: boolean) {
    if (!userId) { toast.error("Sign in first"); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          external_user_id: userId,
          title,
          message,
          url: withDeepLink ? deepLink : undefined,
          data: { test: true, deep_link: withDeepLink ? deepLink : null },
        },
      });
      if (error) throw error;
      if ((data as any)?.recipients === 0) {
        toast.warning("Sent, but OneSignal reported 0 recipients. Register this device first.");
      } else {
        toast.success(`Notification queued (id: ${(data as any)?.onesignal_id?.slice(0, 8)}…)`);
      }
      setTimeout(loadLogs, 1200);
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally {
      setSending(false);
    }
  }

  const stateBadge = useMemo(() => {
    if (optedIn === null) return <Badge variant="outline">Unknown</Badge>;
    if (optedIn && subscriptionId) return <Badge>Subscribed</Badge>;
    return <Badge variant="destructive">Not subscribed</Badge>;
  }, [optedIn, subscriptionId]);

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">OneSignal Push Test Suite</h1>
        <p className="text-sm text-muted-foreground">
          End-to-end verification: register the current device, send a push, verify delivery,
          and confirm deep-link routing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" /> Step 1 — Register this device
          </CardTitle>
          <CardDescription>
            Calls <code>OneSignal.login(userId)</code> (and <code>median.onesignal.login()</code>{" "}
            inside the native shell) so this browser/device becomes targetable by
            <code> external_user_id</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div><Label>Auth user id</Label><Input value={userId} readOnly /></div>
            <div><Label>Auth email</Label><Input value={userEmail} readOnly /></div>
            <div><Label>OneSignal external id</Label><Input value={externalId} readOnly placeholder="—" /></div>
            <div><Label>OneSignal subscription id</Label><Input value={subscriptionId} readOnly placeholder="—" /></div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">Status: {stateBadge}</span>
            <span className="text-sm text-muted-foreground">Permission: {permission || "—"}</span>
            <Button onClick={handleRegister} disabled={registering || !userId}>
              {registering ? "Registering…" : "Register / Opt in"}
            </Button>
            <Button variant="outline" size="icon" onClick={refreshOneSignalState} aria-label="Refresh state">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> Step 2 — Send a test push</CardTitle>
          <CardDescription>
            Targets <code>external_user_id = {userId || "<your id>"}</code> via the
            <code> send-push-notification</code> edge function.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label>Message</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} /></div>
            <div>
              <Label>Deep link URL</Label>
              <Input value={deepLink} onChange={(e) => setDeepLink(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => handleSend(false)} disabled={sending}>
              <Bell className="mr-2 h-4 w-4" />
              {sending ? "Sending…" : "Send plain notification"}
            </Button>
            <Button variant="outline" onClick={() => handleSend(true)} disabled={sending}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Send with deep link
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 3 — Delivery log</CardTitle>
          <CardDescription>
            Recent sends, OneSignal recipient counts, and error details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={loadLogs} disabled={loadingLogs}>
              <RefreshCw className="mr-2 h-4 w-4" />Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>OneSignal id</TableHead>
                  <TableHead>Deep link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No sends yet.</TableCell></TableRow>
                ) : logs.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(row.created_at).toLocaleString()}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{row.title}</TableCell>
                    <TableCell>
                      {row.status === "sent"
                        ? <Badge>sent</Badge>
                        : <Badge variant="destructive">{row.status}</Badge>}
                    </TableCell>
                    <TableCell>{row.recipients ?? "—"}</TableCell>
                    <TableCell>{row.elapsed_ms ? `${row.elapsed_ms}ms` : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.onesignal_id?.slice(0, 8) ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">{row.url ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OneSignalTestSuite;
