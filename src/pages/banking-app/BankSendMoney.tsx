import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User, Send, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const BankSendMoney: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<'recipient' | 'amount' | 'confirm'>('recipient');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 2000));
    toast.success('Transfer sent successfully!');
    setLoading(false);
    navigate(`/bank/${institutionId}/home`);
  };

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Back
      </button>

      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Send Money</h1>
      <p className="mb-6 text-sm text-muted-foreground">Transfer funds to another account</p>

      <motion.div
        key={step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-1 flex-col gap-4"
      >
        {step === 'recipient' && (
          <>
            <div className="space-y-2">
              <Label className="text-sm">Recipient</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                <Input
                  placeholder="Phone number or email"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button onClick={() => setStep('amount')} disabled={!recipient} className="mt-4 gap-2">
              Continue <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </>
        )}

        {step === 'amount' && (
          <>
            <div className="space-y-2">
              <Label className="text-sm">Amount (XAF)</Label>
              <Input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-2xl font-bold text-center h-16"
              />
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
                <span className="text-sm font-medium">{recipient}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="text-sm font-semibold">XAF {Number(amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Fee</span>
                <span className="text-sm font-medium">XAF 0</span>
              </div>
            </div>
            <Button onClick={handleSend} disabled={loading} className="mt-4 gap-2" size="lg">
              {loading ? 'Sending...' : 'Confirm & Send'}
              <Send className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default BankSendMoney;
