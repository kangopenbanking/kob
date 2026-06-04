/**
 * Admin ScreenshotGuard Console
 *
 * - Configure watermark opacity per theme (light / dark) without
 *   redeploying. Values persist to the public
 *   `screenshot_guard_settings` table and are read by every Consumer +
 *   Banking PWA session on next mount.
 * - Inspect recent `guard:render` audit events from
 *   `security_capture_events`, showing which protected routes were
 *   actually rendered for which users.
 *
 * Admin-only — gated by ProtectedRoute requiredRole="admin" upstream.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Save, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const ENDPOINT =
  "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/screenshot-guard-settings";

interface Settings {
  light_opacity: number;
  dark_opacity: number;
  updated_at: string | null;
}

interface RenderRow {
  id: string;
  user_id: string | null;
  app_context: string;
  pathname: string;
  created_at: string;
}

export default function AdminScreenshotGuard() {
  const [settings, setSettings] = useState<Settings>({
    light_opacity: 0.05,
    dark_opacity: 0.03,
    updated_at: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [renders, setRenders] = useState<RenderRow[]>([]);
  const [rendersLoading, setRendersLoading] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(ENDPOINT);
      const data = (await res.json()) as Settings;
      setSettings({
        light_opacity: Number(data.light_opacity ?? 0.05),
        dark_opacity: Number(data.dark_opacity ?? 0.03),
        updated_at: data.updated_at ?? null,
      });
    } catch (e) {
      toast.error("Failed to load settings", { description: String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRenders = useCallback(async () => {
    setRendersLoading(true);
    try {
      const { data, error } = await supabase
        .from("security_capture_events")
        .select("id, user_id, app_context, pathname, created_at")
        .eq("kind", "guard:render")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setRenders(data ?? []);
    } catch (e) {
      toast.error("Failed to load render audit", { description: String(e) });
    } finally {
      setRendersLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); loadRenders(); }, [loadSettings, loadRenders]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Sign in required");
        return;
      }
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          light_opacity: settings.light_opacity,
          dark_opacity: settings.dark_opacity,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as Settings;
      setSettings({
        light_opacity: Number(data.light_opacity),
        dark_opacity: Number(data.dark_opacity),
        updated_at: data.updated_at ?? new Date().toISOString(),
      });
      toast.success("Watermark opacity updated", {
        description: "New values apply on next page mount across all sessions.",
      });
    } catch (e) {
      toast.error("Save failed", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }, [settings.light_opacity, settings.dark_opacity]);

  const pctLight = useMemo(() => Math.round(settings.light_opacity * 1000) / 10, [settings.light_opacity]);
  const pctDark = useMemo(() => Math.round(settings.dark_opacity * 1000) / 10, [settings.dark_opacity]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="ScreenshotGuard"
        description="Configure the forensic watermark overlay applied on financial pages."
        icon={ShieldCheck}
      />

      <Card>
        <CardHeader>
          <CardTitle>Watermark opacity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="light">Light theme ({pctLight}%)</Label>
              <Input
                id="light"
                type="range"
                min={0}
                max={0.3}
                step={0.005}
                value={settings.light_opacity}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, light_opacity: Number(e.target.value) }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Recommended range 0.03 – 0.10. Below 0.03 may be invisible on bright displays.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dark">Dark theme ({pctDark}%)</Label>
              <Input
                id="dark"
                type="range"
                min={0}
                max={0.3}
                step={0.005}
                value={settings.dark_opacity}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, dark_opacity: Number(e.target.value) }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Recommended range 0.02 – 0.08. Dark mode uses screen blend so values are usually lower.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving || loading}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving…" : "Save settings"}
            </Button>
            <Button variant="outline" onClick={loadSettings} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reload
            </Button>
            {settings.updated_at && (
              <span className="text-xs text-muted-foreground">
                Last updated: {new Date(settings.updated_at).toLocaleString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent guard renders</CardTitle>
          <Button size="sm" variant="outline" onClick={loadRenders} disabled={rendersLoading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No guard:render events recorded yet.
                  </TableCell>
                </TableRow>
              )}
              {renders.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline">{r.app_context}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{r.pathname}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.user_id ? r.user_id.slice(0, 8) + "…" : "anon"}
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
