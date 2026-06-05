import {
  Star, Soup, ShoppingCart, CreditCard, Bike, Pill, PackageCheck, Camera,
  ShieldCheck, Stethoscope, Sparkles, Heart, Truck, Clock, MapPin, Phone,
  CheckCircle, Tag, Gift, Search, User, Bell, Home, Utensils, Coffee,
  Apple, Leaf, Award, Box, ClipboardList, FileText, MessageSquare, Smile,
  ThumbsUp, Wallet, QrCode, Receipt, ScanLine, Stamp,
} from "lucide-react";

export const HOW_IT_WORKS_ICONS = {
  Star, Soup, ShoppingCart, CreditCard, Bike, Pill, PackageCheck, Camera,
  ShieldCheck, Stethoscope, Sparkles, Heart, Truck, Clock, MapPin, Phone,
  CheckCircle, Tag, Gift, Search, User, Bell, Home, Utensils, Coffee,
  Apple, Leaf, Award, Box, ClipboardList, FileText, MessageSquare, Smile,
  ThumbsUp, Wallet, QrCode, Receipt, ScanLine, Stamp,
} as const;

export type HowItWorksIconName = keyof typeof HOW_IT_WORKS_ICONS;

export const ICON_NAMES = Object.keys(HOW_IT_WORKS_ICONS) as HowItWorksIconName[];

export function resolveIcon(name: string) {
  return (HOW_IT_WORKS_ICONS as Record<string, any>)[name] ?? Sparkles;
}
