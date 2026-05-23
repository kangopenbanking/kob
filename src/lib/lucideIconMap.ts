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
