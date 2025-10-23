import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Plus, TestTube, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BankConnection {
  id: string;
  bank_name: string;
  bank_code: string;
  connection_type: string;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
}

export function BankConnectionManager() {
  const { toast } = useToast();
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    bank_name: '',
    bank_code: '',
    connection_type: 'REST_API',
    base_url: '',
    username: '',
    password: '',
    host: '',
    port: '',
  });

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bank_connections')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConnections(data || []);
    } catch (error) {
      console.error('Error fetching connections:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleCreate = async () => {
    if (!form.bank_name || !form.bank_code || !form.connection_type) {
      toast({
        title: "Missing Information",
        description: "Please fill required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const connectionConfig: any = {};
      
      if (form.connection_type === 'REST_API') {
        connectionConfig.base_url = form.base_url;
        connectionConfig.auth = {
          username: form.username,
          password: form.password, // In production, this should be encrypted
        };
      } else if (form.connection_type === 'SFTP') {
        connectionConfig.host = form.host;
        connectionConfig.port = parseInt(form.port) || 22;
        connectionConfig.username = form.username;
        connectionConfig.password = form.password; // Should be encrypted
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: institutions } = await supabase.from('institutions').select('id').eq('user_id', user?.id).single();
      
      const { error } = await supabase
        .from('bank_connections')
        .insert({
          institution_id: institutions?.id,
          bank_name: form.bank_name,
          bank_code: form.bank_code,
          connection_type: form.connection_type,
          base_url: form.base_url || null,
          host: form.host || null,
          port: form.port ? parseInt(form.port) : null,
          username: form.username || null,
          connection_config: connectionConfig,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: "Connection Created",
        description: "Bank connection added successfully",
      });

      setDialogOpen(false);
      setForm({
        bank_name: '',
        bank_code: '',
        connection_type: 'REST_API',
        base_url: '',
        username: '',
        password: '',
        host: '',
        port: '',
      });
      fetchConnections();
    } catch (error: any) {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (connectionId: string) => {
    toast({
      title: "Testing Connection",
      description: "Connection test initiated...",
    });

    try {
      const { data, error } = await supabase.functions.invoke('bank-sync', {
        body: { connection_id: connectionId, test_only: true },
      });

      if (error) throw error;

      toast({
        title: "Test Successful",
        description: "Bank connection is working properly",
      });
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;

    try {
      const { error } = await supabase
        .from('bank_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: "Connection Deleted",
        description: "Bank connection removed successfully",
      });
      fetchConnections();
    } catch (error: any) {
      toast({
        title: "Deletion Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Bank Connections</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Connection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Bank Connection</DialogTitle>
              <DialogDescription>
                Configure a new bank integration connection
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input
                    placeholder="Commercial Bank Cameroon"
                    value={form.bank_name}
                    onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bank Code</Label>
                  <Input
                    placeholder="CBC001"
                    value={form.bank_code}
                    onChange={(e) => setForm({ ...form, bank_code: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Connection Type</Label>
                <Select value={form.connection_type} onValueChange={(value) => setForm({ ...form, connection_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REST_API">REST API</SelectItem>
                    <SelectItem value="SFTP">SFTP</SelectItem>
                    <SelectItem value="H2H">Host-to-Host (H2H)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.connection_type === 'REST_API' && (
                <>
                  <div className="space-y-2">
                    <Label>API Base URL</Label>
                    <Input
                      placeholder="https://api.bank.com/v1"
                      value={form.base_url}
                      onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>API Username</Label>
                      <Input
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>API Password</Label>
                      <Input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {form.connection_type === 'SFTP' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SFTP Host</Label>
                      <Input
                        placeholder="sftp.bank.com"
                        value={form.host}
                        onChange={(e) => setForm({ ...form, host: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input
                        type="number"
                        placeholder="22"
                        value={form.port}
                        onChange={(e) => setForm({ ...form, port: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              <Button onClick={handleCreate} disabled={loading} className="w-full">
                {loading ? "Creating..." : "Create Connection"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bank Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Sync</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading connections...
                </TableCell>
              </TableRow>
            ) : connections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No bank connections configured
                </TableCell>
              </TableRow>
            ) : (
              connections.map((conn) => (
                <TableRow key={conn.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <div>
                        <div className="font-medium">{conn.bank_name}</div>
                        <div className="text-sm text-muted-foreground">{conn.bank_code}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{conn.connection_type}</TableCell>
                  <TableCell>
                    <Badge variant={conn.is_active ? 'default' : 'secondary'}>
                      {conn.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {conn.last_sync_at ? (
                      <div>
                        <div className="text-sm">{new Date(conn.last_sync_at).toLocaleString()}</div>
                        <Badge variant={conn.last_sync_status === 'success' ? 'default' : 'destructive'} className="text-xs mt-1">
                          {conn.last_sync_status}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Never synced</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleTest(conn.id)}>
                        <TestTube className="h-3 w-3 mr-1" />
                        Test
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(conn.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
