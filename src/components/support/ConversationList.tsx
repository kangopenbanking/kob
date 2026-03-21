import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConversationSummary {
  id: string;
  subject?: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  department_name?: string;
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
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={cn(
            'flex items-center gap-3 rounded-xl p-3 text-left transition-colors',
            activeId === conv.id ? 'bg-accent' : 'hover:bg-muted/50'
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-foreground">{conv.subject || 'Support Chat'}</p>
              <span className={cn('h-2 w-2 shrink-0 rounded-full', statusColors[conv.status] || 'bg-muted-foreground')} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {conv.department_name && <span>{conv.department_name}</span>}
              <span>·</span>
              <span>{formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
};
