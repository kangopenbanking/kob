import { useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BankLogoProps {
  logoUrl?: string | null;
  name?: string;
  className?: string;
  iconClassName?: string;
}

/**
 * Renders a bank logo when available, falling back to a Building2 icon when
 * the image is missing or fails to load. Use inside a sized container.
 */
export const BankLogo = ({ logoUrl, name, className, iconClassName }: BankLogoProps) => {
  const [errored, setErrored] = useState(false);
  if (logoUrl && !errored) {
    return (
      <img
        src={logoUrl}
        alt={name ? `${name} logo` : "Bank logo"}
        loading="lazy"
        onError={() => setErrored(true)}
        className={cn("h-full w-full object-contain p-0.5", className)}
      />
    );
  }
  return <Building2 className={cn("h-4 w-4 text-primary", iconClassName)} strokeWidth={1.5} />;
};

export default BankLogo;
