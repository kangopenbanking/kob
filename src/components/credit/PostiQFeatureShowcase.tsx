import { motion, useAnimation, useInView, useMotionValue, useSpring } from "framer-motion";
import { MapPin, TrendingUp, Zap, Check, X, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";

interface PostiQFeatureShowcaseProps {
  hasVerification: boolean;
  onVerifyClick: () => void;
}

const PostiQFeatureShowcase = ({ hasVerification, onVerifyClick }: PostiQFeatureShowcaseProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [showComparison, setShowComparison] = useState<"what3words" | "postiq">("what3words");
  
  // Animated counter for credit score
  const scoreStart = useMotionValue(650);
  const scoreEnd = useSpring(650, { stiffness: 50, damping: 20 });
  const [displayScore, setDisplayScore] = useState(650);

  useEffect(() => {
    if (isInView) {
      scoreEnd.set(700);
    }
  }, [isInView, scoreEnd]);

  useEffect(() => {
    return scoreEnd.on("change", (latest) => {
      setDisplayScore(Math.round(latest));
    });
  }, [scoreEnd]);

  // Toggle comparison every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setShowComparison(prev => prev === "what3words" ? "postiq" : "what3words");
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div ref={ref} className="w-full py-16 bg-gradient-to-b from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 space-y-12">
        {/* Hero Banner */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-postiq-red-light to-postiq-blue-light rounded-full border border-postiq-blue/20">
            <Award className="w-4 h-4 text-postiq-blue" />
            <span className="text-sm font-semibold bg-gradient-to-r from-postiq-red to-postiq-blue bg-clip-text text-transparent">
              Location Precision Meets Credit Score Excellence
            </span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-postiq-blue via-primary to-postiq-blue bg-clip-text text-transparent">
            PostiQ Code
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            UK-style postcodes for Cameroon. Better addressing, better credit.
          </p>
        </motion.div>

        {/* Animated Comparison Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto"
        >
          {/* what3words Card (Red Theme) */}
          <Card 
            className={`p-6 transition-all duration-500 ${
              showComparison === "what3words" 
                ? "ring-2 ring-postiq-red shadow-lg shadow-postiq-red/20 scale-105" 
                : "opacity-60"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-postiq-red">what3words</h3>
                <div className="w-10 h-10 bg-postiq-red-light rounded-full flex items-center justify-center">
                  <span className="text-postiq-red text-2xl">///</span>
                </div>
              </div>
              
              <div className="bg-postiq-red-light/50 p-3 rounded-lg font-mono text-sm text-postiq-red-dark">
                ///filled.count.soap
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2 text-muted-foreground">
                  <X className="w-4 h-4 text-postiq-red mt-0.5 shrink-0" />
                  <span>Random word combinations</span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <X className="w-4 h-4 text-postiq-red mt-0.5 shrink-0" />
                  <span>No hierarchical structure</span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <X className="w-4 h-4 text-postiq-red mt-0.5 shrink-0" />
                  <span>No credit score benefit</span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <X className="w-4 h-4 text-postiq-red mt-0.5 shrink-0" />
                  <span>Complex to remember</span>
                </div>
              </div>
            </div>
          </Card>

          {/* PostiQ Code Card (Blue Theme) */}
          <Card 
            className={`p-6 transition-all duration-500 ${
              showComparison === "postiq" 
                ? "ring-2 ring-postiq-blue shadow-lg shadow-postiq-blue/20 scale-105" 
                : "opacity-60"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-postiq-blue">PostiQ Code</h3>
                <div className="w-10 h-10 bg-postiq-blue-light rounded-full flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-postiq-blue" />
                </div>
              </div>
              
              <div className="bg-postiq-blue-light/50 p-3 rounded-lg font-mono text-sm text-postiq-blue-dark font-bold">
                YA01 456
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Check className="w-4 h-4 text-postiq-blue mt-0.5 shrink-0" />
                  <span>UK-style hierarchical format</span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Check className="w-4 h-4 text-postiq-blue mt-0.5 shrink-0" />
                  <span>Region-based structure (AA## ###)</span>
                </div>
                <div className="flex items-start gap-2 font-semibold text-postiq-blue">
                  <Check className="w-4 h-4 text-postiq-blue mt-0.5 shrink-0" />
                  <span>+50 Credit Score Boost 🎉</span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Check className="w-4 h-4 text-postiq-blue mt-0.5 shrink-0" />
                  <span>Simple, memorable codes</span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Benefits Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
        >
          <Card className="p-6 text-center space-y-3 bg-gradient-to-br from-postiq-blue-light to-background border-postiq-blue/20">
            <div className="w-12 h-12 bg-postiq-blue/10 rounded-full flex items-center justify-center mx-auto">
              <MapPin className="w-6 h-6 text-postiq-blue" />
            </div>
            <h4 className="font-bold text-postiq-blue">Location Precision</h4>
            <p className="text-sm text-muted-foreground">~500m radius coverage area</p>
          </Card>

          <Card className="p-6 text-center space-y-3 bg-gradient-to-br from-crediq-green/10 to-background border-crediq-green/20">
            <div className="w-12 h-12 bg-crediq-green/10 rounded-full flex items-center justify-center mx-auto">
              <TrendingUp className="w-6 h-6 text-crediq-green" />
            </div>
            <h4 className="font-bold text-crediq-green">Credit Boost</h4>
            <p className="text-sm text-muted-foreground">Instant +50 points added</p>
          </Card>

          <Card className="p-6 text-center space-y-3 bg-gradient-to-br from-postiq-red-light to-background border-postiq-red/20">
            <div className="w-12 h-12 bg-postiq-red/10 rounded-full flex items-center justify-center mx-auto">
              <Zap className="w-6 h-6 text-postiq-red" />
            </div>
            <h4 className="font-bold text-postiq-red">Instant Verification</h4>
            <p className="text-sm text-muted-foreground">GPS-based, takes seconds</p>
          </Card>
        </motion.div>

        {/* Credit Score Impact Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Card className="p-8 max-w-3xl mx-auto bg-gradient-to-br from-muted/50 to-background">
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-2">Credit Score Impact</h3>
                <p className="text-muted-foreground">Watch your score improve instantly</p>
              </div>

              <div className="flex items-center justify-center gap-8">
                {/* Before Score */}
                <div className="text-center space-y-2">
                  <div className="text-sm text-muted-foreground font-medium">Before</div>
                  <div className="text-5xl font-bold text-crediq-fair">650</div>
                  <div className="text-xs text-muted-foreground">Fair</div>
                </div>

                {/* Animated Arrow */}
                <motion.div
                  animate={{ 
                    x: [0, 10, 0],
                    scale: [1, 1.2, 1]
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="text-postiq-blue"
                >
                  <svg width="60" height="40" viewBox="0 0 60 40" fill="none">
                    <path 
                      d="M5 20 L50 20 M50 20 L40 10 M50 20 L40 30" 
                      stroke="currentColor" 
                      strokeWidth="3" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.div>

                {/* After Score */}
                <div className="text-center space-y-2">
                  <div className="text-sm text-muted-foreground font-medium">After</div>
                  <motion.div 
                    className="text-5xl font-bold text-crediq-good"
                    animate={{ scale: isInView ? [1, 1.1, 1] : 1 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                  >
                    {displayScore}
                  </motion.div>
                  <div className="text-xs text-muted-foreground">Good</div>
                </div>
              </div>

              {/* Boost Badge */}
              <motion.div
                animate={{ 
                  scale: [1, 1.05, 1],
                  opacity: [0.8, 1, 0.8]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-crediq-green/20 to-postiq-blue/20 rounded-full border border-crediq-green/30 mx-auto w-fit"
              >
                <TrendingUp className="w-5 h-5 text-crediq-green" />
                <span className="font-bold text-crediq-green text-lg">+50 Points</span>
              </motion.div>

              {/* CTA Button */}
              {!hasVerification && (
                <div className="text-center pt-4">
                  <Button 
                    size="lg" 
                    onClick={onVerifyClick}
                    className="bg-gradient-to-r from-postiq-blue to-primary hover:from-postiq-blue-dark hover:to-primary-dark"
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    Verify Your Address Now
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Free verification • Instant boost • 5 per day
                  </p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Trust Indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-postiq-blue rounded-full" />
            <span>UK-Style Format</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-crediq-green rounded-full" />
            <span>Credit Score Verified</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full" />
            <span>Cameroon Postal Integrated</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PostiQFeatureShowcase;
