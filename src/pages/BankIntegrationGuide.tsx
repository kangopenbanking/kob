import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  Database, Globe, FileText, Radio, Layers, Shield, Server,
  ChevronRight, Download, ArrowUp, CheckCircle2, Terminal,
  Lock, Key, RefreshCw, Zap, HardDrive, Webhook,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useRegulatoryPdfExport } from '@/hooks/useRegulatoryPdfExport';

/* ─── Data ─────────────────────────────────────────────────────────── */

const sections = [
  {
    id: 'overview',
    icon: Layers,
    title: '1. Overview — KOB Bank Connector Framework',
    content: [
      'Kang Open Banking (KOB) provides a flexible, multi-mode connector framework that allows financial institutions across Africa to integrate their core-banking systems with the KOB platform. The framework supports real-time and batch data exchange for accounts, transactions, balances, and beneficiaries.',
      'KOB supports six integration modes, each designed for different technical maturity levels and operational requirements. Banks can adopt a single mode or combine multiple modes in a hybrid configuration.',
    ],
    table: {
      headers: ['Mode', 'Direction', 'Latency', 'Best For'],
      rows: [
        ['connector_push', 'Bank → KOB', 'Real-time', 'Modern core-banking with API capability'],
        ['db_connector', 'KOB ← Bank DB', 'Near real-time', 'Legacy systems with read-replica access'],
        ['connector_pull', 'KOB → Bank API', 'Polling-based', 'Banks with existing REST/SOAP APIs'],
        ['file_feed', 'Bank → KOB (files)', 'Batch (hourly/daily)', 'Institutions using CSV/ISO 20022'],
        ['mq_realtime', 'Event-driven', 'Sub-second', 'High-volume banks with message queues'],
        ['hybrid', 'Mixed', 'Varies', 'Combining modes for different data types'],
      ],
    },
  },
  {
    id: 'connector-push',
    icon: ArrowUp,
    title: '2. Connector Push (Recommended)',
    subtitle: 'Bank pushes data to KOB ingestion endpoints via mTLS + HMAC',
    content: [
      'The connector_push model is the recommended integration for modern banking partners. The bank\'s system initiates HTTPS POST requests to KOB\'s ingestion endpoints, sending account, transaction, and balance data in real-time or near real-time.',
    ],
    subsections: [
      {
        title: 'Ingestion Endpoints',
        items: [
          'POST /v1/ingest/accounts — Push account records (account_id, holder_name, type, currency, IBAN/RIB)',
          'POST /v1/ingest/transactions — Push transaction records (amount, reference, booking/value dates)',
          'POST /v1/ingest/balances — Push balance snapshots (balance_type, credit/debit indicator)',
          'POST /v1/ingest/beneficiaries — Push beneficiary/payee records',
        ],
      },
      {
        title: 'Security Requirements',
        items: [
          'mTLS (Mutual TLS) with X.509 v3 certificates — both client and server authenticate',
          'HMAC-SHA256 payload signing on every request body',
          'Scoped OAuth2 bearer tokens (scope: bank:ingest)',
          'Correlation IDs (X-Correlation-Id header) for end-to-end traceability',
        ],
      },
      {
        title: 'Certificate Setup',
        items: [
          'Generate a CSR (Certificate Signing Request) with your bank\'s distinguished name',
          'Submit CSR via the KOB Admin Portal → Bank Directory → Connectors → Upload Certificate',
          'KOB signs the certificate and returns the signed X.509 v3 PEM',
          'Configure your connector instance with the signed certificate thumbprint',
          'Certificates are valid for 2 years with 30-day renewal reminders',
        ],
      },
    ],
  },
  {
    id: 'db-connector',
    icon: Database,
    title: '3. Database Connector (Legacy Support)',
    subtitle: 'KOB polls bank read-only replicas using watermark-based incremental sync',
    content: [
      'The db_connector mode is designed for legacy core-banking systems that cannot expose REST APIs but can provide read-only database access. KOB connects to the bank\'s read-replica and polls for new or changed records using a watermark column (typically a timestamp or sequence).',
    ],
    subsections: [
      {
        title: 'Supported Databases',
        items: [
          'PostgreSQL 12+ (recommended)',
          'MySQL 8.0+ / MariaDB 10.5+',
          'Microsoft SQL Server 2016+',
          'Oracle Database 12c+',
          'MongoDB 5.0+ (document-based polling)',
        ],
      },
      {
        title: 'Configuration Parameters',
        items: [
          'Host, port, database name, username (read-only credentials)',
          'SSL/TLS mode (required for production)',
          'Watermark column name (e.g., updated_at, sequence_id)',
          'Poll interval (default: 300 seconds / 5 minutes)',
          'Custom poll queries for accounts, transactions, balances, and beneficiaries',
        ],
      },
      {
        title: 'Sync Lifecycle',
        items: [
          'Initial full sync — KOB reads all records with watermark > epoch',
          'Incremental sync — subsequent polls read only records where watermark > last_watermark_value',
          'Watermark value is persisted after each successful sync run',
          'Failed syncs do not advance the watermark, ensuring no data loss',
          'Sync run history is logged with counts (accounts, transactions, balances synced)',
        ],
      },
    ],
  },
  {
    id: 'connector-pull',
    icon: Globe,
    title: '4. API Connector (connector_pull)',
    subtitle: 'KOB calls bank REST APIs using configurable auth methods',
    content: [
      'The connector_pull mode allows KOB to poll the bank\'s existing REST APIs on a scheduled interval. This is ideal for banks that already have internal or partner-facing APIs but cannot implement push-based webhooks.',
    ],
    subsections: [
      {
        title: 'Supported Authentication Methods',
        items: [
          'API Key — passed via header (X-API-Key) or query parameter',
          'OAuth2 — client_credentials or authorization_code grant',
          'Basic Auth — username:password (Base64 encoded)',
          'Bearer Token — static or rotating JWT tokens',
          'mTLS — mutual certificate authentication',
        ],
      },
      {
        title: 'Path Configuration',
        items: [
          'accounts_path — GET endpoint returning account list (e.g., /api/v1/accounts)',
          'transactions_path — GET endpoint returning transactions with date filters',
          'balances_path — GET endpoint returning current balances',
          'health_path — GET endpoint for connectivity health checks',
        ],
      },
    ],
  },
  {
    id: 'file-feed',
    icon: FileText,
    title: '5. File Feed',
    subtitle: 'Async batch processing of CSV and ISO 20022 files',
    content: [
      'The file_feed mode supports banks that generate periodic data exports in CSV or ISO 20022 (pain.001) format. Files can be uploaded via SFTP or through the KOB Admin Portal.',
    ],
    subsections: [
      {
        title: 'Supported Formats',
        items: [
          'CSV with configurable delimiters and column mappings',
          'ISO 20022 pain.001 (Credit Transfer Initiation)',
          'Custom fixed-width formats (with mapping template)',
        ],
      },
      {
        title: 'Processing Pipeline',
        items: [
          'Upload via SFTP or Admin Portal → File Imports tab',
          'SHA-256 hash deduplication prevents reprocessing',
          'Row-level validation with error reporting',
          'Successful records are ingested; failed rows are logged for correction',
          'Status tracking: pending → processing → completed/failed',
        ],
      },
    ],
  },
  {
    id: 'mq-realtime',
    icon: Radio,
    title: '6. Message Queue / Real-Time',
    subtitle: 'Event-driven messaging for sub-second latency',
    content: [
      'The mq_realtime mode enables event-driven data exchange via message queues or webhooks. This provides the lowest latency integration and is ideal for high-volume banks processing thousands of transactions per second.',
    ],
    subsections: [
      {
        title: 'Supported Transports',
        items: [
          'Webhooks — KOB provides HTTPS endpoints for event delivery',
          'Kafka — via Confluent REST Proxy for managed Kafka clusters',
          'RabbitMQ — AMQP 0-9-1 protocol support',
          'Server-Sent Events (SSE) — for lightweight streaming',
        ],
      },
      {
        title: 'Event Types',
        items: [
          'account.created / account.updated',
          'transaction.posted / transaction.pending',
          'balance.updated',
          'beneficiary.added / beneficiary.removed',
        ],
      },
    ],
  },
  {
    id: 'hybrid',
    icon: Layers,
    title: '7. Hybrid Mode',
    subtitle: 'Combining multiple integration modes for optimal coverage',
    content: [
      'The hybrid mode allows banks to use different integration modes for different data types or operational phases. For example, a bank might use file_feed for historical data migration while running mq_realtime for live transaction streaming.',
    ],
    subsections: [
      {
        title: 'Common Hybrid Configurations',
        items: [
          'file_feed (history) + mq_realtime (live events) — onboarding + ongoing',
          'db_connector (accounts/balances) + connector_push (transactions) — mixed legacy/modern',
          'connector_pull (daily reconciliation) + mq_realtime (real-time alerts) — dual-mode',
        ],
      },
    ],
  },
  {
    id: 'sandbox',
    icon: Terminal,
    title: '8. Sandbox Testing',
    subtitle: 'Test your integration in a safe environment before going live',
    content: [
      'KOB provides a full sandbox environment for every integration mode. Sandbox mode simulates responses, generates test data, and validates your integration without affecting production systems.',
    ],
    subsections: [
      {
        title: 'Sandbox Features',
        items: [
          'Auto-generated test bank with sample accounts, transactions, and balances',
          'Simulated webhook delivery with configurable delays and error rates',
          'Sandbox API keys with full audit logging',
          'Test certificate generation for mTLS sandbox testing',
          'One-click seed data for DB Connector testing',
        ],
      },
      {
        title: 'Go-Live Checklist',
        items: [
          'All sandbox tests passing (accounts, transactions, balances ingestion)',
          'mTLS certificate uploaded and validated',
          'HMAC signing verified on all push endpoints',
          'Reconciliation dry-run completed with zero discrepancies',
          'Disaster recovery failover tested',
          'Compliance review approved by KOB team',
        ],
      },
    ],
  },
  {
    id: 'security',
    icon: Shield,
    title: '9. Security & Compliance',
    subtitle: 'Enterprise-grade security for every integration mode',
    content: [
      'All integration modes adhere to KOB\'s security framework, which is aligned with COBAC/BEAC regulations and PCI-DSS requirements.',
    ],
    subsections: [
      {
        title: 'Security Standards',
        items: [
          'mTLS (X.509 v3) mandatory for all production connector_push instances',
          'HMAC-SHA256 payload signing for data integrity verification',
          'Scoped OAuth2 tokens — minimum privilege (bank:ingest, aisp:accounts, pisp:payments)',
          'TLS 1.2+ for all database connections (db_connector)',
          'IP allowlisting available for all integration modes',
          'Correlation IDs for full end-to-end request tracing',
          'Audit logging of all data ingestion events with tamper-proof storage',
        ],
      },
      {
        title: 'Data Protection',
        items: [
          'All data encrypted at rest (AES-256) and in transit (TLS 1.2+)',
          'PII fields are tokenized within the KOB platform',
          'Data retention policies aligned with COBAC regulatory requirements',
          'Right-to-erasure support for GDPR-equivalent compliance',
        ],
      },
    ],
  },
];

const sectionVariant = {
  hidden: { opacity: 0, y: 18, filter: 'blur(4px)' },
  visible: (i: number) => ({
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

/* ─── Component ────────────────────────────────────────────────────── */

const BankIntegrationGuide: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const { exportToPdf } = useRegulatoryPdfExport();

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <Helmet>
        <title>Bank Integration Guide | Kang Open Banking</title>
        <meta name="description" content="Comprehensive technical guide for integrating banks with the KOB v1 API — covering connector_push, db_connector, API pull, file feeds, and real-time messaging." />
      </Helmet>

      {/* ── Hero banner ─────────────────────────────────── */}
      <section className="relative bg-primary overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h20v20H0zM20 20h20v20H20z\' fill=\'%23fff\' fill-opacity=\'.5\'/%3E%3C/svg%3E")' }} />
        <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            <Badge variant="secondary" className="mb-4 bg-white/15 text-white border-white/20 backdrop-blur-sm">
              KOB v1 API · Technical Documentation
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight" style={{ lineHeight: 1.1 }}>
              Bank Integration Guide
            </h1>
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mb-8">
              Complete technical reference for integrating financial institutions with the Kang Open Banking platform — six flexible integration modes for every banking architecture.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                variant="secondary"
                className="gap-2"
                onClick={() => exportAsPdf('guide-content', 'KOB_Bank_Integration_Guide')}
                disabled={isExporting}
              >
                <Download className="h-4 w-4" />
                {isExporting ? 'Generating PDF…' : 'Download PDF'}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid lg:grid-cols-[260px_1fr] gap-10">

          {/* ── Sidebar TOC ──────────────────────────────── */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contents</p>
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    activeSection === s.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <s.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{s.title.replace(/^\d+\.\s*/, '')}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* ── Main content ─────────────────────────────── */}
          <div id="guide-content" className="space-y-12 min-w-0">
            {sections.map((section, i) => (
              <motion.section
                key={section.id}
                id={section.id}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.15 }}
                variants={sectionVariant}
              >
                <Card className="border-border/60">
                  <CardContent className="p-6 md:p-8">
                    {/* Section header */}
                    <div className="flex items-start gap-4 mb-5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <section.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-xl md:text-2xl font-bold text-foreground leading-tight">{section.title}</h2>
                        {section.subtitle && (
                          <p className="text-sm text-muted-foreground mt-1">{section.subtitle}</p>
                        )}
                      </div>
                    </div>

                    {/* Paragraphs */}
                    {section.content.map((p, pi) => (
                      <p key={pi} className="text-sm text-muted-foreground leading-relaxed mb-4">{p}</p>
                    ))}

                    {/* Overview table */}
                    {section.table && (
                      <div className="overflow-x-auto rounded-xl border border-border mt-4 mb-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/40">
                              {section.table.headers.map((h) => (
                                <th key={h} className="px-4 py-3 text-left font-semibold text-foreground">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {section.table.rows.map((row, ri) => (
                              <tr key={ri} className="border-t border-border">
                                {row.map((cell, ci) => (
                                  <td key={ci} className={`px-4 py-3 ${ci === 0 ? 'font-mono text-xs font-medium text-primary' : 'text-muted-foreground'}`}>
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Subsections */}
                    {section.subsections?.map((sub, si) => (
                      <div key={si} className="mt-6">
                        <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                          <ChevronRight className="h-4 w-4 text-primary" />
                          {sub.title}
                        </h3>
                        <ul className="space-y-2 pl-4">
                          {sub.items.map((item, ii) => (
                            <li key={ii} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                              <CheckCircle2 className="h-4 w-4 text-primary/60 shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.section>
            ))}

            {/* ── Contact CTA ──────────────────────────────── */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={sectionVariant}
              custom={sections.length}
            >
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-6 md:p-8 text-center">
                  <Server className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-foreground mb-2">Ready to Integrate?</h3>
                  <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-4">
                    Contact the KOB Integration Team to begin your onboarding process. We'll help you choose the right integration mode and provide sandbox credentials.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button asChild>
                      <a href="/contact">Contact Integration Team</a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a href="/developer/sandbox">Open Sandbox</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BankIntegrationGuide;
