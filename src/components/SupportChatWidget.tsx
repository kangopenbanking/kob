import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LiveSupport } from './support/LiveSupport';
import { useLocation } from 'react-router-dom';

const HIDDEN_PREFIXES = ['/admin', '/staff-login', '/auth', '/setup-pin', '/reset-password'];

export const SupportChatWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          aria-label="Open Live Support"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
        >
          <MessageCircle className="h-6 w-6" strokeWidth={1.5} />
        </Button>
      )}
      {open && (
        <div className="fixed bottom-6 right-6 z-50">
          <LiveSupport variant="panel" source={`widget:${pathname}`} onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
};

export default SupportChatWidget;
