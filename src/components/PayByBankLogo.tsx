import logo from "@/assets/pay-by-bank-logo.png";
import { cn } from "@/lib/utils";

interface PayByBankLogoProps {
  className?: string;
  alt?: string;
}

export const PayByBankLogo = ({ className, alt = "Pay by Bank" }: PayByBankLogoProps) => (
  <img src={logo} alt={alt} className={cn("object-contain", className)} />
);

export default PayByBankLogo;
