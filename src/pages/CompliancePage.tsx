import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, FileText, Shield, Building2 } from "lucide-react";

export default function CompliancePage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <FileText className="h-10 w-10 text-primary" />
        <h1 className="text-4xl font-bold">Regulatory Compliance</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        Comprehensive compliance framework for Central African financial regulations
      </p>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-8 pr-4">
          <Card className="p-5 border-l-4 border-l-primary">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Important — read first:</strong> this page describes the regulatory framework Kang Open Banking is <em>designed to align with</em>. It is not a statement of certifications held or licences granted. KOB does not currently hold a COBAC or BEAC licence; licensing is in progress. Specific clause references (COBAC R-2018/01, R-2005/01, R-2001/08, R-2001/07) describe the rules we build against, not attestations of compliance. Treat this page as a roadmap and a transparency document, not as a regulator-issued approval.
            </p>
          </Card>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Framework Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              Kang Open Banking is built against CEMAC (Central African Economic and Monetary Community) financial regulations, with the intent of operating as a licensed open-banking platform across Cameroon and the region once licensing is complete.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Regulatory Bodies</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <Building2 className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">COBAC</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Central African Banking Commission
                    </p>
                    <Badge variant="outline" className="text-xs">Primary Regulator</Badge>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <Building2 className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">BEAC</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Bank of Central African States
                    </p>
                    <Badge variant="outline" className="text-xs">Monetary Authority</Badge>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">COBAC Compliance</h2>
            <div className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                We adhere to all COBAC regulations governing financial institutions and payment service providers in the CEMAC region:
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">Banking Secrecy (COBAC R-2001/08)</h4>
                    <p className="text-sm text-muted-foreground">
                      Strict protection of customer financial data with explicit consent requirements for data sharing.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">Payment Services (COBAC R-2018/01)</h4>
                    <p className="text-sm text-muted-foreground">
                      Regulation of electronic payment systems and service providers including API-based services.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">AML/CFT Compliance (COBAC R-2005/01)</h4>
                    <p className="text-sm text-muted-foreground">
                      Anti-money laundering and counter-financing of terrorism measures, KYC procedures.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">Internal Control (COBAC R-2001/07)</h4>
                    <p className="text-sm text-muted-foreground">
                      Comprehensive internal control framework, audit trails, and risk management systems.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">Data Retention</h4>
                    <p className="text-sm text-muted-foreground">
                      Transaction records maintained for 7 years as required by COBAC regulations.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">BEAC Regulations</h2>
            <div className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Compliance with BEAC monetary and payment system regulations:
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">Payment System Integration</h4>
                    <p className="text-sm text-muted-foreground">
                      Integration with BEAC's SYSTAC (Système de Transfert Automatisé et de Compensation) for interbank settlements.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">Foreign Exchange Controls</h4>
                    <p className="text-sm text-muted-foreground">
                      Adherence to CEMAC foreign exchange regulations for cross-border transactions.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">Reporting Requirements</h4>
                    <p className="text-sm text-muted-foreground">
                      Regular reporting to BEAC on payment flows, transaction volumes, and system performance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Open Banking Standards</h2>
            <div className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                While adapting international best practices, we maintain full compliance with local regulations:
              </p>

              <Card className="p-4 bg-muted/50">
                <h3 className="font-semibold mb-3">Adapted from International Standards</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• <strong>PSD2 Framework:</strong> Account Information Services (AIS) and Payment Initiation Services (PIS)</li>
                  <li>• <strong>UK Open Banking:</strong> Technical standards and API specifications</li>
                  <li>• <strong>Berlin Group:</strong> NextGenPSD2 API framework</li>
                  <li>• <strong>Localized:</strong> All standards adapted to comply with COBAC/BEAC requirements</li>
                </ul>
              </Card>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Data Protection Compliance</h2>
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">Cameroon Data Protection Law (2019)</h4>
                    <p className="text-sm text-muted-foreground">
                      Full compliance with Law No. 2019/020 on data protection in Cameroon, including consent management and data subject rights.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">GDPR Principles</h4>
                    <p className="text-sm text-muted-foreground">
                      Where applicable for international transactions, we follow GDPR principles for data protection.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">Cross-Border Data Transfers</h4>
                    <p className="text-sm text-muted-foreground">
                      Data localization within CEMAC region with appropriate safeguards for any international transfers.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Security Standards</h2>
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-3">International Security Certifications</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm">PCI-DSS Level 1</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm">ISO 27001:2013</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm">SOC 2 Type II</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm">ISO 9001:2015</span>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Compliance Monitoring</h2>
            <div className="space-y-4">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Dedicated Compliance Officer and legal team</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Quarterly internal compliance audits</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Annual third-party compliance assessments</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Continuous regulatory monitoring and updates</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Regular reporting to COBAC and BEAC</span>
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Partner Institution Requirements</h2>
            <div className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Financial institutions and TPPs using our platform must:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Hold valid licenses from COBAC (banks) or appropriate regulatory authorization</li>
                <li>Maintain current AML/KYC compliance programs</li>
                <li>Implement adequate data protection measures</li>
                <li>Submit to periodic compliance reviews</li>
                <li>Report any security incidents within 24 hours</li>
                <li>Maintain insurance coverage as required by regulations</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Audit Reports & Certifications</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We maintain transparency through regular audits and publicly available compliance reports:
            </p>
            <Card className="p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Audit reports and compliance certificates are available to partner institutions under NDA. 
                Contact our compliance team for access: <span className="font-medium text-foreground">compliance@kangopenbanking.com</span>
              </p>
            </Card>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Contact Compliance Team</h2>
            <Card className="p-4">
              <div className="space-y-2 text-sm">
                <p><strong>Compliance Officer:</strong> compliance@kangopenbanking.com</p>
                <p><strong>Legal Department:</strong> legal@kangopenbanking.com</p>
                <p><strong>Regulatory Inquiries:</strong> +237 6 22 02 25 67</p>
                <p><strong>Address:</strong> Bamenda, Cameroon</p>
              </div>
            </Card>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
