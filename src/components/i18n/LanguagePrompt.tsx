import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const STORAGE_KEY = 'language-prompt-shown';

/**
 * One-time language selection prompt shown on first app access.
 * After the user picks (or dismisses), it never auto-opens again.
 */
export function LanguagePrompt() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const t = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(t);
      }
    } catch { /* localStorage unavailable */ }
  }, []);

  const choose = (lang: 'en' | 'fr') => {
    void setLanguage(lang);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setOpen(false);
  };

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent
        className="max-w-sm rounded-2xl"
        onPointerDownOutside={(e) => { e.preventDefault(); dismiss(); }}
        onEscapeKeyDown={() => dismiss()}
        onInteractOutside={(e) => { e.preventDefault(); dismiss(); }}
      >
        <DialogHeader>
          <DialogTitle>Choose your language</DialogTitle>
          <DialogDescription>
            Select your preferred language. You can change this later in Settings.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <Button
            variant={language === 'en' ? 'default' : 'outline'}
            className="h-12 rounded-xl"
            onClick={() => choose('en')}
          >
            English
          </Button>
          <Button
            variant={language === 'fr' ? 'default' : 'outline'}
            className="h-12 rounded-xl"
            onClick={() => choose('fr')}
          >
            Français
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={dismiss} className="w-full">
            Skip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
