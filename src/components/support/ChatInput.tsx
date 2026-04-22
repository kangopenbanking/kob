import React, { useState, useRef } from 'react';
import { Send, Paperclip, X, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ChatInputProps {
  onSend: (content: string, filePath?: string, fileType?: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Identity used for the storage folder + RLS check. Userless guests pass `guest_<guestId>`. */
  uploadIdentity?: string;
}

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE = 5 * 1024 * 1024;

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled,
  placeholder = 'Type a message…',
  uploadIdentity,
}) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFileError(null);
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      const msg = `Unsupported file type "${f.type || 'unknown'}". Allowed: images (JPG, PNG, WebP, GIF), PDF, DOC, DOCX.`;
      setFileError(msg);
      toast({ title: 'Unsupported file', description: msg, variant: 'destructive' });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (f.size > MAX_SIZE) {
      const msg = `File is ${(f.size / (1024 * 1024)).toFixed(1)} MB. Maximum allowed is 5 MB.`;
      setFileError(msg);
      toast({ title: 'File too large', description: msg, variant: 'destructive' });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setFile(f);
  };

  const handleSend = async () => {
    if (!text.trim() && !file) return;

    let filePath: string | undefined;
    let fileType: string | undefined;

    if (file) {
      setUploading(true);
      setProgress(5);

      // Resolve identity: prefer signed-in user, else the guest identity passed by the widget.
      const { data: { user } } = await supabase.auth.getUser();
      const identity = user?.id ?? uploadIdentity;
      if (!identity) {
        toast({ title: 'Unable to upload', description: 'No identity available for upload.', variant: 'destructive' });
        setUploading(false);
        setProgress(0);
        return;
      }

      const ext = file.name.split('.').pop();
      const path = `${identity}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      // Approximate upload progress (the supabase-js SDK doesn't expose XHR progress directly).
      const progTimer = setInterval(() => {
        setProgress((p) => (p < 85 ? p + 7 : p));
      }, 120);

      const { error } = await supabase.storage
        .from('support-attachments')
        .upload(path, file, { contentType: file.type, upsert: false });

      clearInterval(progTimer);
      if (error) {
        setProgress(0);
        toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
        setUploading(false);
        return;
      }

      setProgress(100);
      filePath = path;
      fileType = file.type;
      setUploading(false);
    }

    onSend(text.trim(), filePath, fileType);
    setText('');
    setFile(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border bg-background p-3">
      {file && (
        <div className="mb-2 flex flex-col gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            {file.type.startsWith('image/') ? (
              <img src={URL.createObjectURL(file)} alt="Preview" className="h-10 w-10 rounded object-cover shrink-0" />
            ) : (
              <FileText className="h-4 w-4 text-primary shrink-0" strokeWidth={1.5} />
            )}
            <span className="flex-1 truncate">{file.name}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
            {!uploading && (
              <button onClick={() => { setFile(null); setProgress(0); if (fileRef.current) fileRef.current.value = ''; }} aria-label="Remove attachment">
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" strokeWidth={1.5} />
              </button>
            )}
          </div>
          {uploading && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-background">
              <div
                className="h-full bg-primary transition-all duration-150"
                style={{ width: `${progress}%` }}
                aria-label={`Upload progress ${progress}%`}
              />
            </div>
          )}
        </div>
      )}
      {fileError && !file && (
        <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
          {fileError}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
          aria-label="Attach a file"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
        >
          <Paperclip className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>
        <input ref={fileRef} type="file" accept={ALLOWED_TYPES.join(',')} onChange={handleFile} className="hidden" />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || uploading}
          placeholder={placeholder}
          rows={1}
          aria-label="Message"
          className="flex-1 resize-none rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={disabled || uploading || (!text.trim() && !file)}
          aria-label="Send message"
          className="h-9 w-9 shrink-0 rounded-full"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Send className="h-4 w-4" strokeWidth={1.5} />}
        </Button>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Images & PDFs · 5 MB max</p>
    </div>
  );
};
