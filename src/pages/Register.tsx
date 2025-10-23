import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link, useNavigate } from "react-router-dom";
import { Building2, ArrowLeft, CheckCircle2, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Register = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [institutionType, setInstitutionType] = useState("");
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

      const { data, error } = await supabase
        .from("institutions")
        .insert([{
          user_id: user.id,
          institution_name: formData.institutionName,
          institution_type: institutionType as any,
          registration_number: formData.registrationNumber,
          address: formData.address,
          phone: formData.phone,
          website: formData.website || null,
          status: "pending" as any,
        }])
        .select()
        .single();

      if (error) throw error;

      // Assign institution role to user
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert([{
          user_id: user.id,
          role: "institution" as any,
        }]);

      if (roleError && roleError.code !== "23505") { // Ignore duplicate key errors
        throw roleError;
      }

      toast({
        title: "Registration Submitted Successfully",
        description: "Your application is pending review. We'll contact you within 2 business days.",
      });

      toast({
        title: "Registration Submitted",
        description: "Your application is pending review. You'll be notified once approved.",
      });

      navigate('/pending-approval');
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "Failed to submit registration. Please try again.",
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
                <SelectItem value="credit_union">Credit Union</SelectItem>
                <SelectItem value="fintech">Fintech Company</SelectItem>
                <SelectItem value="developer">Developer / Third Party</SelectItem>
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
  );
};

export default Register;
