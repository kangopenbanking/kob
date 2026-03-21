import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X, Settings2, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const COOKIE_CONSENT_KEY = "kob_cookie_consent";
const COOKIE_PREFS_KEY = "kob_cookie_preferences";

interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  performance: boolean;
}

const defaultPrefs: CookiePreferences = {
  essential: true,
  functional: false,
  analytics: false,
  performance: false,
};

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<CookiePreferences>(defaultPrefs);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Delay show for smooth page load
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveConsent = (preferences: CookiePreferences) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "true");
    localStorage.setItem(COOKIE_PREFS_KEY, JSON.stringify(preferences));
    setVisible(false);
  };

  const acceptAll = () => saveConsent({ essential: true, functional: true, analytics: true, performance: true });
  const rejectAll = () => saveConsent({ essential: true, functional: false, analytics: false, performance: false });
  const saveCustom = () => saveConsent(prefs);

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 80, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 80, scale: 0.95 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="fixed bottom-4 left-4 z-[9999] w-[420px] max-w-[calc(100vw-2rem)]"
      >
        <div className="bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
          {/* Header */}
          <div className="p-5 pb-3">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Cookie className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">Cookie Preferences</h3>
                  <p className="text-[11px] text-muted-foreground">Manage your privacy</p>
                </div>
              </div>
              <button onClick={rejectAll} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted/60">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              We use cookies to enhance your experience, analyse traffic, and personalise content.
              You can choose which cookies you allow.{" "}
              <Link to="/cookies" className="text-primary hover:underline font-medium" onClick={() => setVisible(false)}>
                Read our Cookie Policy
              </Link>
            </p>

            {/* Essential badge */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-xl px-3 py-2 mb-1">
              <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>Essential cookies are always active for security & authentication.</span>
            </div>
          </div>

          {/* Preferences panel */}
          <AnimatePresence>
            {showPrefs && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-2 space-y-3">
                  {[
                    { key: "functional" as const, label: "Functional", desc: "Language, theme, layout preferences" },
                    { key: "analytics" as const, label: "Analytics", desc: "Usage patterns & feature improvements" },
                    { key: "performance" as const, label: "Performance", desc: "Load times & error monitoring" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                      </div>
                      <Switch
                        checked={prefs[item.key]}
                        onCheckedChange={(v) => setPrefs((p) => ({ ...p, [item.key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="p-4 pt-2 space-y-2">
            <button
              onClick={() => setShowPrefs(!showPrefs)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-1 mb-1"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {showPrefs ? "Hide" : "Customise"} preferences
              {showPrefs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={rejectAll} className="flex-1 rounded-xl h-10 text-xs font-semibold">
                Reject All
              </Button>
              {showPrefs ? (
                <Button onClick={saveCustom} className="flex-1 rounded-xl h-10 text-xs font-semibold">
                  Save Preferences
                </Button>
              ) : (
                <Button onClick={acceptAll} className="flex-1 rounded-xl h-10 text-xs font-semibold">
                  Accept All
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
