import React, { useState, useRef } from 'react';
import { Send, Paperclip, X, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ChatInputProps {
  onSend: (content: string, filePath?: string, fileType?: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE = 5 * 1024 * 1024;

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled, placeholder = 'Type a message…' }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast({ title: 'Unsupported file', description: 'Only images and PDF/DOC files are allowed.', variant: 'destructive' });
      return;
    }
    if (f.size > MAX_SIZE) {
      toast({ title: 'File too large', description: 'Maximum size is 5 MB per file.', variant: 'destructive' });
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Sign-in required', description: 'Please sign in to attach files.', variant: 'destructive' });
        setUploading(false);
        return;
      }
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('support-attachments').upload(path, file);
      if (error) {
        toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
        setUploading(false);
        return;
      }
      // Persist the storage PATH, not a signed URL — signed URLs expire and break history.
      filePath = path;
      fileType = file.type;
      setUploading(false);
    }

    onSend(text.trim(), filePath, fileType);
    setText('');
    setFile(null);
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
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs">
          {file.type.startsWith('image/') ? (
            <img src={URL.createObjectURL(file)} alt="Preview" className="h-10 w-10 rounded object-cover shrink-0" />
          ) : (
            <FileText className="h-4 w-4 text-primary shrink-0" strokeWidth={1.5} />
          )}
          <span className="flex-1 truncate">{file.name}</span>
          <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} aria-label="Remove attachment">
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" strokeWidth={1.5} />
          </button>
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
    </div>
  );
};
