import { useState } from "react";
import DOMPurify from "dompurify";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FileCode, Eye, Edit, Mail, Send } from "lucide-react";
import { format } from "date-fns";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default function EmailTemplates() {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [testTemplate, setTestTemplate] = useState<any>(null);
  const [testRecipient, setTestRecipient] = useState("");
  const [testResult, setTestResult] = useState<any | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("email_templates").select("*").order("category", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async (template: any) => {
      const { error } = await supabase
        .from("email_templates")
        .update({ subject: template.subject, body_html: template.body_html, is_active: template.is_active })
        .eq("id", template.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template updated");
      setEditingTemplate(null);
    },
    onError: () => toast.error("Failed to update template"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("email_templates").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template status updated");
    },
  });

  const transactional = templates?.filter((t) => t.category === "transactional") || [];
  const notification = templates?.filter((t) => t.category === "notification") || [];

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Mail} title="Email Template Management" description="Manage automated email templates and notification content" />


      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Templates</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{templates?.length || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{templates?.filter((t) => t.is_active).length || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Sends</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{templates?.reduce((sum, t) => sum + (t.send_count || 0), 0) || 0}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="transactional">
        <TabsList>
          <TabsTrigger value="transactional"><Mail className="h-4 w-4 mr-2" />Transactional</TabsTrigger>
          <TabsTrigger value="notification"><Send className="h-4 w-4 mr-2" />Notifications</TabsTrigger>
        </TabsList>

        {[{ key: "transactional", data: transactional }, { key: "notification", data: notification }].map(({ key, data }) => (
          <TabsContent key={key} value={key}>
            <Card>
              <CardHeader><CardTitle>{key === "transactional" ? "Transactional" : "Notification"} Templates</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <p className="text-center py-8 text-muted-foreground">Loading...</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Variables</TableHead>
                        <TableHead>Sends</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell><div className="font-medium">{template.name}</div><div className="text-xs text-muted-foreground">{template.template_key}</div></TableCell>
                          <TableCell className="max-w-[200px] truncate">{template.subject}</TableCell>
                          <TableCell><div className="flex flex-wrap gap-1">{template.variables?.map((v: string) => <Badge key={v} variant="outline" className="text-xs">{v}</Badge>)}</div></TableCell>
                          <TableCell>{template.send_count}</TableCell>
                          <TableCell><Switch checked={template.is_active} onCheckedChange={(checked) => toggleActive.mutate({ id: template.id, is_active: checked })} /></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Dialog>
                                <DialogTrigger asChild><Button size="sm" variant="ghost" onClick={() => setPreviewTemplate(template)}><Eye className="h-4 w-4" /></Button></DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader><DialogTitle>Preview: {template.name}</DialogTitle></DialogHeader>
                                  <div className="border rounded-lg p-4 bg-background" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(template.body_html) }} />
                                </DialogContent>
                              </Dialog>
                              <Dialog>
                                <DialogTrigger asChild><Button size="sm" variant="ghost" onClick={() => setEditingTemplate({ ...template })}><Edit className="h-4 w-4" /></Button></DialogTrigger>
                                <DialogContent>
                                  <DialogHeader><DialogTitle>Edit: {template.name}</DialogTitle></DialogHeader>
                                  {editingTemplate && (
                                    <div className="space-y-4">
                                      <div><Label>Subject</Label><Input value={editingTemplate.subject} onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })} /></div>
                                      <div><Label>HTML Body</Label><Textarea value={editingTemplate.body_html} onChange={(e) => setEditingTemplate({ ...editingTemplate, body_html: e.target.value })} rows={10} className="font-mono text-xs" /></div>
                                      <Button onClick={() => updateTemplate.mutate(editingTemplate)} className="w-full">Save Changes</Button>
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
