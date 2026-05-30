/**
 * useScreenshotIdentity — resolves a stable, low-PII identity string for the
 * forensic watermark: "<Holder Name> · <last-4 of user id>".
 *
 * Resolution order:
 *   1. profiles.full_name for the current auth user
 *   2. auth.user.user_metadata.full_name / name
 *   3. masked phone number (e.g. "+237 6•• ••• 412")
 *   4. "Account holder" (fallback)
 *
 * The id segment is the last 4 characters of the auth user id — never the
 * full UUID, never the email or phone in the clear.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Identity {
  name: string;
  shortId: string;
  ready: boolean;
}

const FALLBACK: Identity = { name: "Account holder", shortId: "----", ready: false };

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return phone;
  const last3 = digits.slice(-3);
  const cc = phone.startsWith("+") ? phone.slice(0, 4) : "";
  return `${cc} •• ••• ${last3}`.trim();
}

export function useScreenshotIdentity(): Identity {
  const [identity, setIdentity] = useState<Identity>(FALLBACK);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const u = data.user;
        if (!u) return;
        const shortId = u.id.slice(-4).toUpperCase();
        let name: string | null = null;

        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, phone_number")
            .eq("id", u.id)
            .maybeSingle();
          if (profile) {
            const p = profile as { full_name?: string | null; phone_number?: string | null };
            name = (p.full_name && p.full_name.trim()) || null;
            if (!name && p.phone_number) name = maskPhone(p.phone_number);
          }
        } catch {
          /* profile read failed — fall back to auth metadata */
        }

        if (!name) {
          const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
          const m =
            (typeof meta.full_name === "string" && meta.full_name) ||
            (typeof meta.name === "string" && meta.name) ||
            null;
          if (m) name = m;
        }
        if (!name && u.phone) name = maskPhone(u.phone);
        if (!name) name = "Account holder";

        if (alive) setIdentity({ name, shortId, ready: true });
      } catch {
        if (alive) setIdentity(FALLBACK);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return identity;
}
