import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Search, CheckCircle, XCircle, Clock, FileText, Users, Building2, Code, User } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-primary/10 text-primary',
  under_review: 'bg-accent/10 text-accent-foreground',
  approved: 'bg-green-500/10 text-green-700',
  rejected: 'bg-destructive/10 text-destructive',
};

const ENTITY_ICONS: Record<string, any> = {
  personal: User,
  merchant: Building2,
  institution: Building2,
  developer_org: Code,
};

export default function OnboardingManagement() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  const openReviewDialog = (app: any) => {
    setSelectedApp(app);
    setReviewNotes('');
    setReviewDialogOpen(true);
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('onboarding_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (err: any) {
      toast.error('Failed to load applications', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (decision: 'approved' | 'rejected') => {
    if (!selectedApp) return;
    setReviewing(true);
    try {
      const { error } = await supabase.functions.invoke('identity-onboarding', {
        body: {
          action: 'admin-review',
          application_id: selectedApp.id,
          decision,
          review_notes: reviewNotes,
        }
      });
      if (error) throw error;
      toast.success(`Application ${decision}`);
      setSelectedApp(null);
      setReviewNotes('');
      loadApplications();
    } catch (err: any) {
      toast.error('Review failed', { description: err.message });
    } finally {
      setReviewing(false);
    }
  };

  const filteredApps = applications.filter(app => {
    if (statusFilter !== 'all' && app.status !== statusFilter) return false;
    if (typeFilter !== 'all' && app.entity_type !== typeFilter) return false;
    if (searchTerm && !app.id.includes(searchTerm) && !app.user_id.includes(searchTerm)) return false;
    return true;
  });

  const stats = {
    total: applications.length,
    pending: applications.filter(a => ['submitted', 'under_review'].includes(a.status)).length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Onboarding Management</h1>
        <p className="text-muted-foreground mt-1">Review and manage onboarding applications across all account types</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-foreground">{stats.total}</div><p className="text-muted-foreground text-sm">Total Applications</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-primary">{stats.pending}</div><p className="text-muted-foreground text-sm">Pending Review</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{stats.approved}</div><p className="text-muted-foreground text-sm">Approved</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-destructive">{stats.rejected}</div><p className="text-muted-foreground text-sm">Rejected</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by ID or user..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="personal">Personal</SelectItem>
            <SelectItem value="merchant">Merchant</SelectItem>
            <SelectItem value="institution">Institution</SelectItem>
            <SelectItem value="developer_org">Developer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Reviewed</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApps.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No applications found</TableCell></TableRow>
              ) : filteredApps.map((app) => {
                const Icon = ENTITY_ICONS[app.entity_type] || FileText;
                return (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">{app.entity_type.replace('_', ' ')}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge className={STATUS_COLORS[app.status]}>{app.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{app.reviewed_at ? new Date(app.reviewed_at).toLocaleDateString() : '—'}</TableCell>
                    <TableCell>
                      {['submitted', 'under_review'].includes(app.status) ? (
                        <Button size="sm" variant="outline" onClick={() => openReviewDialog(app)}>Review</Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Review Dialog - Controlled */}
      <Dialog open={reviewDialogOpen} onOpenChange={(open) => {
        setReviewDialogOpen(open);
        if (!open) { setSelectedApp(null); setReviewNotes(''); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Application</DialogTitle>
            <DialogDescription>
              {selectedApp?.entity_type?.replace('_', ' ')} application — ID: {selectedApp?.id?.slice(0, 8)}...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Entity Type:</span>
              <span className="capitalize">{selectedApp?.entity_type?.replace('_', ' ')}</span>
              <span className="text-muted-foreground">Submitted:</span>
              <span>{selectedApp?.submitted_at ? new Date(selectedApp.submitted_at).toLocaleString() : 'N/A'}</span>
            </div>
            <Textarea
              placeholder="Review notes (optional)"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={() => handleReview('rejected')} disabled={reviewing}>
              {reviewing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Reject
            </Button>
            <Button onClick={() => handleReview('approved')} disabled={reviewing}>
              {reviewing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
