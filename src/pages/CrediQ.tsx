import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Shield, TrendingUp, Bell, Target, Award, Users } from "lucide-react";

export default function CrediQ() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Shield,
      title: "Free Forever",
      description: "No hidden fees, always accessible to everyone in Cameroon"
    },
    {
      icon: TrendingUp,
      title: "Real-Time Updates",
      description: "Your score updates automatically with every financial activity"
    },
    {
      icon: Bell,
      title: "Smart Alerts",
      description: "Get notified when your score changes or opportunities arise"
    },
    {
      icon: Target,
      title: "Personalized Action Plans",
      description: "AI-powered recommendations to improve your creditworthiness"
    },
    {
      icon: Award,
      title: "Better Loan Terms",
      description: "Higher scores unlock lower interest rates and better terms"
    },
    {
      icon: Users,
      title: "Peer Comparison",
      description: "See how you compare with others in your region (anonymous)"
    }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Cameroon Credit Standard (CCS)</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold">
              Know Your{" "}
              <span className="bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
                CrediQ Score
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Your financial identity in Cameroon. Built on Kang Open Banking, 
              CrediQ gives you a real-time credit score that opens doors to better financial opportunities.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg" 
                onClick={() => navigate('/crediq/onboarding')}
                className="text-lg px-8"
              >
                Get Your Free Score
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate('/crediq/info')}
              >
                Learn More
              </Button>
            </div>

            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span>Bank-level security</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span>300-850 scale</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Why CrediQ?
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card key={index} className="p-6 hover:shadow-lg transition-all">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="container mx-auto px-4 py-20 bg-muted/30">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              How It Works
            </h2>
            
            <div className="space-y-8">
              <div className="flex gap-6 items-start">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Answer 10 Simple Questions</h3>
                  <p className="text-muted-foreground">
                    Tell us about your employment, income, and financial goals. Takes just 3 minutes.
                  </p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Get Your Baseline Score</h3>
                  <p className="text-muted-foreground">
                    Instantly receive your CrediQ score (300-850) and personalized action plan.
                  </p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Watch It Grow</h3>
                  <p className="text-muted-foreground">
                    Your score updates automatically as you use Kang Open Banking services—loans, savings, payments.
                  </p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                  4
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Unlock Better Opportunities</h3>
                  <p className="text-muted-foreground">
                    Higher scores mean better loan terms, lower interest rates, and more financial freedom.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-20">
          <Card className="max-w-3xl mx-auto p-12 text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Start Your Credit Journey?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of Cameroonians building their financial future with CrediQ.
            </p>
            <Button 
              size="lg" 
              onClick={() => navigate('/crediq/onboarding')}
              className="text-lg px-8"
            >
              Get Started - It's Free
            </Button>
          </Card>
        </section>
      </div>
    </Layout>
  );
}
