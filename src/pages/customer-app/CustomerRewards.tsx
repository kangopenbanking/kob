import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, Star, ShoppingBag, Smartphone, Coffee, Ticket } from 'lucide-react';
import { motion } from 'framer-motion';

const rewards = [
  { name: '10% Off Airtime', points: 500, icon: Smartphone, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]' },
  { name: 'Free Coffee', points: 300, icon: Coffee, color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]' },
  { name: 'Shopping Voucher', points: 1000, icon: ShoppingBag, color: 'bg-[hsl(340,60%,92%)]', iconColor: 'text-[hsl(340,50%,40%)]' },
  { name: 'Movie Ticket', points: 750, icon: Ticket, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
];

const CustomerRewards: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'earn' | 'redeem'>('redeem');

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Rewards</h1>
      </div>

      {/* Points Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 rounded-3xl bg-[hsl(45,70%,90%)] p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/50">
          <Star className="h-7 w-7 text-[hsl(45,60%,35%)]" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Points Balance</p>
          <p className="text-2xl font-bold text-foreground">2,450</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex rounded-2xl bg-muted p-1">
        {(['earn', 'redeem'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors ${tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            {t === 'earn' ? 'Earn Points' : 'Redeem'}
          </button>
        ))}
      </div>

      {tab === 'redeem' ? (
        <div className="grid grid-cols-2 gap-3">
          {rewards.map((r, i) => (
            <motion.button key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }} className={`flex flex-col items-center gap-2.5 rounded-3xl ${r.color} p-5`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/50">
                <r.icon className={`h-5 w-5 ${r.iconColor}`} strokeWidth={1.5} />
              </div>
              <p className="text-xs font-bold text-foreground text-center">{r.name}</p>
              <p className="text-[10px] font-semibold text-muted-foreground">{r.points} pts</p>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {[{ action: 'Make a transfer', pts: '+50' }, { action: 'Pay a bill', pts: '+30' }, { action: 'Refer a friend', pts: '+200' }, { action: 'Save to Piggy Bank', pts: '+25' }].map((e, i) => (
            <div key={i} className="flex items-center justify-between rounded-2xl bg-card p-3.5">
              <p className="text-sm font-semibold text-foreground">{e.action}</p>
              <span className="text-xs font-bold text-[hsl(150,60%,40%)]">{e.pts}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerRewards;
