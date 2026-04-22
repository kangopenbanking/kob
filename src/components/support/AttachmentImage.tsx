/**
 * AttachmentImage / AttachmentLink
 * Resolves a private support-attachments storage path into a signed URL on demand,
 * so chat history never breaks even if previously cached signed URLs expire.
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIGN_TTL_SECONDS = 60 * 60; // 1h — re-signed each render session

function isStoragePath(value: string): boolean {
  // Storage paths look like "<uuid>/<timestamp>-<rand>.<ext>" — never start with "http".
  return !!value && !/^https?:\/\//i.test(value);
}

async function resolveSignedUrl(value: string): Promise<string | null> {
  if (!isStoragePath(value)) return value;
  const { data, error } = await supabase.storage
    .from('support-attachments')
    .createSignedUrl(value, SIGN_TTL_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}

interface Props {
  value: string;            // storage path OR legacy full URL
  fileType?: string;
  isOwn?: boolean;
}

export const SupportAttachment: React.FC<Props> = ({ value, fileType, isOwn }) => {
  const [resolved, setResolved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    resolveSignedUrl(value).then((url) => {
      if (cancelled) return;
      setResolved(url);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [value]);

  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs opacity-70">
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} /> Loading attachment…
      </div>
    );
  }

  if (!resolved) {
    return <p className="mt-2 text-xs opacity-70">Attachment unavailable</p>;
  }

  if (fileType?.startsWith('image/')) {
    return <img src={resolved} alt="Attachment" className="mt-2 max-h-48 rounded-lg object-cover" />;
  }

  return (
    <a
      href={resolved}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'mt-2 flex items-center gap-2 rounded-lg p-2 text-xs',
        isOwn ? 'bg-primary-foreground/10' : 'bg-background'
      )}
    >
      <FileText className="h-4 w-4" strokeWidth={1.5} />
      <span>Download file</span>
      <Download className="h-3 w-3" strokeWidth={1.5} />
    </a>
  );
};
