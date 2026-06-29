## Issue
The mega-menu items in `src/components/DynamicNavigation.tsx` already set title + description to `group-hover:text-white`, but the hover background is `hover:bg-accent` (a light muted tone), so white text becomes invisible on hover. The icon also stays primary-colored.

## Change (single file: `src/components/DynamicNavigation.tsx`, lines 92–98)

Swap the hover background to the dark primary surface and turn the icon white on hover so the whole card reads cleanly:

- Card link: `hover:bg-accent` → `hover:bg-primary hover:border-primary`
- Icon: add `group-hover:text-white`
- Title and description: keep existing `group-hover:text-white` (already correct)

No other files or logic touched. Result: on hover the card flips to the dark primary background with title, description, and icon all white.