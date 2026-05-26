import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Smartphone, Wallet, CreditCard, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Globe, Clock, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import kangCardBg from '@/assets/kangcard_visa.png';
import { CM_BANKS } from '@/constants/cameroon-banks';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';
import { KangIdBadge } from '@/components/identity/KangIdBadge';

const MAX_LINKED_ACCOUNTS = 3;

const CARD_NETWORKS = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'amex', label: 'American Express' },
];

interface AccountTypeConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  iconColor: string;
  providerType: string;
  fields: { key: string; label: string; placeholder: string; type?: string; fieldType?: string }[];
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
    icon: CreditCard, color: 'bg-[hsl(225,70%,92%)]', iconColor: 'text-[hsl(225,60%,50%)]', providerType: 'card',
    fields: [
      { key: 'account_name', label: 'Cardholder Name', placeholder: 'Name on card' },
      { key: 'account_number', label: 'Card Number', placeholder: '4242 4242 4242 4242' },
      { key: 'card_network', label: 'Card Network', placeholder: 'Select network', fieldType: 'card_network' },
      { key: 'card_exp_month', label: 'Expiry Month', placeholder: 'MM', fieldType: 'exp_month' },
      { key: 'card_exp_year', label: 'Expiry Year', placeholder: 'YY', fieldType: 'exp_year' },
    ],
  },
];

const getIconForType = (type: string) => {
  const found = accountTypes.find(t => t.key === type);
  return found || accountTypes[0];
};

// Formatting helpers
const formatRibInput = (value: string): string => {
  const digits = value.replace(/\D/g, '').substring(0, 23);
  if (digits.length <= 5) return digits;
  if (digits.length <= 10) return `${digits.substring(0, 5)}-${digits.substring(5)}`;
  if (digits.length <= 21) return `${digits.substring(0, 5)}-${digits.substring(5, 10)}-${digits.substring(10)}`;
  return `${digits.substring(0, 5)}-${digits.substring(5, 10)}-${digits.substring(10, 21)}-${digits.substring(21)}`;
};

const formatIbanInput = (value: string): string => {
  const clean = value.replace(/\s/g, '').toUpperCase().substring(0, 34);
  return clean.match(/.{1,4}/g)?.join(' ') || clean;
};

const formatCardNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '').substring(0, 16);
  return digits.match(/.{1,4}/g)?.join(' ') || digits;
};

const formatPhoneNumber = (value: string): string => {
  let clean = value.replace(/[^\d+]/g, '');
  if (!clean.startsWith('+')) clean = '+' + clean;
  return clean.substring(0, 16);
};

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

const validateInternationalPhone = (phone: string): boolean => {
  const clean = phone.replace(/\D/g, '');
  // Accept international format: country code + local number (7-15 digits total)
  return /^[1-9]\d{6,14}$/.test(clean);
};

const validateEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/* ─── Delete Button ─── */
const CardDeleteBtn = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick}
    className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm hover:bg-white/25 transition-colors">
    <Trash2 className="h-4 w-4 text-white/90" strokeWidth={1.5} />
  </button>
);

const CardDeleteBtnDark = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick}
    className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground/5 hover:bg-destructive/10 transition-colors">
    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" strokeWidth={1.5} />
  </button>
);

/* ─── Bank Card (Visa/MC) ─── */
const LinkedCardVisual = ({ acc, onDelete }: { acc: any; onDelete: () => void }) => {
  const tr = useHarvestedT('customer');
  const meta = acc.metadata as any;
  const network = meta?.card_network || acc.provider_name || 'Card';
  const expMonth = meta?.card_exp_month ? String(meta.card_exp_month).padStart(2, '0') : '••';
  const expYear = meta?.card_exp_year ? String(meta.card_exp_year).slice(-2) : '••';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl" style={{ aspectRatio: '1.586/1' }}>
      <img src={kangCardBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/10" />
      <div className="relative z-10 flex flex-col justify-between h-full p-4 sm:p-5">
        <div className="flex items-start justify-end">
          <CardDeleteBtn onClick={onDelete} />
        </div>
        <div>
          <p className="text-[10px] font-medium text-white/70 uppercase tracking-wider">{tr('Linked Card')}</p>
          <p className="text-xs sm:text-sm font-bold text-white mt-0.5">{acc.account_name || 'Cardholder'}</p>
        </div>
        <div className="space-y-2 sm:space-y-3">
          <p className="font-mono text-sm sm:text-lg text-white tracking-[0.08em] sm:tracking-[0.2em] whitespace-nowrap overflow-hidden">
            •••• •••• •••• {acc.last4 || '••••'}
          </p>
          <div className="flex items-end justify-between">
            <div className="flex gap-4 sm:gap-6">
              <div>
                <p className="text-[8px] sm:text-[9px] font-medium text-white/60 uppercase">{tr('Expires')}</p>
                <p className="text-xs sm:text-sm font-semibold text-white font-mono">{expMonth}/{expYear}</p>
              </div>
              <div>
                <p className="text-[8px] sm:text-[9px] font-medium text-white/60 uppercase">{tr('Network')}</p>
                <p className="text-xs sm:text-sm font-semibold text-white capitalize">{network}</p>
              </div>
            </div>
            {acc.is_primary && (
              <span className="rounded-lg bg-white/20 backdrop-blur-sm px-2 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-bold text-white">{tr('Primary')}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ─── Bank Account (RIB) Card ─── */
const LinkedBankCard = ({ acc, onDelete }: { acc: any; onDelete: () => void }) => {
  const tr = useHarvestedT('customer');
  const meta = acc.metadata as any;
  const bankCode = meta?.rib_bank_code || '';
  const branchCode = meta?.rib_branch_code || '';
  const isIban = meta?.identifier_type === 'IBAN';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border-2 border-[hsl(220,40%,80%)]"
      style={{ aspectRatio: '1.586/1', background: 'linear-gradient(145deg, hsl(220,45%,18%), hsl(220,40%,28%))' }}>
      {/* Decorative circles */}
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full border border-white/5" />
      <div className="absolute -right-2 -top-2 h-16 w-16 rounded-full border border-white/8" />
      <div className="absolute left-4 bottom-4 h-10 w-10 rounded-full bg-white/3" />

      <div className="relative z-10 flex flex-col justify-between h-full p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
              <Building2 className="h-4.5 w-4.5 text-white/80" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{isIban ? 'International Account' : 'Bank Account'}</p>
              <p className="text-sm font-bold text-white">{acc.account_name || 'Account Holder'}</p>
            </div>
          </div>
          <CardDeleteBtn onClick={onDelete} />
        </div>

        <div className="space-y-3">
          {!isIban && bankCode && (
            <div className="flex gap-4">
              <div>
                <p className="text-[9px] font-medium text-white/40 uppercase">{tr('Bank')}</p>
                <p className="text-xs font-semibold text-white font-mono">{bankCode}</p>
              </div>
              <div>
                <p className="text-[9px] font-medium text-white/40 uppercase">{tr('Branch')}</p>
                <p className="text-xs font-semibold text-white font-mono">{branchCode}</p>
              </div>
            </div>
          )}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[9px] font-medium text-white/40 uppercase">{isIban ? 'IBAN' : 'RIB'}</p>
              <p className="font-mono text-base text-white tracking-[0.12em]">•••• •••• {acc.last4 || '••••'}</p>
            </div>
            <div className="flex items-center gap-2">
              {acc.is_primary && (
                <span className="rounded-lg bg-white/15 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white">{tr('Primary')}</span>
              )}
              <span className="rounded-lg bg-[hsl(210,80%,60%)]/20 px-2 py-0.5 text-[9px] font-bold text-[hsl(210,80%,75%)] uppercase">
                {isIban ? 'IBAN' : 'RIB'}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-white/50">{acc.provider_name}</p>
        </div>
      </div>
    </motion.div>
  );
};

/* ─── MTN MoMo Card ─── */
const LinkedMomoMtnCard = ({ acc, onDelete }: { acc: any; onDelete: () => void }) => {
  const tr = useHarvestedT('customer');
  return (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    className="relative overflow-hidden rounded-3xl border-2 border-[hsl(48,90%,60%)]"
    style={{ aspectRatio: '1.586/1', background: 'linear-gradient(145deg, hsl(48,95%,50%), hsl(45,90%,42%))' }}>
    {/* Pattern */}
    <div className="absolute right-3 top-3 h-24 w-24 rounded-full bg-white/8" />
    <div className="absolute right-8 top-8 h-14 w-14 rounded-full bg-white/6" />
    <div className="absolute -left-4 -bottom-4 h-20 w-20 rounded-full bg-black/5" />

    <div className="relative z-10 flex flex-col justify-between h-full p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/10">
            <Smartphone className="h-4.5 w-4.5 text-black/70" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-black/40 uppercase tracking-wider">{tr('MTN Mobile Money')}</p>
            <p className="text-sm font-bold text-black/80">{acc.account_name || 'MoMo User'}</p>
          </div>
        </div>
        <button onClick={onDelete}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/8 hover:bg-black/15 transition-colors">
          <Trash2 className="h-4 w-4 text-black/50" strokeWidth={1.5} />
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-[9px] font-medium text-black/35 uppercase">{tr('Phone Number')}</p>
          <p className="font-mono text-lg text-black/80 tracking-[0.1em]">•••• •••• {acc.last4 || '••••'}</p>
        </div>
        <div className="flex items-end justify-between">
          <span className="rounded-lg bg-black/8 px-2.5 py-1 text-[10px] font-extrabold text-black/60 uppercase tracking-wider">{tr('MTN MoMo')}</span>
          {acc.is_primary && (
            <span className="rounded-lg bg-black/10 px-2.5 py-1 text-[10px] font-bold text-black/60">{tr('Primary')}</span>
          )}
        </div>
      </div>
    </div>
  </motion.div>
  );
};

/* ─── Orange Money Card ─── */
const LinkedOrangeCard = ({ acc, onDelete }: { acc: any; onDelete: () => void }) => {
  const tr = useHarvestedT('customer');
  return (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    className="relative overflow-hidden rounded-3xl border-2 border-[hsl(25,85%,55%)]"
    style={{ aspectRatio: '1.586/1', background: 'linear-gradient(145deg, hsl(25,90%,55%), hsl(20,85%,45%))' }}>
    <div className="absolute -right-4 -top-4 h-28 w-28 rounded-full bg-white/8" />
    <div className="absolute right-6 top-6 h-12 w-12 rounded-full bg-white/6" />
    <div className="absolute left-6 bottom-6 h-8 w-8 rounded-full bg-black/5" />

    <div className="relative z-10 flex flex-col justify-between h-full p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
            <Smartphone className="h-4.5 w-4.5 text-white/80" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">{tr('Orange Money')}</p>
            <p className="text-sm font-bold text-white">{acc.account_name || 'Orange User'}</p>
          </div>
        </div>
        <CardDeleteBtn onClick={onDelete} />
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-[9px] font-medium text-white/40 uppercase">{tr('Phone Number')}</p>
          <p className="font-mono text-lg text-white tracking-[0.1em]">•••• •••• {acc.last4 || '••••'}</p>
        </div>
        <div className="flex items-end justify-between">
          <span className="rounded-lg bg-white/15 px-2.5 py-1 text-[10px] font-extrabold text-white/80 uppercase tracking-wider">{tr('Orange Money')}</span>
          {acc.is_primary && (
            <span className="rounded-lg bg-white/20 px-2.5 py-1 text-[10px] font-bold text-white">{tr('Primary')}</span>
          )}
        </div>
      </div>
    </div>
  </motion.div>
  );
};

/* ─── PayPal Card ─── */
const LinkedPaypalCard = ({ acc, onDelete }: { acc: any; onDelete: () => void }) => {
  const tr = useHarvestedT('customer');
  const email = (acc.metadata as any)?.email || '';
  const maskedEmail = email ? `${email.substring(0, 3)}•••@${email.split('@')[1] || ''}` : `•••• ${acc.last4}`;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border-2 border-[hsl(210,80%,65%)]"
      style={{ aspectRatio: '1.586/1', background: 'linear-gradient(145deg, hsl(210,85%,30%), hsl(215,80%,22%))' }}>
      <div className="absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-[hsl(210,80%,50%)]/10" />
      <div className="absolute right-4 top-4 h-20 w-20 rounded-full border border-white/5" />

      <div className="relative z-10 flex flex-col justify-between h-full p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
              <Wallet className="h-4.5 w-4.5 text-[hsl(210,80%,70%)]" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[hsl(210,60%,70%)] uppercase tracking-wider">{tr('PayPal')}</p>
              <p className="text-sm font-bold text-white">{acc.account_name || 'PayPal User'}</p>
            </div>
          </div>
          <CardDeleteBtn onClick={onDelete} />
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-[9px] font-medium text-white/40 uppercase">{tr('Email')}</p>
            <p className="text-sm font-semibold text-white/90">{maskedEmail}</p>
          </div>
          <div className="flex items-end justify-between">
            <span className="rounded-lg bg-[hsl(210,80%,50%)]/20 px-2.5 py-1 text-[10px] font-extrabold text-[hsl(210,80%,75%)] uppercase tracking-wider">{tr('PayPal')}</span>
            {acc.is_primary && (
              <span className="rounded-lg bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white">{tr('Primary')}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ─── Unified Account Card Renderer ─── */
const LinkedAccountCard = ({ acc, onDelete }: { acc: any; onDelete: () => void }) => {
  const type = acc.account_type;
  const meta = acc.metadata as any;

  if (type === 'bank_card') return <LinkedCardVisual acc={acc} onDelete={onDelete} />;
  if (type === 'bank_account' && meta?.identifier_type !== 'IBAN') return <LinkedBankCard acc={acc} onDelete={onDelete} />;
  if (type === 'bank_account' && meta?.identifier_type === 'IBAN') return <LinkedBankCard acc={acc} onDelete={onDelete} />;
  if (type === 'momo_mtn') return <LinkedMomoMtnCard acc={acc} onDelete={onDelete} />;
  if (type === 'momo_orange') return <LinkedOrangeCard acc={acc} onDelete={onDelete} />;
  if (type === 'paypal') return <LinkedPaypalCard acc={acc} onDelete={onDelete} />;

  // Fallback for unknown types
  return <LinkedBankCard acc={acc} onDelete={onDelete} />;
};

/* ─── Main Component ─── */
const CustomerLinkedAccounts: React.FC = () => {
  const tr = useHarvestedT('customer');
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

  const { data: hasRemovals = false } = useQuery({
    queryKey: ['customer-has-removals', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('customer_linked_accounts')
        .select('id')
        .eq('user_id', user!.id)
        .eq('status', 'removed')
        .limit(1);
      if (error) throw error;
      return (data?.length || 0) > 0;
    },
  });

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['linked-account-requests', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('linked_account_change_requests')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const atLimit = linkedAccounts.length >= MAX_LINKED_ACCOUNTS;
  const pendingCount = pendingRequests.filter((r: any) => r.status === 'pending').length;

  const handleOpenAdd = () => {
    if (atLimit) {
      toast.error(`Maximum ${MAX_LINKED_ACCOUNTS} linked accounts reached. Remove an existing account first.`);
      return;
    }
    setShowAdd(true);
  };

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
    } else if (selectedType.key === 'bank_card') {
      const formatted = formatCardNumber(value);
      setFormData(prev => ({ ...prev, account_number: formatted }));
      const digits = formatted.replace(/\D/g, '');
      if (digits.length === 16) {
        setValidationMsg({ text: '✓ Valid card number length', isError: false });
      } else if (digits.length > 0) {
        setValidationMsg({ text: `${digits.length}/16 digits`, isError: false });
      }
    } else {
      setFormData(prev => ({ ...prev, account_number: value }));
    }
  }, [selectedType, formData.bank_code]);

  const handlePhoneChange = useCallback((value: string) => {
    const formatted = formatPhoneNumber(value);
    setFormData(prev => ({ ...prev, account_number: formatted }));
    setValidationMsg(null);
    const clean = formatted.replace(/\D/g, '');
    if (clean.length >= 9) {
      if (validateInternationalPhone(clean)) {
        setValidationMsg({ text: '✓ Valid phone number', isError: false });
      } else {
        setValidationMsg({ text: 'Enter a valid phone number', isError: true });
      }
    }
  }, []);

  const handleAddAccount = async () => {
    if (!selectedType || !user) return;

    // Validate required fields
    for (const f of selectedType.fields) {
      if (f.key === 'bank_code' || f.fieldType === 'exp_month' || f.fieldType === 'exp_year' || f.fieldType === 'card_network') continue;
      if (!formData[f.key]?.trim()) { toast.error(`Enter ${f.label.toLowerCase()}`); return; }
    }

    // RIB validation
    if (selectedType.key === 'bank_account') {
      const digits = (formData.account_number || '').replace(/\D/g, '');
      if (digits.length !== 23) { toast.error('RIB must be exactly 23 digits'); return; }
      const { valid } = validateRibChecksum(digits);
      if (!valid) { toast.error('Invalid RIB checksum'); return; }
      if (!formData.bank_code) { toast.error('Please select your bank'); return; }
    }

    // IBAN validation
    if (selectedType.key === 'bank_iban') {
      const clean = (formData.account_number || '').replace(/\s/g, '');
      if (clean.length < 15) { toast.error('IBAN too short'); return; }
    }

    // Card validation
    if (selectedType.key === 'bank_card') {
      const digits = (formData.account_number || '').replace(/\D/g, '');
      if (digits.length < 13 || digits.length > 19) { toast.error('Enter a valid card number (13-19 digits)'); return; }
      if (!formData.card_network) { toast.error('Select a card network'); return; }
      if (!formData.card_exp_month || !formData.card_exp_year) { toast.error('Enter card expiry date'); return; }
      const month = parseInt(formData.card_exp_month, 10);
      if (month < 1 || month > 12) { toast.error('Invalid expiry month'); return; }
      const yearNum = parseInt(formData.card_exp_year, 10);
      const fullYear = yearNum < 100 ? 2000 + yearNum : yearNum;
      const now = new Date();
      const expDate = new Date(fullYear, month);
      if (expDate <= now) { toast.error('Card has expired'); return; }
    }

    // MoMo phone validation
    if (selectedType.key === 'momo_mtn' || selectedType.key === 'momo_orange') {
      const phone = (formData.account_number || '').replace(/\D/g, '');
      if (!validateInternationalPhone(phone)) { toast.error('Enter a valid phone number'); return; }
    }

    // PayPal email validation
    if (selectedType.key === 'paypal') {
      if (!validateEmail(formData.account_number || '')) { toast.error('Enter a valid email address'); return; }
    }

    setSaving(true);
    try {
      const rawNumber = (formData.account_number || '').replace(/[\s\-]/g, '');
      const last4 = rawNumber.slice(-4);
      const bank = CM_BANKS.find(b => b.code === formData.bank_code);
      const accountType = selectedType.key === 'bank_iban' ? 'bank_account' : selectedType.key;

      let metadata: any = undefined;
      if (selectedType.key === 'bank_account') {
        metadata = {
          identifier_type: 'DOMESTIC_RIB',
          rib_bank_code: rawNumber.substring(0, 5),
          rib_branch_code: rawNumber.substring(5, 10),
          rib_account_number: rawNumber.substring(10, 21),
          rib_key: rawNumber.substring(21, 23),
          swift_bic: bank?.swift,
          rail: 'DOMESTIC',
        };
      } else if (selectedType.key === 'bank_iban') {
        metadata = {
          identifier_type: 'IBAN',
          country: rawNumber.substring(0, 2),
          rail: 'INTERNATIONAL',
        };
      } else if (selectedType.key === 'bank_card') {
        metadata = {
          card_network: formData.card_network,
          card_exp_month: parseInt(formData.card_exp_month, 10),
          card_exp_year: parseInt(formData.card_exp_year, 10) < 100
            ? 2000 + parseInt(formData.card_exp_year, 10)
            : parseInt(formData.card_exp_year, 10),
          card_type: 'debit',
        };
      } else if (selectedType.key === 'momo_mtn' || selectedType.key === 'momo_orange') {
        metadata = {
          provider: selectedType.key === 'momo_mtn' ? 'MTN' : 'Orange',
          phone_country: 'CM',
        };
      } else if (selectedType.key === 'paypal') {
        metadata = {
          email: rawNumber,
        };
      }

      const networkLabel = CARD_NETWORKS.find(n => n.value === formData.card_network)?.label;

      const accountData = {
        account_type: accountType,
        account_name: formData.account_name || null,
        account_number: selectedType.key === 'bank_card' ? last4 : rawNumber, // Cards: only store last4
        provider_name: bank?.name || networkLabel || formData.provider_name || selectedType.label,
        provider_type: selectedType.providerType,
        last4,
        is_primary: linkedAccounts.length === 0,
        metadata,
      };

      if (hasRemovals) {
        const { error } = await (supabase as any).from('linked_account_change_requests').insert({
          user_id: user.id,
          request_type: 'add_after_removal',
          requested_account_data: accountData,
          status: 'pending',
        });
        if (error) throw error;
        toast.success('Account linking request submitted for admin approval');
        queryClient.invalidateQueries({ queryKey: ['linked-account-requests'] });
      } else {
        // Enforce max linked accounts limit
        if (linkedAccounts.length >= 10) {
          toast.error('Maximum of 10 linked accounts allowed');
          setSaving(false);
          return;
        }
        const { error } = await (supabase as any).from('customer_linked_accounts').insert({
          user_id: user.id,
          ...accountData,
          is_active: true,
          status: 'active',
        });
        if (error) throw error;
        
        // Update profile to remove view-only status
        await supabase.from('profiles').update({ linked_account_type: accountData.account_type } as any).eq('id', user.id);
        
        toast.success(`${selectedType.label} linked successfully`);
        queryClient.invalidateQueries({ queryKey: ['customer-linked-accounts'] });
      }

      setShowAdd(false);
      setSelectedType(null);
      setFormData({});
      setValidationMsg(null);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to link account'));
    } finally {
      setSaving(false);
    }
  };

  const [showDeletePin, setShowDeletePin] = useState(false);

  const initiateDelete = (id: string) => {
    setDeleteId(id);
    setShowDeletePin(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteId) return;
    try {
      const { error } = await (supabase as any).from('customer_linked_accounts')
        .update({ is_active: false, status: 'removed', removed_at: new Date().toISOString() })
        .eq('id', deleteId);
      if (error) throw error;

      await (supabase as any).rpc('increment_removal_count' as any, { row_id: deleteId }).catch(() => {});

      toast.success('Account removed. Future account additions will require admin approval.');
      queryClient.invalidateQueries({ queryKey: ['customer-linked-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['customer-has-removals'] });
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to remove linked account'));
    }
    setDeleteId(null);
  };

  const renderField = (f: { key: string; label: string; placeholder: string; type?: string; fieldType?: string }) => {
    // Bank selector
    if (f.key === 'bank_code' && selectedType?.key === 'bank_account') {
      return (
        <div key={f.key} className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">{f.label}</label>
          <Select value={formData.bank_code || ''} onValueChange={(v) => setFormData({ ...formData, bank_code: v })}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder={tr('Select your bank')} />
            </SelectTrigger>
            <SelectContent>
              {CM_BANKS.map(b => (
                <SelectItem key={b.code} value={b.code}>{b.name} ({b.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Card network selector
    if (f.fieldType === 'card_network') {
      return (
        <div key={f.key} className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">{f.label}</label>
          <Select value={formData.card_network || ''} onValueChange={(v) => setFormData({ ...formData, card_network: v })}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder={tr('Select network')} />
            </SelectTrigger>
            <SelectContent>
              {CARD_NETWORKS.map(n => (
                <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Expiry month/year as inline row
    if (f.fieldType === 'exp_month') {
      return (
        <div key="expiry_row" className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">{tr('Month')}</label>
            <Select value={formData.card_exp_month || ''} onValueChange={(v) => setFormData({ ...formData, card_exp_month: v })}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="MM" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => {
                  const m = String(i + 1).padStart(2, '0');
                  return <SelectItem key={m} value={m}>{m}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground">{tr('Year')}</label>
            <Select value={formData.card_exp_year || ''} onValueChange={(v) => setFormData({ ...formData, card_exp_year: v })}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="YY" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => {
                  const y = new Date().getFullYear() + i;
                  return <SelectItem key={y} value={String(y).slice(-2)}>{String(y).slice(-2)}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    // Skip standalone exp_year render (handled in exp_month block above)
    if (f.fieldType === 'exp_year') return null;

    // RIB / IBAN formatted inputs
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
            <p className={`text-[11px] ${validationMsg.isError ? 'text-destructive' : 'text-[hsl(150,50%,35%)]'}`}>
              {validationMsg.text}
            </p>
          )}
          {selectedType?.key === 'bank_account' && (
            <p className="text-[10px] text-muted-foreground">{tr('Format: Bank (5) - Branch (5) - Account (11) - Key (2)')}</p>
          )}
        </div>
      );
    }

    // Card number formatted input
    if (f.key === 'account_number' && selectedType?.key === 'bank_card') {
      return (
        <div key={f.key} className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">{f.label}</label>
          <Input
            type="text"
            inputMode="numeric"
            value={formData.account_number || ''}
            onChange={e => handleAccountNumberChange(e.target.value)}
            placeholder={f.placeholder}
            className="rounded-xl font-mono tracking-[0.15em]"
            maxLength={19}
          />
          {validationMsg && (
            <p className={`text-[11px] ${validationMsg.isError ? 'text-destructive' : 'text-[hsl(150,50%,35%)]'}`}>
              {validationMsg.text}
            </p>
          )}
        </div>
      );
    }

    // Phone number for MoMo
    if (f.key === 'account_number' && (selectedType?.key === 'momo_mtn' || selectedType?.key === 'momo_orange')) {
      return (
        <div key={f.key} className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">{f.label}</label>
          <Input
            type="tel"
            value={formData.account_number || ''}
            onChange={e => handlePhoneChange(e.target.value)}
            placeholder={f.placeholder}
            className="rounded-xl font-mono"
          />
          {validationMsg && (
            <p className={`text-[11px] ${validationMsg.isError ? 'text-destructive' : 'text-[hsl(150,50%,35%)]'}`}>
              {validationMsg.text}
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
          <h1 className="text-xl font-bold text-foreground">{tr('Linked Accounts')}</h1>
        </div>
        <button
          onClick={handleOpenAdd}
          disabled={atLimit}
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${atLimit ? 'bg-muted cursor-not-allowed' : 'bg-primary'}`}
        >
          <Plus className={`h-4 w-4 ${atLimit ? 'text-muted-foreground' : 'text-primary-foreground'}`} strokeWidth={2} />
        </button>
      </div>

      {/* KANG ID — permanent identifier, tap to copy */}
      {user?.kangId && <KangIdBadge kangId={user.kangId} variant="card" />}

      {/* Account limit banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 rounded-2xl bg-[hsl(210,80%,93%)] p-4">
        <CheckCircle2 className="h-5 w-5 text-[hsl(210,60%,45%)] mt-0.5 shrink-0" strokeWidth={1.5} />
        <div>
          <p className="text-xs font-bold text-foreground">
            {linkedAccounts.length}/{MAX_LINKED_ACCOUNTS} accounts linked
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {atLimit
              ? 'Maximum reached. Remove an account to add a new one. Re-linking requires admin approval.'
              : 'Free deposits from linked accounts. Low-cost withdrawals.'}
          </p>
        </div>
      </motion.div>

      {/* Admin approval warning */}
      {hasRemovals && !atLimit && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-2xl bg-[hsl(40,90%,92%)] p-4">
          <ShieldAlert className="h-5 w-5 text-[hsl(40,80%,40%)] mt-0.5 shrink-0" strokeWidth={1.5} />
          <div>
            <p className="text-xs font-bold text-foreground">{tr('Admin Approval Required')}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Since you previously removed an account, new additions require admin review before activation.
            </p>
          </div>
        </motion.div>
      )}

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{tr('Pending Requests')}</p>
          {pendingRequests.map((req: any) => {
            const data = req.requested_account_data;
            const config = getIconForType(data?.account_type || 'bank_account');
            const Icon = config.icon;
            const statusColor = req.status === 'pending' ? 'bg-[hsl(40,90%,92%)] text-[hsl(40,80%,35%)]'
              : req.status === 'approved' ? 'bg-[hsl(150,50%,90%)] text-[hsl(150,50%,30%)]'
              : 'bg-destructive/10 text-destructive';
            return (
              <motion.div key={req.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between rounded-2xl border border-dashed border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.color}`}>
                    <Icon className={`h-5 w-5 ${config.iconColor}`} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{data?.account_name || data?.account_type}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {data?.provider_name} •••• {data?.last4}
                    </p>
                  </div>
                </div>
                <Badge className={`text-[9px] ${statusColor} border-0`}>
                  {req.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                  {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                </Badge>
              </motion.div>
            );
          })}
          {pendingCount > 0 && (
            <p className="text-[10px] text-muted-foreground text-center">
              {pendingCount} request{pendingCount > 1 ? 's' : ''} awaiting admin review
            </p>
          )}
        </div>
      )}

      {/* Account List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : linkedAccounts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Building2 className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-foreground">{tr('No linked accounts')}</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">{tr('Link a bank account, mobile money, PayPal, or card to deposit and withdraw funds.')}</p>
          <Button onClick={handleOpenAdd} className="rounded-2xl mt-2"><Plus className="h-4 w-4 mr-1" /> {tr('Link Account')}</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {linkedAccounts.map((acc: any) => (
            <LinkedAccountCard key={acc.id} acc={acc} onDelete={() => initiateDelete(acc.id)} />
          ))}
        </div>
      )}

      {/* Add Account Dialog */}
      <Dialog open={showAdd} onOpenChange={(v) => { setShowAdd(v); if (!v) { setSelectedType(null); setFormData({}); setValidationMsg(null); } }}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>{selectedType ? `Link ${selectedType.label}` : 'Link an Account'}</DialogTitle>
            <DialogDescription>
              {hasRemovals
                ? 'This request will be sent to an admin for approval before activation.'
                : selectedType ? `Enter your ${selectedType.label} details below` : 'Select the type of account to link'}
            </DialogDescription>
          </DialogHeader>

          {hasRemovals && (
            <div className="flex items-center gap-2 rounded-xl bg-[hsl(40,90%,92%)] p-3">
              <ShieldAlert className="h-4 w-4 text-[hsl(40,80%,40%)] shrink-0" />
              <p className="text-[11px] text-[hsl(40,80%,30%)]">{tr('Admin approval required — your request will be reviewed.')}</p>
            </div>
          )}

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

                {/* Card preview when filling card details */}
                {selectedType.key === 'bank_card' && (formData.account_number || formData.account_name) && (
                  <div className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: '1.586/1' }}>
                    <img src={kangCardBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/10" />
                    <div className="relative z-10 flex flex-col justify-between h-full p-4">
                      <p className="text-[10px] text-white/70 uppercase tracking-wider font-medium">{tr('Preview')}</p>
                      <div className="space-y-2">
                        <p className="font-mono text-base text-white tracking-[0.15em]">
                          {formData.account_number || '•••• •••• •••• ••••'}
                        </p>
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-[9px] text-white/60 uppercase">{tr('Cardholder')}</p>
                            <p className="text-xs font-semibold text-white">{formData.account_name || '—'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] text-white/60 uppercase">{tr('Expires')}</p>
                            <p className="text-xs font-semibold text-white font-mono">
                              {formData.card_exp_month || '••'}/{formData.card_exp_year || '••'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedType.fields.map(f => renderField(f))}
                <Button onClick={handleAddAccount} disabled={saving} className="w-full rounded-2xl h-12">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {hasRemovals ? 'Submit for Approval' : `Link ${selectedType.label}`}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId && !showDeletePin} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('Remove Account?')}</AlertDialogTitle>
            <AlertDialogDescription>
              This account will be unlinked from your wallet. <strong>{tr('Important:')}</strong> After removing an account, any future account additions will require admin approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{tr('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => setShowDeletePin(true)} className="rounded-xl bg-destructive text-destructive-foreground">{tr('Remove')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PinConfirmDialog open={showDeletePin} onOpenChange={(v) => { if (!v) { setShowDeletePin(false); setDeleteId(null); } }} onConfirmed={handleDeleteConfirmed} />
    </div>
  );
};

export default CustomerLinkedAccounts;
