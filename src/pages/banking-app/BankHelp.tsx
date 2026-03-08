import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Phone, Mail, FileText, ChevronRight, Send, X, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/components/pwa/TenantProvider';

const faqs = [
  { q: 'How do I fund my account?', a: 'Go to Home → Fund Account and choose from Mobile Money, Card, PayPal, or Bank Transfer. Follow the prompts to complete your deposit.' },
  { q: 'How long do transfers take?', a: 'Internal transfers are instant. Mobile Money transfers typically complete within 1–5 minutes. Bank transfers may take 1–3 business days.' },
  { q: 'How do I reset my transaction PIN?', a: 'Go to More → Settings → Change Transaction PIN. You will need to verify your identity before setting a new PIN.' },
  { q: 'What are virtual cards?', a: 'Virtual cards are digital Visa/Mastercard cards you can use for online purchases. Create one from the Cards tab on the home screen.' },
  { q: 'How do I check my credit score?', a: 'Go to More → Credit Score to view your CrediQ rating, score history, and tips to improve your score.' },
  { q: 'Is my money safe?', a: 'Yes. All accounts are protected with bank-grade encryption, two-factor authentication, and transaction PIN verification for every payment.' },
  { q: 'How do I close my account?', a: 'Please contact our support team via Live Chat or email. Account closure requests are processed within 5 business days.' },
];

const BankHelp: React.FC = () => {
  const navigate = useNavigate();
  const { name: institutionName, supportPhone, supportEmail } = useTenant();
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatSubject, setChatSubject] = useState('');
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const phoneNumber = supportPhone || '+237 233 000 000';
  const emailAddress = supportEmail || 'support@kangbank.com';

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(phoneNumber.replace(/\s/g, ''));
      setCopiedPhone(true);
      toast.success('Phone number copied! Opening dialer...');
      setTimeout(() => setCopiedPhone(false), 2000);
      // Also open the dialer
      window.location.href = `tel:${phoneNumber.replace(/\s/g, '')}`;
    } catch {
      // Fallback: just open dialer
      window.location.href = `tel:${phoneNumber.replace(/\s/g, '')}`;
    }
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(emailAddress);
      setCopiedEmail(true);
      toast.success('Email copied! Opening email app...');
      setTimeout(() => setCopiedEmail(false), 2000);
      // Also open default email client
      window.location.href = `mailto:${emailAddress}?subject=Support Request — ${institutionName}`;
    } catch {
      // Fallback: just open email client
      window.location.href = `mailto:${emailAddress}?subject=Support Request — ${institutionName}`;
    }
  };

  const handleSendChat = async () => {
    if (!chatSubject.trim() || !chatMessage.trim()) {
      toast.error('Please fill in subject and message');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Please sign in first'); return; }
      const { error } = await supabase.from('app_notifications').insert({
        user_id: user.id,
        type: 'info',
        title: `Support: ${chatSubject.trim()}`,
        message: chatMessage.trim(),
        icon: 'support',
        metadata: { source: 'bank_help_chat', subject: chatSubject.trim() },
      });
      if (error) throw error;
      toast.success('Message sent! Our team will respond within 24 hours.');
      setChatMessage('');
      setChatSubject('');
      setShowChat(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    }
  };

  const helpActions = [
    {
      icon: FileText,
      label: 'FAQs',
      description: 'Frequently asked questions',
      onClick: () => {
        document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' });
      },
      trailing: <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />,
    },
    {
      icon: MessageCircle,
      label: 'Live Chat',
      description: 'Chat with support',
      onClick: () => setShowChat(true),
      trailing: <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />,
    },
    {
      icon: Phone,
      label: 'Call Us',
      description: phoneNumber,
      onClick: handleCopyPhone,
      trailing: copiedPhone
        ? <Check className="h-4 w-4 text-green-500" strokeWidth={1.5} />
        : <Copy className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />,
    },
    {
      icon: Mail,
      label: 'Email Support',
      description: emailAddress,
      onClick: handleCopyEmail,
      trailing: copiedEmail
        ? <Check className="h-4 w-4 text-green-500" strokeWidth={1.5} />
        : <Copy className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Back
      </button>

      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Help & Support</h1>
      <p className="mb-6 text-sm text-muted-foreground">How can we help you?</p>

      {/* Contact Actions */}
      <div className="flex flex-col gap-2 mb-8">
        {helpActions.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileTap={{ scale: 0.98 }}
              onClick={item.onClick}
              className="flex items-center justify-between rounded-xl border bg-card p-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              {item.trailing}
            </motion.button>
          );
        })}
      </div>

      {/* FAQ Section */}
      <div id="faq-section">
        <h2 className="mb-3 text-base font-semibold text-foreground">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-sm text-left">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* Live Chat Modal */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
            onClick={() => setShowChat(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-2xl bg-card p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground">Send a Message</h3>
                <button onClick={() => setShowChat(false)}>
                  <X className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <Input
                  placeholder="Subject"
                  value={chatSubject}
                  onChange={(e) => setChatSubject(e.target.value)}
                />
                <Textarea
                  placeholder="Describe your issue..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  rows={4}
                />
                <Button onClick={handleSendChat} className="w-full gap-2">
                  <Send className="h-4 w-4" strokeWidth={1.5} />
                  Send Message
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BankHelp;
