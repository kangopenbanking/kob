import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MessageCircle, X, ArrowLeft, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { IntakeFields, type IntakeField } from './support/IntakeFields';
import { SlaBadge } from './support/SlaBadge';
import {
  getOrCreateGuestId,
  getPersistedDepartment,
  setPersistedDepartment,
} from '@/utils/supportGuest';
import { validateStartChat, describeBackendError, type FieldErrors } from '@/utils/supportValidation';
import { checkSupportBackendHealth, type HealthState } from '@/utils/supportHealth';
import { trackSupport } from '@/utils/supportAnalytics';

type Step = 'closed' | 'menu' | 'departments' | 'subject' | 'chat' | 'history';

export const SupportChatWidget: React.FC = () => {
  const [step, setStep] = useState<Step>('closed');
  const [userId, setUserId] = useState<string>();
  const [selectedDept, setSelectedDept] = useState<Department | undefined>(() => getPersistedDepartment());
  const [subject, setSubject] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [intakeValues, setIntakeValues] = useState<Record<string, string>>({});
  const [intakeErrors, setIntakeErrors] = useState<Record<string, string>>({});
  const [activeConvId, setActiveConvId] = useState<string>();
  const [starting, setStarting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<{ subject?: boolean; guestEmail?: boolean }>({});
  const [health, setHealth] = useState<{ state: HealthState; latencyMs?: number; error?: string }>({ state: 'unknown' });
  const [agentTyping, setAgentTyping] = useState(false);

  // Persistent guest identity for anonymous visitors (no account required)
  const guestId = useMemo(() => getOrCreateGuestId(), []);

  // Identity used for storage uploads + per-guest rate limiting (server-evaluated keys).
  const supportIdentity = userId || `guest_${guestId}`;

  const { departments, loading: deptsLoading } = useSupportDepartments();
  const { conversations, loading: convsLoading, refresh: refreshConvs } = useSupportConversations(userId, guestId);
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
    if (activeConvId && step === 'chat') markRead(activeConvId, 'user');
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

  // Run a health probe whenever the user enters the subject step
  const runHealthProbe = useCallback(async () => {
    setHealth({ state: 'checking' });
    const res = await checkSupportBackendHealth();
    setHealth(res);
    if (res.state === 'offline' || res.state === 'degraded') {
      trackSupport('support_health_check_failed', { state: res.state, latencyMs: res.latencyMs, error: res.error });
    }
  }, []);

  useEffect(() => {
    if (step === 'subject') runHealthProbe();
  }, [step, runHealthProbe]);

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_user_count || 0), 0);

  // Department-driven dynamic intake fields (e.g., order ID, account ID, urgency)
  const intakeFields: IntakeField[] = useMemo(
    () => (selectedDept?.intake_fields as IntakeField[] | undefined) ?? [],
    [selectedDept?.id, selectedDept?.intake_fields],
  );

  // Reset intake state whenever the user picks a different department
  useEffect(() => {
    setIntakeValues({});
    setIntakeErrors({});
  }, [selectedDept?.id]);

  // Live (per-keystroke) validation for the form
  const liveErrors = useMemo<FieldErrors>(() => {
    const { errors: e } = validateStartChat({
      departmentId: selectedDept?.id,
      subject,
      guestName: userId ? '' : guestName,
      guestEmail: userId ? '' : guestEmail,
    });
    return e;
  }, [selectedDept?.id, subject, guestName, guestEmail, userId]);

  // Live validation for required intake fields
  const liveIntakeErrors = useMemo<Record<string, string>>(() => {
    const errs: Record<string, string> = {};
    for (const f of intakeFields) {
      if (f.required && !(intakeValues[f.key] || '').trim()) {
        errs[f.key] = `${f.label} is required.`;
      }
    }
    return errs;
  }, [intakeFields, intakeValues]);

  const formValid =
    Object.keys(liveErrors).length === 0 && Object.keys(liveIntakeErrors).length === 0;
  const backendUp = health.state === 'healthy' || health.state === 'degraded' || health.state === 'unknown';
  const canSubmit = formValid && backendUp && !starting;

  // The conversation summary backing the chat header (for SLA + meta)
  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeConvId),
    [conversations, activeConvId],
  );

  const handleDeptSelect = (dept: Department) => {
    setSelectedDept(dept);
    setPersistedDepartment(dept);
    trackSupport('support_dept_selected', {
      department_id: dept.id,
      department_name: dept.name,
      intake_field_count: (dept.intake_fields || []).length,
    });
    setStep('subject');
  };

  const openWidget = () => {
    setStep('menu');
    trackSupport('support_widget_opened', { has_persisted_dept: !!selectedDept });
  };

  const startNewConversation = () => {
    // Skip the dept picker if we already have a remembered department
    if (selectedDept) setStep('subject');
    else setStep('departments');
  };

  const handleStartChat = async () => {
    trackSupport('support_start_chat_clicked', {
      department_id: selectedDept?.id,
      has_subject: subject.trim().length > 0,
      authenticated: !!userId,
      intake_field_count: intakeFields.length,
    });

    // Field-level validation — show inline errors and keep user on the failing step
    const { ok, errors: fieldErrors } = validateStartChat({
      departmentId: selectedDept?.id,
      subject,
      guestName: userId ? '' : guestName,
      guestEmail: userId ? '' : guestEmail,
    });
    setErrors(fieldErrors);
    setIntakeErrors(liveIntakeErrors);
    setTouched({ subject: true, guestEmail: true });

    if (!ok || Object.keys(liveIntakeErrors).length > 0) {
      const firstError =
        Object.values(fieldErrors)[0] ||
        Object.values(liveIntakeErrors)[0] ||
        'Please fix the highlighted fields.';
      trackSupport('support_validation_failed', {
        errors: fieldErrors,
        intake_errors: liveIntakeErrors,
      });
      toast.error(firstError);
      // Keep user on the most relevant step
      if (fieldErrors.departmentId) setStep('departments');
      return;
    }

    // Health gate
    if (!backendUp) {
      toast.error(`Support backend is ${health.state}. ${health.error || 'Please retry shortly.'}`);
      return;
    }

    if (starting) return;
    setStarting(true);
    try {
      // Trim & strip empty intake values so DB metadata stays clean
      const cleanIntake: Record<string, string> = {};
      for (const f of intakeFields) {
        const v = (intakeValues[f.key] || '').trim();
        if (v) cleanIntake[f.key] = v;
      }

      const convId = await createConversation(
        userId,
        selectedDept!.id,
        subject.trim(),
        'website',
        subject.trim(),
        userId ? undefined : { guestId, name: guestName.trim() || undefined, email: guestEmail.trim() || undefined },
        cleanIntake,
      );
      trackSupport('support_conversation_created', {
        conversation_id: convId,
        department_id: selectedDept!.id,
        authenticated: !!userId,
        intake_keys: Object.keys(cleanIntake),
      });
      setActiveConvId(convId);
      setStep('chat');
      refreshConvs();
    } catch (e: any) {
      const desc = describeBackendError(e);
      console.error('[SupportChat] start chat failed:', e);
      trackSupport('support_conversation_error', {
        code: desc.code,
        message: desc.message,
        details: desc.details,
      });
      toast.error(desc.message, {
        description: desc.code ? `Error code: ${desc.code}` : undefined,
        duration: 8000,
      });
      // Stay on the subject step so the user can retry
      setStep('subject');
    } finally {
      setStarting(false);
    }
  };

  const handleSend = async (content: string, filePath?: string, fileType?: string) => {
    if (!activeConvId) return;
    try {
      await sendMessage(activeConvId, userId, 'user', content, filePath, fileType, supportIdentity);
    } catch (e: any) {
      const desc = describeBackendError(e);
      trackSupport('support_send_message_error', { code: desc.code, message: desc.message });
      toast.error(desc.message);
    }
  };

  const isOpen = step !== 'closed';

  // Helpers for inline error display: only show after the user has touched the field OR after submit
  const showSubjectError = (touched.subject || errors.subject) && (errors.subject || liveErrors.subject);
  const showEmailError = (touched.guestEmail || errors.guestEmail) && (errors.guestEmail || liveErrors.guestEmail);

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={openWidget}
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
                  <p className="text-sm text-muted-foreground">
                    How can we help you today? Live support is free — no account needed.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    <Button onClick={startNewConversation} className="justify-start rounded-xl" variant="outline">
                      <MessageCircle className="mr-2 h-4 w-4" strokeWidth={1.5} /> Start a new conversation
                    </Button>
                    {selectedDept && (
                      <p className="text-[11px] text-muted-foreground">
                        Last department: <span className="font-medium text-foreground">{selectedDept.name}</span>{' '}
                        ·{' '}
                        <button
                          className="underline hover:text-foreground"
                          onClick={() => { setSelectedDept(undefined); setPersistedDepartment(undefined); setStep('departments'); }}
                        >
                          Change
                        </button>
                      </p>
                    )}
                    {conversations.length > 0 && (
                      <Button onClick={() => { refreshConvs(); setStep('history'); }} className="justify-start rounded-xl" variant="ghost">
                        View past conversations ({conversations.length})
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {step === 'departments' && (
                <DepartmentPicker departments={departments} loading={deptsLoading} onSelect={handleDeptSelect} />
              )}

              {step === 'subject' && (
                <div className="flex flex-col gap-3 p-4">
                  {/* Selected department summary */}
                  {selectedDept && (
                    <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Department</p>
                        <p className="truncate text-sm font-medium text-foreground">{selectedDept.name}</p>
                      </div>
                      <button className="text-xs text-primary underline" onClick={() => setStep('departments')}>
                        Change
                      </button>
                    </div>
                  )}

                  <p className="text-sm font-medium text-foreground">What can we help you with?</p>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, subject: true }))}
                    placeholder="Briefly describe your issue…"
                    className="rounded-xl"
                    aria-invalid={!!showSubjectError}
                    maxLength={200}
                  />
                  {showSubjectError && (
                    <p className="text-[11px] text-destructive">{errors.subject || liveErrors.subject}</p>
                  )}

                  {!userId && (
                    <>
                      <Input
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Your name (optional)"
                        className="rounded-xl"
                        maxLength={80}
                      />
                      <Input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, guestEmail: true }))}
                        placeholder="Email for replies (optional)"
                        className="rounded-xl"
                        aria-invalid={!!showEmailError}
                        maxLength={200}
                      />
                      {showEmailError ? (
                        <p className="text-[11px] text-destructive">{errors.guestEmail || liveErrors.guestEmail}</p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Add an email if you'd like agent replies sent to your inbox.
                        </p>
                      )}
                    </>
                  )}

                  {/* Department-specific intake fields (e.g., order ID, account ID) */}
                  {intakeFields.length > 0 && (
                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {selectedDept?.name} details
                      </p>
                      <IntakeFields
                        fields={intakeFields}
                        values={intakeValues}
                        errors={intakeErrors}
                        onChange={(key, value) => {
                          setIntakeValues((v) => ({ ...v, [key]: value }));
                          setIntakeErrors((e) => {
                            if (!e[key]) return e;
                            const { [key]: _, ...rest } = e;
                            return rest;
                          });
                        }}
                      />
                    </div>
                  )}

                  {/* SLA expectation hint based on the selected department */}
                  {selectedDept?.sla_target_minutes && (
                    <p className="text-[11px] text-muted-foreground">
                      Expected first response: within{' '}
                      <span className="font-medium text-foreground">
                        {selectedDept.sla_target_minutes} min
                      </span>{' '}
                      (target SLA).
                    </p>
                  )}

                  {/* Backend health banner */}
                  {(health.state === 'offline' || health.state === 'degraded') && (
                    <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                      <span>
                        {health.state === 'offline' ? 'Support backend is unreachable.' : 'Support backend is slow.'}{' '}
                        {health.error || ''}{' '}
                        <button className="underline" onClick={runHealthProbe}>Retry</button>
                      </span>
                    </div>
                  )}
                  {health.state === 'healthy' && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" strokeWidth={1.5} />
                      Backend healthy · {health.latencyMs}ms
                    </div>
                  )}

                  <Button
                    onClick={handleStartChat}
                    disabled={!canSubmit}
                    className="rounded-xl"
                  >
                    {starting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.5} /> Starting…</>
                    ) : health.state === 'checking' ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.5} /> Checking backend…</>
                    ) : !backendUp ? (
                      'Backend unavailable'
                    ) : (
                      'Start chat'
                    )}
                  </Button>

                  {!selectedDept && (
                    <p className="text-[11px] text-destructive">
                      No department selected.{' '}
                      <button className="underline" onClick={() => setStep('departments')}>Choose one</button>.
                    </p>
                  )}
                </div>
              )}

              {step === 'chat' && (
                <>
                  {activeConv && (
                    <div className="border-b border-border bg-muted/30 px-3 py-2">
                      <SlaBadge
                        createdAt={activeConv.created_at}
                        slaTargetMinutes={activeConv.sla_target_minutes}
                        slaBreachAt={activeConv.sla_breach_at}
                        firstResponseAt={activeConv.first_response_at}
                        status={activeConv.status}
                        liveCountdown
                      />
                    </div>
                  )}
                  <ChatThread
                    messages={messages}
                    currentUserId={userId}
                    viewerRole="user"
                    className="flex-1"
                    agentTyping={agentTyping}
                  />
                  <ChatInput
                    onSend={handleSend}
                    uploadIdentity={supportIdentity}
                    conversationId={activeConvId}
                    typingRole="user"
                  />
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
