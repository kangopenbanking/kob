// Shared theme for the Budget feature.
// Vars are applied to document.documentElement so portalled components
// (Radix Sheet, Dialog, Popover) inherit them.
import { useEffect, useState } from "react";

export type BudgetTheme = "light" | "dark";

const THEME_KEY = "kob_budget_theme";

export const BUDGET_THEMES: Record<BudgetTheme, Record<string, string>> = {
  light: {
    "--bud-bg": "#F5F6FA",
    "--bud-surface": "#FFFFFF",
    "--bud-surface-2": "#F0F2F7",
    "--bud-border": "rgba(15,23,42,0.08)",
    "--bud-border-soft": "rgba(15,23,42,0.05)",
    "--bud-text": "#0B1220",
    "--bud-text-2": "#475569",
    "--bud-text-3": "#94A3B8",
    "--bud-track": "rgba(15,23,42,0.06)",
    "--bud-hover": "rgba(15,23,42,0.03)",
    "--bud-cta-bg": "#0B1220",
    "--bud-cta-fg": "#FFFFFF",
    "--bud-accent": "#0284C7",
    "--bud-accent-soft": "rgba(2,132,199,0.10)",
    "--bud-ring-track": "rgba(15,23,42,0.06)",
    "--bud-input-bg": "#FFFFFF",
    "--bud-input-placeholder": "#94A3B8",
  },
  dark: {
    "--bud-bg": "#0B0F19",
    "--bud-surface": "#111623",
    "--bud-surface-2": "rgba(255,255,255,0.02)",
    "--bud-border": "rgba(255,255,255,0.08)",
    "--bud-border-soft": "rgba(255,255,255,0.05)",
    "--bud-text": "#E8ECF3",
    "--bud-text-2": "#94A3B8",
    "--bud-text-3": "#64748B",
    "--bud-track": "rgba(255,255,255,0.06)",
    "--bud-hover": "rgba(255,255,255,0.04)",
    "--bud-cta-bg": "#FFFFFF",
    "--bud-cta-fg": "#0F172A",
    "--bud-accent": "#7DD3FC",
    "--bud-accent-soft": "rgba(56,189,248,0.14)",
    "--bud-ring-track": "rgba(255,255,255,0.05)",
    "--bud-input-bg": "rgba(255,255,255,0.04)",
    "--bud-input-placeholder": "#64748B",
  },
};

function applyTheme(theme: BudgetTheme) {
  if (typeof document === "undefined") return;
  const tokens = BUDGET_THEMES[theme];
  const root = document.documentElement;
  Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute("data-bud-theme", theme);
}

function clearTheme() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  Object.keys(BUDGET_THEMES.light).forEach((k) => root.style.removeProperty(k));
  root.removeAttribute("data-bud-theme");
}

export function useBudgetTheme(): [BudgetTheme, () => void] {
  const [theme, setTheme] = useState<BudgetTheme>(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem(THEME_KEY) as BudgetTheme) || "light";
  });

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* noop */ }
    return () => clearTheme();
  }, [theme]);

  return [theme, () => setTheme((t) => (t === "light" ? "dark" : "light"))];
}
