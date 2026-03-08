import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface UseAuthenticatedUserResult {
  user: User | null;
  loading: boolean;
  error: string | null;
}

/**
 * Shared hook to resolve the authenticated user once.
 * Avoids duplicate `supabase.auth.getUser()` calls across dashboard pages.
 */
export function useAuthenticatedUser(): UseAuthenticatedUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (cancelled) return;
        if (authError) {
          setError(authError.message);
          return;
        }
        setUser(user);
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? "Auth error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    resolve();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading, error };
}
