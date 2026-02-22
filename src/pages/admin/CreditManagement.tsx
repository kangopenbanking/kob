import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Key, TrendingUp, DollarSign, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import * as bcrypt from 'bcryptjs';

export default function CreditManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    client_name: '',
    client_type: 'bank',
    pricing_tier: 'standard',
    institution_id: '',
  });
  const queryClient = useQueryClient();

  // Fetch institutions for the selector
  const { data: institutions } = useQuery({
    queryKey: ['institutions-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select('id, institution_name')
        .eq('status', 'approved')
        .order('institution_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch access requests
  const { data: accessRequests } = useQuery({
    queryKey: ['credit-api-access-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_api_access_requests')
        .select('*, institutions(institution_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('credit_api_access_requests')
        .update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-api-access-requests'] });
      toast.success('Request updated');
    },
  });

  // Fetch API clients
  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ['credit-api-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_api_clients')
        .select('*, institutions(institution_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch usage statistics
  const { data: usageStats } = useQuery({
    queryKey: ['credit-api-usage-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_api_usage_logs')
        .select('client_id, billed_amount, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      // Aggregate by client
      const stats = data.reduce((acc: any, log: any) => {
        if (!acc[log.client_id]) {
          acc[log.client_id] = { total_queries: 0, total_revenue: 0 };
        }
        acc[log.client_id].total_queries += 1;
        acc[log.client_id].total_revenue += parseFloat(log.billed_amount || 0);
        return acc;
      }, {});

      return stats;
    },
  });

  // Fetch score distribution
  const { data: scoreDistribution } = useQuery({
    queryKey: ['credit-score-distribution'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_scores')
        .select('score')
        .eq('status', 'active');

      if (error) throw error;

      const distribution = {
        excellent: 0,
        very_good: 0,
        good: 0,
        fair: 0,
        poor: 0,
      };

      data.forEach((record: any) => {
        if (record.score >= 800) distribution.excellent++;
        else if (record.score >= 740) distribution.very_good++;
        else if (record.score >= 670) distribution.good++;
        else if (record.score >= 580) distribution.fair++;
        else distribution.poor++;
      });

      return distribution;
    },
  });

  // Create API client mutation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: any) => {
      // Generate API key and secret
      const apiKey = `kob_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      const apiSecret = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Hash the secret
      const apiSecretHash = await bcrypt.hash(apiSecret, 10);

      const { data, error } = await supabase
        .from('credit_api_clients')
        .insert({
          ...clientData,
          api_key: apiKey,
          api_secret_hash: apiSecretHash,
          allowed_operations: ['score_query', 'report_query'],
        })
        .select()
        .single();

      if (error) throw error;

      // Return both the data and the plain secret (only shown once)
      return { ...data, api_secret: apiSecret };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-api-clients'] });
      setIsCreateDialogOpen(false);
      toast.success('API client created successfully');
    },
    onError: (error) => {
      console.error('Error creating API client:', error);
      toast.error('Failed to create API client');
    },
  });

  const handleCreateClient = () => {
    if (!newClient.client_name || !newClient.client_type) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Build payload, omitting institution_id if not selected
    const payload: any = {
      client_name: newClient.client_name,
      client_type: newClient.client_type,
      pricing_tier: newClient.pricing_tier,
    };
    if (newClient.institution_id) {
      payload.institution_id = newClient.institution_id;
    }

    createClientMutation.mutate(payload);
  };

  if (loadingClients) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Credit API Management</h1>
            <p className="text-muted-foreground">Manage B2B credit score API clients</p>
          </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create API Client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New API Client</DialogTitle>
              <DialogDescription>
                Generate API credentials for a financial institution
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Client Name</Label>
                <Input
                  value={newClient.client_name}
                  onChange={(e) => setNewClient({ ...newClient, client_name: e.target.value })}
                  placeholder="e.g., ABC Bank"
                />
              </div>
              <div>
                <Label>Client Type</Label>
                <Select value={newClient.client_type} onValueChange={(value) => setNewClient({ ...newClient, client_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="fintech">Fintech</SelectItem>
                    <SelectItem value="microfinance">Microfinance</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pricing Tier</Label>
                <Select value={newClient.pricing_tier} onValueChange={(value) => setNewClient({ ...newClient, pricing_tier: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free_tier">Free Tier (100/day)</SelectItem>
                    <SelectItem value="standard">Standard (5,000/day - 50 XAF/query)</SelectItem>
                    <SelectItem value="premium">Premium (50,000/day - 35 XAF/query)</SelectItem>
                    <SelectItem value="enterprise">Enterprise (Unlimited - 25 XAF/query)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
              <div>
                <Label>Institution (Optional)</Label>
                <Select value={newClient.institution_id} onValueChange={(value) => setNewClient({ ...newClient, institution_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an institution" />
                  </SelectTrigger>
                  <SelectContent>
                    {institutions?.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>{inst.institution_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateClient} disabled={createClientMutation.isPending}>
                {createClientMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Client
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients?.filter(c => c.is_active).length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Queries (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(Object.values(usageStats || {}).reduce((sum: number, stat: any) => sum + stat.total_queries, 0) as number)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(Object.values(usageStats || {}).reduce((sum: number, stat: any) => sum + stat.total_revenue, 0) as number).toLocaleString()} XAF
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {scoreDistribution ? Math.round(
                (scoreDistribution.excellent * 825 + scoreDistribution.very_good * 770 + 
                 scoreDistribution.good * 705 + scoreDistribution.fair * 625 + scoreDistribution.poor * 440) /
                (scoreDistribution.excellent + scoreDistribution.very_good + scoreDistribution.good + 
                 scoreDistribution.fair + scoreDistribution.poor)
              ) : 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clients">API Clients</TabsTrigger>
          <TabsTrigger value="requests">
            Access Requests
            {accessRequests && accessRequests.filter((r: any) => r.status === 'pending').length > 0 && (
              <Badge variant="destructive" className="ml-2">{accessRequests.filter((r: any) => r.status === 'pending').length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
          <TabsTrigger value="distribution">Score Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="clients">
          <Card>
            <CardHeader>
              <CardTitle>API Clients</CardTitle>
              <CardDescription>Manage financial institution API access</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Pricing Tier</TableHead>
                    <TableHead>Total Queries</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Query</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients?.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.client_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{client.client_type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{client.api_key.substring(0, 20)}...</TableCell>
                      <TableCell>{client.pricing_tier}</TableCell>
                      <TableCell>{client.total_queries || 0}</TableCell>
                      <TableCell>
                        <Badge variant={client.is_active ? 'default' : 'secondary'}>
                          {client.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {client.last_query_at ? new Date(client.last_query_at).toLocaleDateString() : 'Never'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Credit API Access Requests</CardTitle>
              <CardDescription>Review and approve institution access requests</CardDescription>
            </CardHeader>
            <CardContent>
              {accessRequests && accessRequests.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Institution</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessRequests.map((req: any) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">
                          {req.institutions?.institution_name || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={req.status === 'pending' ? 'secondary' : req.status === 'approved' ? 'default' : 'destructive'}>
                            {req.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(req.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {req.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => updateRequestMutation.mutate({ id: req.id, status: 'approved' })}
                                disabled={updateRequestMutation.isPending}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateRequestMutation.mutate({ id: req.id, status: 'rejected' })}
                                disabled={updateRequestMutation.isPending}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No access requests</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>Usage Analytics (Last 30 Days)</CardTitle>
              <CardDescription>Query volume and revenue by client</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {clients?.map((client: any) => {
                  const stats = usageStats?.[client.id] || { total_queries: 0, total_revenue: 0 };
                  return (
                    <div key={client.id} className="flex justify-between items-center p-4 border rounded-lg">
                      <div>
                        <p className="font-semibold">{client.client_name}</p>
                        <p className="text-sm text-muted-foreground">{client.pricing_tier}</p>
                      </div>
                      <div className="flex gap-6">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Queries</p>
                          <p className="text-xl font-bold">{stats.total_queries}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Revenue</p>
                          <p className="text-xl font-bold">{stats.total_revenue.toLocaleString()} XAF</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution">
          <Card>
            <CardHeader>
              <CardTitle>Credit Score Distribution</CardTitle>
              <CardDescription>Distribution of credit scores across all users</CardDescription>
            </CardHeader>
            <CardContent>
              {scoreDistribution && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 border rounded-lg">
                    <span className="font-medium">Excellent (800-850)</span>
                    <Badge>{scoreDistribution.excellent}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-4 border rounded-lg">
                    <span className="font-medium">Very Good (740-799)</span>
                    <Badge>{scoreDistribution.very_good}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-4 border rounded-lg">
                    <span className="font-medium">Good (670-739)</span>
                    <Badge>{scoreDistribution.good}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-4 border rounded-lg">
                    <span className="font-medium">Fair (580-669)</span>
                    <Badge variant="secondary">{scoreDistribution.fair}</Badge>
                  </div>
                  <div className="flex justify-between items-center p-4 border rounded-lg">
                    <span className="font-medium">Poor (300-579)</span>
                    <Badge variant="destructive">{scoreDistribution.poor}</Badge>
                  </div>
                </div>
              )}
            </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
);
}
