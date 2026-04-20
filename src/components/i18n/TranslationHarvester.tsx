import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { queueAutoHarvestedString, useLanguage } from '@/lib/i18n/LanguageContext';

interface Props {
  /** Category prefix for harvested keys, e.g. 'customer', 'business', 'banking'. */
  category: string;
  /** CSS selector for the root to scan. Defaults to <body>. */
  rootSelector?: string;
  /** Throttle re-scans (ms). */
  debounceMs?: number;
}

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'KBD', 'SAMP',
  'SVG', 'PATH', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION',
]);

// Reject strings that look like data, not UI copy.
const NUMERIC_ONLY = /^[\s\d.,:/\-+%$€£¥₦]+$/;
const URL_LIKE = /^(https?:\/\/|www\.|[\w.-]+@[\w.-]+\.\w+)/i;
const CODE_LIKE = /^[{<[].*[}>\]]$/;
const HEX_LIKE = /^#?[0-9a-fA-F]{3,8}$/;

function isHarvestable(text: string): boolean {
  const t = text.trim();
  if (t.length < 2 || t.length > 240) return false;
  if (NUMERIC_ONLY.test(t)) return false;
  if (URL_LIKE.test(t)) return false;
  if (CODE_LIKE.test(t)) return false;
  if (HEX_LIKE.test(t)) return false;
  // Must contain at least one ASCII letter
  if (!/[A-Za-z]/.test(t)) return false;
  // Avoid obvious template artifacts
  if (t.includes('{{') || t.includes('}}')) return false;
  return true;
}

function shouldSkipNode(node: Node): boolean {
  let el: HTMLElement | null = node.parentElement;
  while (el) {
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.getAttribute('data-no-i18n') !== null) return true;
    if (el.getAttribute('contenteditable') === 'true') return true;
    el = el.parentElement;
  }
  return false;
}

function scan(root: HTMLElement, category: string) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (shouldSkipNode(n)) return NodeFilter.FILTER_REJECT;
      const v = (n.nodeValue || '').trim();
      if (!isHarvestable(v)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node: Node | null;
  let count = 0;
  while ((node = walker.nextNode())) {
    queueAutoHarvestedString((node.nodeValue || '').trim(), category);
    if (++count > 500) break; // safety cap per scan
  }
  // Also harvest aria-label, title, placeholder, alt
  root.querySelectorAll<HTMLElement>('[aria-label], [title], [placeholder], [alt]').forEach((el) => {
    if (SKIP_TAGS.has(el.tagName)) return;
    for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
      const v = el.getAttribute(attr);
      if (v && isHarvestable(v)) queueAutoHarvestedString(v.trim(), category);
    }
  });
}

/**
 * Mount inside a mobile-app layout. Auto-registers visible English UI strings
 * for translation on every route change. Scoped, idempotent, and throttled.
 */
export function TranslationHarvester({
  category,
  rootSelector,
  debounceMs = 1500,
}: Props) {
  const location = useLocation();
  // Subscribe to language so harvest re-runs once translations load
  useLanguage();

  useEffect(() => {
    const root = (rootSelector
      ? (document.querySelector(rootSelector) as HTMLElement | null)
      : document.body) || document.body;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      timer = null;
      try { scan(root, category); } catch (e) { /* swallow */ }
    };

    // Initial scan after route paints
    timer = setTimeout(run, debounceMs);

    // Observe in-route DOM changes (lazy lists, modals)
    const obs = new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(run, debounceMs);
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true });

    return () => {
      if (timer) clearTimeout(timer);
      obs.disconnect();
    };
  }, [location.pathname, category, rootSelector, debounceMs]);

  return null;
}
