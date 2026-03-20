import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Clock, Loader2, MessageSquare, Link2} from "lucide-react";
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const LinkedAccountRequests: React.FC = () => {
  const queryClient = useQueryClient();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-linked-account-requests'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('linked_account_change_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch profiles for user info
      const userIds = [...new Set((data || []).map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds as string[]);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      return (data || []).map((r: any) => ({
        ...r,
        profile: profileMap.get(r.user_id) || null,
      }));
    },
  });

  const handleReview = async () => {
    if (!reviewId) return;
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Update request status
      const { error: updateError } = await (supabase as any)
        .from('linked_account_change_requests')
        .update({
          status: reviewAction,
          reviewed_by: user?.id,
          review_notes: reviewNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewId);

      if (updateError) throw updateError;

      // If approved, insert the account into customer_linked_accounts
      if (reviewAction === 'approved') {
        const request = requests.find((r: any) => r.id === reviewId);
        if (request) {
          const accountData = request.requested_account_data;
          const { error: insertError } = await (supabase as any)
            .from('customer_linked_accounts')
            .insert({
              user_id: request.user_id,
              ...accountData,
              is_active: true,
              status: 'active',
            });
          if (insertError) throw insertError;
        }
      }

      toast.success(`Request ${reviewAction}`);
      queryClient.invalidateQueries({ queryKey: ['admin-linked-account-requests'] });
      setReviewId(null);
      setReviewNotes('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to process request');
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = requests.filter((r: any) => r.status === 'pending').length;

  return (
    <div className="space-y-6 p-6">
      <AdminPageHeader icon={Link2} title="Linked Account Requests" description="Review and approve customer account re-linking requests" />

      {pendingCount > 0 && (
        <div className="flex justify-end">
          <Badge className="bg-[hsl(40,90%,92%)] text-[hsl(40,80%,35%)] border-0 text-sm">
            <Clock className="h-3.5 w-3.5 mr-1" /> {pendingCount} pending
          </Badge>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-muted-foreground">No requests</p>
          <p className="text-xs text-muted-foreground">Account re-linking requests from customers will appear here.</p>
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Account Details</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req: any) => {
                const data = req.requested_account_data || {};
                const profile = req.profile;
                const statusBadge = req.status === 'pending'
                  ? <Badge className="bg-[hsl(40,90%,92%)] text-[hsl(40,80%,35%)] border-0"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
                  : req.status === 'approved'
                  ? <Badge className="bg-[hsl(150,50%,90%)] text-[hsl(150,50%,30%)] border-0"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>
                  : <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;

                return (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-semibold">
                          {profile?.email || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">{profile?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{data.provider_name || data.account_type}</p>
                        <p className="text-xs text-muted-foreground font-mono">•••• {data.last4}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs capitalize">{req.request_type?.replace(/_/g, ' ')}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(req.created_at), 'MMM d, yyyy')}
                      </span>
                    </TableCell>
                    <TableCell>{statusBadge}</TableCell>
                    <TableCell className="text-right">
                      {req.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline"
                            onClick={() => { setReviewId(req.id); setReviewAction('approved'); }}
                            className="text-xs h-8">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline"
                            onClick={() => { setReviewId(req.id); setReviewAction('rejected'); }}
                            className="text-xs h-8 text-destructive border-destructive/30">
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                          </Button>
                        </div>
                      ) : (
                        req.review_notes && (
                          <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                            <MessageSquare className="h-3 w-3" /> {req.review_notes}
                          </span>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewId} onOpenChange={(v) => { if (!v) { setReviewId(null); setReviewNotes(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewAction === 'approved' ? 'Approve' : 'Reject'} Request</DialogTitle>
            <DialogDescription>
              {reviewAction === 'approved'
                ? 'Approving will activate this linked account for the customer.'
                : 'Rejecting will deny the customer account linking request.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Input
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              placeholder={reviewAction === 'approved' ? 'Approved after verification' : 'Reason for rejection...'}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReviewId(null); setReviewNotes(''); }}>Cancel</Button>
            <Button
              onClick={handleReview}
              disabled={processing}
              className={reviewAction === 'rejected' ? 'bg-destructive text-destructive-foreground' : ''}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {reviewAction === 'approved' ? 'Approve & Activate' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LinkedAccountRequests;
