// Default category seed data for Smart Budgeting (XAF-native, trilingual labels)
import type { BudgetLang } from "@/types/budget";

export interface DefaultCategory {
  id: string;
  icon: string;
  colour: string;
  default_share: number;
  name: Record<BudgetLang, string>;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { id: "cat_food",          icon: "ShoppingCart",    colour: "#10D9A0", default_share: 0.35, name: { en: "Food & Market",   fr: "Alimentation & Marché", pid: "Chop & Market" } },
  { id: "cat_transport",     icon: "Car",             colour: "#0EA5E9", default_share: 0.18, name: { en: "Transport",       fr: "Transport",             pid: "Waka" } },
  { id: "cat_airtime",       icon: "DeviceMobile",    colour: "#A78BFA", default_share: 0.08, name: { en: "Airtime & Data",  fr: "Crédit & Internet",     pid: "Credit & Data" } },
  { id: "cat_education",     icon: "GraduationCap",   colour: "#38BDF8", default_share: 0.05, name: { en: "Education",       fr: "Éducation",             pid: "School" } },
  { id: "cat_health",        icon: "FirstAid",        colour: "#FB7185", default_share: 0.05, name: { en: "Health",          fr: "Santé",                 pid: "Health" } },
  { id: "cat_utilities",     icon: "Lightning",       colour: "#F59E0B", default_share: 0.10, name: { en: "Utilities",       fr: "Services publics",      pid: "Light & Water" } },
  { id: "cat_njangi",        icon: "UsersThree",      colour: "#F97316", default_share: 0.03, name: { en: "Njangi / Tontine",fr: "Tontine",               pid: "Njangi" } },
  { id: "cat_remittance",    icon: "ArrowsLeftRight", colour: "#06B6D4", default_share: 0.02, name: { en: "Remittances",     fr: "Transferts",            pid: "Send Money" } },
  { id: "cat_savings",       icon: "PiggyBank",       colour: "#8B5CF6", default_share: 0.10, name: { en: "Savings",         fr: "Épargne",               pid: "Save" } },
  { id: "cat_entertainment", icon: "MusicNote",       colour: "#EC4899", default_share: 0.02, name: { en: "Entertainment",   fr: "Loisirs",               pid: "Enjoyment" } },
  { id: "cat_other",         icon: "DotsThree",       colour: "#64748B", default_share: 0.02, name: { en: "Other",           fr: "Autre",                 pid: "Other" } },
];

export const getCategory = (id: string) =>
  DEFAULT_CATEGORIES.find((c) => c.id === id) || DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1];

export const localiseCategoryName = (id: string, lang: BudgetLang): string =>
  getCategory(id).name[lang];
