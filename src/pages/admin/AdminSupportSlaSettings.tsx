import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DepartmentRow {
  id: string;
  name: string;
  is_active: boolean;
  sla_target_minutes: number;
  sla_warning_pct: number;
  sla_escalation_pct: number;
  escalation_department_id: string | null;
  supervisor_email: string | null;
  notify_supervisor: boolean;
}

interface DraftRow extends DepartmentRow {
  _dirty?: boolean;
}

interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const validateRow = (row: DraftRow): ValidationResult => {
  const errors: string[] = [];
  const target = Number(row.sla_target_minutes);
  const warn = Number(row.sla_warning_pct);
  const esc = Number(row.sla_escalation_pct);

  if (!Number.isFinite(target) || target < 1 || target > 1440) {
    errors.push("Target must be between 1 and 1440 minutes");
  }
  if (!Number.isFinite(warn) || warn < 1 || warn > 99) {
    errors.push("Warning threshold must be 1–99%");
  }
  if (!Number.isFinite(esc) || esc < 1 || esc > 500) {
    errors.push("Escalation threshold must be 1–500%");
  }
  if (warn >= esc) {
    errors.push("Warning threshold must be lower than escalation threshold");
  }
  if (row.escalation_department_id === row.id) {
    errors.push("A department cannot escalate to itself");
  }
  if (
    row.supervisor_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.supervisor_email)
  ) {
    errors.push("Supervisor email is not a valid address");
  }
  return { ok: errors.length === 0, errors };
};

const AdminSupportSlaSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});

  const { data: departments = [], isLoading } = useQuery<DepartmentRow[]>({
    queryKey: ["support-departments-sla"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_departments")
        .select(
          "id, name, is_active, sla_target_minutes, sla_warning_pct, sla_escalation_pct, escalation_department_id, supervisor_email, notify_supervisor"
        )
        .order("display_order");
      if (error) throw error;
      return (data as any) || [];
    },
  });

  useEffect(() => {
    if (!departments.length) return;
    setDrafts((prev) => {
      const next = { ...prev };
      departments.forEach((d) => {
        if (!next[d.id]) next[d.id] = { ...d };
      });
      return next;
    });
  }, [departments]);

  const updateDraft = (id: string, patch: Partial<DraftRow>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch, _dirty: true },
    }));
  };

  const saveOne = useMutation({
    mutationFn: async (row: DraftRow) => {
      const validation = validateRow(row);
      if (!validation.ok) {
        throw new Error(validation.errors.join(". "));
      }
      const { error } = await supabase
        .from("support_departments")
        .update({
          sla_target_minutes: row.sla_target_minutes,
          sla_warning_pct: row.sla_warning_pct,
          sla_escalation_pct: row.sla_escalation_pct,
          escalation_department_id: row.escalation_department_id,
          supervisor_email: row.supervisor_email?.trim() || null,
          notify_supervisor: row.notify_supervisor,
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: (_d, row) => {
      toast.success(`Saved ${row.name}`);
      setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], _dirty: false } }));
      queryClient.invalidateQueries({ queryKey: ["support-departments-sla"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  const rows = useMemo(
    () => departments.map((d) => drafts[d.id] || d),
    [departments, drafts]
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Settings}
        title="SLA & Escalation"
        description="Configure response targets and escalation thresholds for each support department."
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4">
          {rows.map((row) => {
            const validation = validateRow(row);
            const breachMinutes = Math.round(
              (row.sla_target_minutes * row.sla_escalation_pct) / 100
            );
            const warnMinutes = Math.round(
              (row.sla_target_minutes * row.sla_warning_pct) / 100
            );
            return (
              <Card key={row.id} className="border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{row.name}</CardTitle>
                      <CardDescription>
                        {row.is_active ? "Active" : "Inactive"} · Default target {row.sla_target_minutes} min
                      </CardDescription>
                    </div>
                    {validation.ok ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-600/40">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Valid
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-destructive border-destructive/40">
                        <AlertTriangle className="mr-1 h-3 w-3" /> Needs attention
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs">SLA target (minutes)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={1440}
                        value={row.sla_target_minutes}
                        onChange={(e) =>
                          updateDraft(row.id, { sla_target_minutes: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Warning at (% of target)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        value={row.sla_warning_pct}
                        onChange={(e) =>
                          updateDraft(row.id, { sla_warning_pct: parseInt(e.target.value) || 0 })
                        }
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Triggers at ~{warnMinutes} min
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs">Escalation at (% of target)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={500}
                        value={row.sla_escalation_pct}
                        onChange={(e) =>
                          updateDraft(row.id, { sla_escalation_pct: parseInt(e.target.value) || 0 })
                        }
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Breaches at ~{breachMinutes} min
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Escalate to department</Label>
                      <Select
                        value={row.escalation_department_id || "none"}
                        onValueChange={(v) =>
                          updateDraft(row.id, {
                            escalation_department_id: v === "none" ? null : v,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="No automatic transfer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No automatic transfer</SelectItem>
                          {departments
                            .filter((d) => d.id !== row.id)
                            .map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Supervisor email (optional)</Label>
                      <Input
                        type="email"
                        placeholder="supervisor@company.com"
                        value={row.supervisor_email || ""}
                        onChange={(e) =>
                          updateDraft(row.id, { supervisor_email: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={row.notify_supervisor}
                        onCheckedChange={(v) =>
                          updateDraft(row.id, { notify_supervisor: v })
                        }
                      />
                      <Label className="text-xs">Email supervisor on escalation</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      {!validation.ok && (
                        <span className="text-xs text-destructive">
                          {validation.errors[0]}
                        </span>
                      )}
                      <Button
                        size="sm"
                        disabled={!(row as DraftRow)._dirty || !validation.ok || saveOne.isPending}
                        onClick={() => saveOne.mutate(row as DraftRow)}
                      >
                        {saveOne.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminSupportSlaSettings;
