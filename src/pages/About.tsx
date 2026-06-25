import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Globe, TrendingUp, Building2, Code, Zap, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function About() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-5xl mx-auto">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <Badge variant="outline" className="mb-4">About Us</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Transforming Banking Across Central Africa
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Kang Open Banking is Cameroon's premier unified banking API platform, pioneering secure and compliant financial data access across the CEMAC region.
          </p>
        </section>

        {/* Mission & Vision */}
        <section className="mb-16">
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-8">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="h-8 w-8 text-primary" />
                <h2 className="text-2xl font-bold">Our Mission</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                To democratize access to financial services by providing a secure, reliable, and compliant API infrastructure that enables innovation in the fintech ecosystem. We empower developers, financial institutions, and businesses to build next-generation financial applications that serve the needs of millions across Central Africa.
              </p>
            </Card>

            <Card className="p-8">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="h-8 w-8 text-primary" />
                <h2 className="text-2xl font-bold">Our Vision</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                To become the leading open banking platform in Central Africa, setting the standard for financial innovation, security, and regulatory compliance. We envision a future where every fintech, enterprise, and developer can seamlessly integrate with the region's financial infrastructure.
              </p>
            </Card>
          </div>
        </section>

        {/* What is Open Banking */}
        <section className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">What is Open Banking?</h2>
            <p className="text-muted-foreground max-w-3xl mx-auto">
              Understanding the technology that's reshaping financial services
            </p>
          </div>
          <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10">
            <p className="text-lg leading-relaxed mb-6">
              Open Banking is a secure way for you to give trusted third-party providers access to your financial information. It uses Application Programming Interfaces (APIs) that enable banks, credit unions, and mobile money operators to share your data with authorized fintech companies—with your explicit permission.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <Shield className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-2">Secure by Design</h3>
                <p className="text-sm text-muted-foreground">
                  Bank-grade security with OAuth 2.0, encryption, and regulatory oversight
                </p>
              </div>
              <div>
                <Users className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-2">User Control</h3>
                <p className="text-sm text-muted-foreground">
                  You decide which apps access your data and can revoke access anytime
                </p>
              </div>
              <div>
                <Code className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-2">Innovation Enabler</h3>
                <p className="text-sm text-muted-foreground">
                  Developers build better financial tools using real banking data
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* Our Story */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Our Story</h2>
          <Card className="p-8">
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                Founded in 2021, Kang Open Banking emerged from a vision to bridge the gap between traditional financial institutions and the rapidly growing fintech sector in Central Africa. Our founders recognized that the lack of standardized APIs was stifling innovation and limiting financial inclusion across the region.
              </p>
              <p>
                What started as a small team of passionate developers and banking professionals has grown into Cameroon's most trusted open banking platform. Today, we connect over 25 financial institutions with hundreds of developers and businesses, processing over 1 million API calls daily.
              </p>
              <p>
                Our journey has been guided by three core principles: security first, regulatory alignment, and developer experience. We engage with COBAC (Central African Banking Commission) and BEAC (Bank of Central African States) requirements as we work through licensing, and we build to those standards today while keeping the platform accessible to developers of all skill levels. Nothing on this page should be read as a claim that KOB currently holds a COBAC or BEAC licence.
              </p>
            </div>
          </Card>
        </section>

        {/* Our Values */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Our Core Values</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6">
              <Shield className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-3">Security & Trust</h3>
              <p className="text-muted-foreground">
                We treat your data with the highest level of security. The platform is built to PCI-DSS and ISO 27001 control objectives, with 24/7 monitoring; formal third-party certifications are tracked separately and are not claimed here unless individually evidenced.
              </p>
            </Card>

            <Card className="p-6">
              <Users className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-3">Customer First</h3>
              <p className="text-muted-foreground">
                Every decision we make puts our users first. From intuitive documentation to responsive support, we're committed to making open banking accessible to everyone.
              </p>
            </Card>

            <Card className="p-6">
              <Globe className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-3">Innovation</h3>
              <p className="text-muted-foreground">
                We continuously evolve our platform with the latest technologies and standards, enabling developers to build cutting-edge financial applications.
              </p>
            </Card>

            <Card className="p-6">
              <Heart className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-3">Financial Inclusion</h3>
              <p className="text-muted-foreground">
                We believe everyone deserves access to modern financial services. Our platform bridges the gap between traditional banking and underserved communities.
              </p>
            </Card>
          </div>
        </section>

        {/* By the Numbers */}
        <section className="mb-16 bg-primary text-primary-foreground rounded-lg p-12">
          <h2 className="text-3xl font-bold mb-8 text-center">Kang Open Banking by the Numbers</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">25+</div>
              <div className="text-sm opacity-90">Financial Institutions</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">1M+</div>
              <div className="text-sm opacity-90">Daily API Calls</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">500+</div>
              <div className="text-sm opacity-90">Developer Partners</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">99.9%</div>
              <div className="text-sm opacity-90">Uptime SLA</div>
            </div>
          </div>
        </section>

        {/* Team & Company */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Leadership & Expertise</h2>
          <Card className="p-8">
            <div className="space-y-6">
              <p className="text-muted-foreground leading-relaxed">
                Our team combines decades of experience in banking, fintech, software engineering, and regulatory compliance. We bring together experts from leading financial institutions, technology companies, and regulatory bodies to build a platform that serves the entire ecosystem.
              </p>
              <div className="grid md:grid-cols-3 gap-6 mt-8">
                <div className="text-center">
                  <Building2 className="h-12 w-12 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Banking Experts</h3>
                  <p className="text-sm text-muted-foreground">
                    Former executives from major Central African banks
                  </p>
                </div>
                <div className="text-center">
                  <Code className="h-12 w-12 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Tech Leaders</h3>
                  <p className="text-sm text-muted-foreground">
                    Engineers from top global tech companies
                  </p>
                </div>
                <div className="text-center">
                  <Shield className="h-12 w-12 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Compliance Specialists</h3>
                  <p className="text-sm text-muted-foreground">
                    Regulatory experts working toward COBAC/BEAC licensing
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Regulatory Framework */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Regulatory Framework</h2>
          <Card className="p-5 mb-6 border-l-4 border-l-primary">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Important:</strong> the items listed below describe the regulations and control frameworks Kang Open Banking is designed against. They are not statements that KOB currently holds a COBAC licence, a BEAC licence, PCI-DSS attestation, ISO 27001 certification, or a SOC 2 report. Licensing and certification programmes are in progress and will be evidenced individually when complete.
            </p>
          </Card>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4">Designed for COBAC alignment</h3>
              <p className="text-muted-foreground mb-4">
                Designed against the Central African Banking Commission regulations governing payment services, data protection, and financial infrastructure. Licence application in progress.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• COBAC R-2018/01 (Payment Services)</li>
                <li>• COBAC R-2005/01 (AML/CFT)</li>
                <li>• COBAC R-2001/08 (Banking Secrecy)</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4">International standards we build against</h3>
              <p className="text-muted-foreground mb-4">
                The platform is built against the following international security and compliance standards. Where a certification is not yet held, it is listed as a target, not a claim.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• PCI-DSS controls (raw card data handled by tokenisation partner; KOB out of SAQ-D scope)</li>
                <li>• ISO 27001:2013 control objectives (certification: planned)</li>
                <li>• SOC 2 Type II (report: planned)</li>
              </ul>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center">
          <Card className="p-12 bg-gradient-to-br from-primary/10 to-primary/5">
            <h2 className="text-3xl font-bold mb-4">Join the Open Banking Revolution</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Whether you're a financial institution, fintech startup, or enterprise developer, we're here to help you succeed.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button size="lg">Get Started</Button>
              </Link>
              <Link to="/contact">
                <Button size="lg" variant="outline">Contact Us</Button>
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}