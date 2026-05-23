import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function resolveLucideIcon(name: string): LucideIcon {
  const Icon = (Icons as unknown as Record<string, LucideIcon>)[name];
  return Icon || Icons.Circle;
}

// Curated icon options for the bottom-nav picker
export const NAV_ICON_OPTIONS: string[] = [
  "Home", "Activity", "PieChart", "ScanLine", "CreditCard", "Menu",
  "Wallet", "BarChart3", "Send", "Receipt", "Settings", "User",
  "ShoppingBag", "Bell", "Building2", "Briefcase", "QrCode", "ArrowLeftRight",
  "PiggyBank", "LineChart", "Search", "Plus", "MapPin", "Globe",
];

/**
 * Icon source classifier for the unified <NavIcon> component.
 * Supports:
 *  - "Home"                       -> Lucide icon by name
 *  - "fa:user"                    -> Font Awesome 4 (fa-user)
 *  - "fl:home"                    -> Flaticon Uicons Regular Straight (fi fi-rs-home) — back-compat
 *  - "fl:{style}:home"            -> Flaticon Uicons in a specific style
 *       style ∈ rs (regular straight) | ss (solid straight) | bs (bold straight)
 *                | rr (regular rounded) | sr (solid rounded) | br (bold rounded)
 *  - "url:https://…/icon.png"     -> uploaded image (PNG/SVG)
 */
export type NavIconKind = "lucide" | "fa4" | "flaticon" | "image";
export type FlaticonStyle = "rs" | "ss" | "bs" | "rr" | "sr" | "br";

const FLATICON_STYLES: FlaticonStyle[] = ["rs", "ss", "bs", "rr", "sr", "br"];

export function parseNavIcon(
  value: string | null | undefined,
): { kind: NavIconKind; value: string; style?: FlaticonStyle } {
  const v = (value || "").trim();
  if (v.startsWith("url:")) return { kind: "image", value: v.slice(4) };
  if (v.startsWith("fa:")) return { kind: "fa4", value: v.slice(3) };
  if (v.startsWith("fl:")) {
    const rest = v.slice(3);
    const [maybeStyle, ...nameParts] = rest.split(":");
    if (nameParts.length > 0 && FLATICON_STYLES.includes(maybeStyle as FlaticonStyle)) {
      return { kind: "flaticon", value: nameParts.join(":"), style: maybeStyle as FlaticonStyle };
    }
    return { kind: "flaticon", value: rest, style: "rs" };
  }
  return { kind: "lucide", value: v || "Circle" };
}
