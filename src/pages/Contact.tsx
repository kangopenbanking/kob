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
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";

const CONTACT_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Kang Open Banking",
  "description": "Unified Open Banking API platform for Cameroon and the CEMAC region.",
  "url": "https://kangopenbanking.com",
  "telephone": "+237 6 22 02 25 67",
  "email": "info@kangopenbanking.com",
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "CM",
    "addressLocality": "Douala",
    "addressRegion": "Littoral"
  },
  "areaServed": ["CM", "CF", "TD", "CG", "GA", "GQ"],
  "contactPoint": [
    {
      "@type": "ContactPoint",
      "telephone": "+237 6 22 02 25 67",
      "contactType": "customer support",
      "availableLanguage": ["English", "French"],
      "areaServed": "CM"
    }
  ]
};

export default function Contact() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company_name: "",
    company_size: "",
    phone: "",
    inquiry_type: "",
    integration_timeline: "",
    transaction_volume: "",
    use_cases: [] as string[],
    current_systems: "",
    requirements: "",
    preferred_contact: "",
    budget_range: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.use_cases.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one use case",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('enterprise-contact-submit', {
        body: {
          ...formData,
          source_page: window.location.pathname
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Thank You! 🎉",
          description: `We'll respond within ${data.expected_response_time}. Check your email for confirmation.`,
        });
        
        // Reset form
        setFormData({
          name: "",
          email: "",
          company_name: "",
          company_size: "",
          phone: "",
          inquiry_type: "",
          integration_timeline: "",
          transaction_volume: "",
          use_cases: [],
          current_systems: "",
          requirements: "",
          preferred_contact: "",
          budget_range: "",
        });
      } else {
        throw new Error(data.error || 'Submission failed');
      }
    } catch (error: any) {
      console.error('Form submission error:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again or contact us directly.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
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
        <h2 className="sr-only">Ways to reach our team</h2>
        <section className="grid md:grid-cols-4 gap-6 mb-12" aria-labelledby="contact-channels">
          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <HeadphonesIcon className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">24/7 Support</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Critical issues support
            </p>
            <p className="text-sm font-medium">+237 6 22 02 25 67</p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <Mail className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Email Us</h3>
            <p className="text-sm text-muted-foreground mb-3">
              General inquiries
            </p>
            <p className="text-sm font-medium">info@kangopenbanking.com</p>
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
            <p className="text-sm font-medium">status.kangopenbanking.com</p>
          </Card>
        </section>

        <div className="grid lg:grid-cols-2 gap-12 mb-12">
          {/* Enhanced Enterprise Contact Form */}
          <section>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Enterprise Contact Form
                </CardTitle>
                <CardDescription>
                  Tell us about your needs and we'll get back to you with a tailored solution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Contact Information</h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Full Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                          maxLength={100}
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
                          maxLength={255}
                          placeholder="john@company.com"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="company_name">Company Name *</Label>
                        <Input
                          id="company_name"
                          value={formData.company_name}
                          onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                          required
                          maxLength={200}
                          placeholder="Acme Corporation"
                        />
                      </div>

                      <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+237 6XX XXX XXX"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Company Details */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Company Details</h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="company_size">Company Size *</Label>
                        <Select
                          value={formData.company_size}
                          onValueChange={(value) => setFormData({ ...formData, company_size: value })}
                          required
                        >
                          <SelectTrigger id="company_size">
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1-10">1-10 employees</SelectItem>
                            <SelectItem value="11-50">11-50 employees</SelectItem>
                            <SelectItem value="51-200">51-200 employees</SelectItem>
                            <SelectItem value="201-1000">201-1,000 employees</SelectItem>
                            <SelectItem value="1000+">1,000+ employees</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="transaction_volume">Expected Transaction Volume *</Label>
                        <Select
                          value={formData.transaction_volume}
                          onValueChange={(value) => setFormData({ ...formData, transaction_volume: value })}
                          required
                        >
                          <SelectTrigger id="transaction_volume">
                            <SelectValue placeholder="Select volume" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="< 1K/month">Less than 1K/month</SelectItem>
                            <SelectItem value="1K-10K">1K-10K/month</SelectItem>
                            <SelectItem value="10K-100K">10K-100K/month</SelectItem>
                            <SelectItem value="100K+">100K+/month</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Integration Details */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Integration Details</h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="inquiry_type">Type of Inquiry *</Label>
                        <Select
                          value={formData.inquiry_type}
                          onValueChange={(value) => setFormData({ ...formData, inquiry_type: value })}
                          required
                        >
                          <SelectTrigger id="inquiry_type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Enterprise API Integration">🔥 Enterprise API Integration</SelectItem>
                            <SelectItem value="Strategic Partnership">🔥 Strategic Partnership</SelectItem>
                            <SelectItem value="White-Label Solution">🔥 White-Label Solution</SelectItem>
                            <SelectItem value="Custom Development">Custom Development</SelectItem>
                            <SelectItem value="Technical Support">Technical Support</SelectItem>
                            <SelectItem value="General Inquiry">General Inquiry</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="integration_timeline">Integration Timeline *</Label>
                        <Select
                          value={formData.integration_timeline}
                          onValueChange={(value) => setFormData({ ...formData, integration_timeline: value })}
                          required
                        >
                          <SelectTrigger id="integration_timeline">
                            <SelectValue placeholder="Select timeline" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Immediate">Immediate (ASAP)</SelectItem>
                            <SelectItem value="1-3 months">1-3 months</SelectItem>
                            <SelectItem value="3-6 months">3-6 months</SelectItem>
                            <SelectItem value="6-12 months">6-12 months</SelectItem>
                            <SelectItem value="Exploring">Just Exploring</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="preferred_contact">Preferred Contact Method *</Label>
                        <Select
                          value={formData.preferred_contact}
                          onValueChange={(value) => setFormData({ ...formData, preferred_contact: value })}
                          required
                        >
                          <SelectTrigger id="preferred_contact">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Email">📧 Email</SelectItem>
                            <SelectItem value="Phone">📞 Phone</SelectItem>
                            <SelectItem value="Video Call">🎥 Video Call</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="budget_range">Budget Range (Optional)</Label>
                        <Select
                          value={formData.budget_range}
                          onValueChange={(value) => setFormData({ ...formData, budget_range: value })}
                        >
                          <SelectTrigger id="budget_range">
                            <SelectValue placeholder="Select range" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Confidential">Confidential</SelectItem>
                            <SelectItem value="<$5K">Less than $5,000</SelectItem>
                            <SelectItem value="$5K-$20K">$5,000 - $20,000</SelectItem>
                            <SelectItem value="$20K-$100K">$20,000 - $100,000</SelectItem>
                            <SelectItem value="$100K+">$100,000+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>Use Cases * (Select all that apply)</Label>
                      <div className="grid md:grid-cols-2 gap-3 mt-2">
                        {[
                          'Banking Integration',
                          'Payment Processing',
                          'Credit Scoring',
                          'Loan Management',
                          'Mobile Money',
                          'Custom Solution'
                        ].map((useCase) => (
                          <label key={useCase} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.use_cases.includes(useCase)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    use_cases: [...formData.use_cases, useCase]
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    use_cases: formData.use_cases.filter(uc => uc !== useCase)
                                  });
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{useCase}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="current_systems">Current Systems (Optional)</Label>
                      <Input
                        id="current_systems"
                        value={formData.current_systems}
                        onChange={(e) => setFormData({ ...formData, current_systems: e.target.value })}
                        maxLength={500}
                        placeholder="e.g., Salesforce, SAP, Custom ERP"
                      />
                    </div>

                    <div>
                      <Label htmlFor="requirements">Specific Requirements *</Label>
                      <Textarea
                        id="requirements"
                        value={formData.requirements}
                        onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                        required
                        rows={5}
                        maxLength={2000}
                        placeholder="Tell us about your specific needs, challenges, and what you're looking to achieve..."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {formData.requirements.length}/2000 characters
                      </p>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit Enterprise Inquiry"}
                  </Button>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    By submitting this form, you agree to our Terms of Service and Privacy Policy
                  </p>
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
                      <span>support@kangopenbanking.com</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>+237 6 22 02 25 67</span>
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
                      <span>sales@kangopenbanking.com</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>+237 6 22 02 25 67</span>
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
                      <span>compliance@kangopenbanking.com</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>security@kangopenbanking.com</span>
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
                      <span>billing@kangopenbanking.com</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>+237 6 22 02 25 67</span>
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
                    Bamenda, Cameroon<br />
                    Main Operations & Technical Support
                  </p>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Phone: +237 6 22 02 25 67</p>
                    <p>Email: info@kangopenbanking.com</p>
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
                    <p>Email: international@kangopenbanking.com</p>
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
                <a href="https://status.kangopenbanking.com" target="_blank" rel="noopener">Status Page</a>
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}