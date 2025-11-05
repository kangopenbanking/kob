import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertTriangle, Zap, Bug, Plus } from "lucide-react";

export default function Changelog() {
  const releases = [
    {
      version: "1.2.0",
      date: "2025-01-15",
      type: "minor",
      changes: [
        { type: "feature", description: "Added CrediQ credit health monitoring dashboard" },
        { type: "feature", description: "New API Playground for testing public endpoints" },
        { type: "feature", description: "API Catalog with searchable endpoint directory" },
        { type: "improvement", description: "Improved API response times by 30%" },
        { type: "improvement", description: "Enhanced OpenAPI documentation" },
      ]
    },
    {
      version: "1.1.0",
      date: "2025-01-01",
      type: "minor",
      changes: [
        { type: "feature", description: "ISO20022 message parsing and generation" },
        { type: "feature", description: "SWIFT MT103 and MT940 support" },
        { type: "feature", description: "Bulk transfer operations" },
        { type: "improvement", description: "Enhanced OAuth 2.0 flows" },
        { type: "fix", description: "Fixed timezone handling in transaction timestamps" },
      ]
    },
    {
      version: "1.0.5",
      date: "2024-12-15",
      type: "patch",
      changes: [
        { type: "fix", description: "Resolved mobile money webhook delivery issues" },
        { type: "fix", description: "Fixed credit score calculation edge cases" },
        { type: "improvement", description: "Better error messages for failed payments" },
      ]
    },
    {
      version: "1.0.0",
      date: "2024-11-01",
      type: "major",
      changes: [
        { type: "feature", description: "Initial public release" },
        { type: "feature", description: "AISP (Account Information Service)" },
        { type: "feature", description: "PISP (Payment Initiation Service)" },
        { type: "feature", description: "Mobile Money integration (MTN, Orange)" },
        { type: "feature", description: "Credit scoring engine" },
        { type: "feature", description: "OAuth 2.0 authentication" },
      ]
    },
  ];

  const getChangeIcon = (type: string) => {
    switch (type) {
      case "feature": return <Plus className="h-4 w-4 text-green-600" />;
      case "improvement": return <Zap className="h-4 w-4 text-blue-600" />;
      case "fix": return <Bug className="h-4 w-4 text-orange-600" />;
      case "breaking": return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getChangeColor = (type: string) => {
    switch (type) {
      case "feature": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "improvement": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "fix": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "breaking": return "bg-red-500/10 text-red-600 border-red-500/20";
      default: return "bg-muted";
    }
  };

  const getReleaseTypeBadge = (type: string) => {
    switch (type) {
      case "major": return <Badge variant="destructive">Major Release</Badge>;
      case "minor": return <Badge variant="default">Minor Release</Badge>;
      case "patch": return <Badge variant="secondary">Patch</Badge>;
      default: return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">API Changelog</h1>
        <p className="text-xl text-muted-foreground">
          Track new features, improvements, and bug fixes
        </p>
      </div>

      <div className="space-y-8">
        {releases.map((release, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <CardTitle>Version {release.version}</CardTitle>
                  {getReleaseTypeBadge(release.type)}
                </div>
                <Badge variant="outline">{release.date}</Badge>
              </div>
              <CardDescription>
                {release.changes.length} changes in this release
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {release.changes.map((change, changeIndex) => (
                  <div key={changeIndex} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getChangeIcon(change.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={`text-xs ${getChangeColor(change.type)}`}>
                          {change.type}
                        </Badge>
                      </div>
                      <p className="text-sm">{change.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deprecation Notice */}
      <Card className="mt-12 border-yellow-500/20 bg-yellow-500/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <CardTitle className="text-yellow-600">Deprecation Notice</CardTitle>
              <CardDescription className="mt-2">
                No endpoints are currently scheduled for deprecation.
                We maintain backwards compatibility and provide at least 6 months notice before deprecating any features.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
