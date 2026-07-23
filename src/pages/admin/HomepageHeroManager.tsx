import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Image as ImageIcon, Video, Eye, EyeOff, Upload, ArrowUp, ArrowDown, LayoutDashboard} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { HeroImageCropDialog } from "@/components/admin/HeroImageCropDialog";
import {
  classifyHeroMedia,
  probeImageDimensions,
  probeVideoDimensions,
  aspectWithinTolerance,
  HERO_TARGET_ASPECT,
} from "@/lib/admin/hero-media-validation";
import { adminStorageUpload } from "@/lib/admin/adminStorageUpload";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface HeroSlide {
  id: string;
  title: string | null;
  subtitle: string | null;
  media_url: string;
  media_type: string;
  cta_text: string | null;
  cta_link: string | null;
  sort_order: number;
  is_active: boolean;
  overlay_opacity: number;
  font_color: string | null;
  font_size: string | null;
  font_alignment: string | null;
  subtitle_font_size: string | null;
  subtitle_font_color: string | null;
  created_at: string;
}

export default function HomepageHeroManager() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const fetchSlides = async () => {
    const { data, error } = await supabase
      .from("homepage_hero_slides")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      toast({ title: "Error loading slides", description: error.message, variant: "destructive" });
    } else {
      setSlides((data as any[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSlides(); }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `slide-${Date.now()}.${ext}`;
      const mediaType = file.type.startsWith("video/") ? "video" : "image";

      const { publicUrl } = await adminStorageUpload({
        bucket: "homepage-hero",
        path,
        file,
        contentType: file.type,
      });

      const { error: insertError } = await supabase.from("homepage_hero_slides").insert({
        media_url: publicUrl,
        media_type: mediaType,
        sort_order: slides.length,
        title: "",
        subtitle: "",
        overlay_opacity: 0.4,
      } as any);

      if (insertError) {
        toast({ title: "Error creating slide", description: insertError.message, variant: "destructive" });
      } else {
        toast({ title: "Slide added!" });
        fetchSlides();
      }
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // Crop dialog state
  const [cropTarget, setCropTarget] = useState<{ slideId: string; url: string; fileName: string } | null>(null);

  /**
   * Persist a replacement via the admin edge function so the change is
   * server-validated (type/size/aspect ratio) and written to audit_logs.
   */
  const persistReplacement = async (
    slideId: string,
    publicUrl: string,
    mediaType: "image" | "video",
    dims: { width: number; height: number } | null,
  ) => {
    const cacheBusted = `${publicUrl}?v=${Date.now()}`;
    const { data, error } = await supabase.functions.invoke("hero-media-update", {
      body: {
        slide_id: slideId,
        media_url: cacheBusted,
        media_type: mediaType,
        reported_width: dims?.width,
        reported_height: dims?.height,
      },
    });
    if (error || (data && (data as any).error)) {
      const msg = (data as any)?.error ?? error?.message ?? "Update failed";
      toast({ title: "Replacement rejected", description: msg, variant: "destructive" });
      return false;
    }
    setSlides((prev) =>
      prev.map((s) => (s.id === slideId ? { ...s, media_url: cacheBusted, media_type: mediaType } : s)),
    );
    toast({ title: "Media replaced", description: "Change recorded in the audit log." });
    return true;
  };

  const uploadAndPersist = async (
    slideId: string,
    blob: Blob,
    fileName: string,
    contentType: string,
    mediaType: "image" | "video",
    dims: { width: number; height: number } | null,
  ) => {
    setUploading(true);
    try {
      const ext = (fileName.split(".").pop() || (mediaType === "image" ? "jpg" : "mp4")).toLowerCase();
      const path = `slide-${slideId}-${Date.now()}.${ext}`;
      const { publicUrl } = await adminStorageUpload({
        bucket: "homepage-hero",
        path,
        file: blob,
        contentType,
        upsert: true,
      });
      await persistReplacement(slideId, publicUrl, mediaType, dims);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const replaceMedia = async (id: string, file: File) => {
    const v = classifyHeroMedia(file);
    if (!v.ok || !v.kind) {
      toast({ title: "Invalid file", description: v.error, variant: "destructive" });
      return;
    }

    if (v.kind === "video") {
      try {
        const dims = await probeVideoDimensions(file);
        if (!aspectWithinTolerance(dims.width, dims.height)) {
          toast({
            title: "Aspect ratio out of range",
            description: `Video must be ~16:9 (got ${dims.width}×${dims.height}).`,
            variant: "destructive",
          });
          return;
        }
        await uploadAndPersist(id, file, file.name, file.type, "video", dims);
      } catch (e) {
        toast({ title: "Could not read video", description: (e as Error).message, variant: "destructive" });
      }
      return;
    }

    // Images: open crop dialog targeting the hero's 16:9 layout.
    const url = URL.createObjectURL(file);
    setCropTarget({ slideId: id, url, fileName: file.name });
  };

  const handleCropConfirm = async (blob: Blob, fileName: string) => {
    if (!cropTarget) return;
    const dims = await probeImageDimensions(blob).catch(() => null);
    if (dims && !aspectWithinTolerance(dims.width, dims.height)) {
      toast({
        title: "Crop aspect mismatch",
        description: `Cropped image is ${dims.width}×${dims.height} (target 16:9).`,
        variant: "destructive",
      });
      return;
    }
    const contentType = /\.png$/i.test(fileName) ? "image/png" : "image/jpeg";
    const target = cropTarget;
    URL.revokeObjectURL(target.url);
    setCropTarget(null);
    await uploadAndPersist(target.slideId, blob, fileName, contentType, "image", dims);
  };

  const updateSlide = async (id: string, updates: Partial<HeroSlide>) => {
    const { error } = await supabase.from("homepage_hero_slides").update(updates as any).eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      setSlides(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    }
  };

  const deleteSlide = async (id: string) => {
    const { error } = await supabase.from("homepage_hero_slides").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Slide removed" });
      fetchSlides();
    }
  };

  const moveSlide = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slides.length) return;
    await applyNewOrder(arrayMove(slides, index, newIndex));
  };

  const applyNewOrder = async (next: HeroSlide[]) => {
    setSlides(next.map((s, i) => ({ ...s, sort_order: i })));
    await Promise.all(
      next.map((s, i) =>
        supabase.from("homepage_hero_slides").update({ sort_order: i } as any).eq("id", s.id),
      ),
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = slides.findIndex((s) => s.id === active.id);
    const to = slides.findIndex((s) => s.id === over.id);
    if (from === -1 || to === -1) return;
    await applyNewOrder(arrayMove(slides, from, to));
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading slides...</div>;

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={LayoutDashboard} title="Homepage Hero Manager" description="Manage hero slides and homepage content" />

      <div className="flex items-center justify-between">
        <label>
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          <Button asChild disabled={uploading}>
            <span>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Add Slide"}
            </span>
          </Button>
        </label>
      </div>

      {slides.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No hero slides yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload images or videos to create a hero slideshow on the homepage
            </p>
          </CardContent>
        </Card>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
      {slides.map((slide, index) => (
        <SortableCardShell key={slide.id} id={slide.id} className={!slide.is_active ? "opacity-60" : ""}>
          {(dragHandleProps) => (
          <CardContent className="p-6">
            <div className="grid lg:grid-cols-[200px_1fr] gap-6">
              {/* Preview */}
              <div className="space-y-2">
                <div className="relative rounded-lg overflow-hidden aspect-video bg-muted group">
                  {slide.media_type === "video" ? (
                    <video src={slide.media_url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={slide.media_url} alt="" className="w-full h-full object-cover" />
                  )}
                  <Badge className="absolute top-2 left-2" variant="secondary">
                    {slide.media_type === "video" ? <Video className="h-3 w-3 mr-1" /> : <ImageIcon className="h-3 w-3 mr-1" />}
                    {slide.media_type}
                  </Badge>
                </div>
                <label className="block">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && replaceMedia(slide.id, e.target.files[0])}
                  />
                  <Button asChild variant="outline" size="sm" className="w-full" disabled={uploading}>
                    <span className="cursor-pointer">
                      <Upload className="h-3.5 w-3.5 mr-2" />
                      {uploading ? "Uploading..." : "Replace media"}
                    </span>
                  </Button>
                </label>
              </div>

              {/* Fields */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Drag to reorder"
                      className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent active:cursor-grabbing"
                      {...dragHandleProps}
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <Badge variant="outline">#{index + 1}</Badge>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveSlide(index, "up")} disabled={index === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveSlide(index, "down")} disabled={index === slides.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {slide.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      <Switch
                        checked={slide.is_active}
                        onCheckedChange={(checked) => updateSlide(slide.id, { is_active: checked })}
                      />
                    </div>
                    <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => deleteSlide(slide.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={slide.title || ""}
                      onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
                      placeholder="Slide headline"
                    />
                  </div>
                  <div>
                    <Label>Subtitle</Label>
                    <Input
                      value={slide.subtitle || ""}
                      onChange={(e) => updateSlide(slide.id, { subtitle: e.target.value })}
                      placeholder="Supporting text"
                    />
                  </div>
                  <div>
                    <Label>CTA Text</Label>
                    <Input
                      value={slide.cta_text || ""}
                      onChange={(e) => updateSlide(slide.id, { cta_text: e.target.value })}
                      placeholder="e.g. Get Started"
                    />
                  </div>
                  <div>
                    <Label>CTA Link</Label>
                    <Input
                      value={slide.cta_link || ""}
                      onChange={(e) => updateSlide(slide.id, { cta_link: e.target.value })}
                      placeholder="e.g. /contact"
                    />
                  </div>
                </div>

                <div>
                  <Label>Overlay Opacity: {Math.round((slide.overlay_opacity ?? 0.4) * 100)}%</Label>
                  <Slider
                    value={[(slide.overlay_opacity ?? 0.4) * 100]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={(v) => setSlides(prev => prev.map(s => s.id === slide.id ? { ...s, overlay_opacity: v[0] / 100 } : s))}
                    onValueCommit={(v) => updateSlide(slide.id, { overlay_opacity: v[0] / 100 })}
                    className="mt-2"
                  />
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <Label>Font Color</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={slide.font_color || '#ffffff'}
                        onChange={(e) => updateSlide(slide.id, { font_color: e.target.value })}
                        className="h-9 w-12 rounded border border-input cursor-pointer"
                      />
                      <Input
                        value={slide.font_color || '#ffffff'}
                        onChange={(e) => updateSlide(slide.id, { font_color: e.target.value })}
                        placeholder="#ffffff"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Title Size</Label>
                    <Select
                      value={slide.font_size || 'default'}
                      onValueChange={(v) => updateSlide(slide.id, { font_size: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                        <SelectItem value="xlarge">Extra Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description Size</Label>
                    <Select
                      value={slide.subtitle_font_size || 'default'}
                      onValueChange={(v) => updateSlide(slide.id, { subtitle_font_size: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                        <SelectItem value="xlarge">Extra Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description Color</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={slide.subtitle_font_color || slide.font_color || '#ffffff'}
                        onChange={(e) => updateSlide(slide.id, { subtitle_font_color: e.target.value })}
                        className="h-9 w-12 rounded border border-input cursor-pointer"
                      />
                      <Input
                        value={slide.subtitle_font_color || ''}
                        onChange={(e) => updateSlide(slide.id, { subtitle_font_color: e.target.value || null })}
                        placeholder="Inherit from title"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Alignment</Label>
                    <Select
                      value={slide.font_alignment || 'left'}
                      onValueChange={(v) => updateSlide(slide.id, { font_alignment: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          )}
        </SortableCardShell>
      ))}
        </SortableContext>
      </DndContext>

      <HeroImageCropDialog
        open={!!cropTarget}
        imageUrl={cropTarget?.url ?? null}
        fileName={cropTarget?.fileName ?? "image.jpg"}
        onClose={() => {
          if (cropTarget?.url) URL.revokeObjectURL(cropTarget.url);
          setCropTarget(null);
        }}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}

/**
 * SortableCardShell — wraps a sortable Card and exposes drag handle
 * props to its children via a render prop so the handle can live in
 * the card header.
 */
function SortableCardShell({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: (handleProps: Record<string, unknown>) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <Card className={className}>{children({ ...attributes, ...listeners })}</Card>
    </div>
  );
}
