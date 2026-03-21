import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DepartmentPicker, type Department } from '@/components/support/DepartmentPicker';
import { ChatThread } from '@/components/support/ChatThread';
import { ChatInput } from '@/components/support/ChatInput';
import { ConversationList } from '@/components/support/ConversationList';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  useSupportDepartments,
  useSupportConversations,
  useSupportMessages,
  useCreateConversation,
  useSendMessage,
} from '@/hooks/useSupportChat';

type Step = 'list' | 'departments' | 'subject' | 'chat';

const BankSupport: React.FC = () => {
  const navigate = useNavigate();
  const { institutionId } = useParams();
  const [userId, setUserId] = useState<string>();
  const [step, setStep] = useState<Step>('list');
  const [selectedDept, setSelectedDept] = useState<Department>();
  const [subject, setSubject] = useState('');
  const [activeConvId, setActiveConvId] = useState<string>();

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id)); }, []);

  const { departments, loading: deptsLoading } = useSupportDepartments();
  const { conversations, loading: convsLoading, refresh } = useSupportConversations(userId);
  const { messages } = useSupportMessages(activeConvId);
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();

  const handleStartChat = async () => {
    if (!userId || !selectedDept) return;
    const convId = await createConversation(userId, selectedDept.id, subject || 'General inquiry', 'banking_app', subject);
    setActiveConvId(convId);
    setStep('chat');
    refresh();
  };

  const handleSend = async (content: string, fileUrl?: string, fileType?: string) => {
    if (!activeConvId || !userId) return;
    await sendMessage(activeConvId, userId, 'user', content, fileUrl, fileType);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => {
          if (step === 'chat') { setActiveConvId(undefined); setStep('list'); }
          else if (step === 'subject') setStep('departments');
          else if (step === 'departments') setStep('list');
          else navigate(`/bank/${institutionId}/more`);
        }}>
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">
          {step === 'chat' ? 'Support Chat' : step === 'departments' ? 'Choose Department' : step === 'subject' ? 'Describe Issue' : 'Support'}
        </h1>
      </div>

      {step === 'list' && (
        <div className="flex flex-1 flex-col p-4 gap-4">
          <Button onClick={() => setStep('departments')} className="rounded-xl">Start New Conversation</Button>
          <ConversationList conversations={conversations} loading={convsLoading} onSelect={(id) => { setActiveConvId(id); setStep('chat'); }} />
        </div>
      )}
      {step === 'departments' && <DepartmentPicker departments={departments} loading={deptsLoading} onSelect={(d) => { setSelectedDept(d); setStep('subject'); }} />}
      {step === 'subject' && (
        <div className="flex flex-col gap-4 p-4">
          <p className="text-sm font-medium">What can we help you with?</p>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Briefly describe your issue..." className="rounded-xl" />
          <Button onClick={handleStartChat} className="rounded-xl">Start Chat</Button>
        </div>
      )}
      {step === 'chat' && (
        <>
          <ChatThread messages={messages} currentUserId={userId} className="flex-1" />
          <ChatInput onSend={handleSend} />
        </>
      )}
    </div>
  );
};

export default BankSupport;
