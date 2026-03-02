import React, { useState, useEffect } from 'react';
import { FileText, Shield, Phone, Scale, ChevronRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

interface LegalPage {
  slug: string;
  title: string;
  category: string;
}

const iconMap: Record<string, React.ElementType> = {
  'terms-of-service': Scale,
  'privacy-policy': Shield,
  'kyc-policy': FileText,
  'kyb-policy': FileText,
  'security-policy': Shield,
  'contact-us': Phone,
  'acceptable-use': Scale,
  'data-retention': FileText,
  'sla': FileText,
  'aml-policy': Shield,
  'dispute-policy': Scale,
  'data-protection-framework': Shield,
};

interface AppLegalPagesListProps {
  onSelect: (slug: string) => void;
}

const AppLegalPagesList: React.FC<AppLegalPagesListProps> = ({ onSelect }) => {
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase.from('app_legal_pages') as any)
        .select('slug, title, category')
        .eq('is_active', true)
        .order('sort_order');
      if (data) setPages(data);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {pages.map((page, i) => {
        const Icon = iconMap[page.slug] || FileText;
        return (
          <motion.button
            key={page.slug}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(page.slug)}
            className="flex items-center justify-between rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-foreground">{page.title}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          </motion.button>
        );
      })}
    </div>
  );
};

export default AppLegalPagesList;
