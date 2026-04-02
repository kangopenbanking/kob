import { CodeBlock } from "@/components/developer/CodeBlock";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Package } from "lucide-react";
import { useState } from "react";

interface SdkExamplesProps {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  endpoint: string;
  requestBody?: string;
}

function toSdkMethodPath(endpoint: string): { resource: string; action: string; args: string } {
  // /v1/accounts/{accountId}/transactions → accounts, transactions.list, accountId
  const parts = endpoint.replace(/^\/v1\//, "").split("/").filter(Boolean);
  const cleanParts = parts.filter(p => !p.startsWith("{"));
  const paramParts = parts.filter(p => p.startsWith("{")).map(p => p.replace(/[{}]/g, ""));
  
  const resource = cleanParts[0] || "resource";
  const subResource = cleanParts[1] || "";
  const action = subResource || resource;
  
  return { resource, action, args: paramParts.join(", ") };
}

export function generateSdkExamples(
  method: string,
  endpoint: string,
  requestBody?: string
) {
  const { resource, action, args } = toSdkMethodPath(endpoint);
  const hasBody = !!requestBody && ["POST", "PUT", "PATCH"].includes(method);
  const bodyOneLine = hasBody ? requestBody!.replace(/\n/g, "").replace(/\s{2,}/g, " ") : "";

  // Determine SDK method based on HTTP method
  const sdkMethod = method === "GET" ? (args ? "get" : "list")
    : method === "POST" ? "create"
    : method === "PUT" || method === "PATCH" ? "update"
    : "delete";

  const nodeExample = hasBody
    ? `import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  clientId: 'your_client_id',
  apiKey: 'sbx_your_sandbox_key',
  environment: 'sandbox',
});

const result = await kob.${resource}.${sdkMethod}(${args ? `'${args}', ` : ''}${bodyOneLine});
console.log(result);`
    : `import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  clientId: 'your_client_id',
  apiKey: 'sbx_your_sandbox_key',
  environment: 'sandbox',
});

const result = await kob.${resource}.${sdkMethod}(${args ? `'${args}'` : ''});
console.log(result);`;

  const pythonExample = hasBody
    ? `from kangopenbanking import KangOpenBanking

kob = KangOpenBanking(
    client_id="your_client_id",
    api_key="sbx_your_sandbox_key",
    environment="sandbox",
)

result = kob.${resource}.${sdkMethod}(${args ? `"${args}", ` : ''}${bodyOneLine})
print(result)`
    : `from kangopenbanking import KangOpenBanking

kob = KangOpenBanking(
    client_id="your_client_id",
    api_key="sbx_your_sandbox_key",
    environment="sandbox",
)

result = kob.${resource}.${sdkMethod}(${args ? `"${args}"` : ''})
print(result)`;

  const phpExample = hasBody
    ? `<?php
use KangOpenBanking\\KangOpenBanking;

$kob = new KangOpenBanking([
    'client_id' => 'your_client_id',
    'api_key' => 'sbx_your_sandbox_key',
    'environment' => 'sandbox',
]);

$result = $kob->${resource}->${sdkMethod}(${args ? `'${args}', ` : ''}${bodyOneLine});
print_r($result);`
    : `<?php
use KangOpenBanking\\KangOpenBanking;

$kob = new KangOpenBanking([
    'client_id' => 'your_client_id',
    'api_key' => 'sbx_your_sandbox_key',
    'environment' => 'sandbox',
]);

$result = $kob->${resource}->${sdkMethod}(${args ? `'${args}'` : ''});
print_r($result);`;

  return [
    { language: "nodejs", code: nodeExample, label: "Node.js SDK" },
    { language: "python", code: pythonExample, label: "Python SDK" },
    { language: "php", code: phpExample, label: "PHP SDK" },
  ];
}

export function SdkExamples({ method, endpoint, requestBody }: SdkExamplesProps) {
  const [open, setOpen] = useState(false);
  const examples = generateSdkExamples(method, endpoint, requestBody);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
          <span className="flex items-center gap-2 font-semibold">
            <Package className="h-4 w-4" />
            Official SDK Examples
            <Badge variant="secondary" className="text-xs font-normal">Node · Python · PHP</Badge>
          </span>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <CodeBlock examples={examples} title={`SDK: ${method} ${endpoint}`} />
      </CollapsibleContent>
    </Collapsible>
  );
}
