import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { useState } from "react";

interface DocumentPreviewLightboxProps {
  url: string | null;
  label?: string;
  onClose: () => void;
}

export function DocumentPreviewLightbox({ url, label, onClose }: DocumentPreviewLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!url) return null;

  const isImage = url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i);
  const isPdf = url.match(/\.pdf(\?|$)/i);

  return (
    <Dialog open={!!url} onOpenChange={() => { onClose(); setZoom(1); setRotation(0); }}>
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
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(url, "_blank")}>
                <ExternalLink className="h-4 w-4" />
              </Button>
              <a href={url} download className="inline-flex">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Download className="h-4 w-4" />
                </Button>
              </a>
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
            />
          ) : isPdf ? (
            <iframe src={url} className="w-full h-[65vh] rounded-lg" title={label || "Document"} />
          ) : (
            <div className="text-center space-y-3 py-12">
              <p className="text-muted-foreground">Preview not available for this file type.</p>
              <Button variant="outline" onClick={() => window.open(url, "_blank")}>
                <ExternalLink className="h-4 w-4 mr-2" /> Open in new tab
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
