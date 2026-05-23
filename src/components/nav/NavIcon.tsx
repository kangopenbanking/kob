import React from "react";
import { parseNavIcon, resolveLucideIcon } from "@/lib/lucideIconMap";
import { cn } from "@/lib/utils";

interface NavIconProps {
  icon: string;
  className?: string;
  strokeWidth?: number;
}

/**
 * Unified icon renderer for navigation. Supports Lucide names, Font Awesome 4
 * (prefix "fa:"), Flaticon Uicons (prefix "fl:"), and uploaded image URLs
 * (prefix "url:").
 */
export const NavIcon: React.FC<NavIconProps> = ({ icon, className, strokeWidth = 1.75 }) => {
  const parsed = parseNavIcon(icon);

  if (parsed.kind === "image") {
    return (
      <img
        src={parsed.value}
        alt=""
        className={cn("h-6 w-6 object-contain", className)}
        draggable={false}
      />
    );
  }

  if (parsed.kind === "fa4") {
    return (
      <i
        className={cn("fa", `fa-${parsed.value}`, "text-foreground", className)}
        aria-hidden="true"
        style={{ fontSize: "1.25rem", lineHeight: 1 }}
      />
    );
  }

  if (parsed.kind === "flaticon") {
    const style = parsed.style ?? "rs";
    return (
      <i
        className={cn("fi", `fi-${style}-${parsed.value}`, "text-foreground", className)}
        aria-hidden="true"
        style={{ fontSize: "1.25rem", lineHeight: 1 }}
      />
    );
  }

  const Icon = resolveLucideIcon(parsed.value);
  return <Icon className={cn("h-6 w-6", className)} strokeWidth={strokeWidth} />;
};

export default NavIcon;
