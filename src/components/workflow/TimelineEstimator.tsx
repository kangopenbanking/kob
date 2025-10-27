import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Clock, CheckCircle2 } from "lucide-react";

type InstitutionType = "bank" | "credit-union" | "developer" | "payment-provider";

const timelineData = {
  bank: {
    label: "Bank / Financial Institution",
    weeks: 10,
    phases: [
      { name: "Registration & KYC", weeks: 2 },
      { name: "Technical Integration", weeks: 4 },
      { name: "Compliance Setup", weeks: 2 },
      { name: "Testing & Certification", weeks: 2 },
    ],
  },
  "credit-union": {
    label: "Credit Union / Microfinance",
    weeks: 8,
    phases: [
      { name: "Registration & KYC", weeks: 1 },
      { name: "Technical Integration", weeks: 3 },
      { name: "Compliance Setup", weeks: 2 },
      { name: "Testing & Certification", weeks: 2 },
    ],
  },
  developer: {
    label: "Developer / TPP",
    weeks: 6,
    phases: [
      { name: "Registration & Sandbox Access", weeks: 1 },
      { name: "API Integration", weeks: 3 },
      { name: "Testing", weeks: 1 },
      { name: "Production Approval", weeks: 1 },
    ],
  },
  "payment-provider": {
    label: "Payment Service Provider",
    weeks: 8,
    phases: [
      { name: "Registration & Licensing", weeks: 2 },
      { name: "Payment Integration", weeks: 3 },
      { name: "Compliance & Security", weeks: 2 },
      { name: "Testing & Go-Live", weeks: 1 },
    ],
  },
};

export function TimelineEstimator() {
  const [institutionType, setInstitutionType] = useState<InstitutionType>("bank");
  const timeline = timelineData[institutionType];

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Integration Timeline Estimator
        </CardTitle>
        <CardDescription>
          Select your institution type to see estimated integration timeline
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup
          value={institutionType}
          onValueChange={(value) => setInstitutionType(value as InstitutionType)}
        >
          {Object.entries(timelineData).map(([key, data]) => (
            <div key={key} className="flex items-center space-x-2">
              <RadioGroupItem value={key} id={key} />
              <Label htmlFor={key} className="cursor-pointer">
                {data.label} ({data.weeks} weeks)
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold">Total Timeline</h4>
            <span className="text-2xl font-bold text-primary">
              {timeline.weeks} weeks
            </span>
          </div>

          <div className="space-y-4">
            {timeline.phases.map((phase, index) => {
              const progressPercentage = (phase.weeks / timeline.weeks) * 100;
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="font-medium">{phase.name}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {phase.weeks} {phase.weeks === 1 ? "week" : "weeks"}
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                </div>
              );
            })}
          </div>

          <div className="bg-muted p-4 rounded-lg mt-6">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Timeline estimates are based on typical integration
              scenarios. Actual duration may vary depending on your technical readiness,
              compliance requirements, and resource availability.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
