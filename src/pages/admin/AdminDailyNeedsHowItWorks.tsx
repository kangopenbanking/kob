import { useEffect, useState } from "react";
import { ChevronLeft, Plus, Trash2, ArrowUp, ArrowDown, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ICON_NAMES, resolveIcon } from "@/components/daily-needs/iconRegistry";

type Vertical = "food" | "pharmacy";

interface Step {
  id?: string;
  vertical: Vertical;
  position: number;
  title: string;
  description: string;
  icon: string;
  bg_color: string;
  icon_color: string;
  _dirty?: boolean;
  _new?: boolean;
}

export default function AdminDailyNeedsHowItWorks() {
  const navigate = useNavigate();
  const [vertical, setVertical] = useState<Vertical>("food");
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async (v: Vertical) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("daily_needs_how_it_works_steps")
      .select("*")
      .eq("vertical", v)
      .order("position");
    if (error) toast.error(error.message);
    setSteps((data as Step[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(vertical); }, [vertical]);

  const update = (idx: number, patch: Partial<Step>) => {
    setSteps((s) => s.map((row, i) => i === idx ? { ...row, ...patch, _dirty: true } : row));
  };

  const addStep = () => {
    const nextPos = (steps[steps.length - 1]?.position ?? 0) + 1;
    setSteps((s) => [...s, {
      vertical, position: nextPos, title: "New step",
      description: "Describe this step.", icon: "Sparkles",
      bg_color: vertical === "food" ? "hsl(25, 90%, 93%)" : "hsl(160, 65%, 90%)",
      icon_color: vertical === "food" ? "hsl(25, 90%, 45%)" : "hsl(160, 65%, 35%)",
      _new: true, _dirty: true,
    }]);
  };

  const removeStep = async (idx: number) => {
    const row = steps[idx];
    if (row.id) {
      const { error } = await supabase.from("daily_needs_how_it_works_steps").delete().eq("id", row.id);
      if (error) { toast.error(error.message); return; }
    }
    setSteps((s) => s.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= steps.length) return;
    setSteps((s) => {
      const copy = [...s];
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy.map((row, i) => ({ ...row, position: i + 1, _dirty: true }));
    });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const normalised = steps.map((row, i) => ({ ...row, position: i + 1 }));
      for (const row of normalised) {
        if (!row._dirty && !row._new) continue;
        const payload = {
          vertical: row.vertical, position: row.position,
          title: row.title, description: row.description,
          icon: row.icon, bg_color: row.bg_color, icon_color: row.icon_color,
        };
        if (row.id) {
          const { error } = await supabase
            .from("daily_needs_how_it_works_steps").update(payload).eq("id", row.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("daily_needs_how_it_works_steps").insert(payload);
          if (error) throw error;
        }
      }
      toast.success("Saved");
      await load(vertical);
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate("/admin/daily-needs")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-semibold">How it works — Guide editor</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Edit the collapsible "How it works" steps shown on the customer Food and Pharmacy pages.
      </p>

      <Tabs value={vertical} onValueChange={(v) => setVertical(v as Vertical)}>
        <TabsList>
          <TabsTrigger value="food">Food</TabsTrigger>
          <TabsTrigger value="pharmacy">Pharmacy</TabsTrigger>
        </TabsList>

        {(["food", "pharmacy"] as Vertical[]).map((v) => (
          <TabsContent key={v} value={v} className="space-y-3 mt-4">
            {loading ? <Skeleton className="h-64" /> : (
              <>
                {steps.map((row, idx) => {
                  const Icon = resolveIcon(row.icon);
                  return (
                    <Card key={row.id ?? `new-${idx}`} className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                             style={{ backgroundColor: row.bg_color }}>
                          <Icon className="h-5 w-5" style={{ color: row.icon_color }} strokeWidth={1.5} />
                        </div>
                        <span className="text-sm font-semibold">Step {idx + 1}</span>
                        <div className="ml-auto flex gap-1">
                          <Button variant="ghost" size="icon" aria-label="Move up"
                            onClick={() => move(idx, -1)} disabled={idx === 0}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Move down"
                            onClick={() => move(idx, 1)} disabled={idx === steps.length - 1}>
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Delete step"
                            onClick={() => removeStep(idx)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Title</label>
                          <Input value={row.title} onChange={(e) => update(idx, { title: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Icon</label>
                          <Select value={row.icon} onValueChange={(val) => update(idx, { icon: val })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent className="max-h-72">
                              {ICON_NAMES.map((name) => (
                                <SelectItem key={name} value={name}>{name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-medium">Description</label>
                          <Textarea rows={2} value={row.description}
                            onChange={(e) => update(idx, { description: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Background color (HSL/CSS)</label>
                          <Input value={row.bg_color}
                            onChange={(e) => update(idx, { bg_color: e.target.value })}
                            placeholder="hsl(25, 90%, 93%)" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">Icon color (HSL/CSS)</label>
                          <Input value={row.icon_color}
                            onChange={(e) => update(idx, { icon_color: e.target.value })}
                            placeholder="hsl(25, 90%, 45%)" />
                        </div>
                      </div>
                    </Card>
                  );
                })}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={addStep}>
                    <Plus className="h-4 w-4 mr-1" /> Add step
                  </Button>
                  <Button onClick={saveAll} disabled={saving}>
                    <Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save all changes"}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
