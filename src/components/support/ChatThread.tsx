import React, { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { FileText, Image as ImageIcon, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChatMessage {
  id: string;
  sender_type: 'user' | 'agent' | 'system';
  sender_id?: string;
  content?: string;
  file_url?: string;
  file_type?: string;
  created_at: string;
  read_at?: string;
}

interface ChatThreadProps {
  messages: ChatMessage[];
  currentUserId?: string;
  className?: string;
}

const isImage = (type?: string) => type?.startsWith('image/');

export const ChatThread: React.FC<ChatThreadProps> = ({ messages, currentUserId, className }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className={cn('flex flex-1 items-center justify-center text-sm text-muted-foreground', className)}>
        No messages yet. Start the conversation!
      </div>
    );
  }

  return (
    <div className={cn('flex flex-1 flex-col gap-3 overflow-y-auto p-4', className)}>
      {messages.map((msg) => {
        const isOwn = msg.sender_type === 'user' && msg.sender_id === currentUserId;
        const isSystem = msg.sender_type === 'system';

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
              {msg.sender_type === 'agent' && !isOwn && (
                <p className="mb-0.5 text-[10px] font-semibold opacity-70">Support Agent</p>
              )}
              {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
              {msg.file_url && (
                <div className="mt-2">
                  {isImage(msg.file_type) ? (
                    <img src={msg.file_url} alt="Attachment" className="max-h-48 rounded-lg object-cover" />
                  ) : (
                    <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                      className={cn(
                        'flex items-center gap-2 rounded-lg p-2 text-xs',
                        isOwn ? 'bg-primary-foreground/10' : 'bg-background'
                      )}>
                      <FileText className="h-4 w-4" />
                      <span>Download file</span>
                      <Download className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
              <p className={cn('mt-1 text-[10px] opacity-60', isOwn ? 'text-right' : 'text-left')}>
                {format(new Date(msg.created_at), 'HH:mm')}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
