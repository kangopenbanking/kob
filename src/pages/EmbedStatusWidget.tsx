import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmbeddableStatusWidget } from "@/components/EmbeddableStatusWidget";
import { Layout } from "@/components/Layout";

const EmbedStatusWidget = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">API Status Widget</h1>
          <p className="text-xl text-muted-foreground">
            Embed real-time API status on your website or documentation
          </p>
        </div>

        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Why Use the Status Widget?</CardTitle>
              <CardDescription>
                Build trust and transparency with your users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>Show real-time API health to reduce support inquiries</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>Build developer trust with transparent uptime metrics</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>Lightweight widget that loads in under 100ms</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>Automatic updates every 30 seconds</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>Customizable colors and styling</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <EmbeddableStatusWidget />

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Use Cases</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border">
                <h3 className="font-semibold mb-2">📚 API Documentation</h3>
                <p className="text-sm text-muted-foreground">
                  Add to your docs homepage to show developers that the API is healthy before they start integrating
                </p>
              </div>
              <div className="p-4 rounded-lg border">
                <h3 className="font-semibold mb-2">🏢 Company Website</h3>
                <p className="text-sm text-muted-foreground">
                  Display on your main website or footer to demonstrate reliability to potential customers
                </p>
              </div>
              <div className="p-4 rounded-lg border">
                <h3 className="font-semibold mb-2">📊 Status Page</h3>
                <p className="text-sm text-muted-foreground">
                  Create a dedicated status page for users to check current and historical API performance
                </p>
              </div>
              <div className="p-4 rounded-lg border">
                <h3 className="font-semibold mb-2">💬 Support Portal</h3>
                <p className="text-sm text-muted-foreground">
                  Reduce support tickets by showing status information right in your help center
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default EmbedStatusWidget;
