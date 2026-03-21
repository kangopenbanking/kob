import React, { useState, useEffect } from 'react';
import { MessageCircle, X, ArrowLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { DepartmentPicker, type Department } from './support/DepartmentPicker';
import { ChatThread } from './support/ChatThread';
import { ChatInput } from './support/ChatInput';
import { ConversationList } from './support/ConversationList';
import {
  useSupportDepartments,
  useSupportConversations,
  useSupportMessages,
  useCreateConversation,
  useSendMessage,
} from '@/hooks/useSupportChat';
import { Input } from './ui/input';
import { Button } from './ui/button';

type Step = 'closed' | 'menu' | 'departments' | 'subject' | 'chat' | 'history';

export const SupportChatWidget: React.FC = () => {
  const [step, setStep] = useState<Step>('closed');
  const [userId, setUserId] = useState<string>();
  const [selectedDept, setSelectedDept] = useState<Department>();
  const [subject, setSubject] = useState('');
  const [activeConvId, setActiveConvId] = useState<string>();

  const { departments, loading: deptsLoading } = useSupportDepartments();
  const { conversations, loading: convsLoading, refresh: refreshConvs } = useSupportConversations(userId);
  const { messages, loading: msgsLoading } = useSupportMessages(activeConvId, userId);
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  const handleDeptSelect = (dept: Department) => {
    setSelectedDept(dept);
    setStep('subject');
  };

  const handleStartChat = async () => {
    if (!userId || !selectedDept) return;
    try {
      const convId = await createConversation(userId, selectedDept.id, subject || 'General inquiry', 'website', subject);
      setActiveConvId(convId);
      setStep('chat');
      refreshConvs();
    } catch {
      // error handled upstream
    }
  };

  const handleSend = async (content: string, fileUrl?: string, fileType?: string) => {
    if (!activeConvId || !userId) return;
    await sendMessage(activeConvId, userId, 'user', content, fileUrl, fileType);
  };

  const handleOpenHistory = (convId: string) => {
    setActiveConvId(convId);
    setStep('chat');
  };

  const isOpen = step !== 'closed';

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setStep('menu')}
            className="fixed bottom-20 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
            aria-label="Open support chat"
          >
            <MessageCircle className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-5 right-5 z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:h-[520px] sm:w-[400px] max-sm:inset-0 max-sm:bottom-0 max-sm:right-0 max-sm:rounded-none max-sm:border-0"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border bg-primary px-4 py-3">
              {(step === 'departments' || step === 'subject' || step === 'chat' || step === 'history') && (
                <button
                  onClick={() => {
                    if (step === 'chat') { setActiveConvId(undefined); setStep('menu'); }
                    else if (step === 'subject') setStep('departments');
                    else if (step === 'history') setStep('menu');
                    else setStep('menu');
                  }}
                  className="text-primary-foreground/80 hover:text-primary-foreground"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary-foreground">
                  {step === 'chat' ? 'Support Chat' : step === 'history' ? 'Chat History' : 'Live Support'}
                </p>
                {step === 'chat' && <p className="text-[10px] text-primary-foreground/70">We typically reply in a few minutes</p>}
              </div>
              <button onClick={() => { setStep('closed'); setActiveConvId(undefined); }} className="text-primary-foreground/80 hover:text-primary-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {step === 'menu' && (
                <div className="flex flex-col gap-3 p-4">
                  <p className="text-lg font-bold text-foreground">Hi there 👋</p>
                  <p className="text-sm text-muted-foreground">How can we help you today?</p>
                  <div className="mt-4 flex flex-col gap-2">
                    <Button onClick={() => setStep('departments')} className="justify-start rounded-xl" variant="outline">
                      <MessageCircle className="mr-2 h-4 w-4" /> Start a new conversation
                    </Button>
                    {userId && (
                      <Button onClick={() => { refreshConvs(); setStep('history'); }} className="justify-start rounded-xl" variant="ghost">
                        View past conversations ({conversations.length})
                      </Button>
                    )}
                    {!userId && (
                      <p className="mt-2 text-center text-xs text-muted-foreground">Sign in to chat with our team</p>
                    )}
                  </div>
                </div>
              )}

              {step === 'departments' && (
                <DepartmentPicker departments={departments} loading={deptsLoading} onSelect={handleDeptSelect} />
              )}

              {step === 'subject' && (
                <div className="flex flex-col gap-4 p-4">
                  <p className="text-sm font-medium text-foreground">What can we help you with?</p>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Briefly describe your issue..."
                    className="rounded-xl"
                  />
                  <Button onClick={handleStartChat} disabled={!userId} className="rounded-xl">
                    Start Chat
                  </Button>
                </div>
              )}

              {step === 'chat' && (
                <>
                  <ChatThread messages={messages} currentUserId={userId} className="flex-1" />
                  <ChatInput onSend={handleSend} disabled={!userId} />
                </>
              )}

              {step === 'history' && (
                <div className="flex-1 overflow-y-auto p-2">
                  <ConversationList
                    conversations={conversations}
                    loading={convsLoading}
                    onSelect={handleOpenHistory}
                    activeId={activeConvId}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
