import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Smartphone, Wallet, CreditCard, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

// Cameroon bank directory (synced with directory-banks-cm edge function)
const CM_BANKS = [
  { code: '10005', name: 'Afriland First Bank', swift: 'AFRIACMCXXX' },
  { code: '10009', name: 'Atlantic Bank Cameroon', swift: 'ATCRCMCMXXX' },
  { code: '10017', name: 'Ecobank Cameroon', swift: 'ECOCCMCXXXX' },
  { code: '10023', name: 'Standard Chartered Bank', swift: 'SCBLCMCXXXX' },
  { code: '10025', name: 'Citibank N.A. Cameroon', swift: 'CITICMCXXXX' },
  { code: '10029', name: 'BICEC', swift: 'BICECMCXXXX' },
  { code: '10033', name: 'Société Générale Cameroun', swift: 'SGCMCMCXXXX' },
  { code: '10038', name: 'UBA Cameroon', swift: 'UNAFCMCXXXX' },
  { code: '10039', name: 'NFC Bank', swift: 'NFBKCMCXXXX' },
  { code: '10041', name: 'CBC', swift: 'CBCRCMCXXXX' },
  { code: '10050', name: 'BGFI Bank Cameroon', swift: 'BGFICMCXXXX' },
  { code: '10055', name: 'CCA Bank', swift: 'CCAICMCXXXX' },
  { code: '10060', name: 'National Financial Credit Bank', swift: 'NFCBCMCXXXX' },
  { code: '10065', name: 'BC-PME', swift: 'BCPMCMCXXXX' },
  { code: '10070', name: 'UBC', swift: 'UBCMCMCXXXX' },
];

interface AccountTypeConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  iconColor: string;
  providerType: string;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
}

const accountTypes: AccountTypeConfig[] = [
  {
    key: 'bank_account', label: 'Bank Account (RIB)', description: 'Link via 23-digit Cameroon RIB',
    icon: Building2, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]', providerType: 'bank',
    fields: [
      { key: 'account_name', label: 'Account Holder Name', placeholder: 'Full name on account' },
      { key: 'bank_code', label: 'Bank', placeholder: 'Select your bank' },
      { key: 'account_number', label: 'RIB Number (23 digits)', placeholder: '10005-00100-01234567890-23' },
    ],
  },
  {
    key: 'bank_iban', label: 'International (IBAN)', description: 'Link via IBAN for international transfers',
    icon: Globe, color: 'bg-[hsl(270,50%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]', providerType: 'bank',
    fields: [
      { key: 'account_name', label: 'Account Holder Name', placeholder: 'Full name on account' },
      { key: 'account_number', label: 'IBAN', placeholder: 'CM21 10005 00100 01234567890 23' },
    ],
  },
  {
    key: 'momo_mtn', label: 'MTN MoMo', description: 'Link your MTN Mobile Money',
    icon: Smartphone, color: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]', providerType: 'mobile_money',
    fields: [
      { key: 'account_name', label: 'Account Name', placeholder: 'Name on MoMo account' },
      { key: 'account_number', label: 'Phone Number', placeholder: '+237 6XX XXX XXX', type: 'tel' },
    ],
  },
  {
    key: 'momo_orange', label: 'Orange Money', description: 'Link your Orange Mobile Money',
    icon: Smartphone, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]', providerType: 'mobile_money',
    fields: [
      { key: 'account_name', label: 'Account Name', placeholder: 'Name on account' },
      { key: 'account_number', label: 'Phone Number', placeholder: '+237 6XX XXX XXX', type: 'tel' },
    ],
  },
  {
    key: 'paypal', label: 'PayPal', description: 'Link your PayPal account',
    icon: Wallet, color: 'bg-[hsl(210,70%,90%)]', iconColor: 'text-[hsl(210,70%,50%)]', providerType: 'paypal',
    fields: [
      { key: 'account_name', label: 'PayPal Name', placeholder: 'Full name on PayPal' },
      { key: 'account_number', label: 'PayPal Email', placeholder: 'your@email.com', type: 'email' },
    ],
  },
  {
    key: 'bank_card', label: 'Bank Card', description: 'Link a debit or credit card',
    icon: CreditCard, color: 'bg-[hsl(270,50%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]', providerType: 'card',
    fields: [
      { key: 'account_name', label: 'Cardholder Name', placeholder: 'Name on card' },
      { key: 'account_number', label: 'Card Number', placeholder: '**** **** **** 1234' },
      { key: 'provider_name', label: 'Card Network', placeholder: 'Visa / Mastercard' },
    ],
  },
];

const getIconForType = (type: string) => {
  const found = accountTypes.find(t => t.key === type);
  return found || accountTypes[0];
};

// RIB formatting helper
const formatRibInput = (value: string): string => {
  const digits = value.replace(/\D/g, '').substring(0, 23);
  if (digits.length <= 5) return digits;
  if (digits.length <= 10) return `${digits.substring(0, 5)}-${digits.substring(5)}`;
  if (digits.length <= 21) return `${digits.substring(0, 5)}-${digits.substring(5, 10)}-${digits.substring(10)}`;
  return `${digits.substring(0, 5)}-${digits.substring(5, 10)}-${digits.substring(10, 21)}-${digits.substring(21)}`;
};

// IBAN formatting helper
const formatIbanInput = (value: string): string => {
  const clean = value.replace(/\s/g, '').toUpperCase().substring(0, 34);
  return clean.match(/.{1,4}/g)?.join(' ') || clean;
};

// RIB MOD-97 key validation (client-side)
const validateRibChecksum = (rib23: string): { valid: boolean; expectedKey: string } => {
  const bank = parseInt(rib23.substring(0, 5), 10);
  const branch = parseInt(rib23.substring(5, 10), 10);
  const accountStr = rib23.substring(10, 21);
  let accountMod = 0;
  for (let i = 0; i < accountStr.length; i++) {
    accountMod = (accountMod * 10 + parseInt(accountStr[i], 10)) % 97;
  }
  const combined = ((bank % 97) * 89 + (branch % 97) * 15 + accountMod * 3) % 97;
  const key = 97 - combined;
  const expectedKey = key.toString().padStart(2, '0');
  const actualKey = rib23.substring(21, 23);
  return { valid: actualKey === expectedKey, expectedKey };
};

const CustomerLinkedAccounts: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedType, setSelectedType] = useState<AccountTypeConfig | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [validationMsg, setValidationMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const { data: linkedAccounts = [], isLoading } = useQuery({
    queryKey: ['customer-linked-accounts', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('customer_linked_accounts')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleAccountNumberChange = useCallback((value: string) => {
    if (!selectedType) return;
    setValidationMsg(null);

    if (selectedType.key === 'bank_account') {
      const formatted = formatRibInput(value);
      setFormData(prev => ({ ...prev, account_number: formatted }));
      const digits = formatted.replace(/\D/g, '');
      if (digits.length === 23) {
        const { valid, expectedKey } = validateRibChecksum(digits);
        if (valid) {
          const bankCode = digits.substring(0, 5);
          const bank = CM_BANKS.find(b => b.code === bankCode);
          setValidationMsg({ text: `✓ Valid RIB${bank ? ` — ${bank.name}` : ''}`, isError: false });
          if (bank && !formData.bank_code) {
            setFormData(prev => ({ ...prev, bank_code: bankCode }));
          }
        } else {
          setValidationMsg({ text: `Invalid RIB key: expected ${expectedKey}, got ${digits.substring(21, 23)}`, isError: true });
        }
      } else if (digits.length > 0) {
        setValidationMsg({ text: `${digits.length}/23 digits`, isError: false });
      }
    } else if (selectedType.key === 'bank_iban') {
      const formatted = formatIbanInput(value);
      setFormData(prev => ({ ...prev, account_number: formatted }));
      const clean = formatted.replace(/\s/g, '');
      if (clean.length >= 15 && /^[A-Z]{2}\d{2}/.test(clean)) {
        setValidationMsg({ text: `✓ ${clean.substring(0, 2)} IBAN — ${clean.length} chars`, isError: false });
      } else if (clean.length > 0) {
        setValidationMsg({ text: `${clean.length} characters (min 15)`, isError: false });
      }
    } else {
      setFormData(prev => ({ ...prev, account_number: value }));
    }
  }, [selectedType, formData.bank_code]);

  const handleAddAccount = async () => {
    if (!selectedType || !user) return;

    // Validate required fields
    for (const f of selectedType.fields) {
      if (f.key === 'bank_code') continue; // handled by select
      if (!formData[f.key]?.trim()) { toast.error(`Enter ${f.label.toLowerCase()}`); return; }
    }

    // Extra validation for RIB
    if (selectedType.key === 'bank_account') {
      const digits = (formData.account_number || '').replace(/\D/g, '');
      if (digits.length !== 23) { toast.error('RIB must be exactly 23 digits'); return; }
      const { valid } = validateRibChecksum(digits);
      if (!valid) { toast.error('Invalid RIB checksum'); return; }
      if (!formData.bank_code) { toast.error('Please select your bank'); return; }
    }

    // Extra validation for IBAN
    if (selectedType.key === 'bank_iban') {
      const clean = (formData.account_number || '').replace(/\s/g, '');
      if (clean.length < 15) { toast.error('IBAN too short'); return; }
    }

    setSaving(true);
    try {
      const rawNumber = (formData.account_number || '').replace(/[\s\-]/g, '');
      const last4 = rawNumber.slice(-4);
      const bank = CM_BANKS.find(b => b.code === formData.bank_code);

      const accountType = selectedType.key === 'bank_iban' ? 'bank_account' : selectedType.key;

      const { error } = await (supabase as any).from('customer_linked_accounts').insert({
        user_id: user.id,
        account_type: accountType,
        account_name: formData.account_name || null,
        account_number: rawNumber,
        provider_name: bank?.name || formData.provider_name || selectedType.label,
        provider_type: selectedType.providerType,
        last4,
        is_primary: linkedAccounts.length === 0,
        is_active: true,
        status: 'active',
        metadata: selectedType.key === 'bank_account' ? {
          identifier_type: 'DOMESTIC_RIB',
          rib_bank_code: rawNumber.substring(0, 5),
          rib_branch_code: rawNumber.substring(5, 10),
          rib_account_number: rawNumber.substring(10, 21),
          rib_key: rawNumber.substring(21, 23),
          swift_bic: bank?.swift,
          rail: 'DOMESTIC',
        } : selectedType.key === 'bank_iban' ? {
          identifier_type: 'IBAN',
          country: rawNumber.substring(0, 2),
          rail: 'INTERNATIONAL',
        } : undefined,
      });
      if (error) throw error;
      toast.success(`${selectedType.label} linked successfully`);
      queryClient.invalidateQueries({ queryKey: ['customer-linked-accounts'] });
      setShowAdd(false);
      setSelectedType(null);
      setFormData({});
      setValidationMsg(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to link account');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await (supabase as any).from('customer_linked_accounts')
        .update({ is_active: false, status: 'removed' })
        .eq('id', deleteId);
      toast.success('Account removed');
      queryClient.invalidateQueries({ queryKey: ['customer-linked-accounts'] });
    } catch { toast.error('Failed to remove'); }
    setDeleteId(null);
  };

  const renderField = (f: { key: string; label: string; placeholder: string; type?: string }) => {
    if (f.key === 'bank_code' && selectedType?.key === 'bank_account') {
      return (
        <div key={f.key} className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">{f.label}</label>
          <Select value={formData.bank_code || ''} onValueChange={(v) => setFormData({ ...formData, bank_code: v })}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select your bank" />
            </SelectTrigger>
            <SelectContent>
              {CM_BANKS.map(b => (
                <SelectItem key={b.code} value={b.code}>
                  {b.name} ({b.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (f.key === 'account_number' && (selectedType?.key === 'bank_account' || selectedType?.key === 'bank_iban')) {
      return (
        <div key={f.key} className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">{f.label}</label>
          <Input
            type="text"
            value={formData.account_number || ''}
            onChange={e => handleAccountNumberChange(e.target.value)}
            placeholder={f.placeholder}
            className="rounded-xl font-mono tracking-wider"
          />
          {validationMsg && (
            <p className={`text-[11px] ${validationMsg.isError ? 'text-destructive' : 'text-green-600'}`}>
              {validationMsg.text}
            </p>
          )}
          {selectedType?.key === 'bank_account' && (
            <p className="text-[10px] text-muted-foreground">
              Format: Bank (5) - Branch (5) - Account (11) - Key (2)
            </p>
          )}
        </div>
      );
    }

    return (
      <div key={f.key} className="space-y-1">
        <label className="text-[11px] font-semibold text-muted-foreground">{f.label}</label>
        <Input
          type={f.type || 'text'}
          value={formData[f.key] || ''}
          onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
          placeholder={f.placeholder}
          className="rounded-xl"
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
          </button>
          <h1 className="text-xl font-bold text-foreground">Linked Accounts</h1>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
          <Plus className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
        </button>
      </div>

      {/* Info Banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 rounded-2xl bg-[hsl(210,80%,93%)] p-4">
        <CheckCircle2 className="h-5 w-5 text-[hsl(210,60%,45%)] mt-0.5 shrink-0" strokeWidth={1.5} />
        <div>
          <p className="text-xs font-bold text-foreground">Free deposits, low-cost withdrawals</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Adding money from your linked accounts is always free. Withdrawing back has a small admin-managed fee.
          </p>
        </div>
      </motion.div>

      {/* Account List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : linkedAccounts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Building2 className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-foreground">No linked accounts</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">Link a bank account, mobile money, PayPal, or card to deposit and withdraw funds.</p>
          <Button onClick={() => setShowAdd(true)} className="rounded-2xl mt-2"><Plus className="h-4 w-4 mr-1" /> Link Account</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {linkedAccounts.map((acc: any) => {
            const config = getIconForType(acc.account_type);
            const Icon = config.icon;
            const meta = acc.metadata as any;
            const identifierBadge = meta?.identifier_type === 'DOMESTIC_RIB' ? 'RIB' : meta?.identifier_type === 'IBAN' ? 'IBAN' : null;
            return (
              <motion.div key={acc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between rounded-3xl border-2 border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${config.color}`}>
                    <Icon className={`h-5 w-5 ${config.iconColor}`} strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-foreground">{acc.account_name || config.label}</p>
                      {identifierBadge && (
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                          identifierBadge === 'RIB' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>{identifierBadge}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {acc.provider_name || config.label} {acc.last4 ? `•••• ${acc.last4}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {acc.is_primary && (
                    <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Primary</span>
                  )}
                  <button onClick={() => setDeleteId(acc.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" strokeWidth={1.5} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Account Dialog */}
      <Dialog open={showAdd} onOpenChange={(v) => { setShowAdd(v); if (!v) { setSelectedType(null); setFormData({}); setValidationMsg(null); } }}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>{selectedType ? `Link ${selectedType.label}` : 'Link an Account'}</DialogTitle>
            <DialogDescription>
              {selectedType ? `Enter your ${selectedType.label} details below` : 'Select the type of account to link'}
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {!selectedType ? (
              <motion.div key="types" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                {accountTypes.map((t) => (
                  <button key={t.key} onClick={() => { setSelectedType(t); setFormData({}); setValidationMsg(null); }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left hover:bg-muted/50 transition-colors">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.color}`}>
                      <t.icon className={`h-5 w-5 ${t.iconColor}`} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.label}</p>
                      <p className="text-[11px] text-muted-foreground">{t.description}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <button onClick={() => { setSelectedType(null); setFormData({}); setValidationMsg(null); }}
                  className="text-xs text-primary font-semibold flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" /> Back to account types
                </button>
                {selectedType.fields.map(f => renderField(f))}
                <Button onClick={handleAddAccount} disabled={saving} className="w-full rounded-2xl h-12">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Link {selectedType.label}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Account?</AlertDialogTitle>
            <AlertDialogDescription>This account will be unlinked from your wallet. You can re-add it anytime.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CustomerLinkedAccounts;