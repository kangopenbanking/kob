import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Settings, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function RateLimitConfig() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients } = useQuery({
    queryKey: ["api-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: rateLimits } = useQuery({
    queryKey: ["rate-limits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rate_limits")
        .select("*")
        .order("window_start", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Group rate limits by client and endpoint
  const clientUsage = rateLimits?.reduce((acc: any, limit) => {
    const key = `${limit.client_id}-${limit.endpoint}`;
    if (!acc[key]) {
      acc[key] = {
        client_id: limit.client_id,
        endpoint: limit.endpoint,
        total_requests: 0,
        limit_exceeded_count: 0,
        max_limit: 100, // Default, should come from config
      };
    }
    acc[key].total_requests += limit.request_count;
    if (limit.limit_exceeded) acc[key].limit_exceeded_count++;
    return acc;
  }, {});

  const usageData = Object.values(clientUsage || {});

  const updateRateLimit = useMutation({
    mutationFn: async (config: any) => {
      // Update the api_client's rate limit settings
      const { error } = await supabase
        .from("api_clients")
        .update({
          monthly_requests_limit: config.limit * Math.ceil((30 * 24 * 60) / config.window_minutes),
          rate_limit_tier: `${config.limit}/${config.window_minutes}m`,
        })
        .eq("client_id", config.client_id);
      if (error) throw error;
      return config;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-clients"] });
      toast({ title: "Rate limit configuration saved" });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update rate limit",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rate Limit Configuration</h1>
          <p className="text-muted-foreground">Configure per-client rate limits and monitor usage patterns</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Configure Limit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure Rate Limit</DialogTitle>
            </DialogHeader>
            <RateLimitForm onSubmit={(data) => updateRateLimit.mutate(data)} clients={clients || []} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Current Usage Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-2xl font-bold">{clients?.length || 0}</div>
          <div className="text-sm text-muted-foreground">Active Clients</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">
            {rateLimits?.reduce((sum, r) => sum + r.request_count, 0).toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Total Requests (Current Window)</div>
        </Card>
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="text-2xl font-bold text-red-600">
            {rateLimits?.filter(r => r.limit_exceeded).length || 0}
          </div>
          <div className="text-sm text-red-700">Rate Limit Violations</div>
        </Card>
      </div>

      {/* Client Usage Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client ID</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>Requests</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Violations</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">No usage data available</TableCell>
              </TableRow>
            ) : (
              usageData.map((usage: any, index) => {
                const usagePercent = (usage.total_requests / usage.max_limit) * 100;
                return (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-sm">{usage.client_id}</TableCell>
                    <TableCell className="font-mono text-sm">{usage.endpoint}</TableCell>
                    <TableCell>
                      {usage.total_requests.toLocaleString()} / {usage.max_limit}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Progress value={Math.min(usagePercent, 100)} className="h-2" />
                        <span className="text-xs text-muted-foreground">
                          {usagePercent.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {usage.limit_exceeded_count > 0 ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {usage.limit_exceeded_count}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">None</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline">
                        <Settings className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Recent Rate Limit Events */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Rate Limit Events</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client ID</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>Requests</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rateLimits?.slice(0, 10).map((limit) => (
              <TableRow key={limit.id}>
                <TableCell className="font-mono text-sm">{limit.client_id}</TableCell>
                <TableCell className="font-mono text-sm">{limit.endpoint}</TableCell>
                <TableCell>{limit.request_count}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(limit.window_start).toLocaleTimeString()}
                </TableCell>
                <TableCell>
                  {limit.limit_exceeded ? (
                    <Badge variant="destructive">Exceeded</Badge>
                  ) : (
                    <Badge variant="secondary">Normal</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function RateLimitForm({ onSubmit, clients }: { onSubmit: (data: any) => void; clients: any[] }) {
  const [formData, setFormData] = useState({
    client_id: "",
    endpoint: "*",
    limit: 100,
    window_minutes: 60,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Client</Label>
        <Select
          value={formData.client_id}
          onValueChange={(value) => setFormData({ ...formData, client_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.client_id} value={client.client_id}>
                {client.client_name || client.client_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Endpoint (use * for all)</Label>
        <Input
          placeholder="e.g., /api/* or *"
          value={formData.endpoint}
          onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Request Limit</Label>
          <Input
            type="number"
            min="1"
            value={formData.limit}
            onChange={(e) => setFormData({ ...formData, limit: parseInt(e.target.value) })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Time Window (minutes)</Label>
          <Input
            type="number"
            min="1"
            value={formData.window_minutes}
            onChange={(e) => setFormData({ ...formData, window_minutes: parseInt(e.target.value) })}
            required
          />
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        This will limit the client to {formData.limit} requests per {formData.window_minutes} minute
        {formData.window_minutes !== 1 ? "s" : ""} on endpoint "{formData.endpoint}"
      </div>

      <Button type="submit" className="w-full">Save Configuration</Button>
    </form>
  );
}
