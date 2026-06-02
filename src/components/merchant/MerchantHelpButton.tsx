import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HelpCircle, BookOpen, MessageSquare, Phone, Mail, ChevronRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { findGuideForRoute } from "./merchant-guide-content";

const SUPPORT_PHONE_RAW = "237622022567";
const SUPPORT_PHONE_PRETTY = "+237 6 22 02 25 67";
const SUPPORT_EMAIL = "support@kangopenbanking.com";

export function MerchantHelpButton() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const guide = findGuideForRoute(location.pathname);

  if (!guide) return null;
  const Icon = guide.icon;

  return (
    <>
      <button
        type="button"
        aria-label="Quick guide & support"
        onClick={() => setOpen(true)}
        className="group fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-300 hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 animate-fade-in"
      >
        <HelpCircle className="h-6 w-6 transition-transform duration-300 group-hover:rotate-12" strokeWidth={2} />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-y-auto">
          <div className="bg-primary text-primary-foreground p-6 animate-fade-in">
            <SheetHeader className="space-y-3 text-left">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/15">
                  <Icon className="h-5 w-5" />
                </div>
                <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-primary-foreground/15">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider opacity-80 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> Quick guide
                </p>
                <SheetTitle className="text-primary-foreground text-xl font-bold mt-1">{guide.title}</SheetTitle>
                <SheetDescription className="text-primary-foreground/85 text-sm mt-1">
                  {guide.summary}
                </SheetDescription>
              </div>
            </SheetHeader>
          </div>

          <div className="p-6 space-y-6">
            <section>
              <h3 className="text-sm font-semibold mb-3">How it works</h3>
              <ol className="space-y-3">
                {guide.steps.map((step, i) => (
                  <li
                    key={i}
                    className="flex gap-3 animate-fade-in"
                    style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-foreground/85">{step}</span>
                  </li>
                ))}
              </ol>
            </section>

            {guide.tips && guide.tips.length > 0 && (
              <section className="rounded-lg border border-border bg-muted/40 p-4 animate-fade-in" style={{ animationDelay: "300ms", animationFillMode: "backwards" }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pro tips</h3>
                <ul className="space-y-1.5">
                  {guide.tips.map((t, i) => (
                    <li key={i} className="text-xs text-foreground/80 leading-relaxed">• {t}</li>
                  ))}
                </ul>
              </section>
            )}

            <Separator />

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Need more detail?</h3>
              <Button
                variant="outline"
                className="w-full justify-between h-11"
                onClick={() => { setOpen(false); navigate(`/merchant/guide/${guide.slug}`); }}
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Open full guide
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {guide.fullGuide && (
                <Button
                  variant="ghost"
                  className="w-full justify-between h-10 text-xs"
                  onClick={() => { setOpen(false); navigate(guide.fullGuide!); }}
                >
                  <span>Technical / developer docs</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </section>

            <Separator />

            <section className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                Live support
              </h3>
              <Button
                className="w-full justify-between h-11"
                onClick={() => { setOpen(false); navigate("/support-agent"); }}
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Chat with us now
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" asChild className="h-10">
                  <a href={`https://wa.me/${SUPPORT_PHONE_RAW}`} target="_blank" rel="noopener noreferrer">
                    <Phone className="h-3.5 w-3.5 mr-1.5" />
                    WhatsApp
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild className="h-10">
                  <a href={`mailto:${SUPPORT_EMAIL}`}>
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                    Email
                  </a>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center pt-1">
                {SUPPORT_PHONE_PRETTY} · {SUPPORT_EMAIL}
              </p>
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
