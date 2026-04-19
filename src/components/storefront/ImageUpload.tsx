import { useState, useRef } from 'react';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface ImageUploadProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  bucket?: string;
  folder?: string;
  accept?: string;
  previewClass?: string;
  placeholder?: string;
}

export function ImageUpload({
  label,
  value,
  onChange,
  bucket = 'storefront-assets',
  folder,
  accept = 'image/*',
  previewClass = 'w-16 h-16 rounded-xl object-cover',
  placeholder = 'Upload or paste URL',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB');
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${folder || 'general'}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(publicUrl);
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const clear = () => {
    onChange('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 rounded-lg border-border/60 flex-1 text-xs"
        />
        <label className="cursor-pointer">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-lg flex-shrink-0"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
        </label>
        {value && (
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0 text-muted-foreground hover:text-destructive" onClick={clear}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      {value && (
        <div className="rounded-xl border border-border/40 p-3 bg-muted/20 block">
          <img src={value} alt={label} className={previewClass} onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
      )}
    </div>
  );
}
