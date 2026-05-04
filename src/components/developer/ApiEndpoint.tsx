import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { JsonSyntax } from "@/components/developer/JsonSyntax";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Check, Copy, ChevronDown, ChevronRight, Code2 } from "lucide-react";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SdkExamples } from "@/components/developer/SdkExamples";

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

import { API_EXAMPLE_BASE_URL } from "@/config/api";

// Endpoint props already include the `/v1/...` prefix, so strip the trailing
// `/v1` from the public gateway base to avoid producing malformed `/v1/v1/...`
// URLs in copy-pasteable snippets (enforced by .github/workflows/no-double-v1.yml).
const BASE_URL = API_EXAMPLE_BASE_URL.replace(/\/v1\/?$/, "");

export function generateCodeExamples(
  method: string,
  endpoint: string,
  requestBody?: string
) {
  const url = `${BASE_URL}${endpoint}`;
  const hasBody = !!requestBody && ["POST", "PUT", "PATCH"].includes(method);
  const bodyOneLine = hasBody ? requestBody!.replace(/\n/g, "").replace(/\s{2,}/g, " ") : "";

  const curl = hasBody
    ? `curl -X ${method} "${url}" \\
  -H "Authorization: Bearer sk_test_your_api_key" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '${requestBody}'`
    : `curl -X ${method} "${url}" \\
  -H "Authorization: Bearer sk_test_your_api_key"`;

  const nodejs = hasBody
    ? `const response = await fetch("${url}", {
  method: "${method}",
  headers: {
    "Authorization": "Bearer sk_test_your_api_key",
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID()
  },
  body: JSON.stringify(${bodyOneLine})
});

const data = await response.json();
console.log(data);`
    : `const response = await fetch("${url}", {
  headers: {
    "Authorization": "Bearer sk_test_your_api_key"
  }
});

const data = await response.json();
console.log(data);`;

  const python = hasBody
    ? `import requests

response = requests.${method.toLowerCase()}(
    "${url}",
    headers={
        "Authorization": "Bearer sk_test_your_api_key",
        "Content-Type": "application/json",
        "Idempotency-Key": "unique-key-here"
    },
    json=${bodyOneLine}
)

print(response.json())`
    : `import requests

response = requests.${method.toLowerCase()}(
    "${url}",
    headers={"Authorization": "Bearer sk_test_your_api_key"}
)

print(response.json())`;

  const php = hasBody
    ? `<?php
$ch = curl_init("${url}");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "${method}");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer sk_test_your_api_key",
    "Content-Type: application/json",
    "Idempotency-Key: " . uniqid()
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, '${bodyOneLine}');

$response = curl_exec($ch);
curl_close($ch);
echo $response;`
    : `<?php
$ch = curl_init("${url}");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer sk_test_your_api_key"
]);

$response = curl_exec($ch);
curl_close($ch);
echo $response;`;

  const goLang = hasBody
    ? `package main

import (
    "bytes"
    "fmt"
    "io"
    "net/http"
)

func main() {
    body := []byte(\`${bodyOneLine}\`)
    req, _ := http.NewRequest("${method}", "${url}", bytes.NewBuffer(body))
    req.Header.Set("Authorization", "Bearer sk_test_your_api_key")
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Idempotency-Key", "unique-key-here")

    resp, _ := http.DefaultClient.Do(req)
    defer resp.Body.Close()
    data, _ := io.ReadAll(resp.Body)
    fmt.Println(string(data))
}`
    : `package main

import (
    "fmt"
    "io"
    "net/http"
)

func main() {
    req, _ := http.NewRequest("${method}", "${url}", nil)
    req.Header.Set("Authorization", "Bearer sk_test_your_api_key")

    resp, _ := http.DefaultClient.Do(req)
    defer resp.Body.Close()
    data, _ := io.ReadAll(resp.Body)
    fmt.Println(string(data))
}`;

  const java = hasBody
    ? `import java.net.HttpURLConnection;
import java.net.URL;
import java.io.*;

URL url = new URL("${url}");
HttpURLConnection conn = (HttpURLConnection) url.openConnection();
conn.setRequestMethod("${method}");
conn.setRequestProperty("Authorization", "Bearer sk_test_your_api_key");
conn.setRequestProperty("Content-Type", "application/json");
conn.setRequestProperty("Idempotency-Key", java.util.UUID.randomUUID().toString());
conn.setDoOutput(true);

try (OutputStream os = conn.getOutputStream()) {
    os.write("${bodyOneLine}".getBytes("utf-8"));
}

try (BufferedReader br = new BufferedReader(
        new InputStreamReader(conn.getInputStream(), "utf-8"))) {
    StringBuilder response = new StringBuilder();
    String line;
    while ((line = br.readLine()) != null) {
        response.append(line.trim());
    }
    System.out.println(response.toString());
}`
    : `import java.net.HttpURLConnection;
import java.net.URL;
import java.io.*;

URL url = new URL("${url}");
HttpURLConnection conn = (HttpURLConnection) url.openConnection();
conn.setRequestMethod("${method}");
conn.setRequestProperty("Authorization", "Bearer sk_test_your_api_key");

try (BufferedReader br = new BufferedReader(
        new InputStreamReader(conn.getInputStream(), "utf-8"))) {
    StringBuilder response = new StringBuilder();
    String line;
    while ((line = br.readLine()) != null) {
        response.append(line.trim());
    }
    System.out.println(response.toString());
}`;

  return [
    { language: "curl", code: curl, label: "cURL" },
    { language: "nodejs", code: nodejs, label: "Node.js" },
    { language: "python", code: python, label: "Python" },
    { language: "php", code: php, label: "PHP" },
    { language: "go", code: goLang, label: "Go" },
    { language: "java", code: java, label: "Java" },
  ];
}

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
          <code className="text-sm font-mono text-gray-100"><JsonSyntax code={code} /></code>
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
  const [codeOpen, setCodeOpen] = useState(false);
  const codeExamples = generateCodeExamples(method, endpoint, requestBody);

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

      <Separator className="my-4" />
      <Collapsible open={codeOpen} onOpenChange={setCodeOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
            <span className="flex items-center gap-2 font-semibold">
              <Code2 className="h-4 w-4" />
              Code Examples
              <Badge variant="secondary" className="text-xs font-normal">6 languages</Badge>
            </span>
            {codeOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <CodeBlock examples={codeExamples} title={`${method} ${endpoint}`} />
        </CollapsibleContent>
      </Collapsible>

      <SdkExamples method={method} endpoint={endpoint} requestBody={requestBody} />
    </Card>
  );
}
