import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  HeadphonesIcon, 
  MessageSquare, 
  Building2,
  Shield,
  Code,
  FileText,
  Globe
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Contact() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    inquiryType: "",
    message: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Message Sent",
      description: "We'll get back to you within 24 hours.",
    });
    setFormData({ name: "", email: "", company: "", inquiryType: "", message: "" });
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <section className="text-center mb-12">
          <Badge variant="outline" className="mb-4">Contact Us</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Get in Touch</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Our team is here to help with your integration, answer questions, or discuss partnership opportunities.
          </p>
        </section>

        {/* Quick Contact Cards */}
        <section className="grid md:grid-cols-4 gap-6 mb-12">
          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <HeadphonesIcon className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">24/7 Support</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Critical issues support
            </p>
            <p className="text-sm font-medium">+237 233 XX XX XX</p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <Mail className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Email Us</h3>
            <p className="text-sm text-muted-foreground mb-3">
              General inquiries
            </p>
            <p className="text-sm font-medium">info@kangopenbanking.cm</p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <MessageSquare className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Live Chat</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Mon-Fri, 8AM-6PM WAT
            </p>
            <Button variant="outline" size="sm">Start Chat</Button>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <Globe className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Status Page</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Service health
            </p>
            <p className="text-sm font-medium">status.kangopenbanking.cm</p>
          </Card>
        </section>

        <div className="grid lg:grid-cols-2 gap-12 mb-12">
          {/* Contact Form */}
          <section>
            <Card>
              <CardHeader>
                <CardTitle>Send Us a Message</CardTitle>
                <CardDescription>
                  Fill out the form below and our team will respond within 24 hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      placeholder="john@company.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="company">Company / Organization</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Your Company Ltd"
                    />
                  </div>

                  <div>
                    <Label htmlFor="inquiryType">Type of Inquiry *</Label>
                    <Select
                      value={formData.inquiryType}
                      onValueChange={(value) => setFormData({ ...formData, inquiryType: value })}
                      required
                    >
                      <SelectTrigger id="inquiryType">
                        <SelectValue placeholder="Select inquiry type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technical">Technical Support</SelectItem>
                        <SelectItem value="sales">Sales & Partnerships</SelectItem>
                        <SelectItem value="integration">Integration Help</SelectItem>
                        <SelectItem value="compliance">Compliance & Legal</SelectItem>
                        <SelectItem value="billing">Billing & Accounts</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      required
                      rows={6}
                      placeholder="Tell us how we can help..."
                    />
                  </div>

                  <Button type="submit" className="w-full">Send Message</Button>
                </form>
              </CardContent>
            </Card>
          </section>

          {/* Department Contacts */}
          <section className="space-y-6">
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <Code className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Technical Support</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    API integration help, debugging, and technical documentation
                  </p>
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>support@kangopenbanking.cm</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>+237 233 XX XX XX</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>24/7 for critical issues</span>
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start gap-4">
                <Building2 className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Sales & Partnerships</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Enterprise pricing, strategic partnerships, and custom solutions
                  </p>
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>sales@kangopenbanking.cm</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>+237 233 XX XX XX</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Mon-Fri, 8AM-6PM WAT</span>
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start gap-4">
                <Shield className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Compliance & Security</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Regulatory questions, security reports, and data protection
                  </p>
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>compliance@kangopenbanking.cm</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>security@kangopenbanking.cm</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Mon-Fri, 8AM-6PM WAT</span>
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start gap-4">
                <FileText className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Billing & Accounts</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Invoicing, payments, subscription management
                  </p>
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>billing@kangopenbanking.cm</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>+237 233 XX XX XX</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Mon-Fri, 8AM-6PM WAT</span>
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </section>
        </div>

        {/* Office Locations */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-8 text-center">Our Offices</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <MapPin className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">Cameroon Headquarters</h3>
                  <p className="text-muted-foreground mb-4">
                    Douala, Cameroon<br />
                    Main Operations & Technical Support
                  </p>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Phone: +237 233 XX XX XX</p>
                    <p>Email: info@kangopenbanking.cm</p>
                    <p>Hours: Mon-Fri, 8AM-6PM WAT</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start gap-4">
                <MapPin className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">Canada Office</h3>
                  <p className="text-muted-foreground mb-4">
                    Port Dover, ON, Canada<br />
                    International Operations
                  </p>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Reg. No: 1381210-3 (CBCA)</p>
                    <p>Email: international@kangopenbanking.cm</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* FAQ Quick Links */}
        <section>
          <Card className="p-8 bg-gradient-to-br from-primary/10 to-primary/5">
            <h2 className="text-2xl font-bold mb-4 text-center">Before You Reach Out</h2>
            <p className="text-center text-muted-foreground mb-6">
              You might find your answer faster in our comprehensive documentation
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button variant="outline" asChild>
                <a href="/documentation">Documentation</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/faq">FAQ</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/guides/security">Security Guide</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="https://status.kangopenbanking.cm" target="_blank" rel="noopener">Status Page</a>
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}