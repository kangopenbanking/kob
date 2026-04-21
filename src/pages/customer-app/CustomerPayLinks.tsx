import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Link2, Plus, Copy, Share2, X, Calendar, DollarSign, StickyNote, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { API_CONFIG } from '@/config/api';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

const CustomerPayLinks: React.FC = () => {
  const tr = useHarvestedT('customer');
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['customer-pay-links', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_pay_links')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Form state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [isOpenAmount, setIsOpenAmount] = useState(false);

  

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Enter a link name'); return; }
    if (!newDescription.trim()) { toast.error('Enter a description'); return; }
    if (!isOpenAmount && (!newAmount || Number(newAmount) <= 0)) { toast.error('Enter a valid amount or enable open amount'); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-paylinks-ops', {
        body: {
          action: 'create',
          name: newName.trim(),
          description: newDescription.trim(),
          amount: isOpenAmount ? null : Number(newAmount),
          is_open_amount: isOpenAmount,
          expires_at: newExpiry ? new Date(newExpiry).toISOString() : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ['customer-pay-links'] });
      setShowCreate(false);
      resetForm();
      toast.success('Pay link created!');
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to create link'));
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => { setNewName(''); setNewDescription(''); setNewAmount(''); setNewExpiry(''); setIsOpenAmount(false); };

  const getUrl = (slug: string) => `${API_CONFIG.SITE_URL}/pay/${slug}`;

  const handleCopy = (slug: string) => {
    navigator.clipboard.writeText(getUrl(slug)).then(
      () => toast.success('Link copied to clipboard'),
      () => toast.success('Link copied!')
    );
  };

  const handleShare = (link: any) => {
    const url = getUrl(link.slug);
    if (navigator.share) {
      navigator.share({ title: link.name, url });
    } else {
      handleCopy(link.slug);
    }
  };

  const handleToggle = async (link: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-paylinks-ops', {
        body: { action: 'toggle', link_id: link.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ['customer-pay-links'] });
      toast.success(data?.is_active ? 'Link activated' : 'Link deactivated');
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to update'));
    }
  };

  const totalRevenue = links.reduce((s: number, l: any) => s + Number(l.total_collected || 0), 0);
  const totalClicks = links.reduce((s: number, l: any) => s + (l.clicks || 0), 0);

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">{tr('Pay Links')}</h1>
        </div>
        <Button size="sm" className="rounded-2xl h-9 text-xs font-bold" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2} /> New Link
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-[hsl(210,80%,93%)] p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(210,60%,45%)]">{tr('Links')}</p>
          <p className="text-sm font-bold text-[hsl(210,60%,45%)] mt-0.5">{links.length}</p>
        </div>
        <div className="rounded-2xl bg-[hsl(150,40%,90%)] p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(150,60%,40%)]">{tr('Clicks')}</p>
          <p className="text-sm font-bold text-[hsl(150,60%,40%)] mt-0.5">{totalClicks}</p>
        </div>
        <div className="rounded-2xl bg-[hsl(45,70%,90%)] p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(45,60%,35%)]">{tr('Revenue')}</p>
          <p className="text-sm font-bold text-[hsl(45,60%,35%)] mt-0.5">{totalRevenue > 0 ? `${(totalRevenue / 1000).toFixed(0)}K` : '0'}</p>
        </div>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-3xl border-2 border-foreground bg-card">
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">{tr('Create Pay Link')}</p>
                <button onClick={() => { setShowCreate(false); resetForm(); }}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{tr('Link Details')}</p>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={tr('Link name (e.g. Product Payment)')} className="rounded-xl pl-10" />
                </div>
                <div className="relative">
                  <StickyNote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <Input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder={tr('Description')} className="rounded-xl pl-10" />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{tr('Amount')}</p>
                <button onClick={() => setIsOpenAmount(!isOpenAmount)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold transition-all ${isOpenAmount ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${isOpenAmount ? 'border-background' : 'border-muted-foreground'}`}>
                    {isOpenAmount && <div className="h-2 w-2 rounded-full bg-background" />}
                  </div>
                  Open amount (payer decides)
                </button>
                {!isOpenAmount && (
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    <Input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder={tr('Amount (XAF)')} className="rounded-xl pl-10" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{tr('Expiry (optional)')}</p>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <Input type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} className="rounded-xl pl-10" />
                </div>
              </div>

              <Button onClick={handleCreate} disabled={creating} className="rounded-2xl h-11 text-xs font-bold">
                {creating ? <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> {tr('Creating...')}</span>
                  : <><Link2 className="mr-2 h-4 w-4" strokeWidth={1.5} /> {tr('Create Pay Link')}</>}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Links List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : links.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{tr('No pay links yet. Create your first one!')}</p>
        ) : links.map((link: any, i: number) => (
          <motion.div key={link.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }} className="rounded-3xl bg-card border-2 border-border p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-bold text-foreground">{link.name}</p>
              <button onClick={() => handleToggle(link)}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${link.is_active ? 'bg-[hsl(150,40%,90%)] text-[hsl(150,60%,40%)]' : 'bg-muted text-muted-foreground'}`}>
                {link.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">{link.description}</p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-3">
              <span className="font-bold">{link.amount ? `${Number(link.amount).toLocaleString()} XAF` : 'Open amount'}</span>
              <span>·</span>
              <span>{link.clicks || 0} clicks</span>
              <span>·</span>
              <span>{link.payments_count || 0} payments</span>
              {link.expires_at && <><span>·</span><span>Exp: {new Date(link.expires_at).toLocaleDateString()}</span></>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleCopy(link.slug)} className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 flex-1 justify-center">
                <Copy className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-[10px] font-bold text-muted-foreground">{tr('Copy')}</span>
              </button>
              <button onClick={() => handleShare(link)} className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 flex-1 justify-center">
                <Share2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-[10px] font-bold text-muted-foreground">{tr('Share')}</span>
              </button>
              <button onClick={() => window.open(getUrl(link.slug), '_blank')} className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2">
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default CustomerPayLinks;
