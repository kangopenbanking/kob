import React, { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SupportAttachment } from './AttachmentImage';

export interface ChatMessage {
  id: string;
  sender_type: 'user' | 'agent' | 'system';
  sender_id?: string;
  content?: string;
  file_url?: string;     // legacy: full URL or new: storage path
  file_type?: string;
  created_at: string;
  read_at?: string;
}

interface ChatThreadProps {
  messages: ChatMessage[];
  currentUserId?: string;
  viewerRole?: 'user' | 'agent';
  className?: string;
}

export const ChatThread: React.FC<ChatThreadProps> = ({
  messages,
  currentUserId,
  viewerRole = 'user',
  className,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className={cn('flex flex-1 items-center justify-center text-sm text-muted-foreground', className)}>
        No messages yet — start the conversation.
      </div>
    );
  }

  return (
    <div className={cn('flex flex-1 flex-col gap-3 overflow-y-auto p-4', className)}>
      {messages.map((msg) => {
        const isSystem = msg.sender_type === 'system';

        // "Own" = a message I sent, regardless of role
        const isOwn =
          (viewerRole === 'user' && msg.sender_type === 'user' && msg.sender_id === currentUserId) ||
          (viewerRole === 'agent' && msg.sender_type === 'agent' && msg.sender_id === currentUserId);

        if (isSystem) {
          return (
            <div key={msg.id} className="flex justify-center">
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                {msg.content}
              </span>
            </div>
          );
        }

        return (
          <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[80%] rounded-2xl px-4 py-2.5',
              isOwn
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-muted text-foreground rounded-bl-md'
            )}>
              {!isOwn && (
                <p className="mb-0.5 text-[10px] font-semibold opacity-70">
                  {msg.sender_type === 'agent' ? 'Support agent' : 'You'}
                </p>
              )}
              {msg.content && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}
              {msg.file_url && (
                <SupportAttachment value={msg.file_url} fileType={msg.file_type} isOwn={isOwn} />
              )}
              <div className={cn('mt-1 flex items-center gap-1 text-[10px] opacity-60', isOwn ? 'justify-end' : 'justify-start')}>
                <span>{format(new Date(msg.created_at), 'HH:mm')}</span>
                {isOwn && (
                  msg.read_at
                    ? <CheckCheck className="h-3 w-3" strokeWidth={2} aria-label="Read" />
                    : <Check className="h-3 w-3" strokeWidth={2} aria-label="Sent" />
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
