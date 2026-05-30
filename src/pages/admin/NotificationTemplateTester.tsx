import React, { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import {
  NOTIFICATION_TEMPLATES,
  defaultValues,
  renderTemplate,
  type NotificationTemplate,
} from "@/lib/notification-templates-manifest";

const LucideIcon: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
  const toPascal = (s: string) =>
    s.replace(/(^\w|-\w)/g, (m) => m.replace("-", "").toUpperCase());
  const Comp = (Icons as any)[toPascal(name)] ?? Icons.Bell;
  return <Comp className={className} strokeWidth={1.5} />;
};

const PhoneFrame: React.FC<{
  template: NotificationTemplate;
  values: Record<string, string>;
  lang: "en" | "fr";
}> = ({ template, values, lang }) => {
  const titleSrc = lang === "fr" ? template.title_fr : template.title_en;
  const msgSrc = lang === "fr" ? template.message_fr : template.message_en;
  const { rendered: title, missing: tMissing } = renderTemplate(titleSrc, values);
  const { rendered: body, missing: bMissing } = renderTemplate(msgSrc, values);
  const missing = Array.from(new Set([...tMissing, ...bMissing]));

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <LucideIcon name={template.icon} className="h-5 w-5 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold">{title}</p>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">now</span>
            </div>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">{body}</p>
            {template.actions && template.actions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {template.actions.map((a, i) => (
                  <Button key={i} size="sm" variant={i === 0 ? "default" : "outline"}>
                    {lang === "fr" ? a.label_fr : a.label_en}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {missing.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          Unresolved variables: <span className="font-mono">{missing.join(", ")}</span>
        </div>
      )}
    </div>
  );
};

const NotificationTemplateTester: React.FC = () => {
  const [selectedId, setSelectedId] = useState(NOTIFICATION_TEMPLATES[0].id);
  const template = useMemo(
    () => NOTIFICATION_TEMPLATES.find((t) => t.id === selectedId)!,
    [selectedId],
  );
  const [values, setValues] = useState<Record<string, string>>(() => defaultValues(template));
  const [sending, setSending] = useState(false);

  React.useEffect(() => {
    setValues(defaultValues(template));
  }, [template]);

  const grouped = useMemo(() => {
    const map: Record<string, NotificationTemplate[]> = {};
    for (const t of NOTIFICATION_TEMPLATES) {
      (map[t.category] ||= []).push(t);
    }
    return map;
  }, []);

  async function sendLive() {
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in first");
      const { rendered: title_en } = renderTemplate(template.title_en, values);
      const { rendered: message_en } = renderTemplate(template.message_en, values);
      const { rendered: title_fr } = renderTemplate(template.title_fr, values);
      const { rendered: message_fr } = renderTemplate(template.message_fr, values);
      const { error } = await supabase.functions.invoke("push-notification", {
        body: {
          user_id: user.id,
          title: title_en,
          message: message_en,
          title_fr,
          message_fr,
          type: template.type,
          icon: template.icon,
          metadata: { template_id: template.id, test: true },
        },
      });
      if (error) throw error;
      toast.success(`Sent "${template.name}" to your account`);
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally {
      setSending(false);
    }
  }

  function clearOne(key: string) {
    setValues((v) => ({ ...v, [key]: "" }));
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notification Template Tester</h1>
        <p className="text-sm text-muted-foreground">
          Preview every in-app / push template in English and French, test variable
          substitution, and send a live copy to your account.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Templates</CardTitle>
            <CardDescription>{NOTIFICATION_TEMPLATES.length} total</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[560px]">
              <div className="space-y-4 p-3">
                {Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat}>
                    <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {cat}
                    </p>
                    <div className="space-y-1">
                      {items.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedId(t.id)}
                          className={`flex w-full items-start gap-2 rounded-md p-2 text-left text-sm transition-colors hover:bg-muted ${
                            t.id === selectedId ? "bg-muted" : ""
                          }`}
                        >
                          <LucideIcon name={t.icon} className="mt-0.5 h-4 w-4 text-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{t.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <LucideIcon name={template.icon} className="h-5 w-5" />
                    {template.name}
                  </CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{template.category}</Badge>
                  <Badge variant="outline">{template.type}</Badge>
                  {template.triggered_by && (
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {template.triggered_by}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="en">
                <TabsList>
                  <TabsTrigger value="en">English</TabsTrigger>
                  <TabsTrigger value="fr">Français</TabsTrigger>
                  <TabsTrigger value="side">Side by side</TabsTrigger>
                </TabsList>
                <TabsContent value="en" className="mt-4">
                  <PhoneFrame template={template} values={values} lang="en" />
                </TabsContent>
                <TabsContent value="fr" className="mt-4">
                  <PhoneFrame template={template} values={values} lang="fr" />
                </TabsContent>
                <TabsContent value="side" className="mt-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">EN</p>
                      <PhoneFrame template={template} values={values} lang="en" />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">FR</p>
                      <PhoneFrame template={template} values={values} lang="fr" />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Variables</CardTitle>
              <CardDescription>
                Edit values to test substitution. Clear one to verify how the template handles empty data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {template.variables.length === 0 ? (
                <p className="text-sm text-muted-foreground">This template has no variables.</p>
              ) : (
                template.variables.map((v) => (
                  <div key={v.key} className="grid grid-cols-1 gap-2 md:grid-cols-[180px_1fr_auto] md:items-center">
                    <Label className="font-mono text-xs">{`{{${v.key}}}`}</Label>
                    <Input
                      value={values[v.key] ?? ""}
                      onChange={(e) => setValues((s) => ({ ...s, [v.key]: e.target.value }))}
                      placeholder={v.sample}
                    />
                    <Button variant="ghost" size="sm" onClick={() => clearOne(v.key)}>
                      Clear
                    </Button>
                  </div>
                ))
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setValues(defaultValues(template))}>
                  Reset to samples
                </Button>
                <Button variant="outline" size="sm" onClick={() => setValues({})}>
                  Clear all
                </Button>
                <Button onClick={sendLive} disabled={sending}>
                  {sending ? "Sending…" : "Send live to my account"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default NotificationTemplateTester;
