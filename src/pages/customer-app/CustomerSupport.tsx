import React, { useState } from 'react';
import { ArrowLeft, ListChecks, PenLine, MessageCircle, Paperclip } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { DepartmentPicker, type Department } from '@/components/support/DepartmentPicker';
import { ChatThread } from '@/components/support/ChatThread';
import { ChatInput } from '@/components/support/ChatInput';
import { ConversationList } from '@/components/support/ConversationList';
import { HowItWorksFlow, type FlowStep } from '@/components/customer-app/HowItWorksFlow';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';
  useSupportDepartments,
  useSupportConversations,
  useSupportMessages,
  useCreateConversation,
  useSendMessage,
} from '@/hooks/useSupportChat';

type Step = 'list' | 'departments' | 'subject' | 'chat';

const supportFlowSteps: FlowStep[] = [
  { icon: ListChecks, title: 'Choose a department', description: 'Pick the team that best fits your issue for faster routing.', color: 'hsl(210,80%,93%)', iconColor: 'hsl(210,60%,45%)' },
  { icon: PenLine, title: 'Describe your issue', description: 'Write a brief summary so our agents can prepare.', color: 'hsl(150,70%,90%)', iconColor: 'hsl(150,50%,35%)' },
  { icon: MessageCircle, title: 'Chat with an agent', description: 'Get live help from the KOB support team.', color: 'hsl(35,90%,90%)', iconColor: 'hsl(35,70%,40%)' },
  { icon: Paperclip, title: 'Attach files if needed', description: 'Upload images or documents to help explain your issue. NOTE: KOB responds within 15 min – 24 hrs.', color: 'hsl(280,70%,92%)', iconColor: 'hsl(280,50%,45%)' },
];

const CustomerSupport: React.FC = () => {
  const tr = useHarvestedT('customer');
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const userId = user?.id;

  const [step, setStep] = useState<Step>('list');
  const [selectedDept, setSelectedDept] = useState<Department>();
  const [subject, setSubject] = useState('');
  const [activeConvId, setActiveConvId] = useState<string>();

  const { departments, loading: deptsLoading } = useSupportDepartments();
  const { conversations, loading: convsLoading, refresh } = useSupportConversations(userId);
  const { messages } = useSupportMessages(activeConvId, userId);
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();

  const handleStartChat = async () => {
    if (!userId || !selectedDept) return;
    const convId = await createConversation(userId, selectedDept.id, subject || 'General inquiry', 'consumer_app', subject);
    setActiveConvId(convId);
    setStep('chat');
    refresh();
  };

  const handleSend = async (content: string, fileUrl?: string, fileType?: string) => {
    if (!activeConvId || !userId) return;
    await sendMessage(activeConvId, userId, 'user', content, fileUrl, fileType);
  };

  const title = step === 'chat' ? 'Support Chat' : step === 'departments' ? 'Choose Department' : step === 'subject' ? 'Describe Issue' : 'Support Chat';

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 5rem)' }}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
        <button onClick={() => {
          if (step === 'chat') { setActiveConvId(undefined); setStep('list'); }
          else if (step === 'subject') setStep('departments');
          else if (step === 'departments') setStep('list');
          else navigate('/app/more');
        }}>
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
      </div>

      {step === 'list' && (
        <div className="flex flex-1 flex-col p-4 gap-4 overflow-y-auto">
          <HowItWorksFlow
            defaultOpen
            steps={supportFlowSteps}
          />
          <Button onClick={() => setStep('departments')} className="rounded-xl">
            Start New Conversation
          </Button>
          <ConversationList
            conversations={conversations}
            loading={convsLoading}
            onSelect={(id) => { setActiveConvId(id); setStep('chat'); }}
          />
        </div>
      )}

      {step === 'departments' && (
        <div className="flex-1 overflow-y-auto">
          <DepartmentPicker departments={departments} loading={deptsLoading} onSelect={(d) => { setSelectedDept(d); setStep('subject'); }} />
        </div>
      )}

      {step === 'subject' && (
        <div className="flex flex-col gap-4 p-4">
          <p className="text-sm font-medium">{tr('What can we help you with?')}</p>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={tr('Briefly describe your issue...')} className="rounded-xl" />
          <Button onClick={handleStartChat} className="rounded-xl">{tr('Start Chat')}</Button>
        </div>
      )}

      {step === 'chat' && (
        <div className="flex flex-1 flex-col min-h-0">
          <ChatThread messages={messages} currentUserId={userId} className="flex-1 min-h-0 overflow-y-auto" />
          <div className="shrink-0">
            <ChatInput onSend={handleSend} />
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSupport;
