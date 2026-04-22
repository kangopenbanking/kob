import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, ChevronRight, Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SlaBadge } from './SlaBadge';
import { exportConversationToPdf } from '@/utils/supportTranscript';
import { toast } from 'sonner';

export interface ConversationSummary {
  id: string;
  subject?: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  department_name?: string;
  last_message_preview?: string;
  last_message_at?: string;
  unread_user_count?: number;
  sla_target_minutes?: number;
  sla_breach_at?: string | null;
  first_response_at?: string | null;
}

interface ConversationListProps {
  conversations: ConversationSummary[];
  loading?: boolean;
  onSelect: (id: string) => void;
  activeId?: string;
}

const statusColors: Record<string, string> = {
  open: 'bg-yellow-500',
  assigned: 'bg-blue-500',
  resolved: 'bg-green-500',
  closed: 'bg-muted-foreground',
};

export const ConversationList: React.FC<ConversationListProps> = ({ conversations, loading, onSelect, activeId }) => {
  const [exportingId, setExportingId] = useState<string | null>(null);

  const handleExport = async (e: React.MouseEvent, conv: ConversationSummary) => {
    e.stopPropagation();
    setExportingId(conv.id);
    try {
      await exportConversationToPdf({
        conversationId: conv.id,
        subject: conv.subject,
        departmentName: conv.department_name,
        createdAt: conv.created_at,
        updatedAt: conv.last_message_at || conv.updated_at,
        slaTargetMinutes: conv.sla_target_minutes,
        firstResponseAt: conv.first_response_at,
      });
      toast.success('Transcript downloaded');
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    } finally {
      setExportingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <MessageCircle className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {conversations.map((conv) => {
        const unread = conv.unread_user_count ?? 0;
        return (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-xl p-3 text-left transition-colors',
              activeId === conv.id ? 'bg-accent' : 'hover:bg-muted/50'
            )}
          >
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <MessageCircle className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className={cn('truncate text-sm text-foreground', unread > 0 ? 'font-semibold' : 'font-medium')}>
                  {conv.subject || 'Support chat'}
                </p>
                <span className={cn('h-2 w-2 shrink-0 rounded-full', statusColors[conv.status] || 'bg-muted-foreground')} />
                <SlaBadge
                  compact
                  createdAt={conv.created_at}
                  slaTargetMinutes={conv.sla_target_minutes}
                  slaBreachAt={conv.sla_breach_at}
                  firstResponseAt={conv.first_response_at}
                  status={conv.status}
                />
              </div>
              {conv.last_message_preview && (
                <p className="truncate text-xs text-muted-foreground">{conv.last_message_preview}</p>
              )}
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {conv.department_name && <span>{conv.department_name}</span>}
                {conv.department_name && <span>·</span>}
                <span>{formatDistanceToNow(new Date(conv.last_message_at || conv.updated_at), { addSuffix: true })}</span>
              </div>
            </div>
            <button
              onClick={(e) => handleExport(e, conv)}
              disabled={exportingId === conv.id}
              aria-label="Download transcript as PDF"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
              title="Download PDF transcript"
            >
              {exportingId === conv.id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                : <Download className="h-3.5 w-3.5" strokeWidth={1.5} />}
            </button>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          </div>
        );
      })}
    </div>
  );
};
