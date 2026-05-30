/**
 * Shared client/server validation rules for homepage hero media replacements.
 * Mirror these constants in supabase/functions/hero-media-update/index.ts.
 */
export const HERO_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const HERO_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const HERO_MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const HERO_MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
export const HERO_TARGET_ASPECT = 16 / 9;
export const HERO_ASPECT_TOLERANCE = 0.05; // ±5%

export type HeroMediaKind = "image" | "video";

export interface ValidationResult {
  ok: boolean;
  error?: string;
  kind?: HeroMediaKind;
}

export function classifyHeroMedia(file: File): ValidationResult {
  if ((HERO_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    if (file.size > HERO_MAX_IMAGE_BYTES) {
      return { ok: false, error: `Image exceeds ${HERO_MAX_IMAGE_BYTES / 1024 / 1024} MB limit.` };
    }
    return { ok: true, kind: "image" };
  }
  if ((HERO_VIDEO_TYPES as readonly string[]).includes(file.type)) {
    if (file.size > HERO_MAX_VIDEO_BYTES) {
      return { ok: false, error: `Video exceeds ${HERO_MAX_VIDEO_BYTES / 1024 / 1024} MB limit.` };
    }
    return { ok: true, kind: "video" };
  }
  return {
    ok: false,
    error: "Unsupported file type. Allowed: JPEG, PNG, WebP, MP4, WebM, MOV.",
  };
}

export async function probeImageDimensions(file: Blob): Promise<{ width: number; height: number }> {
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const out = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image dimensions"));
    };
    img.src = url;
  });
}

export async function probeVideoDimensions(file: Blob): Promise<{ width: number; height: number }> {
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      const out = { width: v.videoWidth, height: v.videoHeight };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read video metadata"));
    };
    v.src = url;
  });
}

export function aspectWithinTolerance(width: number, height: number, target = HERO_TARGET_ASPECT, tolerance = HERO_ASPECT_TOLERANCE) {
  if (!width || !height) return false;
  const ratio = width / height;
  return Math.abs(ratio - target) / target <= tolerance;
}
