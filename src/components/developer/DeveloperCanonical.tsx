import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";

/**
 * PERMANENT PUBLIC ROUTE HELPER — DO NOT REMOVE OR REDIRECT (Order P1, P2)
 *
 * Injects a canonical <link> on every /developer/* page so crawlers index the
 * single, no-trailing-slash URL on the production host, regardless of which
 * mirror domain (kangopenbanking.com / info.kangfintechsolutions.com) served
 * the response or whether a 301 trailing-slash normalisation occurred upstream.
 *
 * This makes Lighthouse / generic SEO crawlers stop reporting "blank stub" for
 * pages they reached via a 301 redirect — the canonical points them straight
 * at the rendered content URL.
 */
export function DeveloperCanonical() {
  const { pathname } = useLocation();

  // Always strip a trailing slash (except for the root "/developer") so the
  // canonical URL is stable and matches the route table in src/App.tsx.
  const normalised =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.replace(/\/+$/, "")
      : pathname;

  const canonical = `https://kangopenbanking.com${normalised}`;

  // Soft client-side normalisation: if a user lands on /developer/foo/ with a
  // trailing slash, rewrite the URL bar to /developer/foo without reloading.
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      pathname.length > 1 &&
      pathname.endsWith("/")
    ) {
      const target = normalised + window.location.search + window.location.hash;
      window.history.replaceState(null, "", target);
    }
  }, [pathname, normalised]);

  return (
    <Helmet>
      <link rel="canonical" href={canonical} />
      <meta name="robots" content="index,follow" />
      <link rel="alternate" hrefLang="en" href={canonical} />
      <link rel="alternate" hrefLang="x-default" href={canonical} />
    </Helmet>
  );
}
