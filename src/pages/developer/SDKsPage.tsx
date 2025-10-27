import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Code, CheckCircle2, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function SDKsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">SDKs & Libraries</h1>
        <p className="text-xl text-muted-foreground">
          Official SDKs for popular programming languages and frameworks
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          All SDKs are open source and available on GitHub. Contributions are welcome!
        </AlertDescription>
      </Alert>

      {/* Official SDKs */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Official SDKs</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* JavaScript/TypeScript SDK */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <Code className="h-8 w-8 text-primary" />
                <Badge>Official</Badge>
              </div>
              <CardTitle>JavaScript / TypeScript</CardTitle>
              <CardDescription>Full-featured SDK for Node.js and browser environments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Promise-based API</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>TypeScript support</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Automatic token refresh</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Webhook signature verification</span>
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded font-mono text-sm">
                npm install @kob/sdk
              </div>

              <div className="flex gap-2">
                <Button className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Install
                </Button>
                <Button variant="outline">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  GitHub
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                Version 1.0.0 • Updated 2 days ago
              </div>
            </CardContent>
          </Card>

          {/* Python SDK */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <Code className="h-8 w-8 text-primary" />
                <Badge>Official</Badge>
              </div>
              <CardTitle>Python</CardTitle>
              <CardDescription>Pythonic SDK with async support</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Sync & async support</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Type hints</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Pagination helpers</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Django/Flask integration</span>
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded font-mono text-sm">
                pip install kob-sdk
              </div>

              <div className="flex gap-2">
                <Button className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Install
                </Button>
                <Button variant="outline">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  GitHub
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                Version 1.0.0 • Updated 5 days ago
              </div>
            </CardContent>
          </Card>

          {/* PHP SDK */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <Code className="h-8 w-8 text-primary" />
                <Badge>Official</Badge>
              </div>
              <CardTitle>PHP</CardTitle>
              <CardDescription>Composer package for PHP applications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>PSR-7 compatible</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Laravel integration</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Guzzle HTTP client</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Webhook verification</span>
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded font-mono text-sm">
                composer require kob/sdk
              </div>

              <div className="flex gap-2">
                <Button className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Install
                </Button>
                <Button variant="outline">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  GitHub
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                Version 1.0.0 • Updated 1 week ago
              </div>
            </CardContent>
          </Card>

          {/* Java SDK */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <Code className="h-8 w-8 text-primary" />
                <Badge>Official</Badge>
              </div>
              <CardTitle>Java</CardTitle>
              <CardDescription>Maven/Gradle library for Java applications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Java 11+ support</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Spring Boot integration</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Reactive support</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Comprehensive javadocs</span>
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded font-mono text-sm">
                {"<dependency>"}
                <br />
                {"  <groupId>com.kob</groupId>"}
                <br />
                {"  <artifactId>kob-sdk</artifactId>"}
                <br />
                {"</dependency>"}
              </div>

              <div className="flex gap-2">
                <Button className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Install
                </Button>
                <Button variant="outline">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  GitHub
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                Version 1.0.0 • Updated 1 week ago
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile SDKs */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Mobile SDKs</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* iOS SDK */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <Code className="h-8 w-8 text-primary" />
                <Badge>Official</Badge>
              </div>
              <CardTitle>iOS (Swift)</CardTitle>
              <CardDescription>Native iOS SDK with SwiftUI support</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Swift Package Manager</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Async/await support</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Keychain integration</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Biometric authentication</span>
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded font-mono text-sm">
                https://github.com/kob/ios-sdk
              </div>

              <div className="flex gap-2">
                <Button className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Documentation
                </Button>
                <Button variant="outline">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  GitHub
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                Version 1.0.0 • iOS 14+
              </div>
            </CardContent>
          </Card>

          {/* Android SDK */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <Code className="h-8 w-8 text-primary" />
                <Badge>Official</Badge>
              </div>
              <CardTitle>Android (Kotlin)</CardTitle>
              <CardDescription>Native Android SDK with Jetpack Compose</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Kotlin coroutines</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Jetpack Compose UI</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Encrypted storage</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Biometric prompts</span>
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded font-mono text-sm">
                implementation 'com.kob:android-sdk:1.0.0'
              </div>

              <div className="flex gap-2">
                <Button className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Documentation
                </Button>
                <Button variant="outline">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  GitHub
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                Version 1.0.0 • API 24+
              </div>
            </CardContent>
          </Card>

          {/* React Native SDK */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <Code className="h-8 w-8 text-primary" />
                <Badge>Official</Badge>
              </div>
              <CardTitle>React Native</CardTitle>
              <CardDescription>Cross-platform SDK for React Native apps</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>iOS & Android support</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>TypeScript definitions</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Secure storage</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Biometric authentication</span>
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded font-mono text-sm">
                npm install @kob/react-native
              </div>

              <div className="flex gap-2">
                <Button className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Install
                </Button>
                <Button variant="outline">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  GitHub
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                Version 1.0.0 • RN 0.70+
              </div>
            </CardContent>
          </Card>

          {/* Flutter SDK */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <Code className="h-8 w-8 text-primary" />
                <Badge>Official</Badge>
              </div>
              <CardTitle>Flutter</CardTitle>
              <CardDescription>Dart package for Flutter applications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Null safety</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Material & Cupertino widgets</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Secure storage plugin</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Local authentication</span>
                </div>
              </div>
              
              <div className="bg-muted p-3 rounded font-mono text-sm">
                kob_sdk: ^1.0.0
              </div>

              <div className="flex gap-2">
                <Button className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  pub.dev
                </Button>
                <Button variant="outline">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  GitHub
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                Version 1.0.0 • Flutter 3.0+
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Support */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle>SDK Support & Contributions</CardTitle>
          <CardDescription>Get help and contribute to our SDKs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="font-semibold mb-1">Need Help?</p>
            <p className="text-sm text-muted-foreground">
              Join our Discord community or open an issue on GitHub for SDK support.
            </p>
          </div>
          <div>
            <p className="font-semibold mb-1">Want to Contribute?</p>
            <p className="text-sm text-muted-foreground">
              All SDKs are open source. Contributions, bug reports, and feature requests are welcome!
            </p>
          </div>
          <div>
            <p className="font-semibold mb-1">Missing Your Language?</p>
            <p className="text-sm text-muted-foreground">
              Let us know which SDK you'd like to see next, or build your own using our API documentation.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
