import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw, Check, X, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";

export default function WebhookManagement() {
  const [open, setOpen] = useState(false);
  const [testWebhookId, setTestWebhookId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhooks")
        .select("*, institutions(institution_name)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: deliveries } = useQuery({
    queryKey: ["webhook-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_deliveries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  const createWebhook = useMutation({
    mutationFn: async (formData: any) => {
      const { data, error } = await supabase
        .from("webhooks")
        .insert([formData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast({ title: "Webhook created successfully" });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create webhook",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const testWebhook = useMutation({
    mutationFn: async (webhookId: string) => {
      const { data, error } = await supabase.functions.invoke("webhook-delivery", {
        body: {
          webhook_id: webhookId,
          test_mode: true,
          event_type: "transaction.completed",
          event_data: {
            transaction_id: "test-123",
            amount: 1000,
            status: "completed"
          }
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-deliveries"] });
      toast({ title: "Test webhook sent successfully" });
      setTestWebhookId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send test webhook",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const toggleWebhook = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("webhooks")
        .update({ is_active })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast({ title: "Webhook status updated" });
    }
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Webhook Management</h1>
          <p className="text-muted-foreground">Configure and monitor institution webhooks</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Webhook</DialogTitle>
            </DialogHeader>
            <WebhookForm onSubmit={(data) => createWebhook.mutate(data)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Institution</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : webhooks?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">No webhooks configured</TableCell>
              </TableRow>
            ) : (
              webhooks?.map((webhook) => (
                <TableRow key={webhook.id}>
                  <TableCell>
                    {(webhook.institutions as any)?.institution_name || "N/A"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{webhook.url}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {webhook.events?.slice(0, 2).map((event: string) => (
                        <Badge key={event} variant="secondary" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                      {webhook.events && webhook.events.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{webhook.events.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={webhook.is_active}
                      onCheckedChange={(checked) => 
                        toggleWebhook.mutate({ id: webhook.id, is_active: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testWebhook.mutate(webhook.id)}
                      disabled={testWebhookId === webhook.id}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Test
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Deliveries</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Response</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">No deliveries yet</TableCell>
              </TableRow>
            ) : (
              deliveries?.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell className="font-mono text-sm">{delivery.event_type}</TableCell>
                  <TableCell>
                    {delivery.status === "success" ? (
                      <Badge className="bg-green-500">
                        <Check className="mr-1 h-3 w-3" />
                        Success
                      </Badge>
                    ) : delivery.status === "failed" ? (
                      <Badge variant="destructive">
                        <X className="mr-1 h-3 w-3" />
                        Failed
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{delivery.attempt_count}</TableCell>
                  <TableCell className="font-mono text-xs">{delivery.http_status}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(delivery.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function WebhookForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    url: "",
    client_id: "",
    events: ["transaction.completed", "transaction.failed"],
    secret: "",
    is_active: true
  });

  const { data: clients } = useQuery({
    queryKey: ["webhook-form-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_clients")
        .select("client_id, client_name")
        .eq("is_active", true)
        .order("client_name");
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.url || !formData.client_id) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Client *</Label>
        <Select
          value={formData.client_id}
          onValueChange={(value) => setFormData({ ...formData, client_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select API client" />
          </SelectTrigger>
          <SelectContent>
            {clients?.map((client) => (
              <SelectItem key={client.client_id} value={client.client_id}>
                {client.client_name || client.client_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Webhook URL *</Label>
        <Input
          placeholder="https://your-domain.com/webhooks"
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>HMAC Secret (Optional)</Label>
        <Input
          type="password"
          placeholder="Enter secret for signature verification"
          value={formData.secret}
          onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Used to verify webhook signatures via HMAC-SHA256
        </p>
      </div>

      <div className="space-y-2">
        <Label>Events (JSON array)</Label>
        <Textarea
          placeholder='["transaction.completed", "transaction.failed"]'
          value={JSON.stringify(formData.events)}
          onChange={(e) => {
            try {
              setFormData({ ...formData, events: JSON.parse(e.target.value) });
            } catch {}
          }}
          className="font-mono text-sm"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        <Label>Active</Label>
      </div>

      <Button type="submit" className="w-full" disabled={!formData.url || !formData.client_id}>Create Webhook</Button>
    </form>
  );
}
