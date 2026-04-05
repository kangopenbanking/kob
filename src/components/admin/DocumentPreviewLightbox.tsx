import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ZoomOut, RotateCw, Loader2 } from "lucide-react";
import { useState, useCallback, useEffect, useMemo } from "react";

interface DocumentPreviewLightboxProps {
  url: string | null;
  label?: string;
  onClose: () => void;
}

const inferMimeTypeFromUrl = (sourceUrl: string): string | null => {
  if (/\.(jpg|jpeg)(\?|$)/i.test(sourceUrl)) return "image/jpeg";
  if (/\.png(\?|$)/i.test(sourceUrl)) return "image/png";
  if (/\.webp(\?|$)/i.test(sourceUrl)) return "image/webp";
  if (/\.gif(\?|$)/i.test(sourceUrl)) return "image/gif";
  if (/\.pdf(\?|$)/i.test(sourceUrl)) return "application/pdf";
  return null;
};

const getDownloadExtension = (mimeType: string | null, sourceUrl: string): string => {
  const urlMatch = sourceUrl.match(/\.([a-z0-9]+)(?:\?|$)/i);
  if (urlMatch?.[1]) return urlMatch[1].toLowerCase();

  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "application/pdf":
      return "pdf";
    default:
      return "file";
  }
};

export function DocumentPreviewLightbox({ url, label, onClose }: DocumentPreviewLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [resolvedMimeType, setResolvedMimeType] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    onClose();
    setZoom(1);
    setRotation(0);
    setLoadError(null);
  }, [onClose]);

  useEffect(() => {
    if (!url) {
      setPreviewObjectUrl(null);
      setResolvedMimeType(null);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    let objectUrl: string | null = null;

    const loadPreview = async () => {
      setIsLoading(true);
      setLoadError(null);
      setPreviewObjectUrl(null);
      setResolvedMimeType(null);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch preview: ${response.status}`);
        }

        const sourceBlob = await response.blob();
        const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || sourceBlob.type || inferMimeTypeFromUrl(url) || "";
        const previewBlob = contentType && sourceBlob.type !== contentType
          ? new Blob([sourceBlob], { type: contentType })
          : sourceBlob;

        objectUrl = URL.createObjectURL(previewBlob);

        if (!isActive) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setPreviewObjectUrl(objectUrl);
        setResolvedMimeType(contentType || null);
      } catch (error) {
        if (!isActive) return;
        console.warn("Failed to load document preview", error);
        setLoadError("Preview unavailable in-browser for this file. You can still download it.");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  const isImage = useMemo(() => {
    if (resolvedMimeType?.startsWith("image/")) return true;
    return !!url?.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i);
  }, [resolvedMimeType, url]);

  const isPdf = useMemo(() => {
    if (resolvedMimeType === "application/pdf") return true;
    return !!url?.match(/\.pdf(\?|$)/i);
  }, [resolvedMimeType, url]);

  const handleDownload = useCallback(async () => {
    if (!url || downloading) return;

    setDownloading(true);
    let temporaryObjectUrl: string | null = null;

    try {
      const href = previewObjectUrl ?? await (async () => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.status}`);
        }
        const blob = await response.blob();
        temporaryObjectUrl = URL.createObjectURL(blob);
        return temporaryObjectUrl;
      })();

      const link = document.createElement("a");
      link.href = href;
      link.download = `${(label || "document").replace(/[^a-zA-Z0-9_-]/g, "_")}.${getDownloadExtension(resolvedMimeType, url)}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      window.location.assign(url);
    } finally {
      if (temporaryObjectUrl) {
        URL.revokeObjectURL(temporaryObjectUrl);
      }
      setDownloading(false);
    }
  }, [url, label, downloading, previewObjectUrl, resolvedMimeType]);

  if (!url) return null;

  return (
    <Dialog open={!!url} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">{label || "Document Preview"}</DialogTitle>
            <div className="flex items-center gap-1">
              {isImage && previewObjectUrl && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRotation((r) => r + 90)}>
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} disabled={downloading || isLoading}>
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center justify-center overflow-auto p-4 bg-muted/40 min-h-[400px] max-h-[70vh]">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading document preview…</p>
            </div>
          ) : previewObjectUrl && isImage ? (
            <img
              src={previewObjectUrl}
              alt={label || "Document"}
              className="rounded-lg shadow-lg transition-transform duration-200"
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, maxWidth: "100%", maxHeight: "65vh" }}
            />
          ) : previewObjectUrl && isPdf ? (
            <object
              data={previewObjectUrl}
              type={resolvedMimeType || "application/pdf"}
              className="w-full h-[65vh] rounded-lg"
              aria-label={label || "Document"}
            >
              <div className="text-center space-y-3 py-12">
                <p className="text-muted-foreground">Your browser could not render this PDF inline.</p>
                <Button variant="outline" onClick={handleDownload} disabled={downloading}>
                  {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Download PDF
                </Button>
              </div>
            </object>
          ) : (
            <div className="text-center space-y-3 py-12">
              <p className="text-muted-foreground">{loadError || "Preview not available for this file type."}</p>
              <Button variant="outline" onClick={handleDownload} disabled={downloading}>
                {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Download File
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
