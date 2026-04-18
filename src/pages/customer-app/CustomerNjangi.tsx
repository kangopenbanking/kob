import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CircleDollarSign, Users, Calendar, Plus, ChevronRight, X,
  Loader2, Banknote, AlertCircle, CheckCircle2, Clock, UserPlus, Trophy, Repeat, ShieldCheck, Gift
} from 'lucide-react';
import { HowItWorksFlow, type FlowStep } from '@/components/customer-app/HowItWorksFlow';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerNjangi } from '@/hooks/useCustomerData';
import { useCreateNjangiGroup, useJoinNjangiGroup, useNjangiContribute, useNjangiPayout, useLeaveNjangiGroup } from '@/hooks/useNjangiData';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const circleColors = [
  { bg: 'bg-[hsl(270,60%,92%)]', accent: 'text-[hsl(270,50%,45%)]', bar: 'bg-[hsl(270,50%,45%)]' },
  { bg: 'bg-[hsl(210,80%,93%)]', accent: 'text-[hsl(210,60%,45%)]', bar: 'bg-[hsl(210,60%,45%)]' },
  { bg: 'bg-[hsl(150,40%,90%)]', accent: 'text-[hsl(150,40%,35%)]', bar: 'bg-[hsl(150,40%,35%)]' },
  { bg: 'bg-[hsl(45,70%,90%)]', accent: 'text-[hsl(45,60%,35%)]', bar: 'bg-[hsl(45,60%,35%)]' },
];

type ViewMode = 'list' | 'create' | 'join' | 'detail';

const CustomerNjangi: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const { data: circles = [], isLoading, refetch } = useCustomerNjangi(user?.id);

  const createMutation = useCreateNjangiGroup();
  const joinMutation = useJoinNjangiGroup();
  const contributeMutation = useNjangiContribute();
  const payoutMutation = useNjangiPayout();
  const leaveMutation = useLeaveNjangiGroup();

  const [view, setView] = useState<ViewMode>('list');
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [showPin, setShowPin] = useState(false);
  const [pinAction, setPinAction] = useState<{ type: 'contribute' | 'payout'; groupId: string } | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newContribution, setNewContribution] = useState('');
  const [newMembers, setNewMembers] = useState('5');
  const [newFrequency, setNewFrequency] = useState('monthly');
  const [newPayoutMethod, setNewPayoutMethod] = useState('random');
  const [newLateRate, setNewLateRate] = useState('5');

  // Join form state
  const [joinGroupId, setJoinGroupId] = useState('');

  // Detail view queries
  const { data: detailMembers = [] } = useQuery({
    queryKey: ['njangi-detail-members', selectedGroup?.id],
    enabled: !!selectedGroup?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('njangi_members')
        .select('id, user_id, status, has_received_payout, joined_at')
        .eq('group_id', selectedGroup.id)
        .eq('status', 'active');
      // Get profile names
      const memberIds = (data || []).map(m => m.user_id);
      if (memberIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', memberIds);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      return (data || []).map(m => ({ ...m, profile: profileMap[m.user_id] || null }));
    },
  });

  const { data: detailContributions = [] } = useQuery({
    queryKey: ['njangi-detail-contribs', selectedGroup?.id, selectedGroup?.current_cycle],
    enabled: !!selectedGroup?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('njangi_contributions')
        .select('id, member_id, cycle_number, amount, status, paid_at, late_interest_amount')
        .eq('group_id', selectedGroup.id)
        .eq('cycle_number', selectedGroup.current_cycle);
      return data || [];
    },
  });

  const resetCreateForm = () => {
    setNewName(''); setNewContribution(''); setNewMembers('5');
    setNewFrequency('monthly'); setNewPayoutMethod('random'); setNewLateRate('5');
  };

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Enter a circle name'); return; }
    const amount = parseFloat(newContribution);
    if (!amount || amount < 100) { toast.error('Contribution must be at least 100 XAF'); return; }
    const members = parseInt(newMembers);
    if (!members || members < 2 || members > 50) { toast.error('Members must be 2–50'); return; }
    const lateRate = parseFloat(newLateRate);
    if (isNaN(lateRate) || lateRate < 0 || lateRate > 100) { toast.error('Late interest 0–100%'); return; }

    createMutation.mutate({
      name: newName.trim(),
      contribution_amount: amount,
      frequency: newFrequency,
      payout_method: newPayoutMethod,
      late_interest_rate: lateRate,
      max_members: members,
      institution_id: null,
    }, {
      onSuccess: () => {
        toast.success('Njangi circle created!');
        resetCreateForm();
        setView('list');
        refetch();
      },
    });
  };

  const handleJoin = async () => {
    if (!joinGroupId.trim()) { toast.error('Enter a Group ID'); return; }
    joinMutation.mutate({ group_id: joinGroupId.trim() }, {
      onSuccess: () => {
        toast.success('Joined circle!');
        setJoinGroupId('');
        setView('list');
        refetch();
      },
    });
  };

  const requestContribute = (groupId: string) => {
    setPinAction({ type: 'contribute', groupId });
    setShowPin(true);
  };

  const requestPayout = (groupId: string) => {
    setPinAction({ type: 'payout', groupId });
    setShowPin(true);
  };

  const handlePinConfirmed = async () => {
    if (!pinAction) return;
    if (pinAction.type === 'contribute') {
      contributeMutation.mutate({ group_id: pinAction.groupId }, {
        onSuccess: async (data) => {
          const status = data?.contribution_status === 'late' ? '(late — interest applied)' : '';
          toast.success(`Contribution recorded ${status}`);
          refetch();
          await Promise.all([
            queryClient.refetchQueries({ queryKey: ['customer-accounts'] }),
            queryClient.refetchQueries({ queryKey: ['account-balances'] }),
          ]);
        },
      });
    } else {
      payoutMutation.mutate({ group_id: pinAction.groupId }, {
        onSuccess: async (data) => {
          toast.success(`Payout of ${data?.total_amount?.toLocaleString()} XAF sent! Cycle ${data?.next_cycle} begins.`);
          refetch();
          await Promise.all([
            queryClient.refetchQueries({ queryKey: ['customer-accounts'] }),
            queryClient.refetchQueries({ queryKey: ['account-balances'] }),
          ]);
        },
      });
    }
    setPinAction(null);
  };

  const openDetail = (circle: any) => {
    setSelectedGroup(circle);
    setView('detail');
  };

  const myMemberInGroup = (groupId: string) =>
    detailMembers.find(m => m.user_id === user?.id);

  const hasPaidThisCycle = (memberId: string) =>
    detailContributions.some(c => c.member_id === memberId && (c.status === 'paid' || c.status === 'late'));

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">Njangi</h1>
        </div>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  // ─── Detail View ───
  if (view === 'detail' && selectedGroup) {
    const isCreator = selectedGroup.creator_id === user?.id || selectedGroup._currentUserId === user?.id;
    const allPaid = detailMembers.length > 0 && detailMembers.every(m => hasPaidThisCycle(m.id));
    const myMember = myMemberInGroup(selectedGroup.id);
    const iHavePaid = myMember ? hasPaidThisCycle(myMember.id) : false;
    const style = circleColors[0];

    return (
      <div className="flex flex-col gap-4 p-5 pb-28">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('list'); setSelectedGroup(null); }}>
            <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
          </button>
          <h1 className="text-xl font-bold text-foreground">{selectedGroup.name}</h1>
        </div>

        {/* Status Banner */}
        <div className={`rounded-3xl ${style.bg} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Cycle {selectedGroup.current_cycle}</p>
              <p className="text-lg font-bold text-foreground">{selectedGroup.contribution_amount?.toLocaleString()} XAF</p>
              <p className="text-xs text-muted-foreground">{selectedGroup.frequency} • {selectedGroup.payout_method} payout</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/50">
              <CircleDollarSign className={`h-7 w-7 ${style.accent}`} strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> {detailMembers.length}/{selectedGroup.max_members} members
            {selectedGroup.late_interest_rate > 0 && (
              <span className="ml-2">• {selectedGroup.late_interest_rate}% late fee</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {!iHavePaid && selectedGroup.status === 'active' && (
            <Button onClick={() => requestContribute(selectedGroup.id)} disabled={contributeMutation.isPending}
              className="flex-1 rounded-2xl h-11 gap-2">
              {contributeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
              Contribute
            </Button>
          )}
          {iHavePaid && (
            <div className="flex-1 flex items-center justify-center gap-2 rounded-2xl h-11 bg-[hsl(150,40%,90%)] text-[hsl(150,40%,35%)] text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Paid this cycle
            </div>
          )}
          {isCreator && allPaid && detailMembers.length > 0 && (
            <Button variant="outline" onClick={() => requestPayout(selectedGroup.id)} disabled={payoutMutation.isPending}
              className="flex-1 rounded-2xl h-11 gap-2 border-[hsl(45,60%,35%)] text-[hsl(45,60%,35%)]">
              {payoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              Trigger Payout
            </Button>
          )}
        </div>

        {/* Group ID for sharing */}
        <div className="rounded-2xl bg-card border border-border p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Group ID (share to invite)</p>
          <button onClick={() => { navigator.clipboard.writeText(selectedGroup.id); toast.success('Copied!'); }}
            className="text-xs font-mono text-primary break-all text-left">{selectedGroup.id}</button>
        </div>

        {/* Members List */}
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Members</p>
        <div className="space-y-2">
          {detailMembers.map((m: any) => {
            const paid = hasPaidThisCycle(m.id);
            return (
              <div key={m.id} className="flex items-center justify-between rounded-2xl bg-card border border-border p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                    <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {m.profile?.full_name || m.profile?.email || 'Member'}
                      {m.user_id === user?.id && <span className="text-muted-foreground"> (You)</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {m.has_received_payout ? 'Received payout ✓' : 'Awaiting payout'}
                    </p>
                  </div>
                </div>
                {paid ? (
                  <div className="flex items-center gap-1 text-[hsl(150,60%,40%)]">
                    <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                    <span className="text-[10px] font-bold">Paid</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-4 w-4" strokeWidth={1.5} />
                    <span className="text-[10px] font-bold">Pending</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Contribution Log */}
        {detailContributions.length > 0 && (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mt-2">Cycle {selectedGroup.current_cycle} Contributions</p>
            <div className="space-y-1.5">
              {detailContributions.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl bg-muted/50 p-2.5">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-foreground font-medium">{c.amount?.toLocaleString()} XAF</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.late_interest_amount > 0 && (
                      <span className="text-[10px] text-destructive font-semibold">+{c.late_interest_amount} interest</span>
                    )}
                    <span className={`text-[10px] font-bold ${c.status === 'paid' ? 'text-[hsl(150,60%,40%)]' : c.status === 'late' ? 'text-[hsl(25,80%,50%)]' : 'text-muted-foreground'}`}>
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ─── Create View ───
  if (view === 'create') {
    return (
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('list'); resetCreateForm(); }}>
            <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
          </button>
          <h1 className="text-xl font-bold text-foreground">Create Circle</h1>
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Circle Name</Label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Family Savings" className="rounded-xl" maxLength={60} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Contribution Amount (XAF)</Label>
            <Input type="number" value={newContribution} onChange={e => setNewContribution(e.target.value)} placeholder="e.g. 25000" className="rounded-xl" min={100} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Frequency</Label>
              <Select value={newFrequency} onValueChange={setNewFrequency}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Payout Method</Label>
              <Select value={newPayoutMethod} onValueChange={setNewPayoutMethod}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Random</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Max Members</Label>
              <Input type="number" value={newMembers} onChange={e => setNewMembers(e.target.value)} className="rounded-xl" min={2} max={50} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Late Interest (%)</Label>
              <Input type="number" value={newLateRate} onChange={e => setNewLateRate(e.target.value)} className="rounded-xl" min={0} max={100} />
            </div>
          </div>

          <div className="rounded-2xl bg-[hsl(45,70%,90%)] p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-[hsl(45,60%,35%)] mt-0.5 shrink-0" strokeWidth={1.5} />
            <p className="text-[11px] text-[hsl(45,60%,25%)]">
              Your contributions and payment history will be reported to your credit score. On-time payments boost your score.
            </p>
          </div>

          <Button onClick={handleCreate} disabled={createMutation.isPending} className="rounded-2xl h-12 font-semibold">
            {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Create Circle
          </Button>
        </div>
      </div>
    );
  }

  // ─── Join View ───
  if (view === 'join') {
    return (
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('list'); setJoinGroupId(''); }}>
            <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
          </button>
          <h1 className="text-xl font-bold text-foreground">Join Circle</h1>
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(210,80%,93%)] mx-auto">
            <UserPlus className="h-7 w-7 text-[hsl(210,60%,45%)]" strokeWidth={1.5} />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Enter the Group ID shared by the circle creator to join.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Group ID</Label>
            <Input value={joinGroupId} onChange={e => setJoinGroupId(e.target.value)} placeholder="Paste group ID" className="rounded-xl font-mono text-xs" />
          </div>
          <Button onClick={handleJoin} disabled={joinMutation.isPending} className="rounded-2xl h-12 font-semibold">
            {joinMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Join Circle
          </Button>
        </div>
      </div>
    );
  }

  // ─── List View ───
  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Njangi</h1>
      </div>

      {/* How It Works Flow */}
      <HowItWorksFlow
        title="How Njangi Works"
        steps={[
          { icon: Plus, title: 'Create or Join a Circle', description: 'Start your own savings circle or join one using a Group ID shared by the creator.', color: 'hsl(270,60%,92%)', iconColor: 'hsl(270,50%,45%)' },
          { icon: Users, title: 'Invite Members', description: 'Share your Group ID with friends and family. Set contribution amounts and frequency.', color: 'hsl(210,80%,93%)', iconColor: 'hsl(210,60%,45%)' },
          { icon: Repeat, title: 'Contribute Each Cycle', description: 'Members contribute a fixed amount each cycle. Late payments incur interest fees.', color: 'hsl(45,70%,90%)', iconColor: 'hsl(45,60%,35%)' },
          { icon: Gift, title: 'Receive Your Payout', description: 'Each cycle, one member receives the full pot. The rotation continues until everyone benefits.', color: 'hsl(150,40%,90%)', iconColor: 'hsl(150,40%,35%)' },
          { icon: ShieldCheck, title: 'Build Your Credit', description: 'On-time contributions boost your credit score. Your participation is reported automatically.', color: 'hsl(340,60%,92%)', iconColor: 'hsl(340,50%,45%)' },
        ] as FlowStep[]}
      />

      {/* Summary */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 rounded-3xl bg-[hsl(270,60%,92%)] p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/50">
          <CircleDollarSign className="h-7 w-7 text-[hsl(270,50%,45%)]" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Active Circles</p>
          <p className="text-2xl font-bold text-foreground">{circles.length}</p>
        </div>
      </motion.div>

      {/* Circles */}
      {circles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <CircleDollarSign className="h-12 w-12 text-muted-foreground" strokeWidth={1} />
          <p className="text-sm font-semibold text-muted-foreground">No active circles</p>
          <p className="text-xs text-muted-foreground text-center">Create or join a Njangi circle to start saving together</p>
        </div>
      ) : (
        circles.map((c: any, i: number) => {
          const style = circleColors[i % circleColors.length];
          return (
            <motion.button key={c.id} onClick={() => openDetail(c)}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }} className={`rounded-3xl ${style.bg} p-4 text-left w-full`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-foreground">{c.name}</p>
                <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-[11px] text-muted-foreground">{c.member_count} members</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-[11px] text-muted-foreground">{c.contribution_amount?.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-[11px] text-muted-foreground">{c.frequency}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-background/50 overflow-hidden">
                  <div className={`h-full rounded-full ${style.bar}`}
                    style={{ width: `${c.max_members > 0 ? (c.current_cycle / c.max_members) * 100 : 0}%` }} />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">Cycle {c.current_cycle}</span>
              </div>
            </motion.button>
          );
        })
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button className="flex-1 rounded-2xl h-12 gap-2" onClick={() => setView('create')}>
          <Plus className="h-4 w-4" strokeWidth={1.5} /> Create Circle
        </Button>
        <Button variant="outline" className="flex-1 rounded-2xl h-12 gap-2" onClick={() => setView('join')}>
          <UserPlus className="h-4 w-4" strokeWidth={1.5} /> Join Circle
        </Button>
      </div>

      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={handlePinConfirmed} />
    </div>
  );
};

export default CustomerNjangi;
