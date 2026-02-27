import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export async function enforceSingleSession(sessionId: string, deviceInfo?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  try {
    await supabase.functions.invoke('enforce-single-session', {
      body: {
        session_id: sessionId,
        device_info: deviceInfo || `${navigator.userAgent.slice(0, 100)}`,
      },
    });
  } catch (err) {
    console.error('Failed to enforce single session:', err);
  }
}

export function useSingleSession() {
  const navigate = useNavigate();
  const { institutionId } = useParams();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    // Check initial state
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        wasSignedIn.current = true;
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        wasSignedIn.current = true;
      }

      if (event === 'SIGNED_OUT' && wasSignedIn.current) {
        wasSignedIn.current = false;
        toast.info('You were signed out because another session was started', {
          duration: 5000,
        });
        // Redirect to the bank login page
        if (institutionId) {
          navigate(`/bank/${institutionId}`);
        } else {
          navigate('/auth');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, institutionId]);
}
