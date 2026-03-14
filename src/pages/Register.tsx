import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link, useNavigate } from "react-router-dom";
import { Building2, ArrowLeft, CheckCircle2, Shield, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MandatoryPinSetupStep } from "@/components/auth/MandatoryPinSetupStep";

const Register = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [institutionType, setInstitutionType] = useState("");
  const [useKobFlutterwave, setUseKobFlutterwave] = useState(false);
  const [formData, setFormData] = useState({
    institutionName: "",
    registrationNumber: "",
    phone: "",
    website: "",
    address: "",
  });

  useEffect(() => {
    // Check if user is logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast({
          variant: "destructive",
          title: "Authentication Required",
          description: "Please sign in to register your institution",
        });
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!user) {
        throw new Error("You must be signed in to register an institution");
      }

      const { data, error } = await supabase.functions.invoke('institution-register', {
        body: {
          institution_name: formData.institutionName,
          institution_type: institutionType,
          registration_number: formData.registrationNumber,
          address: formData.address,
          phone: formData.phone,
          website: formData.website || null,
          use_kob_flutterwave: useKobFlutterwave,
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Registration Submitted",
        description: "Your application is pending review. You'll be notified once approved.",
      });

      navigate('/pending-approval');
    } catch (error: any) {
      console.error("Registration error:", error);
      
      let errorMessage = "Failed to submit registration. Please try again.";
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Secure Registration • Step {currentStep} of 2</span>
            </div>
            <h1 className="text-5xl font-bold mb-4">
              {currentStep === 1 ? "Select Institution Type" : "Register Your Institution"}
            </h1>
            <p className="text-xl text-muted-foreground">
              {currentStep === 1 
                ? "Choose the category that best describes your organization" 
                : "Join Cameroon's unified banking API platform"}
            </p>
          </div>

          {currentStep === 2 && (
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
          )}

          {/* Step 1: Institution Type Selection */}
          {currentStep === 1 && (
            <div className="grid md:grid-cols-2 gap-6">
              <Card 
                className="border-2 cursor-pointer transition-all hover:border-primary hover:shadow-lg"
                onClick={() => {
                  setInstitutionType("bank");
                  setCurrentStep(2);
                }}
              >
                <CardContent className="pt-8 pb-8">
                  <div className="text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Building2 className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold mb-2">Bank</h3>
                      <p className="text-muted-foreground">
                        Commercial banks, retail banks, and other licensed banking institutions
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="border-2 cursor-pointer transition-all hover:border-primary hover:shadow-lg"
                onClick={() => {
                  setInstitutionType("credit_union");
                  setCurrentStep(2);
                }}
              >
                <CardContent className="pt-8 pb-8">
                  <div className="text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Building2 className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold mb-2">Credit Union</h3>
                      <p className="text-muted-foreground">
                        Member-owned financial cooperatives and credit unions
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="border-2 cursor-pointer transition-all hover:border-primary hover:shadow-lg"
                onClick={() => {
                  setInstitutionType("fintech");
                  setCurrentStep(2);
                }}
              >
                <CardContent className="pt-8 pb-8">
                  <div className="text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Building2 className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold mb-2">Fintech Company</h3>
                      <p className="text-muted-foreground">
                        Digital payment providers, mobile money operators, and fintech startups
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="border-2 cursor-pointer transition-all hover:border-primary hover:shadow-lg"
                onClick={() => {
                  setInstitutionType("developer");
                  setCurrentStep(2);
                }}
              >
                <CardContent className="pt-8 pb-8">
                  <div className="text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Building2 className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold mb-2">Developer / Third Party</h3>
                      <p className="text-muted-foreground">
                        Third-party developers and service providers building on the platform
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Registration Form */}
          {currentStep === 2 && (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-2xl">Institution Details</CardTitle>
                <CardDescription>
                  All fields are required. Your information will be kept confidential and secure.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Institution Type Display */}
                  <div className="space-y-2">
                    <Label>Institution Type</Label>
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                      <Building2 className="h-5 w-5 text-primary" />
                      <span className="font-medium capitalize">
                        {institutionType === "credit_union" ? "Credit Union" : 
                         institutionType === "developer" ? "Developer / Third Party" :
                         institutionType === "fintech" ? "Fintech Company" : "Bank"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        onClick={() => setCurrentStep(1)}
                      >
                        Change
                      </Button>
                    </div>
                  </div>

                {/* Basic Information */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="institutionName">Institution Name *</Label>
                    <Input
                      id="institutionName"
                      placeholder="e.g., Cameroon Commercial Bank"
                      value={formData.institutionName}
                      onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrationNumber">Registration Number *</Label>
                    <Input
                      id="registrationNumber"
                      placeholder="Official registration number"
                      value={formData.registrationNumber}
                      onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Contact Information */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+237 XXX XXX XXX"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website (Optional)</Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://institution.cm"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
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
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                  />
                </div>

                {/* KOB Payment Facilitation Option - Only for Developer/Fintech */}
                {(institutionType === "developer" || institutionType === "fintech") && (
                  <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardContent className="pt-6 pb-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Zap className="h-6 w-6 text-primary" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="text-lg font-bold mb-1">Use KOB Payment Facilitation</h3>
                              <p className="text-sm text-muted-foreground mb-3">
                                Start accepting payments instantly without payment account setup
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="useKobFlutterwave"
                                checked={useKobFlutterwave}
                                onChange={(e) => setUseKobFlutterwave(e.target.checked)}
                                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                              />
                            </div>
                          </div>
                          <ul className="space-y-2 text-sm">
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <span>No payment account setup needed</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <span>Skip KYB verification delays</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <span>Low per-transaction fees</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <span>Automated settlements to your account</span>
                            </li>
                          </ul>
                          <Link to="/payment-facilitation" target="_blank" className="text-sm text-primary hover:underline mt-3 inline-block">
                            Learn more about Payment Facilitation →
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={() => setCurrentStep(1)}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      size="lg"
                      className="flex-1 bg-gradient-to-r from-primary to-primary-light"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Submitting..." : "Submit Application"}
                    </Button>
                  </div>

                  <p className="text-xs text-center text-muted-foreground">
                    By submitting this form, you agree to our Terms of Service and Privacy Policy
                  </p>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
  );
};

export default Register;
