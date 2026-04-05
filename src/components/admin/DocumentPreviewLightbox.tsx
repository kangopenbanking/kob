import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, ZoomIn, ZoomOut, RotateCw, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";

interface DocumentPreviewLightboxProps {
  url: string | null;
  label?: string;
  onClose: () => void;
}

export function DocumentPreviewLightbox({ url, label, onClose }: DocumentPreviewLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const handleClose = useCallback(() => {
    onClose();
    setZoom(1);
    setRotation(0);
  }, [onClose]);

  const handleDownload = useCallback(async () => {
    if (!url || downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const ext = url.match(/\.(jpg|jpeg|png|webp|gif|pdf)/i)?.[1] || "file";
      a.download = `${(label || "document").replace(/[^a-zA-Z0-9_-]/g, "_")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in same tab if blob download fails
      window.location.href = url;
    } finally {
      setDownloading(false);
    }
  }, [url, label, downloading]);

  if (!url) return null;

  const isImage = url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i);
  const isPdf = url.match(/\.pdf(\?|$)/i);

  return (
    <Dialog open={!!url} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">{label || "Document Preview"}</DialogTitle>
            <div className="flex items-center gap-1">
              {isImage && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(z + 0.25, 3))}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRotation(r => r + 90)}>
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} disabled={downloading}>
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex items-center justify-center overflow-auto p-4 bg-black/5 min-h-[400px] max-h-[70vh]">
          {isImage ? (
            <img
              src={url}
              alt={label || "Document"}
              className="rounded-lg shadow-lg transition-transform duration-200"
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, maxWidth: "100%", maxHeight: "65vh" }}
              crossOrigin="anonymous"
            />
          ) : isPdf ? (
            <iframe
              src={url}
              className="w-full h-[65vh] rounded-lg border-0"
              title={label || "Document"}
              sandbox="allow-same-origin allow-scripts"
            />
          ) : (
            <div className="text-center space-y-3 py-12">
              <p className="text-muted-foreground">Preview not available for this file type.</p>
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
