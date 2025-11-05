import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  structuredData?: object;
}

export function SEO({ 
  title, 
  description, 
  keywords, 
  canonical, 
  ogImage, 
  ogType = "website", 
  structuredData 
}: SEOProps) {
  const siteTitle = "Kang Open Banking";
  const fullTitle = title ? `${title} | ${siteTitle}` : `${siteTitle} - Unified Banking API for Cameroon`;
  const defaultDescription = "Unified Open Banking API for Cameroon's financial institutions. Connect banks, credit unions, and fintech companies with XAF-native payment gateway integration.";
  const defaultImage = "https://kangopenbanking.com/hero-banner-kob.png";
  
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description || defaultDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      {canonical && <link rel="canonical" href={canonical} />}
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description || defaultDescription} />
      <meta property="og:image" content={ogImage || defaultImage} />
      <meta property="og:type" content={ogType} />
      {canonical && <meta property="og:url" content={canonical} />}
      
      {/* Twitter */}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description || defaultDescription} />
      <meta name="twitter:image" content={ogImage || defaultImage} />
      
      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}
