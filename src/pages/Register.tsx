import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import { Building2, ArrowLeft, CheckCircle2, Shield } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const Register = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [institutionType, setInstitutionType] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      toast({
        title: "Registration Submitted",
        description: "We'll review your application and contact you within 2 business days.",
      });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-primary">Kang Open Banking</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Secure Registration</span>
            </div>
            <h1 className="text-5xl font-bold mb-4">Register Your Institution</h1>
            <p className="text-xl text-muted-foreground">
              Join Cameroon's unified banking API platform
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="border-2">
              <CardContent className="pt-6 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-primary">1</span>
                </div>
                <h3 className="font-semibold mb-2">Submit Application</h3>
                <p className="text-sm text-muted-foreground">Complete the registration form</p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="pt-6 text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-primary">2</span>
                </div>
                <h3 className="font-semibold mb-2">Verification</h3>
                <p className="text-sm text-muted-foreground">We verify your institution details</p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="pt-6 text-center">
                <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold mb-2">Get API Access</h3>
                <p className="text-sm text-muted-foreground">Receive your API credentials</p>
              </CardContent>
            </Card>
          </div>

          {/* Registration Form */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-2xl">Institution Details</CardTitle>
              <CardDescription>
                All fields are required. Your information will be kept confidential and secure.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Institution Type */}
                <div className="space-y-2">
                  <Label htmlFor="institutionType">Institution Type *</Label>
                  <Select value={institutionType} onValueChange={setInstitutionType} required>
                    <SelectTrigger id="institutionType">
                      <SelectValue placeholder="Select institution type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="credit-union">Credit Union</SelectItem>
                      <SelectItem value="fintech">Fintech Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Basic Information */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="institutionName">Institution Name *</Label>
                    <Input
                      id="institutionName"
                      placeholder="e.g., Cameroon Commercial Bank"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrationNumber">Registration Number *</Label>
                    <Input
                      id="registrationNumber"
                      placeholder="Official registration number"
                      required
                    />
                  </div>
                </div>

                {/* Contact Information */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Official Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="contact@institution.cm"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+237 XXX XXX XXX"
                      required
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="address">Physical Address *</Label>
                  <Textarea
                    id="address"
                    placeholder="Complete physical address in Cameroon"
                    rows={3}
                    required
                  />
                </div>

                {/* Technical Contact */}
                <div className="border-t pt-6">
                  <h3 className="font-semibold text-lg mb-4">Technical Contact Person</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="techName">Full Name *</Label>
                      <Input
                        id="techName"
                        placeholder="Technical lead name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="techEmail">Email *</Label>
                      <Input
                        id="techEmail"
                        type="email"
                        placeholder="tech@institution.cm"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="techPhone">Phone *</Label>
                      <Input
                        id="techPhone"
                        type="tel"
                        placeholder="+237 XXX XXX XXX"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="techRole">Role/Position *</Label>
                      <Input
                        id="techRole"
                        placeholder="e.g., CTO, IT Manager"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Business Details */}
                <div className="border-t pt-6">
                  <h3 className="font-semibold text-lg mb-4">Business Information</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="services">Services Offered</Label>
                      <Textarea
                        id="services"
                        placeholder="Describe the financial services your institution provides"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apiUsage">Intended API Usage</Label>
                      <Textarea
                        id="apiUsage"
                        placeholder="How do you plan to use Kang Open Banking API?"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                {/* Compliance */}
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-accent mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold mb-1">Regulatory Compliance</p>
                      <p className="text-muted-foreground">
                        By submitting this form, you confirm that your institution is properly licensed 
                        and complies with all relevant financial regulations in Cameroon.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-4 pt-4">
                  <Button
                    type="submit"
                    size="lg"
                    className="flex-1 bg-gradient-to-r from-primary to-primary-light"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Submitting..." : "Submit Application"}
                  </Button>
                  <Link to="/" className="flex-1">
                    <Button type="button" variant="outline" size="lg" className="w-full">
                      Cancel
                    </Button>
                  </Link>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  By submitting this form, you agree to our Terms of Service and Privacy Policy
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Register;
