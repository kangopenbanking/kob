import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Link2, Plus, Copy, ExternalLink, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const links = [
  { name: 'Product Payment', amount: 25000, clicks: 12, created: 'Feb 20', active: true },
  { name: 'Service Fee', amount: 50000, clicks: 5, created: 'Feb 15', active: true },
  { name: 'Donation Link', amount: null, clicks: 34, created: 'Jan 30', active: false },
];

const CustomerPayLinks: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">Pay Links</h1>
        </div>
        <Button size="sm" className="rounded-xl h-9"><Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2} /> New</Button>
      </div>

      <div className="space-y-2">
        {links.map((link, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }} className="rounded-2xl bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-foreground">{link.name}</p>
              <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${link.active ? 'bg-[hsl(150,40%,90%)] text-[hsl(150,60%,40%)]' : 'bg-muted text-muted-foreground'}`}>
                {link.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {link.amount ? `${link.amount.toLocaleString()} XAF` : 'Open amount'} · {link.clicks} clicks · {link.created}
            </p>
            <div className="flex gap-2">
              <button className="flex items-center gap-1 rounded-xl bg-muted px-3 py-1.5">
                <Copy className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-[10px] font-bold text-muted-foreground">Copy</span>
              </button>
              <button className="flex items-center gap-1 rounded-xl bg-muted px-3 py-1.5">
                <Share2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-[10px] font-bold text-muted-foreground">Share</span>
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default CustomerPayLinks;
