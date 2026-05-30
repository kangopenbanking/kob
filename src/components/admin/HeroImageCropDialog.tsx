/**
 * HeroImageCropDialog — crop/zoom an image to the hero's 16:9 layout
 * before uploading. Wraps react-easy-crop and outputs a Blob.
 */
import { useCallback, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  imageUrl: string | null;
  fileName: string;
  /** Output aspect ratio. Defaults to 16:9 to match the hero layout. */
  aspect?: number;
  onClose: () => void;
  onConfirm: (cropped: Blob, fileName: string) => void;
}

async function getCroppedBlob(imageSrc: string, crop: Area, fileName: string): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  // Clamp output to a sensible max width to keep payloads small.
  const MAX_W = 1920;
  const scale = Math.min(1, MAX_W / crop.width);
  const outW = Math.round(crop.width * scale);
  const outH = Math.round(crop.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, outW, outH);

  const isPng = /\.png$/i.test(fileName);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Encode failed"))),
      isPng ? "image/png" : "image/jpeg",
      0.9,
    ),
  );
}

export function HeroImageCropDialog({ open, imageUrl, fileName, aspect = 16 / 9, onClose, onConfirm }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => setPixels(areaPixels), []);

  const handleConfirm = async () => {
    if (!imageUrl || !pixels) return;
    try {
      setBusy(true);
      const blob = await getCroppedBlob(imageUrl, pixels, fileName);
      onConfirm(blob, fileName);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crop image to hero layout</DialogTitle>
        </DialogHeader>
        <div className="relative h-[360px] w-full overflow-hidden rounded-md bg-muted">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              restrictPosition
            />
          )}
        </div>
        <div className="mt-2">
          <Label className="text-xs">Zoom</Label>
          <Slider value={[zoom]} min={1} max={4} step={0.05} onValueChange={(v) => setZoom(v[0])} className="mt-2" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={busy || !pixels}>
            {busy ? "Processing…" : "Apply crop & upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
