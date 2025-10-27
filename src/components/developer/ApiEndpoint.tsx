import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
          <code className="text-sm font-mono bg-muted px-3 py-1 rounded">
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
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
            <code className="text-sm font-mono">{requestBody}</code>
          </pre>
        </>
      )}

      {response && (
        <>
          <Separator className="my-4" />
          <h4 className="font-semibold mb-3">Response</h4>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
            <code className="text-sm font-mono">{response}</code>
          </pre>
        </>
      )}

      {example && (
        <>
          <Separator className="my-4" />
          <h4 className="font-semibold mb-3">Example</h4>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
            <code className="text-sm font-mono">{example}</code>
          </pre>
        </>
      )}
    </Card>
  );
}
