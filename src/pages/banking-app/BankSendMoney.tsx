import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User, Send, ArrowRight, Loader2, CreditCard, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { useSendTransfer, useBankAccounts } from '@/hooks/useBankingData';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';

type IdentifierType = 'account' | 'rib' | 'iban';

const BankSendMoney: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<'recipient' | 'amount' | 'confirm'>('recipient');
  const [identifierType, setIdentifierType] = useState<IdentifierType>('account');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [showPin, setShowPin] = useState(false);
  const { data: accounts } = useBankAccounts();
  const sendTransfer = useSendTransfer();

  const sourceAccount = accounts?.[0];

  const handleSend = () => {
    setShowPin(true);
  };

  const executeSend = () => {
    if (!sourceAccount) return;
    const cleanRecipient = recipient.replace(/[\s\-]/g, '');
    sendTransfer.mutate({
      source_account_id: sourceAccount.id,
      destination_account_id: cleanRecipient,
      amount: Number(amount),
      currency: 'XAF',
      description: `Transfer to ${recipient}`,
      identifier_type: identifierType === 'rib' ? 'DOMESTIC_RIB' : identifierType === 'iban' ? 'IBAN' : 'LOCAL_BANK',
    }, {
      onSuccess: () => navigate(`/bank/${institutionId}/home`),
    });
  };

  const getRecipientValidation = (): { valid: boolean; hint: string } => {
    const clean = recipient.replace(/[\s\-]/g, '');
    switch (identifierType) {
      case 'rib':
        return {
          valid: /^\d{23}$/.test(clean),
          hint: clean.length > 0 ? `${clean.length}/23 digits` : 'Enter 23-digit RIB number',
        };
      case 'iban':
        return {
          valid: /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/i.test(clean) && clean.length >= 15,
          hint: clean.length > 0 ? `${clean.length} characters` : 'e.g. CM21 10005 00100 ...',
        };
      default:
        return { valid: clean.length > 0, hint: 'Account number, phone, or ID' };
    }
  };

  const formatRibDisplay = (value: string): string => {
    const digits = value.replace(/\D/g, '').substring(0, 23);
    if (digits.length <= 5) return digits;
    if (digits.length <= 10) return `${digits.substring(0, 5)}-${digits.substring(5)}`;
    if (digits.length <= 21) return `${digits.substring(0, 5)}-${digits.substring(5, 10)}-${digits.substring(10)}`;
    return `${digits.substring(0, 5)}-${digits.substring(5, 10)}-${digits.substring(10, 21)}-${digits.substring(21)}`;
  };

  const formatIbanDisplay = (value: string): string => {
    const clean = value.replace(/\s/g, '').toUpperCase().substring(0, 34);
    return clean.match(/.{1,4}/g)?.join(' ') || clean;
  };

  const handleRecipientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (identifierType === 'rib') {
      setRecipient(formatRibDisplay(raw));
    } else if (identifierType === 'iban') {
      setRecipient(formatIbanDisplay(raw));
    } else {
      setRecipient(raw);
    }
  };

  const validation = getRecipientValidation();
  const identifierLabel = identifierType === 'rib' ? 'DOMESTIC' : identifierType === 'iban' ? 'INTERNATIONAL' : '';

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Back
      </button>

      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Send Money</h1>
      <p className="mb-6 text-sm text-muted-foreground">Transfer funds to another account</p>

      <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-1 flex-col gap-4">
        {step === 'recipient' && (
          <>
            {/* Identifier type selector */}
            <div className="space-y-2">
              <Label className="text-sm">Transfer Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'account' as IdentifierType, label: 'Account', icon: User },
                  { key: 'rib' as IdentifierType, label: 'RIB', icon: CreditCard },
                  { key: 'iban' as IdentifierType, label: 'IBAN', icon: Globe },
                ]).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => { setIdentifierType(key); setRecipient(''); }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all ${
                      identifierType === key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                {identifierType === 'rib' ? 'RIB Number (23 digits)' : identifierType === 'iban' ? 'IBAN' : 'Recipient'}
              </Label>
              <p className="text-xs text-muted-foreground">
                {identifierType === 'rib'
                  ? 'Enter the 23-digit Cameroon RIB: Bank (5) - Branch (5) - Account (11) - Key (2)'
                  : identifierType === 'iban'
                  ? 'Enter the international IBAN (e.g. CM21 10005 00100 ...)'
                  : 'Enter their account number, phone number, or national ID'}
              </p>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                <Input
                  placeholder={
                    identifierType === 'rib' ? '10005-00100-01234567890-23'
                    : identifierType === 'iban' ? 'CM21 1000 5001 0001 2345 6789 023'
                    : 'e.g. ACC-1234... or 6XXXXXXXX'
                  }
                  value={recipient}
                  onChange={handleRecipientChange}
                  className={`pl-10 font-mono ${identifierType === 'rib' || identifierType === 'iban' ? 'tracking-wider' : ''}`}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className={`text-xs ${validation.valid ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {validation.hint}
                </p>
                {identifierLabel && (
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    identifierType === 'rib' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {identifierLabel}
                  </span>
                )}
              </div>
            </div>
            <Button onClick={() => setStep('amount')} disabled={!validation.valid} className="mt-4 gap-2">
              Continue <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </>
        )}

        {step === 'amount' && (
          <>
            <div className="space-y-2">
              <Label className="text-sm">Amount (XAF)</Label>
              <Input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-2xl font-bold text-center h-16" />
            </div>
            <Button onClick={() => setStep('confirm')} disabled={!amount || Number(amount) <= 0} className="mt-4 gap-2">
              Review <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="flex flex-col gap-3 rounded-2xl bg-muted p-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">To</span>
                <span className="text-sm font-medium font-mono">{recipient}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Type</span>
                <span className="text-sm font-medium uppercase">{identifierType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="text-sm font-semibold">XAF {Number(amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Rail</span>
                <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full ${
                  identifierType === 'rib' ? 'bg-blue-100 text-blue-700'
                  : identifierType === 'iban' ? 'bg-purple-100 text-purple-700'
                  : 'bg-muted-foreground/10 text-muted-foreground'
                }`}>
                  {identifierType === 'rib' ? 'DOMESTIC' : identifierType === 'iban' ? 'INTERNATIONAL' : 'LOCAL'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Fee</span>
                <span className="text-sm font-medium">XAF 0</span>
              </div>
            </div>
            <Button onClick={handleSend} disabled={sendTransfer.isPending} className="mt-4 gap-2" size="lg">
              {sendTransfer.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
              ) : (
                <>Confirm & Send <Send className="h-4 w-4" strokeWidth={1.5} /></>
              )}
            </Button>
          </>
        )}
      </motion.div>

      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={executeSend} />
    </div>
  );
};

export default BankSendMoney;
