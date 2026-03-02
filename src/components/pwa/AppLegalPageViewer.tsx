import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

interface AppLegalPageViewerProps {
  slug: string;
  backPath?: string;
  onBack?: () => void;
}

const AppLegalPageViewer: React.FC<AppLegalPageViewerProps> = ({ slug, backPath, onBack }) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase.from('app_legal_pages') as any)
        .select('title, content')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();
      if (data) {
        setTitle(data.title);
        setContent(data.content);
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col p-5 pb-28"
    >
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => backPath ? navigate(backPath) : navigate(-1)}>
          <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={1.5} />
        </button>
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
        <ReactMarkdown
          components={{
            h2: ({ children }) => <h2 className="text-base font-bold text-foreground mt-5 mb-2">{children}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-bold text-foreground mt-4 mb-1.5">{children}</h3>,
            p: ({ children }) => <p className="text-sm text-muted-foreground leading-relaxed mb-3">{children}</p>,
            ul: ({ children }) => <ul className="text-sm text-muted-foreground space-y-1 mb-3 pl-4 list-disc">{children}</ul>,
            ol: ({ children }) => <ol className="text-sm text-muted-foreground space-y-1 mb-3 pl-4 list-decimal">{children}</ol>,
            li: ({ children }) => <li className="text-sm text-muted-foreground">{children}</li>,
            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
            table: ({ children }) => (
              <div className="overflow-x-auto rounded-xl border border-border mb-3">
                <table className="w-full text-xs">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
            th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-foreground">{children}</th>,
            td: ({ children }) => <td className="px-3 py-2 border-t border-border text-muted-foreground">{children}</td>,
            code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </motion.div>
  );
};

export default AppLegalPageViewer;
