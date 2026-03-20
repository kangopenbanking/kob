import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const BankReceive: React.FC = () => {
  const navigate = useNavigate();
  const { institutionId } = useParams();
  const [copied, setCopied] = useState(false);
  const [accountId, setAccountId] = useState('CMR-0012-4829-7765');

  useEffect(() => {
    const fetchAccount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && institutionId) {
        const { data } = await supabase
          .from('accounts')
          .select('account_id')
          .eq('user_id', user.id)
          .eq('institution_id', institutionId)
          .limit(1)
          .maybeSingle();
        if (data) setAccountId(data.account_id);
      }
    };
    fetchAccount();
  }, [institutionId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(accountId);
    setCopied(true);
    toast.success('Account number copied to clipboard — share it with the sender');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Back
      </button>

      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Receive Money</h1>
      <p className="mb-6 text-sm text-muted-foreground">Share your account details</p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-6"
      >
        <div className="w-full rounded-2xl border bg-card p-6 text-center">
          <p className="mb-2 text-xs text-muted-foreground">Your Account Number</p>
          <p className="text-lg font-bold tracking-wider text-foreground">{accountId}</p>
        </div>

        <div className="flex w-full gap-3">
          <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" strokeWidth={1.5} /> : <Copy className="h-4 w-4" strokeWidth={1.5} />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button className="flex-1 gap-2" onClick={() => toast.info('Share feature coming soon')}>
            <Share2 className="h-4 w-4" strokeWidth={1.5} />
            Share
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Share your account number with anyone to receive payments directly
        </p>
      </motion.div>
    </div>
  );
};

export default BankReceive;
