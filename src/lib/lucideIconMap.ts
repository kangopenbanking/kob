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
 *  - "Home"                   -> Lucide icon by name
 *  - "fa:user"                -> Font Awesome 4 (fa-user)
 *  - "fl:home"                -> Flaticon Uicons (fi fi-rs-home)
 *  - "url:https://…/icon.png" -> uploaded image (PNG/SVG)
 */
export type NavIconKind = "lucide" | "fa4" | "flaticon" | "image";

export function parseNavIcon(value: string | null | undefined): { kind: NavIconKind; value: string } {
  const v = (value || "").trim();
  if (v.startsWith("url:")) return { kind: "image", value: v.slice(4) };
  if (v.startsWith("fa:")) return { kind: "fa4", value: v.slice(3) };
  if (v.startsWith("fl:")) return { kind: "flaticon", value: v.slice(3) };
  return { kind: "lucide", value: v || "Circle" };
}
