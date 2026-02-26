

## Analysis

**Current state:**
- 3 layout styles (modern/classic/minimal) with fixed rendering per section
- Walkthrough is hardcoded with 3 default slides (icons only, no images/video)
- No per-section card size, color, or column configuration
- No media (images/videos) support in home sections
- No per-institution walkthrough management

**Scope is large — splitting into two major features:**

### Feature 1: Enhanced Layout Customization

**Database migration** — extend `app_config` JSONB with new keys:
```json
{
  "layout_style": "modern",
  "section_styles": {
    "balance_card": { "card_size": "large", "bg_color": "#1a1a2e", "text_color": "#ffffff", "columns": 1 },
    "quick_actions": { "columns": 4, "icon_style": "rounded" },
    "financial_services": { "card_size": "medium", "columns": 3 }
  },
  "media_sections": [
    {
      "id": "promo1",
      "type": "image",
      "url": "https://...",
      "title": "Summer Promo",
      "position": 2
    },
    {
      "id": "vid1",
      "type": "video",
      "provider": "youtube",
      "video_id": "abc123",
      "title": "How to use MoMo",
      "position": 4
    }
  ]
}
```

**Add new layout styles** — extend `LayoutStyle` type to include `'bold'` and `'gradient'` in addition to existing three.

**Per-section customization:**
- Card sizes: `small | medium | large` controlling padding/font sizes
- Background/text color overrides per section
- Column count for grid sections (quick_actions: 2-4, financial_services: 2-3)

**Media sections (images/videos):**
- New `media_banner` section type insertable at any position in section order
- Support image URLs (uploaded or external)
- Embed support for YouTube, Vimeo, Facebook, X, Instagram, LinkedIn videos via iframe/oembed
- Custom video uploads stored in a `pwa-media` storage bucket
- Rendered as a horizontal carousel or single banner card in BankHome

**Files to create:**
- `src/components/pwa/MediaBanner.tsx` — renders image slides or embedded video player

**Files to edit:**
- `src/components/pwa/TenantProvider.tsx` — add `sectionStyles`, `mediaSections` to context, extend `LayoutStyle` and `HomeSectionKey`
- `src/pages/banking-app/BankHome.tsx` — add `'bold'`/`'gradient'` style variants, apply per-section style overrides, render `media_banner` sections
- `src/pages/admin/BankingAppManagement.tsx` — add section style editor (card size, colors, columns), media section manager (add/remove/reorder slides, video URL input with provider detection, image upload)

### Feature 2: Walkthrough Management

**Database migration** — new `institution_walkthroughs` table:
```sql
CREATE TABLE institution_walkthroughs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  slide_order int NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text NOT NULL,
  media_type text DEFAULT 'icon', -- 'icon' | 'image' | 'video'
  media_url text,
  icon_name text DEFAULT 'Shield',
  bg_color text,
  text_color text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

Also add `walkthrough_config` to `app_config`:
```json
{
  "walkthrough_config": {
    "bg_color": "#ffffff",
    "text_color": "#000000",
    "accent_color": "#3b82f6",
    "logo_url": null,
    "skip_enabled": true
  }
}
```

**Storage** — create `pwa-media` public bucket for walkthrough images, custom video thumbnails, and media banner uploads.

**PWA changes:**
- `WalkthroughCarousel.tsx` — fetch slides from `institution_walkthroughs` table, fall back to defaults if none exist. Support image/video media types. Apply walkthrough color theme from config.
- `SplashScreen.tsx` — use walkthrough_config colors if provided.

**Admin changes:**
- Add a "Walkthrough" tab to BankingAppManagement
- CRUD interface for slides: add/edit/delete/reorder
- Per-slide: title, description, media type selector (icon/image/video), media upload/URL, preview
- Global walkthrough settings: background color, text color, accent color, logo override, skip toggle
- Live preview showing the walkthrough carousel with current slides

**Files to edit:**
- `src/components/pwa/WalkthroughCarousel.tsx`
- `src/components/pwa/SplashScreen.tsx`
- `src/pages/admin/BankingAppManagement.tsx` — add Walkthrough tab
- `src/components/pwa/TenantProvider.tsx` — expose walkthrough config

### Implementation Order
1. Database migration (add `institution_walkthroughs` table + storage bucket)
2. Enhanced layout styles + per-section customization in BankHome
3. Media banner component + admin media manager
4. Walkthrough management admin UI + PWA rendering
5. End-to-end testing after each step

