import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  useOnlineAgentCount,
  useMarkRead,
} from '@/hooks/useSupportChat';
import { Input } from './ui/input';
import { Button } from './ui/button';

type Step = 'closed' | 'menu' | 'departments' | 'subject' | 'chat' | 'history';

export const SupportChatWidget: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('closed');
  const [userId, setUserId] = useState<string>();
  const [selectedDept, setSelectedDept] = useState<Department>();
  const [subject, setSubject] = useState('');
  const [activeConvId, setActiveConvId] = useState<string>();

  const { departments, loading: deptsLoading } = useSupportDepartments();
  const { conversations, loading: convsLoading, refresh: refreshConvs } = useSupportConversations(userId);
  const { messages } = useSupportMessages(activeConvId, userId);
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();
  const onlineAgents = useOnlineAgentCount();
  const markRead = useMarkRead();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  // Mark agent messages as read whenever the user opens / receives new messages
  useEffect(() => {
    if (activeConvId && userId && step === 'chat') markRead(activeConvId, 'user');
  }, [activeConvId, userId, step, messages.length, markRead]);

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'closed') {
        setStep('closed');
        setActiveConvId(undefined);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_user_count || 0), 0);

  const handleDeptSelect = (dept: Department) => { setSelectedDept(dept); setStep('subject'); };

  const handleStartChat = async () => {
    if (!userId || !selectedDept) return;
    try {
      const convId = await createConversation(userId, selectedDept.id, subject || 'General inquiry', 'website', subject);
      setActiveConvId(convId);
      setStep('chat');
      refreshConvs();
    } catch { /* error handled upstream */ }
  };

  const handleSend = async (content: string, filePath?: string, fileType?: string) => {
    if (!activeConvId || !userId) return;
    await sendMessage(activeConvId, userId, 'user', content, filePath, fileType);
  };

  const isOpen = step !== 'closed';

  return (
    <>
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
            <MessageCircle className="h-6 w-6" strokeWidth={1.5} />
            {totalUnread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-modal="false"
            aria-label="Live support chat"
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
                    else setStep('menu');
                  }}
                  className="text-primary-foreground/80 hover:text-primary-foreground"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
                </button>
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary-foreground">
                  {step === 'chat' ? 'Support chat' : step === 'history' ? 'Chat history' : 'Live support'}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-primary-foreground/80">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${onlineAgents > 0 ? 'bg-emerald-300' : 'bg-amber-300'}`} />
                  {onlineAgents > 0
                    ? `${onlineAgents} agent${onlineAgents > 1 ? 's' : ''} online · usually replies in a few minutes`
                    : 'Agents are offline · we will reply by email'}
                </div>
              </div>
              <button
                onClick={() => { setStep('closed'); setActiveConvId(undefined); }}
                className="text-primary-foreground/80 hover:text-primary-foreground"
                aria-label="Close support chat"
              >
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {step === 'menu' && (
                <div className="flex flex-col gap-3 p-4">
                  <p className="text-lg font-bold text-foreground">Hi there</p>
                  <p className="text-sm text-muted-foreground">How can we help you today?</p>
                  <div className="mt-4 flex flex-col gap-2">
                    {userId ? (
                      <>
                        <Button onClick={() => setStep('departments')} className="justify-start rounded-xl" variant="outline">
                          <MessageCircle className="mr-2 h-4 w-4" strokeWidth={1.5} /> Start a new conversation
                        </Button>
                        <Button onClick={() => { refreshConvs(); setStep('history'); }} className="justify-start rounded-xl" variant="ghost">
                          View past conversations ({conversations.length})
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-center text-xs text-muted-foreground">Sign in to chat with our team.</p>
                        <Button onClick={() => { setStep('closed'); navigate('/auth'); }} className="rounded-xl">
                          Sign in to continue
                        </Button>
                      </>
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
                    placeholder="Briefly describe your issue…"
                    className="rounded-xl"
                  />
                  <Button onClick={handleStartChat} disabled={!userId} className="rounded-xl">
                    Start chat
                  </Button>
                </div>
              )}

              {step === 'chat' && (
                <>
                  <ChatThread messages={messages} currentUserId={userId} viewerRole="user" className="flex-1" />
                  <ChatInput onSend={handleSend} disabled={!userId} />
                </>
              )}

              {step === 'history' && (
                <div className="flex-1 overflow-y-auto p-2">
                  <ConversationList
                    conversations={conversations}
                    loading={convsLoading}
                    onSelect={(id) => { setActiveConvId(id); setStep('chat'); }}
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
