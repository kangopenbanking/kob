import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SystemStatus {
  status: "operational" | "degraded" | "down";
  responseTime: number;
  uptime: number;
  lastChecked: string;
}

export const EmbeddableStatusWidget = () => {
  const [status, setStatus] = useState<SystemStatus>({
    status: "operational",
    responseTime: 0,
    uptime: 99.9,
    lastChecked: new Date().toISOString()
  });
  const [embedCode, setEmbedCode] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check API health with retry logic
    const checkHealth = async (attemptNumber = 0) => {
      const startTime = Date.now();
      setIsRetrying(attemptNumber > 0);
      
      try {
        const response = await fetch("https://api.kangopenbanking.com/v1/api-health");
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        if (response.ok) {
          setStatus({
            status: "operational",
            responseTime,
            uptime: 99.9,
            lastChecked: new Date().toISOString()
          });
          setRetryCount(0);
          setIsRetrying(false);
        } else {
          if (attemptNumber < 3) {
            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, attemptNumber) * 1000;
            setTimeout(() => checkHealth(attemptNumber + 1), delay);
            setRetryCount(attemptNumber + 1);
          } else {
            setStatus({
              status: "degraded",
              responseTime,
              uptime: 99.5,
              lastChecked: new Date().toISOString()
            });
            setRetryCount(0);
            setIsRetrying(false);
          }
        }
      } catch (error) {
        if (attemptNumber < 3) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attemptNumber) * 1000;
          setTimeout(() => checkHealth(attemptNumber + 1), delay);
          setRetryCount(attemptNumber + 1);
        } else {
          setStatus({
            status: "down",
            responseTime: 0,
            uptime: 0,
            lastChecked: new Date().toISOString()
          });
          setRetryCount(0);
          setIsRetrying(false);
        }
      }
    };

    checkHealth();
    const interval = setInterval(() => checkHealth(), 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Generate embed code with production domain
    const widgetUrl = "https://kangopenbanking.com/status-widget";
    const iframeCode = `<iframe src="${widgetUrl}" width="300" height="200" frameborder="0" style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"></iframe>`;
    const scriptCode = `<div id="kang-status"></div>\n<script src="https://kangopenbanking.com/status-widget.js"></script>`;
    
    setEmbedCode(iframeCode);
  }, []);

  const getStatusIcon = () => {
    switch (status.status) {
      case "operational":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "degraded":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case "down":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusBadge = () => {
    switch (status.status) {
      case "operational":
        return <Badge className="bg-green-500">All Systems Operational</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-500">Degraded Performance</Badge>;
      case "down":
        return <Badge className="bg-red-500">Service Disruption</Badge>;
    }
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(embedCode);
    toast({
      title: "Copied!",
      description: "Embed code copied to clipboard",
    });
  };

  return (
    <div className="space-y-6">
      {/* Live Widget Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Live Status Widget</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-6 bg-gradient-to-br from-background to-muted/20 rounded-lg border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {getStatusIcon()}
                <div>
                  <h3 className="font-semibold">Kang Open Banking API</h3>
                  <p className="text-sm text-muted-foreground">Status Dashboard</p>
                </div>
              </div>
              {getStatusBadge()}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-background/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  Response Time
                </div>
                <p className="text-2xl font-bold">{status.responseTime}ms</p>
              </div>
              <div className="p-3 rounded-lg bg-background/50">
                <div className="text-sm text-muted-foreground mb-1">Uptime</div>
                <p className="text-2xl font-bold">{status.uptime}%</p>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground mt-4 text-center space-y-1">
              <p>Last updated: {new Date(status.lastChecked).toLocaleTimeString()}</p>
              {isRetrying && (
                <p className="text-yellow-600 dark:text-yellow-500 font-semibold">
                  Retrying... (Attempt {retryCount}/3)
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Embed Code */}
      <Card>
        <CardHeader>
          <CardTitle>Embed on Your Site</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-semibold mb-2 block">iFrame Embed Code</label>
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                <code>{embedCode}</code>
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={copyEmbedCode}
              >
                Copy
              </Button>
            </div>
          </div>

          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <h4 className="font-semibold mb-2 text-sm">Features</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Real-time status updates every 30 seconds</li>
              <li>• Automatic color coding (green/yellow/red)</li>
              <li>• Response time and uptime metrics</li>
              <li>• Lightweight and fast loading</li>
              <li>• Customizable styling via CSS</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2 text-sm">Customization Options</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Add these parameters to the iframe URL to customize:
            </p>
            <div className="bg-muted p-3 rounded text-xs space-y-1">
              <div><code>?theme=dark</code> - Dark mode</div>
              <div><code>&compact=true</code> - Compact view</div>
              <div><code>&refresh=60</code> - Custom refresh interval (seconds)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
