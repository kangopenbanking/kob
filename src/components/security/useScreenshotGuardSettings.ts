/**
 * useScreenshotGuardSettings — fetches the runtime opacity values for the
 * ScreenshotGuard watermark (admin-configurable, no redeploy required)
 * and exposes them as { lightOpacity, darkOpacity }.
 *
 * Falls back to the historical defaults (0.05 light, 0.03 dark) when the
 * settings row cannot be loaded — the watermark must always render.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ScreenshotGuardSettings {
  lightOpacity: number;
  darkOpacity: number;
}

const DEFAULTS: ScreenshotGuardSettings = { lightOpacity: 0.05, darkOpacity: 0.03 };

let cache: ScreenshotGuardSettings | null = null;
let inflight: Promise<ScreenshotGuardSettings> | null = null;

async function load(): Promise<ScreenshotGuardSettings> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data } = await supabase
        .from("screenshot_guard_settings")
        .select("light_opacity, dark_opacity")
        .eq("id", "global")
        .maybeSingle();
      const next: ScreenshotGuardSettings = data
        ? {
            lightOpacity: Number(data.light_opacity ?? DEFAULTS.lightOpacity),
            darkOpacity: Number(data.dark_opacity ?? DEFAULTS.darkOpacity),
          }
        : DEFAULTS;
      cache = next;
      return next;
    } catch {
      cache = DEFAULTS;
      return DEFAULTS;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useScreenshotGuardSettings(): ScreenshotGuardSettings {
  const [settings, setSettings] = useState<ScreenshotGuardSettings>(cache ?? DEFAULTS);
  useEffect(() => {
    let mounted = true;
    load().then((s) => { if (mounted) setSettings(s); });
    return () => { mounted = false; };
  }, []);
  return settings;
}

export function _resetScreenshotGuardSettingsCacheForTests() {
  cache = null;
  inflight = null;
}
