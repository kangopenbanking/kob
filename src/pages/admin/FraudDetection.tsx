import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, AlertTriangle, Search, Activity, Eye, ShieldAlert} from "lucide-react";
import { format } from "date-fns";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default function FraudDetection() {
  const queryClient = useQueryClient();

  const { data: fraudRules, isLoading: rulesLoading } = useQuery({
    queryKey: ["fraud-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fraud_rules").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: suspiciousActivities } = useQuery({
    queryKey: ["suspicious-activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suspicious_activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("fraud_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fraud-rules"] });
      toast.success("Rule updated");
    },
  });

  const getSeverityBadge = (severity: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      critical: "destructive",
      high: "destructive",
      medium: "secondary",
      low: "outline",
    };
    return <Badge variant={map[severity] || "outline"}>{severity}</Badge>;
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={ShieldAlert} title="Fraud Detection & AML" description="Monitor and investigate suspicious transactions and fraud patterns" />


      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Rules</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fraudRules?.filter((r) => r.is_active).length || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Rules</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fraudRules?.length || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Flagged Activities</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{suspiciousActivities?.length || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Triggers</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fraudRules?.reduce((sum, r) => sum + (r.trigger_count || 0), 0) || 0}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules"><Shield className="h-4 w-4 mr-2" />Fraud Rules</TabsTrigger>
          <TabsTrigger value="activities"><AlertTriangle className="h-4 w-4 mr-2" />Suspicious Activities</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <Card>
            <CardHeader><CardTitle>Fraud Detection Rules</CardTitle><CardDescription>Configure automated fraud detection rules and actions</CardDescription></CardHeader>
            <CardContent>
              {rulesLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Triggers</TableHead>
                      <TableHead>Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fraudRules?.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell><div className="font-medium">{rule.rule_name}</div><div className="text-xs text-muted-foreground">{rule.description}</div></TableCell>
                        <TableCell><Badge variant="outline">{rule.rule_type}</Badge></TableCell>
                        <TableCell>{getSeverityBadge(rule.severity)}</TableCell>
                        <TableCell><Badge variant="secondary">{rule.action}</Badge></TableCell>
                        <TableCell className="font-mono">{rule.trigger_count}</TableCell>
                        <TableCell><Switch checked={rule.is_active} onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, is_active: checked })} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities">
          <Card>
            <CardHeader><CardTitle>Suspicious Activities</CardTitle><CardDescription>Flagged transactions and activities requiring review</CardDescription></CardHeader>
            <CardContent>
              {!suspiciousActivities?.length ? (
                <p className="text-center py-8 text-muted-foreground">No suspicious activities detected</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Action Taken</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suspiciousActivities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="font-mono text-xs">{format(new Date(activity.created_at), "MMM dd, yyyy HH:mm")}</TableCell>
                        <TableCell><Badge variant="outline">{activity.activity_type}</Badge></TableCell>
                        <TableCell>{getSeverityBadge(activity.severity)}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{activity.description}</TableCell>
                        <TableCell><Badge variant="secondary">{activity.action_taken || "pending"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
