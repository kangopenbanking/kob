import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, MessageCircle, Mail, Phone, Send, FileText,
  Users, ExternalLink, Headphones, Search, ChevronRight,
  Shield, CreditCard, Smartphone, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

const faqCategoriesRaw = [
  { key: 'Payments', label: 'Payments', icon: <CreditCard className="h-4 w-4" strokeWidth={1.8} /> },
  { key: 'Security', label: 'Security', icon: <Shield className="h-4 w-4" strokeWidth={1.8} /> },
  { key: 'Account', label: 'Account', icon: <Smartphone className="h-4 w-4" strokeWidth={1.8} /> },
  { key: 'General', label: 'General', icon: <HelpCircle className="h-4 w-4" strokeWidth={1.8} /> },
];

const faqs = [
  { q: 'How do I send money?', a: 'Go to the Home screen and tap "Transfer". Enter the recipient details and amount, then confirm.', cat: 'Payments' },
  { q: 'How do I link a bank account?', a: 'Navigate to More > Bank, then tap the "+" button to add a new account.', cat: 'Account' },
  { q: 'What are the transfer fees?', a: 'Transfers within the same network are free. Cross-network transfers have a small fee shown before confirmation.', cat: 'Payments' },
  { q: 'How do I change my PIN?', a: 'Go to More > Settings > Security > Change PIN. You\'ll need to verify your current PIN first.', cat: 'Security' },
  { q: 'Is my money safe?', a: 'Yes. We use bank-grade encryption and your funds are held in regulated financial institutions.', cat: 'Security' },
  { q: 'How do I contact support?', a: 'You can use Live Chat or email us from this Help page.', cat: 'General' },
];

const CustomerHelp: React.FC = () => {
  const tr = useHarvestedT('customer');
  const navigate = useNavigate();

  const contactOptions = [
    {
      icon: <MessageCircle className="h-5 w-5" strokeWidth={1.8} />,
      label: 'Live Chat',
      desc: 'Chat with an agent',
      gradient: 'from-[hsl(160,60%,45%)] to-[hsl(160,60%,55%)]',
      iconBg: 'bg-[hsl(160,60%,40%)]',
      action: () => navigate('/app/support'),
    },
    {
      icon: <Mail className="h-5 w-5" strokeWidth={1.8} />,
      label: 'Email Us',
      desc: 'support@kangopenbanking.com',
      gradient: 'from-[hsl(217,91%,50%)] to-[hsl(217,91%,60%)]',
      iconBg: 'bg-[hsl(217,91%,45%)]',
      action: () => { window.location.href = 'mailto:support@kangopenbanking.com'; },
    },
    {
      icon: <Phone className="h-5 w-5" strokeWidth={1.8} />,
      label: 'Call Us',
      desc: '+237 233 432 100',
      gradient: 'from-[hsl(25,80%,50%)] to-[hsl(25,80%,60%)]',
      iconBg: 'bg-[hsl(25,80%,45%)]',
      action: () => { window.location.href = 'tel:+237233432100'; },
    },
  ];

  const quickLinks = [
    { icon: <FileText className="h-4 w-4" strokeWidth={1.5} />, label: 'Help Centre', path: '/help-centre' },
    { icon: <FileText className="h-4 w-4" strokeWidth={1.5} />, label: 'FAQ', path: '/faq' },
    { icon: <FileText className="h-4 w-4" strokeWidth={1.5} />, label: 'Terms & Privacy', path: '/legal' },
    { icon: <Users className="h-4 w-4" strokeWidth={1.5} />, label: 'Contact Support', path: '/contact' },
  ];

  const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
  };


  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = !searchQuery || faq.q.toLowerCase().includes(searchQuery.toLowerCase()) || faq.a.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !activeCategory || faq.cat === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSubmit = async () => {
    if (!subject || !description) { toast.error('Please fill in all fields'); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Please sign in first'); setSubmitting(false); return; }
      const { error } = await supabase.from('app_notifications').insert({
        user_id: user.id,
        type: 'system',
        title: `Support: ${subject}`,
        message: description,
        icon: 'help',
        metadata: { source: 'help_form', subject },
      });
      if (error) throw error;
      setSubject('');
      setDescription('');
      toast.success('Report submitted. We\'ll get back to you soon.');
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to submit report'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      className="flex flex-col gap-5 pb-28"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Header with gradient */}
      <motion.div
        variants={fadeUp}
        className="relative overflow-hidden rounded-b-3xl bg-gradient-to-br from-primary to-primary/80 px-5 pb-6 pt-5"
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/20" />
          <div className="absolute -left-4 bottom-0 h-20 w-20 rounded-full bg-white/15" />
        </div>
        <div className="relative flex items-center gap-3 mb-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm"
          >
            <ArrowLeft className="h-5 w-5 text-primary-foreground" strokeWidth={2} />
          </motion.button>
          <h1 className="text-xl font-bold text-primary-foreground">{tr('Help & Support')}</h1>
        </div>
        <p className="relative text-sm text-primary-foreground/80 mb-4">
          How can we help you today?
        </p>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.8} />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={tr('Search for help...')}
            className="h-11 rounded-2xl border-0 bg-background pl-10 text-sm shadow-md placeholder:text-muted-foreground/60"
          />
        </div>
      </motion.div>

      <div className="flex flex-col gap-5 px-5">
        {/* FAQ Category chips */}
        <motion.div variants={fadeUp} className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {faqCategories.map((cat) => (
            <motion.button
              key={cat.label}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveCategory(activeCategory === cat.label ? null : cat.label)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
                activeCategory === cat.label
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-card text-foreground border border-border'
              }`}
            >
              {cat.icon}
              {cat.label}
            </motion.button>
          ))}
        </motion.div>

        {/* FAQs */}
        <motion.div variants={fadeUp} className="flex flex-col gap-1">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Frequently Asked Questions
          </h2>
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <Accordion type="single" collapsible>
              <AnimatePresence mode="popLayout">
                {filteredFaqs.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-2 py-8 text-center"
                  >
                    <HelpCircle className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">{tr('No results found')}</p>
                  </motion.div>
                ) : (
                  filteredFaqs.map((faq, i) => (
                    <motion.div
                      key={faq.q}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <AccordionItem value={`faq-${i}`} className="border-border/40 px-4">
                        <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline gap-2 py-3.5">
                          <div className="flex items-center gap-2.5 text-left">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
                              {i + 1}
                            </span>
                            {faq.q}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4 pl-8.5 text-sm leading-relaxed text-muted-foreground">
                          {faq.a}
                        </AccordionContent>
                      </AccordionItem>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </Accordion>
          </div>
        </motion.div>

        {/* Contact Us — stacked vertical cards */}
        <motion.div variants={fadeUp} className="flex flex-col gap-2">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Contact Us
          </h2>
          <div className="flex flex-col gap-2.5">
            {contactOptions.map((opt, i) => (
              <motion.button
                key={opt.label}
                whileTap={{ scale: 0.97 }}
                whileHover={{ y: -2 }}
                onClick={opt.action}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.35 }}
                className={`flex items-center gap-3.5 rounded-2xl bg-gradient-to-r ${opt.gradient} p-3.5 shadow-md transition-shadow hover:shadow-lg`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${opt.iconBg} shadow-inner`}>
                  <span className="text-white">{opt.icon}</span>
                </div>
                <div className="flex flex-1 flex-col items-start text-left">
                  <span className="text-sm font-bold text-white">{opt.label}</span>
                  <span className="text-xs text-white/75 leading-tight">{opt.desc}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-white/60 shrink-0" strokeWidth={2} />
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Report a Problem */}
        <motion.div variants={fadeUp} className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Report a Problem
          </h2>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-3">
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder={tr('Subject')}
                className="h-11 rounded-xl border-border bg-background"
              />
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={tr('Describe the issue...')}
                className="min-h-[100px] rounded-xl border-border bg-background"
              />
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="h-11 rounded-2xl font-semibold shadow-md"
              >
                <Send className="mr-2 h-4 w-4" strokeWidth={1.8} />
                {submitting ? 'Submitting...' : 'Submit Report'}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Quick Links */}
        <motion.div variants={fadeUp} className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Quick Links
          </h2>
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            {quickLinks.map((link, i) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.98 }}
                onClick={() => link.path ? navigate(link.path) : toast.info(`${link.label} coming soon`)}
                className="flex w-full items-center justify-between border-b border-border/40 px-4 py-3.5 last:border-0 transition-colors active:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <span className="text-muted-foreground">{link.icon}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">{link.label}</span>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Support hours footer */}
        <motion.div variants={fadeUp} className="flex items-center justify-center gap-2 py-3">
          <Headphones className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="text-[11px] text-muted-foreground/60">
            Support available Mon–Sat, 8AM–6PM WAT
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default CustomerHelp;
