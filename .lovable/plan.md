
Roles active: Guardian, Architect, Surgeon, Auditor, Scorekeeper.

Reality check
- I parsed the uploaded audit report, inspected the current codebase, and re-fetched live published pages.
- The report’s headline diagnosis is now stale: /developer, /developer/getting-started, /developer/authentication, /developer/changelog, and /developer/status currently render unique content on the live site.
- The real remaining gaps are structural and UX-related: public/private route mixing, several prompt URLs still alias to shared overview pages, missing shared docs features, stale version copy in some places, and incomplete alignment with the Mega Super Master Prompt.

What I will fix
1. Public docs routing and URL contract
- Make /developer/sandbox the permanent public sandbox docs landing page.
- Move authenticated sandbox/tools pages out of the public docs path or into a clearly separate protected tools namespace.
- Add any missing prompt-defined public routes and remove same-component aliases where a unique page is required.
- Publish /developer/sitemap.xml and /developer/redirects.json, while keeping old URLs redirect-safe.

2. Remove public/private mixing
- Clean the public sidebar so docs never point anonymous users into gated tools as if they were docs.
- Update hero/top-nav CTAs so public users always go to readable docs first; gated actions become explicit secondary actions.
- Keep ORDER P1 and P2 intact: public-first docs, zero-404 docs.

3. Replace duplicate-content routes with real pages
- Create dedicated pages for routes currently reusing overview components, including:
  - /developer/sandbox/credentials
  - /developer/sandbox/test-cards
  - /developer/sandbox/mobile-money
  - /developer/sandbox/webhooks or simulate-webhooks
  - /developer/sandbox/seed-data
  - /developer/api-reference/errors
  - /developer/api-reference/pagination
  - /developer/api-reference/rate-limits
  - /developer/api-reference/versioning
  - /developer/api-reference/idempotency
  - /developer/open-banking/consents
  - /developer/iso20022/messages
  - any remaining prompt URLs still absent or aliasing
- Each page will contain explanation + code example + table/diagram, not just links.

4. Rebuild the docs flow to be Stripe-like and sequential
- Reorder the canonical reading path to:
  Home → Getting Started → Authentication → Sandbox → API Reference → API Explorer → SDKs → Gateway Quickstart → Webhooks → Open Banking → Mobile Money → ISO 20022 → Go-Live → Support/Access Policy.
- Update AutoDocNavigation and each page’s “next steps” cards so they move logically to the next step, not sideways into unrelated sections.
- Align the home page structure with the prompt: hero, start-here cards, use cases, changelog strip, status strip.

5. Rewrite high-impact pages to exact spec
- Getting Started: convert from TPP/DCR-heavy onboarding to public “first API call” onboarding with keys, 6-language examples, annotated response, and next steps.
- Authentication: tighten API Keys / OAuth2 / FAPI / mTLS into a clearer progression with proper scopes table and flow diagrams.
- Sandbox: expose permanent public credentials at /developer/sandbox and split out the sub-pages.
- API Explorer: prefill sandbox guidance, update stale fallback copy/version counts, and align messaging to v4.6.0 / 339 endpoints / 52 events.
- SDKs: extend to Node, Python, PHP, Java, Go, and Flutter/Dart with install commands, imports, instantiation, full example, and package links.
- Gateway Quickstart and Webhooks: match the prompt’s copy-paste tutorial quality and full event/reference requirements.

6. Add the missing documentation-platform features
- Implement a shared right-rail “On this page” component in PublicDeveloperLayout by reading H2/H3 anchors from the page content.
- Add a consistent developer docs footer on every docs page.
- Add full-text search across the docs set.
- Standardize code blocks, copy buttons, anchors, and section IDs across all doc pages.

7. Normalize metadata, SEO, and versioning
- Give every docs page page-specific title, description, canonical, and TechArticle JSON-LD.
- Remove stale version references (for example, ApiExplorer noscript still mentions v4.2.0 / 326+ operations).
- Surface changelog.json on the homepage and keep changelog timing aligned with the standing orders.

8. Finish the public access contract
- Tighten robots.txt around public docs vs private app/admin areas.
- Ensure /openapi.json, /openapi.yaml, /openapi-sandbox.json, and /changelog.json stay public.
- Ensure every published docs URL resolves uniquely or redirects intentionally.

Verification report I will deliver after implementation
- Route-by-route matrix showing every required /developer URL, its component, and whether it is public, unique, and indexed.
- List of duplicate/gated/stale pages fixed.
- UX checklist: sequential nav, right-rail TOC, footer, search, copyable code, mobile responsiveness.
- Content checklist: sandbox creds, SDK coverage, API Explorer, changelog, status, go-live, access policy.
- Final confidence assessment against the Mega Super Master Prompt and the attached audit.

Technical note
- I will not replace the current portal with a new framework. The existing React/Vite docs foundation already has the routes, layout, Swagger UI, and most core content; the fastest safe path is to finish and normalize this system rather than restart it.
