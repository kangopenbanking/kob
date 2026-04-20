import { useLanguage } from "@/lib/i18n/LanguageContext";

interface BrandNameProps {
  className?: string;
}

export const BrandName = ({ className = "" }: BrandNameProps) => {
  const { t } = useLanguage();
  return (
    <div className={`flex flex-col items-start ${className}`}>
      <span className="font-bold">
        <span className="text-primary">{t('brand.open' as any)}</span> {t('brand.banking' as any)}
      </span>
      <span className="text-[0.5em] font-normal text-foreground tracking-wider -mt-1">
        {t('brand.tagline' as any)}
      </span>
    </div>
  );
};
