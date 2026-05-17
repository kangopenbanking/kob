import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  structuredData?: object;
  breadcrumbs?: Array<{ name: string; url: string }>;
  faqItems?: Array<{ question: string; answer: string }>;
}

export function SEO({ 
  title, 
  description, 
  keywords, 
  canonical, 
  ogImage, 
  ogType = "website", 
  structuredData,
  breadcrumbs,
  faqItems
}: SEOProps) {
  const siteTitle = "Kang Open Banking";
  const fullTitle = title ? `${title} | ${siteTitle}` : `${siteTitle} - Unified Banking API for Cameroon`;
  const defaultDescription = "Unified Open Banking API for Cameroon's financial institutions. Connect banks, credit unions, and fintech companies with XAF-native payment gateway integration.";
  const defaultImage = "https://kangopenbanking.com/images/og-social.png";
  const baseUrl = "https://kangopenbanking.com";
  
  // Generate breadcrumb structured data
  const breadcrumbSchema = breadcrumbs ? {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      "item": `${baseUrl}${crumb.url}`
    }))
  } : null;

  // Generate WebAPI schema for developer pages
  const webAPISchema = canonical?.includes('/developer') ? {
    "@context": "https://schema.org",
    "@type": "WebAPI",
    "name": "Kang Open Banking API",
    "description": "COBAC-compliant Open Banking API for Cameroon enabling account information, payment initiation, credit scoring, and mobile money integration",
    "url": "https://api.kangopenbanking.com/v1",
    "documentation": "https://kangopenbanking.com/developer",
    "termsOfService": "https://kangopenbanking.com/terms",
    "provider": {
      "@type": "Organization",
      "name": "Kang Open Banking",
      "url": "https://kangopenbanking.com",
      "logo": "https://kangopenbanking.com/kob-logo.png",
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "Developer Support",
        "email": "developers@kangopenbanking.com"
      }
    }
  } : null;

  // Generate FAQ structured data
  const faqSchema = faqItems ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqItems.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer
      }
    }))
  } : null;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description || defaultDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      {canonical && <link rel="canonical" href={canonical} />}
      
      {/* Hreflang tags for multilingual support */}
      <link rel="alternate" hrefLang="en" href={canonical || `${baseUrl}/en`} />
      <link rel="alternate" hrefLang="fr" href={canonical?.replace('/en/', '/fr/') || `${baseUrl}/fr`} />
      <link rel="alternate" hrefLang="x-default" href={canonical || baseUrl} />
      
      {/* OpenAPI and API Discovery Links */}
      <link rel="alternate" type="application/openapi+json" href="https://kangopenbanking.com/openapi.json" />
      <link rel="alternate" type="application/json" href="https://kangopenbanking.com/apis.json" />
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description || defaultDescription} />
      <meta property="og:image" content={ogImage || defaultImage} />
      <meta property="og:type" content={ogType} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:site_name" content={siteTitle} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description || defaultDescription} />
      <meta name="twitter:image" content={ogImage || defaultImage} />
      
      {/* WebAPI Structured Data */}
      {webAPISchema && (
        <script type="application/ld+json">
          {JSON.stringify(webAPISchema)}
        </script>
      )}

      {/* Breadcrumb Structured Data */}
      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}

      {/* FAQ Structured Data */}
      {faqSchema && (
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      )}

      {/* Custom Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}