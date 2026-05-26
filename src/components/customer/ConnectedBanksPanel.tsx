/**
 * ConnectedBanksPanel
 * ───────────────────
 * Lets a consumer link external banks via Open Banking (AISP-style).
 * Calls the `consumer-bank-link` edge function:
 *   - list_banks  → available banks to connect
 *   - list_links  → consumer's current connections
 *   - init        → start a new link (returns authorization URL)
 *   - confirm     → mark link active (sandbox auto-authorise)
 *   - revoke      → disconnect a bank
 */
import React, { useState } from 'react';
import { Building2, Plus, Loader2, CheckCircle2, Unlink, Globe2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface BankOption { id: string; display_name: string; status: string; }
interface PsuLink {
  id: string;
  bank_id: string;
  status: 'pending' | 'active' | 'revoked';
  linked_at: string | null;
  banks?: { display_name: string } | null;
}

export const ConnectedBanksPanel: React.FC = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [connectingBankId, setConnectingBankId] = useState<string | null>(null);

  const invoke = async (action: string, body: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('consumer-bank-link', {
      body: { action, ...body },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.detail || data.message || data.error);
    return data;
  };

  const { data: links = [], isLoading: linksLoading } = useQuery({
    queryKey: ['consumer-bank-psu-links'],
    queryFn: async () => (await invoke('list_links')).links as PsuLink[],
  });

  const { data: availableBanks = [], isLoading: banksLoading } = useQuery({
    queryKey: ['consumer-bank-list'],
    enabled: open,
    queryFn: async () => (await invoke('list_banks')).banks as BankOption[],
  });

  const handleConnect = async (bankId: string) => {
    setConnectingBankId(bankId);
    try {
      const init = await invoke('init', { bank_id: bankId });
      if (init.status !== 'active') {
        // Sandbox: auto-confirm. Production would redirect to init.authorization_url.
        await invoke('confirm', { link_id: init.link_id });
      }
      toast.success(`${init.bank_name || 'Bank'} connected successfully`);
      qc.invalidateQueries({ queryKey: ['consumer-bank-psu-links'] });
      setOpen(false);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to connect bank'));
    } finally {
      setConnectingBankId(null);
    }
  };

  const handleRevoke = async (linkId: string, bankName?: string) => {
    try {
      await invoke('revoke', { link_id: linkId });
      toast.success(`${bankName || 'Bank'} disconnected`);
      qc.invalidateQueries({ queryKey: ['consumer-bank-psu-links'] });
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to disconnect'));
    }
  };

  const activeLinks = links.filter(l => l.status !== 'revoked');
  const linkedBankIds = new Set(activeLinks.map(l => l.bank_id));
  const connectable = availableBanks.filter(b => !linkedBankIds.has(b.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Connected Banks</p>
          <p className="text-[11px] text-muted-foreground">Open Banking · AISP</p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          size="sm"
          variant="outline"
          className="rounded-xl h-8 text-[11px] gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> Connect Bank
        </Button>
      </div>

      {linksLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : activeLinks.length === 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-4">
          <Globe2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.5} />
          <div>
            <p className="text-xs font-semibold text-foreground">No banks connected</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Connect your bank via Open Banking to view balances and initiate transfers without entering account details each time.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {activeLinks.map(link => (
            <motion.div
              key={link.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between rounded-2xl border border-border bg-card p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(210,80%,93%)] shrink-0">
                  <Building2 className="h-5 w-5 text-[hsl(210,60%,45%)]" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {link.banks?.display_name || 'Bank'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {link.status === 'active' ? (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-[hsl(150,50%,92%)] text-[hsl(150,50%,28%)] border-0">
                        <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-[hsl(40,90%,92%)] text-[hsl(40,80%,35%)] border-0">
                        Pending authorisation
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRevoke(link.id, link.banks?.display_name)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted hover:bg-destructive/10 transition-colors"
                aria-label="Disconnect bank"
              >
                <Unlink className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Connect a Bank</DialogTitle>
            <DialogDescription>
              Securely link your bank via Open Banking. You will be redirected to your bank to authorise read access to your accounts.
            </DialogDescription>
          </DialogHeader>

          {banksLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : connectable.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-semibold text-foreground">All available banks are connected</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                New partner banks will appear here as they go live.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {connectable.map(bank => {
                const busy = connectingBankId === bank.id;
                return (
                  <button
                    key={bank.id}
                    onClick={() => handleConnect(bank.id)}
                    disabled={busy || !!connectingBankId}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left hover:bg-muted/50 transition-colors disabled:opacity-50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(210,80%,93%)]">
                      <Building2 className="h-5 w-5 text-[hsl(210,60%,45%)]" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{bank.display_name}</p>
                      <p className="text-[10px] text-muted-foreground">Open Banking · Read access</p>
                    </div>
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConnectedBanksPanel;
