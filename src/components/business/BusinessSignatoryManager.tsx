import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Shield } from "lucide-react";

interface BusinessSignatoryManagerProps {
  accountId: string;
}

export const BusinessSignatoryManager = ({ accountId }: BusinessSignatoryManagerProps) => {
  const { toast } = useToast();
  const [signatories, setSignatories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSignatory, setNewSignatory] = useState({
    email: "",
    role: "authorized_signatory",
    daily_limit: "",
    single_limit: "",
  });

  useEffect(() => {
    fetchSignatories();
  }, [accountId]);

  const fetchSignatories = async () => {
    const { data, error } = await supabase
      .from("business_account_signatories")
      .select("*")
      .eq("account_id", accountId);

    if (error) {
      toast({ title: "Error loading signatories", variant: "destructive" });
    } else {
      setSignatories(data || []);
    }
    setLoading(false);
  };

  const handleAddSignatory = async (e: React.FormEvent) => {
    e.preventDefault();

    // In a real implementation, you'd:
    // 1. Look up user by email
    // 2. Send invitation
    // 3. Create signatory record

    toast({
      title: "Coming soon",
      description: "Signatory invitation system will be available soon.",
    });
  };

  const handleRemoveSignatory = async (signatoryId: string) => {
    const { error } = await supabase
      .from("business_account_signatories")
      .update({ status: "revoked" })
      .eq("id", signatoryId);

    if (error) {
      toast({ title: "Error removing signatory", variant: "destructive" });
    } else {
      toast({ title: "Signatory removed successfully" });
      fetchSignatories();
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'director': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return <p>Loading signatories...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Authorized Signatories</CardTitle>
            <CardDescription>
              Manage users who can operate this business account
            </CardDescription>
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Signatory
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAddForm && (
          <form onSubmit={handleAddSignatory} className="p-4 border rounded-lg space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={newSignatory.email}
                onChange={(e) => setNewSignatory({ ...newSignatory, email: e.target.value })}
                placeholder="signatory@company.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={newSignatory.role} onValueChange={(value) => setNewSignatory({ ...newSignatory, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="director">Director</SelectItem>
                  <SelectItem value="authorized_signatory">Authorized Signatory</SelectItem>
                  <SelectItem value="view_only">View Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="daily_limit">Daily Limit (XAF)</Label>
                <Input
                  id="daily_limit"
                  type="number"
                  value={newSignatory.daily_limit}
                  onChange={(e) => setNewSignatory({ ...newSignatory, daily_limit: e.target.value })}
                  placeholder="1000000"
                />
              </div>
              <div>
                <Label htmlFor="single_limit">Single Transaction Limit (XAF)</Label>
                <Input
                  id="single_limit"
                  type="number"
                  value={newSignatory.single_limit}
                  onChange={(e) => setNewSignatory({ ...newSignatory, single_limit: e.target.value })}
                  placeholder="500000"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Send Invitation</Button>
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {signatories.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No signatories added yet. Add team members to manage this account.
            </p>
          ) : (
            signatories.map((signatory) => (
              <div key={signatory.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Shield className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">User ID: {signatory.user_id.slice(0, 8)}...</p>
                    <p className="text-sm text-muted-foreground">
                      {signatory.role.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={getRoleBadgeVariant(signatory.role)}>
                    {signatory.status}
                  </Badge>
                  {signatory.status === 'active' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRemoveSignatory(signatory.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
