import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Mail, Phone, Send, FileText, Users, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const faqs = [
  { q: 'How do I send money?', a: 'Go to the Home screen and tap "Transfer". Enter the recipient details and amount, then confirm.' },
  { q: 'How do I link a bank account?', a: 'Navigate to More > Bank, then tap the "+" button to add a new account.' },
  { q: 'What are the transfer fees?', a: 'Transfers within the same network are free. Cross-network transfers have a small fee shown before confirmation.' },
  { q: 'How do I change my PIN?', a: 'Go to More > Settings > Security > Change PIN. You\'ll need to verify your current PIN first.' },
  { q: 'Is my money safe?', a: 'Yes. We use bank-grade encryption and your funds are held in regulated financial institutions.' },
  { q: 'How do I contact support?', a: 'You can use Live Chat, email us, or call our hotline from this Help page.' },
];

const contactOptions = [
  { icon: <MessageCircle className="h-6 w-6" strokeWidth={1.5} />, label: 'Live Chat', desc: 'Chat with an agent', color: 'hsl(160,60%,88%)', action: () => toast.info('Live chat opening...') },
  { icon: <Mail className="h-6 w-6" strokeWidth={1.5} />, label: 'Email', desc: 'support@kobpay.com', color: 'hsl(210,80%,90%)', action: () => toast.info('Opening email client...') },
  { icon: <Phone className="h-6 w-6" strokeWidth={1.5} />, label: 'Call Us', desc: '+237 233 XXX XXX', color: 'hsl(25,80%,90%)', action: () => toast.info('Initiating call...') },
];

const quickLinks = [
  { icon: <FileText className="h-4 w-4" strokeWidth={1.5} />, label: 'Terms of Service' },
  { icon: <FileText className="h-4 w-4" strokeWidth={1.5} />, label: 'Privacy Policy' },
  { icon: <Users className="h-4 w-4" strokeWidth={1.5} />, label: 'Community Forum' },
];

const CustomerHelp: React.FC = () => {
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!subject || !description) { toast.error('Please fill in all fields'); return; }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubject('');
      setDescription('');
      toast.success('Report submitted. We\'ll get back to you soon.');
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Help & Support</h1>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-1">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Frequently Asked Questions</h2>
        <div className="rounded-2xl border border-border bg-card px-4">
          <Accordion type="single" collapsible>
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-border/50">
                <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Us</h2>
        <div className="grid grid-cols-3 gap-3">
          {contactOptions.map(opt => (
            <motion.button key={opt.label} whileTap={{ scale: 0.95 }} onClick={opt.action}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 p-4" style={{ backgroundColor: opt.color, borderColor: opt.color }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/60">{opt.icon}</div>
              <span className="text-xs font-semibold text-foreground">{opt.label}</span>
              <span className="text-[10px] text-foreground/60">{opt.desc}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Report a Problem</h2>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3">
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className="rounded-xl border-border" />
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the issue..." className="min-h-[100px] rounded-xl border-border" />
            <Button onClick={handleSubmit} disabled={submitting} className="h-11 rounded-2xl font-semibold">
              <Send className="mr-2 h-4 w-4" strokeWidth={1.5} />{submitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Links</h2>
        <div className="rounded-2xl border border-border bg-card">
          {quickLinks.map((link, i) => (
            <button key={i} onClick={() => toast.info(link.label)} className="flex w-full items-center justify-between border-b border-border/50 px-4 py-3 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{link.icon}</span>
                <span className="text-sm font-medium text-foreground">{link.label}</span>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default CustomerHelp;
