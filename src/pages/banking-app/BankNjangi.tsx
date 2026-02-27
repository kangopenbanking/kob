import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Plus, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, Crown, Shuffle, Hand, Copy, TrendingUp, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useNjangiGroups, useCreateNjangiGroup, useJoinNjangiGroup, useNjangiContribute, useNjangiPayout } from '@/hooks/useNjangiData';
import { toast } from 'sonner';
import { sounds } from '@/lib/sounds';

const BankNjangi: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const { data: groups, isLoading } = useNjangiGroups();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinGroupId, setJoinGroupId] = useState('');
  const [formStep, setFormStep] = useState(0);

  const [formData, setFormData] = useState({
    name: '', contribution_amount: '', frequency: 'monthly', payout_method: 'random',
    late_interest_rate: '0', max_members: '5',
  });

  const createMutation = useCreateNjangiGroup();
  const joinMutation = useJoinNjangiGroup();
  const contributeMutation = useNjangiContribute();
  const payoutMutation = useNjangiPayout();

  const handleCreate = () => {
    if (!formData.name || !formData.contribution_amount) { sounds.error(); toast.error('Fill required fields'); return; }
    sounds.tap();
    createMutation.mutate({
      ...formData,
      contribution_amount: Number(formData.contribution_amount),
      late_interest_rate: Number(formData.late_interest_rate),
      max_members: Number(formData.max_members),
      institution_id: institutionId,
    }, {
      onSuccess: () => { sounds.success(); toast.success('Njangi group created!'); setShowCreate(false); setFormStep(0); },
    });
  };

  const handleJoin = () => {
    if (!joinGroupId) { sounds.error(); toast.error('Enter a group ID'); return; }
    sounds.tap();
    joinMutation.mutate({ group_id: joinGroupId }, {
      onSuccess: () => { sounds.success(); toast.success('Joined group!'); setShowJoin(false); setJoinGroupId(''); },
    });
  };

  const handleContribute = (groupId: string) => {
    sounds.tap();
    contributeMutation.mutate({ group_id: groupId }, {
      onSuccess: (data) => {
        sounds.success();
        const delta = data.score_delta;
        toast.success(`Contribution recorded! ${delta !== 0 ? `Credit score ${delta > 0 ? '+' : ''}${delta}` : ''}`);
      },
    });
  };

  const handlePayout = (groupId: string) => {
    sounds.tap();
    payoutMutation.mutate({ group_id: groupId }, {
      onSuccess: (data) => {
        sounds.success();
        toast.success(`Payout of ${Number(data.total_amount).toLocaleString()} XAF sent!`);
      },
    });
  };

  const copyGroupId = (id: string) => {
    navigator.clipboard.writeText(id);
    sounds.confirm();
    toast.success('Group ID copied!');
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col px-4 py-6">
      <button onClick={() => { sounds.navigate(); navigate(-1); }} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-700 p-6 text-white shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-6 w-6" />
              <h1 className="text-xl font-bold">Njangi</h1>
            </div>
            <p className="text-sm text-white/70">Group savings & rotation pot</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold">
            <TrendingUp className="h-3.5 w-3.5" /> CrediQ
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="secondary" className="rounded-full bg-white/20 text-white border-0 hover:bg-white/30" onClick={() => { sounds.tap(); setShowJoin(true); }}>
            Join Group
          </Button>
          <Button size="sm" variant="secondary" className="rounded-full bg-white/20 text-white border-0 hover:bg-white/30" onClick={() => { sounds.tap(); setFormStep(0); setShowCreate(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Create
          </Button>
        </div>
      </motion.div>

      {/* Groups list */}
      {(!groups || groups.length === 0) ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-muted-foreground/20 py-16 bg-muted/20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <Users className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">No groups yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Create or join a Njangi group</p>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group: any, i: number) => {
            const memberCount = group.njangi_members?.length || 0;
            const isCreator = group.creator_id === group._currentUserId;

            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl border-0 overflow-hidden shadow-sm"
              >
                <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-600" />
                <div className="bg-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                        <Users className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{group.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {memberCount}/{group.max_members} members · Cycle {group.current_cycle}
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      group.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                    }`}>
                      {group.status}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="mb-3 grid grid-cols-3 gap-2">
                    {[
                      { label: 'Contribution', value: Number(group.contribution_amount).toLocaleString() },
                      { label: 'Frequency', value: group.frequency },
                      { label: 'Payout', value: group.payout_method, icon: group.payout_method === 'random' ? Shuffle : Hand },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-xl bg-muted/40 p-2.5 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                        <div className="flex items-center justify-center gap-1 mt-0.5">
                          {stat.icon && <stat.icon className="h-3 w-3 text-muted-foreground" />}
                          <p className="text-xs font-bold capitalize">{stat.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {group.late_interest_rate > 0 && (
                    <p className="mb-2 text-xs text-amber-500 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Late interest: {group.late_interest_rate}%
                    </p>
                  )}

                  {/* Share group ID */}
                  <button onClick={() => copyGroupId(group.id)} className="mb-3 flex items-center gap-2 w-full rounded-xl bg-muted/30 px-3 py-2 text-xs hover:bg-muted/50 transition-colors">
                    <Copy className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-muted-foreground truncate">{group.id}</span>
                    <span className="ml-auto text-primary font-semibold">Copy</span>
                  </button>

                  {/* Members */}
                  <div className="mb-3">
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Members</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(group.njangi_members || []).map((m: any) => (
                        <span key={m.id} className="flex items-center gap-1 rounded-full bg-muted/50 px-2.5 py-1 text-[10px] font-medium">
                          {m.user_id === group.creator_id && <Crown className="h-3 w-3 text-amber-500" />}
                          {m.has_received_payout ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Clock className="h-3 w-3 text-muted-foreground" />}
                          {m.user_id.substring(0, 8)}…
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {group.status === 'active' && (
                      <Button size="sm" className="flex-1 rounded-full" onClick={() => handleContribute(group.id)} disabled={contributeMutation.isPending}>
                        {contributeMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                        Contribute
                      </Button>
                    )}
                    {isCreator && group.status === 'active' && (
                      <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => handlePayout(group.id)} disabled={payoutMutation.isPending}>
                        Trigger Payout
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Group Dialog — Multi-step */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">🤝 Create Njangi Group</DialogTitle>
            <div className="flex items-center justify-center gap-2 pt-2">
              {[0, 1].map(step => (
                <div key={step} className={`h-1.5 rounded-full transition-all ${step === formStep ? 'w-8 bg-primary' : step < formStep ? 'w-4 bg-primary/40' : 'w-4 bg-muted'}`} />
              ))}
            </div>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {formStep === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4 py-2">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Group Name</Label>
                  <Input placeholder="e.g. Family Fund" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className="mt-1.5 rounded-xl h-11" />
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contribution Amount (XAF)</Label>
                  <Input type="number" placeholder="10,000" value={formData.contribution_amount} onChange={e => setFormData(p => ({ ...p, contribution_amount: e.target.value }))} className="mt-1.5 rounded-xl h-11" />
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Max Members</Label>
                  <Input type="number" placeholder="5" value={formData.max_members} onChange={e => setFormData(p => ({ ...p, max_members: e.target.value }))} className="mt-1.5 rounded-xl h-11" />
                </div>
              </motion.div>
            )}

            {formStep === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4 py-2">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Frequency</Label>
                  <Select value={formData.frequency} onValueChange={v => setFormData(p => ({ ...p, frequency: v }))}>
                    <SelectTrigger className="mt-1.5 rounded-xl h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payout Method</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    {[
                      { val: 'random', label: 'Random', icon: Shuffle, desc: 'Auto-select recipient' },
                      { val: 'manual', label: 'Manual', icon: Hand, desc: 'Creator selects' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => { sounds.tap(); setFormData(p => ({ ...p, payout_method: opt.val })); }}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${formData.payout_method === opt.val ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/30'}`}
                      >
                        <opt.icon className={`h-5 w-5 ${formData.payout_method === opt.val ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-xs font-bold">{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Late Interest Rate (%)</Label>
                  <Input type="number" placeholder="0" value={formData.late_interest_rate} onChange={e => setFormData(p => ({ ...p, late_interest_rate: e.target.value }))} className="mt-1.5 rounded-xl h-11" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <DialogFooter className="flex gap-2 pt-2">
            {formStep > 0 && <Button variant="outline" className="rounded-full" onClick={() => { sounds.navigate(); setFormStep(0); }}>Back</Button>}
            {formStep === 0 ? (
              <Button className="rounded-full flex-1" onClick={() => { sounds.navigate(); setFormStep(1); }}>Continue</Button>
            ) : (
              <Button className="rounded-full flex-1" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                Create Group
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join Group Dialog */}
      <Dialog open={showJoin} onOpenChange={setShowJoin}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 mb-2">
              <Users className="h-7 w-7 text-violet-500" />
            </div>
            <DialogTitle className="text-center">Join a Njangi Group</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Group ID</Label>
            <Input placeholder="Paste group ID from a friend" value={joinGroupId} onChange={e => setJoinGroupId(e.target.value)} className="mt-1.5 rounded-xl h-11" />
          </div>
          <DialogFooter>
            <Button className="rounded-full w-full" onClick={handleJoin} disabled={joinMutation.isPending}>
              {joinMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Join Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BankNjangi;
