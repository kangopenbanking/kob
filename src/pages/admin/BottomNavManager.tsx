import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Save, RotateCcw, Layout, Upload, Loader2, X } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { NAV_ICON_OPTIONS, parseNavIcon } from "@/lib/lucideIconMap";
import { NavIcon } from "@/components/nav/NavIcon";
import { cn } from "@/lib/utils";
import { adminStorageUpload } from "@/lib/admin/adminStorageUpload";
import type { BottomNavApp, BottomNavItem } from "@/hooks/useBottomNavItems";
import { DEFAULT_NAV_ITEMS } from "@/hooks/useBottomNavItems";

type DraftItem = Omit<BottomNavItem, "id"> & { id?: string; _isNew?: boolean };

const APPS: { value: BottomNavApp; label: string }[] = [
  { value: "customer", label: "Customer" },
  { value: "business", label: "Business" },
  { value: "banking", label: "Banking" },
];

export default function BottomNavManager() {
  const { toast } = useToast();
  const [app, setApp] = useState<BottomNavApp>("customer");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<DraftItem | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bottom_nav_items")
      .select("*")
      .eq("app", app)
      .order("position", { ascending: true });
    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    } else {
      setItems((data as DraftItem[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [app]);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next.map((it, i) => ({ ...it, position: i })));
  };

  const toggle = (idx: number) => {
    const next = [...items];
    next[idx] = { ...next[idx], is_enabled: !next[idx].is_enabled };
    setItems(next);
  };

  const addNew = () => {
    setEditing({
      app, label: "New", icon: "Circle", path: "/app/new",
      position: items.length, is_center: false, is_enabled: true,
      badge_key: null, required_role: null, _isNew: true,
    });
    setEditingIdx(null);
  };

  const openEdit = (idx: number) => {
    setEditing({ ...items[idx] });
    setEditingIdx(idx);
  };

  const applyEdit = () => {
    if (!editing) return;
    const next = [...items];
    if (editing._isNew) next.push({ ...editing, _isNew: false });
    else if (editingIdx !== null) next[editingIdx] = editing;
    setItems(next.map((it, i) => ({ ...it, position: i })));
    setEditing(null);
    setEditingIdx(null);
  };

  const remove = (idx: number) => {
    const next = items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, position: i }));
    setItems(next);
  };

  const resetToDefaults = () => {
    const defaults = DEFAULT_NAV_ITEMS[app];
    if (!defaults.length) {
      toast({ title: "No defaults", description: `No built-in defaults for ${app} yet.` });
      return;
    }
    setItems(defaults.map(({ id, ...rest }) => ({ ...rest, _isNew: true })));
  };

  const save = async () => {
    setSaving(true);
    try {
      const { error: delErr } = await supabase
        .from("bottom_nav_items")
        .delete()
        .eq("app", app);
      if (delErr) throw delErr;
      if (items.length > 0) {
        const rows = items.map((it, i) => ({
          app,
          label: it.label,
          icon: it.icon,
          path: it.path,
          position: i,
          is_center: it.is_center,
          is_enabled: it.is_enabled,
          badge_key: it.badge_key,
          required_role: it.required_role,
        }));
        const { error: insErr } = await supabase.from("bottom_nav_items").insert(rows);
        if (insErr) throw insErr;
      }
      toast({ title: "Navigation saved", description: `${items.length} items updated for ${app}.` });
      await load();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const centerCount = useMemo(() => items.filter((i) => i.is_center).length, [items]);

  return (
    <div className="space-y-6 p-6">
      <AdminPageHeader
        title="Bottom Navigation Manager"
        description="Configure the mobile bottom navigation bar across Customer, Business, and Banking apps."
        icon={Layout}
      />

      <Tabs value={app} onValueChange={(v) => setApp(v as BottomNavApp)}>
        <TabsList>
          {APPS.map((a) => (
            <TabsTrigger key={a.value} value={a.value}>{a.label}</TabsTrigger>
          ))}
        </TabsList>

        {APPS.map((a) => (
          <TabsContent key={a.value} value={a.value} className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={addNew}><Plus className="h-4 w-4 mr-1" />Add item</Button>
                <Button variant="outline" onClick={resetToDefaults}><RotateCcw className="h-4 w-4 mr-1" />Load defaults</Button>
              </div>
              <div className="flex items-center gap-2">
                {centerCount > 1 && (
                  <Badge variant="destructive">Multiple center items — only one is recommended</Badge>
                )}
                <Button onClick={save} disabled={saving || loading}>
                  <Save className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">Items ({items.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
                  {!loading && items.length === 0 && (
                    <div className="text-sm text-muted-foreground">No items configured. Use "Add item" or "Load defaults".</div>
                  )}
                  {items.map((it, idx) => {
                    return (
                      <div key={(it.id || "new") + idx} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                        <div className="flex flex-col">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(idx, -1)} disabled={idx === 0}>
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(idx, 1)} disabled={idx === items.length - 1}>
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                        <button onClick={() => openEdit(idx)} className="flex items-center gap-3 flex-1 text-left">
                          <NavIcon icon={it.icon} className="h-5 w-5 text-foreground" />
                          <div>
                            <div className="text-sm font-medium">{it.label}</div>
                            <div className="text-xs text-muted-foreground">{it.path}</div>
                          </div>
                        </button>
                        {it.is_center && <Badge variant="secondary">Center</Badge>}
                        <Switch checked={it.is_enabled} onCheckedChange={() => toggle(idx)} />
                        <Button size="icon" variant="ghost" onClick={() => openEdit(idx)} aria-label={`Edit ${it.label}`}>
                          {it.is_enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(idx)} aria-label={`Delete ${it.label}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Live preview</CardTitle></CardHeader>
                <CardContent>
                  <div className="mx-auto w-full max-w-xs rounded-3xl border bg-background p-2">
                    <div className="h-72 rounded-2xl bg-muted/30 flex items-end">
                      <div className="w-full border-t bg-background rounded-b-2xl">
                        <div className="flex h-16 items-center justify-around px-1">
                          {items.filter((i) => i.is_enabled).map((it) => {
                            if (it.is_center) {
                              return (
                                <div key={it.id || it.label} className="flex flex-col items-center -mt-6">
                                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow">
                                    <NavIcon icon={it.icon} className="h-5 w-5 text-primary-foreground" />
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div key={it.id || it.label} className="flex flex-1 flex-col items-center gap-0.5">
                                <NavIcon icon={it.icon} className="h-5 w-5 text-foreground" />
                                <span className="text-[9px] font-medium">{it.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?._isNew ? "Add item" : "Edit item"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Path</Label>
                <Input value={editing.path} onChange={(e) => setEditing({ ...editing, path: e.target.value })} placeholder="/app/home" />
              </div>
              <IconPicker value={editing.icon} onChange={(v) => setEditing({ ...editing, icon: v })} />
              <div className="space-y-2">
                <Label>Badge key (optional)</Label>
                <Input value={editing.badge_key || ""} onChange={(e) => setEditing({ ...editing, badge_key: e.target.value || null })} placeholder="unread_alerts" />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="is_center">Center (raised FAB)</Label>
                <Switch id="is_center" checked={editing.is_center} onCheckedChange={(v) => setEditing({ ...editing, is_center: v })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="is_enabled">Visible</Label>
                <Switch id="is_enabled" checked={editing.is_enabled} onCheckedChange={(v) => setEditing({ ...editing, is_enabled: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={applyEdit}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icon picker — supports Lucide, Font Awesome 4, Flaticon Uicons,    */
/* and uploaded images                                                 */
/* ------------------------------------------------------------------ */

const FA4_SUGGESTIONS: string[] = [
  "home", "user", "users", "cog", "bell", "credit-card", "money", "bank",
  "shopping-cart", "shopping-bag", "search", "qrcode", "camera", "calendar",
  "comment", "envelope", "heart", "star", "tag", "tags", "th", "th-list",
  "bar-chart", "line-chart", "pie-chart", "lock", "unlock", "key", "wrench",
  "gift", "globe", "map-marker", "phone", "rocket", "trophy", "shield",
];

type FlaticonStyleKey = "rs" | "ss" | "bs" | "rr" | "sr" | "br";

const FLATICON_STYLE_OPTIONS: { value: FlaticonStyleKey; label: string }[] = [
  { value: "rs", label: "Regular Straight" },
  { value: "ss", label: "Solid Straight" },
  { value: "bs", label: "Bold Straight" },
  { value: "rr", label: "Regular Rounded" },
  { value: "sr", label: "Solid Rounded" },
  { value: "br", label: "Bold Rounded" },
];

const FLATICON_CATEGORIES: { label: string; icons: string[] }[] = [
  {
    label: "Home",
    icons: ["home", "home-location", "house-blank", "house-chimney", "apps", "menu-burger", "dashboard", "grid", "list", "settings"],
  },
  {
    label: "Finance",
    icons: ["wallet", "money", "money-bill-wave", "money-bills", "coins", "piggy-bank", "sack-dollar", "credit-card", "bank", "hand-holding-usd", "chart-line-up", "money-check-edit"],
  },
  {
    label: "Transfer",
    icons: ["paper-plane", "transfer-alt", "arrow-up-from-square", "arrow-down-to-square", "arrows-repeat", "exchange-alt", "arrow-right-arrow-left", "share", "qrcode", "barcode-scan", "scanner"],
  },
  {
    label: "Analytics",
    icons: ["chart-pie", "chart-pie-alt", "chart-line-up", "chart-histogram", "stats", "trending-up", "analyse", "presentation", "gauge", "speedometer"],
  },
  {
    label: "Comms",
    icons: ["bell", "bell-ring", "envelope", "comment", "comments", "chat-arrow-grow", "phone-call", "phone-flip", "headset", "paper-plane-top", "megaphone"],
  },
  {
    label: "Security",
    icons: ["lock", "unlock", "lock-alt", "shield", "shield-check", "shield-keyhole", "key", "fingerprint", "user-shield", "eye", "eye-crossed"],
  },
  {
    label: "Account",
    icons: ["user", "users", "user-add", "circle-user", "id-badge", "id-card-clip-alt", "address-card", "user-pen", "user-headset", "portrait"],
  },
  {
    label: "Commerce",
    icons: ["shopping-bag", "shopping-cart", "store-alt", "receipt", "invoice", "tags", "tag", "gift", "ticket-alt", "box-open", "truck-side"],
  },
  {
    label: "Misc",
    icons: ["search", "calendar", "globe", "marker", "rocket", "trophy", "star", "heart", "bookmark", "camera", "settings-sliders", "filter", "refresh"],
  },
];

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseNavIcon(value);
  const [tab, setTab] = useState<"lucide" | "fa4" | "flaticon" | "image">(parsed.kind);
  const [flStyle, setFlStyle] = useState<FlaticonStyleKey>(
    (parsed.kind === "flaticon" ? parsed.style ?? "rs" : "rs") as FlaticonStyleKey,
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    if (file.size > 1 * 1024 * 1024) {
      toast({ title: "File too large", description: "Icons must be under 1MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { publicUrl } = await adminStorageUpload({
        bucket: "nav-icons",
        path,
        file,
        contentType: file.type,
        upsert: false,
      });
      onChange(`url:${publicUrl}`);
      toast({ title: "Icon uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Icon</Label>
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-background border">
          <NavIcon icon={value} className="h-5 w-5 text-foreground" />
        </div>
        <div className="text-xs text-muted-foreground break-all">{value || "(none)"}</div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="lucide">Lucide</TabsTrigger>
          <TabsTrigger value="fa4">FA 4</TabsTrigger>
          <TabsTrigger value="flaticon">Flaticon</TabsTrigger>
          <TabsTrigger value="image">Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="lucide" className="space-y-2">
          <Select
            value={parsed.kind === "lucide" ? parsed.value : "Home"}
            onValueChange={(v) => onChange(v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {NAV_ICON_OPTIONS.map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TabsContent>

        <TabsContent value="fa4" className="space-y-2">
          <Input
            placeholder="e.g. user (renders fa-user)"
            value={parsed.kind === "fa4" ? parsed.value : ""}
            onChange={(e) => onChange(`fa:${e.target.value.replace(/^fa-/, "").trim()}`)}
          />
          <p className="text-xs text-muted-foreground">
            Enter any Font Awesome 4 name without the <code>fa-</code> prefix.
          </p>
          <div className="grid grid-cols-6 gap-2 max-h-44 overflow-y-auto pr-1">
            {FA4_SUGGESTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(`fa:${n}`)}
                className="flex flex-col items-center gap-1 rounded-md border bg-background p-2 hover:bg-muted text-xs"
              >
                <i className={`fa fa-${n}`} style={{ fontSize: "1rem" }} aria-hidden="true" />
                <span className="truncate w-full text-center text-[10px]">{n}</span>
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="flaticon" className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={flStyle}
              onValueChange={(v) => {
                const s = v as FlaticonStyleKey;
                setFlStyle(s);
                if (parsed.kind === "flaticon" && parsed.value) {
                  onChange(`fl:${s}:${parsed.value}`);
                }
              }}
            >
              <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FLATICON_STYLE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="e.g. wallet"
              value={parsed.kind === "flaticon" ? parsed.value : ""}
              onChange={(e) => {
                const name = e.target.value.replace(/^fi\s+fi-[a-z]{2}-/, "").trim();
                onChange(`fl:${flStyle}:${name}`);
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Pick a weight/style, then choose an icon. Renders as <code>fi fi-{flStyle}-{`{name}`}</code>.
          </p>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {FLATICON_CATEGORIES.map((cat) => (
              <div key={cat.label} className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {cat.label}
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {cat.icons.map((n) => {
                    const selected =
                      parsed.kind === "flaticon" && parsed.value === n && (parsed.style ?? "rs") === flStyle;
                    return (
                      <button
                        key={`${cat.label}-${n}`}
                        type="button"
                        onClick={() => onChange(`fl:${flStyle}:${n}`)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-md border bg-background p-2 hover:bg-muted text-xs transition-colors",
                          selected && "border-primary ring-1 ring-primary"
                        )}
                        title={n}
                      >
                        <i
                          className={`fi fi-${flStyle}-${n}`}
                          style={{ fontSize: "1.1rem", lineHeight: 1 }}
                          aria-hidden="true"
                        />
                        <span className="truncate w-full text-center text-[10px]">{n}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>


        <TabsContent value="image" className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="https://… (PNG, SVG, JPG)"
              value={parsed.kind === "image" ? parsed.value : ""}
              onChange={(e) => onChange(`url:${e.target.value.trim()}`)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              aria-label="Upload icon"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </Button>
            {parsed.kind === "image" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange("Circle")}
                aria-label="Clear icon"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            PNG/SVG recommended, square, under 1MB. Stored in the public <code>nav-icons</code> bucket.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
