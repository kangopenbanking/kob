import { Shield, Lock, Key, FileCheck, Server, Eye } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function SecuritySection() {
  const { t } = useLanguage();
  const practices = [
    { icon: Shield,   title: t('developer.security.oauth.title' as any),   description: t('developer.security.oauth.desc' as any) },
    { icon: Lock,     title: t('developer.security.mtls.title' as any),    description: t('developer.security.mtls.desc' as any) },
    { icon: Key,      title: t('developer.security.tokens.title' as any),  description: t('developer.security.tokens.desc' as any) },
    { icon: FileCheck,title: t('developer.security.cobac.title' as any),   description: t('developer.security.cobac.desc' as any) },
    { icon: Server,   title: t('developer.security.pci.title' as any),     description: t('developer.security.pci.desc' as any) },
    { icon: Eye,      title: t('developer.security.audit.title' as any),   description: t('developer.security.audit.desc' as any) },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">{t('developer.security.heading' as any)}</h2>
        <p className="text-muted-foreground max-w-2xl">
          {t('developer.security.subheading' as any)}
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {practices.map((item) => (
          <div key={item.title} className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
            <item.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-sm">{item.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
