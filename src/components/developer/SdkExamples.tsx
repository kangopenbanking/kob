import { CodeBlock } from "@/components/developer/CodeBlock";
import { API_EXAMPLE_BASE_URL } from "@/config/api";

interface SdkExamplesProps {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  endpoint: string;
  requestBody?: string;
}

/**
 * Per-endpoint multi-language snippet generator embedded inside ApiEndpoint
 * cards. Renders ready-to-copy cURL, Node.js (fetch), and Python (httpx)
 * examples for the supplied method + path.
 *
 * For broader OAuth / refresh / OBIE walk-throughs (not tied to a single
 * operation) use <SdkExamplesShowcase /> instead.
 */
export function SdkExamples({ method, endpoint, requestBody }: SdkExamplesProps) {
  const url = `${API_EXAMPLE_BASE_URL}${endpoint}`;
  const hasBody = method !== "GET" && method !== "DELETE" && Boolean(requestBody);
  const bodyPretty = hasBody ? safePretty(requestBody!) : null;

  const curl = [
    `curl -X ${method} ${url} \\`,
    `  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\`,
    hasBody ? `  -H "Content-Type: application/json" \\` : null,
    method === "POST" || method === "PUT" || method === "PATCH"
      ? `  -H "Idempotency-Key: $(uuidgen)" \\`
      : null,
    hasBody ? `  -d '${bodyPretty}'` : `  -H "Accept: application/json"`,
  ]
    .filter(Boolean)
    .join("\n");

  const node = [
    `// Node.js — fetch`,
    `const res = await fetch("${url}", {`,
    `  method: "${method}",`,
    `  headers: {`,
    `    Authorization: \`Bearer \${process.env.KOB_ACCESS_TOKEN}\`,`,
    hasBody ? `    "Content-Type": "application/json",` : null,
    method === "POST" || method === "PUT" || method === "PATCH"
      ? `    "Idempotency-Key": crypto.randomUUID(),`
      : null,
    `  },`,
    hasBody ? `  body: JSON.stringify(${bodyPretty}),` : null,
    `});`,
    ``,
    `if (!res.ok) {`,
    `  // Handle 401 (token expired) or 403 (insufficient scope) — see Error Codes`,
    `  throw new Error(\`Request failed: \${res.status}\`);`,
    `}`,
    `const data = await res.json();`,
  ]
    .filter(Boolean)
    .join("\n");

  const python = [
    `# Python — httpx`,
    `import os, uuid, httpx`,
    ``,
    `headers = {`,
    `    "Authorization": f"Bearer {os.environ['KOB_ACCESS_TOKEN']}",`,
    hasBody ? `    "Content-Type": "application/json",` : null,
    method === "POST" || method === "PUT" || method === "PATCH"
      ? `    "Idempotency-Key": str(uuid.uuid4()),`
      : null,
    `}`,
    ``,
    `resp = httpx.${method.toLowerCase()}(`,
    `    "${url}",`,
    `    headers=headers,` + (hasBody ? "" : ""),
    hasBody ? `    json=${bodyPretty},` : null,
    `    timeout=10,`,
    `)`,
    `resp.raise_for_status()  # raises on 4xx / 5xx`,
    `data = resp.json()`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="mt-4">
      <CodeBlock
        title={`${method} ${endpoint} — code samples`}
        examples={[
          { language: "bash", label: "cURL", code: curl },
          { language: "javascript", label: "Node.js", code: node },
          { language: "python", label: "Python", code: python },
        ]}
      />
    </div>
  );
}

function safePretty(maybeJson: string): string {
  try {
    return JSON.stringify(JSON.parse(maybeJson), null, 2);
  } catch {
    // Caller passed a non-JSON literal (e.g. a string template). Use as-is.
    return maybeJson;
  }
}
