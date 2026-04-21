/**
 * LivePageTranslator
 *
 * Scans the rendered DOM for visible English text nodes and:
 *  1. Looks them up in the existing i18next store (FNV-1a key in `auto` ns).
 *  2. If a translation exists → replaces the text node in-place.
 *  3. If not → queues the original string via `queueAutoHarvestedString`,
 *     which calls `register-translation-strings` → `translate-strings`
 *     (OpenAI primary, Lovable AI fallback) → realtime bundle reload →
 *     next scan replaces the text.
 *
 * Runs only when the active language is non-English. Idempotent and
 * MutationObserver-driven so it covers route changes and dynamic content.
 *
 * Skips: <script>, <style>, <code>, <pre>, [contenteditable], inputs,
 * elements marked with data-no-translate, and pure numeric/symbolic text.
 */
import { useEffect } from 'react';
import { useLanguage } from './LanguageContext';
import { lookup } from './i18next';
import { queueAutoHarvestedString } from './LanguageContext';

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT', 'TEXTAREA',
  'INPUT', 'SELECT', 'OPTION', 'SVG', 'PATH',
]);

const TEXT_RE = /[A-Za-z]{2,}/; // must contain at least one word

function isTranslatable(node: Text): boolean {
  const text = node.nodeValue?.trim();
  if (!text || text.length < 2 || text.length > 500) return false;
  if (!TEXT_RE.test(text)) return false;
  const parent = node.parentElement;
  if (!parent) return false;
  if (SKIP_TAGS.has(parent.tagName)) return false;
  if (parent.closest('[data-no-translate]')) return false;
  if (parent.closest('[contenteditable="true"]')) return false;
  return true;
}

function translateNode(node: Text): boolean {
  const original = node.nodeValue!;
  const trimmed = original.trim();
  // Preserve surrounding whitespace
  const leading = original.match(/^\s*/)?.[0] ?? '';
  const trailing = original.match(/\s*$/)?.[0] ?? '';

  const translated = lookup(`auto.${fnv1a(trimmed)}`);
  if (translated && translated !== trimmed) {
    node.nodeValue = leading + translated + trailing;
    return true;
  }
  // Queue for backend translation; will appear after realtime reload.
  queueAutoHarvestedString(trimmed, 'auto');
  return false;
}

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function scanRoot(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      isTranslatable(n as Text)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  });
  const nodes: Text[] = [];
  let cur = walker.nextNode();
  while (cur) {
    nodes.push(cur as Text);
    cur = walker.nextNode();
  }
  for (const n of nodes) translateNode(n);
}

export function LivePageTranslator() {
  const { language, isLoadingTranslations } = useLanguage();

  useEffect(() => {
    if (isLoadingTranslations) return;
    if (language === 'en') return;

    // Initial scan (deferred so React finishes painting first).
    let raf = 0;
    const scheduleScan = (root: Node = document.body) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => scanRoot(root));
    };
    scheduleScan();

    // Watch for route changes / dynamic content.
    const observer = new MutationObserver((mutations) => {
      // Debounce by collecting affected roots.
      const roots = new Set<Node>();
      for (const m of mutations) {
        if (m.type === 'characterData' && m.target.parentNode) {
          roots.add(m.target.parentNode);
        } else if (m.type === 'childList') {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE) {
              roots.add(n);
            }
          });
        }
      }
      if (roots.size === 0) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        for (const r of roots) {
          try { scanRoot(r); } catch { /* ignore detached nodes */ }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [language, isLoadingTranslations]);

  return null;
}
