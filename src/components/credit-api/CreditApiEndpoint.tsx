import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface CodeExample {
  language: string;
  code: string;
}

interface ApiEndpointProps {
  method: string;
  endpoint: string;
  description: string;
  parameters?: Parameter[];
  requestBody?: any;
  response?: any;
  codeExamples?: CodeExample[];
}

const methodColors: Record<string, string> = {
  GET: "bg-blue-600",
  POST: "bg-green-600",
  PUT: "bg-yellow-600",
  DELETE: "bg-red-600",
  PATCH: "bg-purple-600"
};

export function CreditApiEndpoint({
  method,
  endpoint,
  description,
  parameters,
  requestBody,
  response,
  codeExamples
}: ApiEndpointProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <Badge className={`${methodColors[method]} text-white`}>
            {method}
          </Badge>
          <code className="text-sm bg-muted px-3 py-1 rounded font-mono flex-1">
            {endpoint}
          </code>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => copyToClipboard(endpoint, "endpoint")}
          >
            {copiedId === "endpoint" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Parameters */}
        {parameters && parameters.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Parameters</h4>
            <div className="space-y-2">
              {parameters.map((param) => (
                <div key={param.name} className="flex items-start gap-2 text-sm">
                  <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                    {param.name}
                  </code>
                  <Badge variant={param.required ? "default" : "secondary"} className="text-xs">
                    {param.required ? "required" : "optional"}
                  </Badge>
                  <span className="text-muted-foreground flex-1">{param.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Request Body */}
        {requestBody && (
          <div>
            <h4 className="font-semibold mb-3">Request Body</h4>
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                <code>{JSON.stringify(requestBody, null, 2)}</code>
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(JSON.stringify(requestBody, null, 2), "request")}
              >
                {copiedId === "request" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Response */}
        {response && (
          <div>
            <h4 className="font-semibold mb-3">Response</h4>
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                <code>{JSON.stringify(response, null, 2)}</code>
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(JSON.stringify(response, null, 2), "response")}
              >
                {copiedId === "response" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Code Examples */}
        {codeExamples && codeExamples.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Code Examples</h4>
            <Tabs defaultValue={codeExamples[0].language}>
              <TabsList>
                {codeExamples.map((example) => (
                  <TabsTrigger key={example.language} value={example.language}>
                    {example.language}
                  </TabsTrigger>
                ))}
              </TabsList>
              {codeExamples.map((example) => (
                <TabsContent key={example.language} value={example.language}>
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{example.code}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(example.code, example.language)}
                    >
                      {copiedId === example.language ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
