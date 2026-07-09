import { useState, type ImgHTMLAttributes, type SyntheticEvent } from "react";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";

interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** URL to render if `src` fails to load. Falls back to a neutral placeholder icon if omitted. */
  fallbackSrc?: string;
  /** Extra class for the placeholder box shown when the image cannot render. */
  fallbackClassName?: string;
}

/**
 * <SafeImage /> — drop-in replacement for <img> that:
 *  - handles remote / user-uploaded image failures gracefully on installed PWAs
 *    (mobile networks flake often; a broken-image glyph looks like a bug),
 *  - sets sensible defaults: lazy loading, async decoding, no-referrer
 *    (Supabase Storage and most CDNs are indifferent, but this prevents the
 *    occasional hotlink block),
 *  - falls back to `fallbackSrc` if provided, otherwise renders a muted
 *    icon placeholder that keeps layout stable.
 *
 * Use this in place of raw <img> for anything sourced from user uploads,
 * Supabase Storage, remote CDNs, or content that may be missing.
 */
export function SafeImage({
  src,
  alt = "",
  className,
  fallbackSrc,
  fallbackClassName,
  loading = "lazy",
  decoding = "async",
  referrerPolicy = "no-referrer",
  onError,
  ...rest
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(
    typeof src === "string" ? src : undefined,
  );

  const handleError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    onError?.(event);
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      return;
    }
    setFailed(true);
  };

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className,
          fallbackClassName,
        )}
      >
        <ImageOff className="h-5 w-5 opacity-60" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      {...rest}
      src={currentSrc}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      referrerPolicy={referrerPolicy}
      onError={handleError}
    />
  );
}

export default SafeImage;
