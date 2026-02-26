import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface ApiEndpointProps {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  endpoint: string;
  description: string;
  parameters?: Parameter[];
  requestBody?: string;
  response?: string;
  example?: string;
}

const methodColors = {
  GET: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  POST: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  PUT: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  DELETE: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  PATCH: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button
      size="icon"
      variant="ghost"
      className="absolute top-3 right-3 h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
      onClick={copy}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function DarkCodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0d1117] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-gray-900">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      </div>
      <div className="relative">
        <CopyButton text={code} />
        <pre className="p-4 overflow-x-auto">
          <code className="text-sm font-mono text-gray-100">{code}</code>
        </pre>
      </div>
    </div>
  );
}

export function ApiEndpoint({
  method,
  endpoint,
  description,
  parameters,
  requestBody,
  response,
  example,
}: ApiEndpointProps) {
  return (
    <Card className="p-6 my-6">
      <div className="flex items-start gap-4 mb-4">
        <Badge variant="outline" className={`${methodColors[method]} font-mono font-bold`}>
          {method}
        </Badge>
        <div className="flex-1">
          <code className="text-sm font-mono bg-[#0d1117] text-green-400 px-3 py-1 rounded border border-white/10">
            {endpoint}
          </code>
        </div>
      </div>

      <p className="text-muted-foreground mb-4">{description}</p>

      {parameters && parameters.length > 0 && (
        <>
          <Separator className="my-4" />
          <h4 className="font-semibold mb-3">Parameters</h4>
          <div className="space-y-3">
            {parameters.map((param) => (
              <div key={param.name} className="flex gap-3">
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded h-fit">
                  {param.name}
                </code>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">
                      {param.type}
                    </Badge>
                    {param.required && (
                      <Badge variant="destructive" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{param.description}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {requestBody && (
        <>
          <Separator className="my-4" />
          <h4 className="font-semibold mb-3">Request Body</h4>
          <DarkCodeBlock label="Request" code={requestBody} />
        </>
      )}

      {response && (
        <>
          <Separator className="my-4" />
          <h4 className="font-semibold mb-3">Response</h4>
          <DarkCodeBlock label="Response" code={response} />
        </>
      )}

      {example && (
        <>
          <Separator className="my-4" />
          <h4 className="font-semibold mb-3">Example</h4>
          <DarkCodeBlock label="Example" code={example} />
        </>
      )}
    </Card>
  );
}
