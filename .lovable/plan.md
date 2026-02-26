

# KANG OPEN BANKING — FULL REGULATORY, INFRASTRUCTURE & MULTI-COUNTRY UPGRADE PLAN

## SCOPE ASSESSMENT

This is a 10-phase upgrade affecting the public site navigation, footer, ~30 new content pages, developer portal sidebar, and changelog. The codebase already has strong foundations (AML tables, KYC/CDD functions, fraud detection, reconciliation framework, double-entry ledger). This upgrade creates the **public-facing documentation and architecture pages** that expose these capabilities to regulators, investors, and enterprise clients.

No backend changes required — all existing edge functions, database tables, and security infrastructure remain intact. This is a **documentation, navigation, and content architecture upgrade**.

---

## FILES TO CREATE (~30 new pages)

### Phase 1 — Cameroon Regulatory (4 pages)
| File | Route |
|------|-------|
| `src/pages/regulatory/CameroonCompliance.tsx` | `/regulatory/cameroon-compliance` |
| `src/pages/compliance/AmlPolicy.tsx` | `/compliance/aml-policy` |
| `src/pages/compliance/KycFramework.tsx` | `/compliance/kyc-framework` |
| `src/pages/compliance/RiskMonitoring.tsx` | `/compliance/risk-monitoring` |

Each page documents the existing system capabilities (sanctions_screening table, customer_due_diligence table, KYC functions, PEP screening, STR workflows) in formal regulatory language suitable for BEAC/COBAC auditors.

### Phase 2 — Architecture Pages (5 pages)
| File | Route |
|------|-------|
| `src/pages/architecture/FraudEngine.tsx` | `/architecture/fraud-engine` |
| `src/pages/architecture/RiskScoringModel.tsx` | `/architecture/risk-scoring-model` |
| `src/pages/architecture/LedgerSystem.tsx` | `/architecture/ledger-system` |
| `src/pages/architecture/ReconciliationFramework.tsx` | `/architecture/reconciliation-framework` |
| `src/pages/architecture/SettlementEngine.tsx` | `/architecture/settlement-engine` |

These document existing capabilities: velocity checks, risk scoring functions, journal-post double-entry engine, reconciliation_runs/mismatches tables, automated-settlement-cron, and atomic wallet functions.

### Phase 3 — Multi-Country Expansion (6 pages)
| File | Route |
|------|-------|
| `src/pages/expansion/Cameroon.tsx` | `/expansion/cameroon` |
| `src/pages/expansion/Nigeria.tsx` | `/expansion/nigeria` |
| `src/pages/expansion/Ghana.tsx` | `/expansion/ghana` |
| `src/pages/expansion/Kenya.tsx` | `/expansion/kenya` |
| `src/pages/expansion/SouthAfrica.tsx` | `/expansion/south-africa` |
| `src/pages/expansion/Europe.tsx` | `/expansion/europe` |

Each includes: regulatory requirements, licensing category, currency support, settlement flow, FX considerations, mobile money coverage, card scheme coverage, data protection laws.

### Phase 4 — Infrastructure & Security (3 pages)
| File | Route |
|------|-------|
| `src/pages/architecture/Infrastructure.tsx` | `/architecture/infrastructure` |
| `src/pages/architecture/DisasterRecovery.tsx` | `/architecture/disaster-recovery` |
| `src/pages/security/IncidentResponse.tsx` | `/security/incident-response` |

### Phase 5 — API Documentation Pages (7 pages)
| File | Route |
|------|-------|
| `src/pages/api/Versioning.tsx` | `/api/versioning` |
| `src/pages/api/ErrorCodes.tsx` | `/api/error-codes` |
| `src/pages/api/WebhooksReference.tsx` | `/api/webhooks` |
| `src/pages/api/Idempotency.tsx` | `/api/idempotency` |
| `src/pages/api/RateLimits.tsx` | `/api/rate-limits` |
| `src/pages/api/SandboxTesting.tsx` | `/api/sandbox-testing` |
| `src/pages/api/SecurityReference.tsx` | `/api/security` |

### Phase 7 — Investor Pages (4 pages)
| File | Route |
|------|-------|
| `src/pages/investors/TechnicalOverview.tsx` | `/investors/technical-overview` |
| `src/pages/investors/RiskDisclosure.tsx` | `/investors/risk-disclosure` |
| `src/pages/investors/ComplianceStatus.tsx` | `/investors/compliance-status` |
| `src/pages/investors/InfrastructureMaturity.tsx` | `/investors/infrastructure-maturity` |

### Phase 8 — Certification (1 page)
| File | Route |
|------|-------|
| `src/pages/certification/AGradeStatus.tsx` | `/certification/a-grade-status` |

### Phase 9 — Sandbox Simulation (1 page)
| File | Route |
|------|-------|
| `src/pages/sandbox/SimulationTools.tsx` | `/sandbox/simulation-tools` |

---

## FILES TO MODIFY (4 existing files)

### 1. `src/components/DynamicNavigation.tsx` — Header Restructure
Replace current mega-menu categories (Credit Score, Solutions, Resources, Company) with:

**New desktop nav structure:**
- **API Docs** (link to `/documentation`)
- **Platform** (mega-menu): Architecture, Fraud Engine, Ledger System, Settlement Engine, Infrastructure
- **Compliance** (mega-menu): Cameroon Compliance, AML Policy, KYC Framework, Risk Monitoring, Data Protection
- **Expansion** (mega-menu): Cameroon, Nigeria, Ghana, Kenya, South Africa, Europe
- **Developers** (mega-menu): Developer Portal, API Explorer, Sandbox, SDKs, Webhooks, Changelog
- **Resources** (mega-menu): Pricing, Integration Workflow, Status, FAQ, Contact
- **Company** (link to `/about`)

Mobile nav updated with matching sections.

### 2. `src/components/Footer.tsx` — Complete Restructure
Replace current 8-column grid with 7 sections matching the spec:
- **Company**: About, Governance (`/compliance`), Regulatory (`/regulatory/cameroon-compliance`), Investor Relations (`/investors/technical-overview`)
- **Developers**: API Reference (`/documentation`), SDKs (`/developer/guides/sdks`), Postman Collection, OpenAPI Download, Webhooks (`/api/webhooks`), Sandbox (`/developer/sandbox`)
- **Compliance**: AML Policy, Data Protection, Risk Monitoring, PCI Scope (`/security-policy`), Open Banking Standards (`/compliance`)
- **Infrastructure**: Architecture, Ledger System, Fraud Engine, Disaster Recovery
- **Expansion**: Cameroon, Nigeria, Ghana, Kenya, South Africa, Europe
- **Legal**: Terms, Privacy, AUP, Refund Policy (new section in Terms), Dispute Policy (`/developer/gateway/disputes`)

### 3. `src/App.tsx` — Add ~31 new routes
Add route definitions for all new pages, wrapped in `<Layout>` component. Group by domain:
```
/regulatory/*
/compliance/*
/architecture/*
/expansion/*
/api/*
/investors/*
/certification/*
/sandbox/*
/security/*
```

### 4. `src/pages/developer/Changelog.tsx` — Add v3.0.0 release
Document all new pages, navigation restructure, and multi-country framework.

### 5. `src/components/developer/DeveloperLayout.tsx` — Add sidebar links
Add new API reference pages to the developer portal sidebar under appropriate sections.

---

## PAGE CONTENT APPROACH

Each page follows the existing pattern (Card-based layouts, Badge components, Separator, professional prose). Content sources:

- **Regulatory pages**: Document existing database tables (sanctions_screening, customer_due_diligence, kyc_verifications) and functions (calculate_kyc_risk_score, check_suspicious_login, log_security_event) in BEAC/COBAC compliance language
- **Architecture pages**: Document existing systems (journal-post, atomic wallet functions, reconciliation_runs, gateway-reconcile-stuck cron, velocity checks in gateway-create-charge)
- **Expansion pages**: Country-specific regulatory requirements, Stripe/Flutterwave coverage, currency codes, data protection laws
- **Investor pages**: Aggregate architecture diagrams, risk metrics, scalability projections from existing infrastructure
- **API pages**: Document existing patterns (idempotency_keys table, rate_limits table, error models, webhook event types)

---

## IMPLEMENTATION SEQUENCE

Due to the scale (~35 files), implementation will proceed in 3 batches:

**Batch 1** (Navigation + Core Infrastructure — 7 files):
1. Footer.tsx restructure
2. DynamicNavigation.tsx restructure
3. Architecture pages (5 pages: fraud-engine, risk-scoring, ledger, reconciliation, settlement)

**Batch 2** (Regulatory + Expansion — 13 files):
4. Regulatory pages (4 pages)
5. Expansion pages (6 pages)
6. Infrastructure pages (3 pages)

**Batch 3** (API + Investor + Routes — 15 files):
7. API documentation pages (7 pages)
8. Investor pages (4 pages)
9. Certification + Sandbox pages (2 pages)
10. App.tsx route additions
11. Changelog update
12. Developer sidebar update

---

## TECHNICAL CONSTRAINTS

- All pages are **public** (no auth required) — wrapped in `<Layout>`
- No database migrations needed — documenting existing capabilities
- No edge function changes — API structure preserved
- Version remains v1 — no breaking changes
- All new routes use existing `Layout` component with `DynamicNavigation` + `Footer`
- SEO component used on all new pages for meta tags
- Consistent with existing design system (Card, Badge, Separator, lucide icons)

---

## A-GRADE CERTIFICATION CRITERIA MET

| Criterion | Status |
|-----------|--------|
| Central bank auditable documentation | New regulatory + compliance pages |
| Enterprise integration ready | API docs + architecture pages |
| Investor due diligence ready | Dedicated investor section |
| Multi-country scalable | 6 expansion country pages |
| Fraud resilient documentation | Fraud engine + risk scoring pages |
| Production hardened documentation | Infrastructure + DR pages |
| Navigation restructured | Header + Footer updated |
| No breaking changes | All existing routes preserved |

