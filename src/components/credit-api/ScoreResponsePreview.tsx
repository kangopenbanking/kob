import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function ScoreResponsePreview() {
  const sampleResponse = {
    user_id: "abc-123-def-456",
    credit_score: 725,
    score_range: "Good (670-739)",
    scoring_model: "blended",
    confidence_level: 0.91,
    risk_category: "medium",
    calculated_at: "2025-01-15T10:30:00Z",
    inquiry_id: "inq_xyz789",
    next_update_date: "2025-02-14",
    external_bureau_used: true
  };

  const fieldDescriptions: Record<string, string> = {
    user_id: "Unique identifier for the user in KOB system",
    credit_score: "Numerical score from 300-850 (higher is better)",
    score_range: "Human-readable interpretation of the score",
    scoring_model: "baseline (internal only) or blended (with NjangiBox)",
    confidence_level: "Statistical confidence in score accuracy (0-1)",
    risk_category: "low, medium, medium-high, or high risk classification",
    calculated_at: "ISO 8601 timestamp of when score was calculated",
    inquiry_id: "Unique ID for this credit inquiry (for audit trail)",
    next_update_date: "When NjangiBox external data will refresh (30-day cache)",
    external_bureau_used: "Whether NjangiBox credit bureau data was included"
  };

  const getScoreColor = (score: number) => {
    if (score >= 740) return "text-green-600";
    if (score >= 670) return "text-blue-600";
    if (score >= 580) return "text-yellow-600";
    return "text-red-600";
  };

  const getRiskBadge = (risk: string) => {
    const colors: Record<string, string> = {
      low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
      medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
      "medium-high": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
      high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
    };
    return colors[risk] || colors.medium;
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Response Data Structure
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          {/* Visual Score Display */}
          <div className="col-span-2 bg-gradient-to-r from-primary/10 to-accent/10 p-6 rounded-lg text-center">
            <div className="text-6xl font-bold mb-2">
              <span className={getScoreColor(sampleResponse.credit_score)}>
                {sampleResponse.credit_score}
              </span>
            </div>
            <div className="text-lg font-semibold mb-2">{sampleResponse.score_range}</div>
            <div className="flex justify-center gap-2">
              <Badge className={getRiskBadge(sampleResponse.risk_category)}>
                {sampleResponse.risk_category.toUpperCase()} RISK
              </Badge>
              <Badge variant="outline">
                {Math.round(sampleResponse.confidence_level * 100)}% Confidence
              </Badge>
              {sampleResponse.external_bureau_used && (
                <Badge variant="secondary">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  NjangiBox Blended
                </Badge>
              )}
            </div>
          </div>

          {/* Field Explanations */}
          <TooltipProvider>
            {Object.entries(sampleResponse).map(([key, value]) => (
              <div key={key} className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-xs font-mono text-primary">{key}</code>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{fieldDescriptions[key]}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-sm font-semibold">
                  {typeof value === "boolean" ? (
                    value ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" /> Yes
                      </span>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" /> No
                      </span>
                    )
                  ) : typeof value === "number" ? (
                    value < 1 && value > 0 ? (
                      `${Math.round(value * 100)}%`
                    ) : (
                      value
                    )
                  ) : (
                    String(value)
                  )}
                </div>
              </div>
            ))}
          </TooltipProvider>
        </div>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <Info className="h-4 w-4" />
            Interpreting the Response
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Use <code className="bg-blue-200 dark:bg-blue-900 px-1 rounded">credit_score</code> for underwriting decisions</li>
            <li>• Check <code className="bg-blue-200 dark:bg-blue-900 px-1 rounded">confidence_level</code> - scores {">"} 0.85 are highly reliable</li>
            <li>• Store <code className="bg-blue-200 dark:bg-blue-900 px-1 rounded">inquiry_id</code> for audit trail and dispute resolution</li>
            <li>• <code className="bg-blue-200 dark:bg-blue-900 px-1 rounded">external_bureau_used</code> = true means 30% NjangiBox data included (more accurate)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
