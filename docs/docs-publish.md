# Documentation Publishing & Indexing Checklist

**Status:** ✅ Complete  
**Last verified:** 2026-02-16

---

## 1. SEO & Meta Tags

| Check | Status | Notes |
|-------|--------|-------|
| `<title>` tag present on all doc pages | ✅ | Via `<SEO>` component |
| `<meta name="description">` unique per page | ✅ | Each page provides custom description |
| `<link rel="canonical">` set | ✅ | Canonical URLs on all doc pages |
| No `noindex` / `nofollow` directives | ✅ | Verified — none present |
| Open Graph tags (`og:title`, `og:description`, `og:image`) | ✅ | Via `<SEO>` component |
| Twitter Card tags | ✅ | `summary_large_image` card type |
| Hreflang tags (en/fr) | ✅ | `<SEO>` includes `hreflang` alternates |

## 2. Structured Data (JSON-LD)

| Schema | Pages | Status |
|--------|-------|--------|
| `TechArticle` | `/documentation` | ✅ |
| `WebAPI` | `/developer/*` | ✅ Auto-injected |
| `BreadcrumbList` | All pages with breadcrumbs | ✅ |
| `FAQPage` | `/faq` | ✅ |
| `Organization` | Homepage | ✅ |
| `SoftwareApplication` | Homepage | ✅ |

## 3. Sitemap & Robots

| Check | Status | Notes |
|-------|--------|-------|
| `public/sitemap.xml` includes all doc URLs | ✅ | 80+ URLs listed |
| `public/robots.txt` allows doc crawling | ✅ | All `/documentation`, `/developer/*`, `/guides/*` allowed |
| Sitemap referenced in `robots.txt` | ✅ | `Sitemap: https://kangopenbanking.com/sitemap.xml` |
| `lastmod` dates current | ⚠️ | Update to current date on each publish |

## 4. API Discovery Endpoints

| Endpoint | Format | Status |
|----------|--------|--------|
| `/functions/v1/public-api-spec` | OpenAPI 3.1 JSON | ✅ Deployed |
| `/functions/v1/postman-collection` | Postman v2.1 JSON | ✅ Deployed |
| `/functions/v1/openapi-json` | OpenAPI JSON (alias) | ✅ Deployed |
| `/.well-known/ai-plugin.json` | ChatGPT Plugin | ✅ In robots.txt |
| `/apis.json` | APIs.json format | ✅ In robots.txt |

## 5. Documentation Page Features

| Feature | Status |
|---------|--------|
| Downloadable OpenAPI spec (JSON) | ✅ |
| Downloadable Postman collection | ✅ |
| Interactive API Explorer (Swagger UI) | ✅ |
| SDK generation link | ✅ |
| Tag-based domain navigation | ✅ |
| Code examples with copy-to-clipboard | ✅ |
| Base URL display (prod + sandbox) | ✅ |

## 6. Crawlability Verification

### Manual checks:
```bash
# Verify no noindex headers
curl -I https://kangopenbanking.com/documentation | grep -i "x-robots-tag"

# Verify sitemap is accessible
curl -s https://kangopenbanking.com/sitemap.xml | head -20

# Verify OpenAPI spec is reachable
curl -s https://api.kangopenbanking.com/functions/v1/public-api-spec | jq '.openapi'

# Verify Postman collection
curl -s https://api.kangopenbanking.com/functions/v1/postman-collection | jq '.info.name'
```

### Google Search Console:
- [ ] Submit sitemap URL
- [ ] Request indexing for key pages: `/documentation`, `/for-developers`, `/api-catalog`
- [ ] Monitor coverage report for excluded pages

## 7. API Directory Submissions

| Directory | Status | URL |
|-----------|--------|-----|
| RapidAPI | 📋 Pending | Submit OpenAPI spec |
| Postman Public Network | 📋 Pending | Publish collection |
| APIs.guru | 📋 Pending | Submit via GitHub PR |
| ProgrammableWeb | 📋 Pending | Create API listing |
| Public APIs (GitHub) | 📋 Pending | Submit PR |

## 8. Performance

| Metric | Target | Status |
|--------|--------|--------|
| LCP | < 2.5s | ✅ |
| FID | < 100ms | ✅ |
| CLS | < 0.1 | ✅ |
| Doc page bundle size | < 200KB gzipped | ✅ |

---

## Publishing Workflow

1. Update content in source files
2. Verify `lastmod` dates in `sitemap.xml`
3. Deploy via Lovable publish
4. Verify deployed pages render correctly
5. Submit updated sitemap to Google Search Console
6. Monitor indexing status over 48-72 hours
