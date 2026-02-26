import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileText, Image as ImageIcon, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentUploaderProps {
  label: string;
  documentType: string;
  userId: string;
  folder: "kyc" | "kyb";
  required?: boolean;
  accept?: string;
  description?: string;
  onUploadComplete: (storagePath: string) => void;
  onRemove?: () => void;
  existingPath?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

type UploadStatus = "idle" | "uploading" | "success" | "error";

export function DocumentUploader({
  label,
  documentType,
  userId,
  folder,
  required = false,
  accept = "image/jpeg,image/png,image/webp,application/pdf",
  description,
  onUploadComplete,
  onRemove,
  existingPath,
}: DocumentUploaderProps) {
  const [status, setStatus] = useState<UploadStatus>(existingPath ? "success" : "idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Invalid file type. Accepted: JPEG, PNG, WebP, PDF");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File too large. Maximum 10MB.");
      return;
    }

    setStatus("uploading");
    setFileName(file.name);
    setProgress(10);

    // Generate preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }

    const ext = file.name.split(".").pop() || "bin";
    const storagePath = `${userId}/${folder}/${documentType}_${Date.now()}.${ext}`;

    setProgress(30);

    const { error: uploadError } = await supabase.storage
      .from("kyc-documents")
      .upload(storagePath, file, { upsert: true });

    if (uploadError) {
      setStatus("error");
      setError(uploadError.message);
      setProgress(0);
      return;
    }

    setProgress(100);
    setStatus("success");
    onUploadComplete(storagePath);
  }, [userId, folder, documentType, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleRemove = () => {
    setStatus("idle");
    setFileName(null);
    setPreviewUrl(null);
    setProgress(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onRemove?.();
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}

      {status === "success" ? (
        <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="h-12 w-12 rounded object-cover border" />
          ) : (
            <FileText className="h-8 w-8 text-muted-foreground" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fileName || "Document uploaded"}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-600" /> Uploaded successfully
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={handleRemove}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
            status === "error" && "border-destructive/50"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          {status === "uploading" ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Uploading {fileName}...</p>
              <Progress value={progress} className="h-2" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Drop file here or click to browse</p>
              <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, or PDF — max 10MB</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}
