import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Plus, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, Crown, Shuffle, Hand } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useNjangiGroups, useCreateNjangiGroup, useJoinNjangiGroup, useNjangiContribute, useNjangiPayout } from '@/hooks/useNjangiData';
import { toast } from 'sonner';

const BankNjangi: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const { data: groups, isLoading } = useNjangiGroups();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinGroupId, setJoinGroupId] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '', contribution_amount: '', frequency: 'monthly', payout_method: 'random',
    late_interest_rate: '0', max_members: '5',
  });

  const createMutation = useCreateNjangiGroup();
  const joinMutation = useJoinNjangiGroup();
  const contributeMutation = useNjangiContribute();
  const payoutMutation = useNjangiPayout();

  const handleCreate = () => {
    if (!formData.name || !formData.contribution_amount) { toast.error('Fill required fields'); return; }
    createMutation.mutate({
      ...formData,
      contribution_amount: Number(formData.contribution_amount),
      late_interest_rate: Number(formData.late_interest_rate),
      max_members: Number(formData.max_members),
      institution_id: institutionId,
    }, {
      onSuccess: () => { toast.success('Njangi group created!'); setShowCreate(false); },
    });
  };

  const handleJoin = () => {
    if (!joinGroupId) { toast.error('Enter a group ID'); return; }
    joinMutation.mutate({ group_id: joinGroupId }, {
      onSuccess: () => { toast.success('Joined group!'); setShowJoin(false); setJoinGroupId(''); },
    });
  };

  const handleContribute = (groupId: string) => {
    contributeMutation.mutate({ group_id: groupId }, {
      onSuccess: (data) => {
        const delta = data.score_delta;
        toast.success(`Contribution recorded! ${delta !== 0 ? `Credit score ${delta > 0 ? '+' : ''}${delta}` : ''}`);
      },
    });
  };

  const handlePayout = (groupId: string) => {
    payoutMutation.mutate({ group_id: groupId }, {
      onSuccess: (data) => {
        toast.success(`Payout of ${Number(data.total_amount).toLocaleString()} XAF sent!`);
      },
    });
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Njangi</h1>
          <p className="text-sm text-muted-foreground">Group savings & payouts</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowJoin(true)}>Join</Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1 h-4 w-4" /> Create</Button>
        </div>
      </div>

      {(!groups || groups.length === 0) ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-muted-foreground/30 py-16">
          <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">No groups yet</p>
          <p className="text-xs text-muted-foreground/70">Create or join a Njangi group</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group: any) => {
            const memberCount = group.njangi_members?.length || 0;
            const isCreator = group.creator_id === group._currentUserId;

            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border bg-card p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--bank-violet))]/10">
                      <Users className="h-5 w-5 text-[hsl(var(--bank-violet))]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {memberCount}/{group.max_members} members · Cycle {group.current_cycle}
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${group.status === 'active' ? 'bg-[hsl(var(--bank-mint))]/10 text-[hsl(var(--bank-mint))]' : 'bg-muted text-muted-foreground'}`}>
                    {group.status}
                  </span>
                </div>

                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/30 p-2">
                    <p className="text-xs text-muted-foreground">Contribution</p>
                    <p className="text-sm font-bold">{Number(group.contribution_amount).toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2">
                    <p className="text-xs text-muted-foreground">Frequency</p>
                    <p className="text-sm font-bold capitalize">{group.frequency}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2">
                    <p className="text-xs text-muted-foreground">Payout</p>
                    <div className="flex items-center justify-center gap-1">
                      {group.payout_method === 'random' ? <Shuffle className="h-3 w-3" /> : <Hand className="h-3 w-3" />}
                      <p className="text-sm font-bold capitalize">{group.payout_method}</p>
                    </div>
                  </div>
                </div>

                {group.late_interest_rate > 0 && (
                  <p className="mb-2 text-xs text-[hsl(var(--bank-amber))]">
                    ⚠️ Late interest: {group.late_interest_rate}%
                  </p>
                )}

                {/* Members preview */}
                <div className="mb-3">
                  <p className="mb-1 text-xs font-bold text-muted-foreground">Members</p>
                  <div className="flex flex-wrap gap-1">
                    {(group.njangi_members || []).map((m: any) => (
                      <span key={m.id} className="flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-xs">
                        {m.user_id === group.creator_id && <Crown className="h-3 w-3 text-[hsl(var(--bank-amber))]" />}
                        {m.has_received_payout ? <CheckCircle2 className="h-3 w-3 text-[hsl(var(--bank-mint))]" /> : <Clock className="h-3 w-3 text-muted-foreground" />}
                        {m.user_id.substring(0, 8)}…
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  {group.status === 'active' && (
                    <Button size="sm" className="flex-1" onClick={() => handleContribute(group.id)} disabled={contributeMutation.isPending}>
                      {contributeMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                      Contribute
                    </Button>
                  )}
                  {isCreator && group.status === 'active' && (
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handlePayout(group.id)} disabled={payoutMutation.isPending}>
                      Trigger Payout
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>🤝 Create Njangi Group</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div><Label>Group Name</Label><Input placeholder="e.g. Family Fund" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Contribution Amount (XAF)</Label><Input type="number" placeholder="10000" value={formData.contribution_amount} onChange={e => setFormData(p => ({ ...p, contribution_amount: e.target.value }))} /></div>
            <div>
              <Label>Frequency</Label>
              <Select value={formData.frequency} onValueChange={v => setFormData(p => ({ ...p, frequency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payout Method</Label>
              <Select value={formData.payout_method} onValueChange={v => setFormData(p => ({ ...p, payout_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Random Selection</SelectItem>
                  <SelectItem value="manual">Manual Selection</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Late Interest Rate (%)</Label><Input type="number" placeholder="0" value={formData.late_interest_rate} onChange={e => setFormData(p => ({ ...p, late_interest_rate: e.target.value }))} /></div>
            <div><Label>Max Members</Label><Input type="number" placeholder="5" value={formData.max_members} onChange={e => setFormData(p => ({ ...p, max_members: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Group Dialog */}
      <Dialog open={showJoin} onOpenChange={setShowJoin}>
        <DialogContent>
          <DialogHeader><DialogTitle>Join a Njangi Group</DialogTitle></DialogHeader>
          <div><Label>Group ID</Label><Input placeholder="Paste group ID" value={joinGroupId} onChange={e => setJoinGroupId(e.target.value)} /></div>
          <DialogFooter>
            <Button onClick={handleJoin} disabled={joinMutation.isPending}>
              {joinMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Join
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BankNjangi;
