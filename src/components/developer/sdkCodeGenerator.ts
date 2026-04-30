/**
 * SDK Code Generator
 * --------------------------------------------------------------------------
 * Generates ready-to-run client code for a given OpenAPI operation in
 * 8 languages: cURL, Node.js, Python, PHP, Ruby, Java, Go, .NET (C#).
 *
 * - Resolves $ref schemas from the loaded spec
 * - Synthesises realistic request bodies from `example`, `examples`, or
 *   `default` values (falls back to type-aware placeholders)
 * - Substitutes :path parameters with spec examples when available
 * - Adds Idempotency-Key header for unsafe methods (POST/PUT/PATCH)
 *   per the project's idempotency hardening contract
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface OpenAPIParam {
  name: string;
  in: string;
  required?: boolean;
  schema?: any;
  example?: any;
  description?: string;
}

export interface OpenAPIOperationLike {
  operationId?: string;
  summary?: string;
  parameters?: OpenAPIParam[];
  requestBody?: any;
}

const UNSAFE = new Set<HttpMethod>(["POST", "PUT", "PATCH"]);

function resolveRef(spec: any, ref: string): any {
  if (!ref?.startsWith("#/")) return null;
  const parts = ref.slice(2).split("/");
  let cur = spec;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur == null) return null;
  }
  return cur;
}

function exampleForSchema(spec: any, schema: any, depth = 0): any {
  if (!schema || depth > 5) return null;
  if (schema.$ref) return exampleForSchema(spec, resolveRef(spec, schema.$ref), depth + 1);
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.allOf) {
    const merged: Record<string, any> = {};
    for (const sub of schema.allOf) {
      const v = exampleForSchema(spec, sub, depth + 1);
      if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(merged, v);
    }
    return Object.keys(merged).length ? merged : null;
  }
  if (schema.oneOf?.[0]) return exampleForSchema(spec, schema.oneOf[0], depth + 1);
  if (schema.anyOf?.[0]) return exampleForSchema(spec, schema.anyOf[0], depth + 1);
  if (schema.type === "object" || schema.properties) {
    const out: Record<string, any> = {};
    const required: string[] = schema.required ?? [];
    const props = schema.properties ?? {};
    // Always emit required props; emit up to 4 optional props for context
    const keys = [...new Set([...required, ...Object.keys(props)])].slice(0, 8);
    for (const k of keys) {
      const v = exampleForSchema(spec, props[k], depth + 1);
      if (v !== null && v !== undefined) out[k] = v;
    }
    return out;
  }
  if (schema.type === "array") {
    const item = exampleForSchema(spec, schema.items, depth + 1);
    return item !== null ? [item] : [];
  }
  if (schema.enum?.length) return schema.enum[0];
  if (schema.type === "string") {
    if (schema.format === "uuid") return "00000000-0000-4000-8000-000000000000";
    if (schema.format === "date-time") return "2026-04-30T00:00:00Z";
    if (schema.format === "date") return "2026-04-30";
    if (schema.format === "email") return "customer@example.com";
    if (schema.format === "uri") return "https://example.com/webhook";
    return "string";
  }
  if (schema.type === "integer") return 0;
  if (schema.type === "number") return 0;
  if (schema.type === "boolean") return false;
  return null;
}

function getRequestBodyExample(spec: any, op: OpenAPIOperationLike): any | null {
  const rb = op.requestBody;
  if (!rb) return null;
  const node = rb.$ref ? resolveRef(spec, rb.$ref) : rb;
  const json = node?.content?.["application/json"];
  if (!json) return null;
  if (json.example !== undefined) return json.example;
  if (json.examples) {
    const first = Object.values(json.examples)[0] as any;
    if (first?.value !== undefined) return first.value;
  }
  return exampleForSchema(spec, json.schema);
}

function substitutePath(spec: any, path: string, params: OpenAPIParam[] = []): string {
  return path.replace(/\{([^}]+)\}/g, (_, name) => {
    const p = params.find((x) => x.name === name && x.in === "path");
    const ex = p?.example ?? p?.schema?.example;
    if (ex !== undefined) return String(ex);
    if (p?.schema?.format === "uuid") return "00000000-0000-4000-8000-000000000000";
    return `{${name}}`;
  });
}

function queryString(params: OpenAPIParam[] = []): string {
  const q = params
    .filter((p) => p.in === "query" && p.required)
    .map((p) => {
      const v = p.example ?? p.schema?.example ?? (p.schema?.type === "integer" ? 10 : "value");
      return `${encodeURIComponent(p.name)}=${encodeURIComponent(String(v))}`;
    });
  return q.length ? `?${q.join("&")}` : "";
}

export interface GenerateInput {
  spec: any;
  baseUrl: string;
  method: HttpMethod;
  path: string;
  op: OpenAPIOperationLike;
}

export interface GeneratedSnippet {
  code: string;
  filename: string;
}

function jsonPretty(obj: unknown, indent = 2): string {
  return JSON.stringify(obj ?? {}, null, indent);
}

// ---------------------------------------------------------------------------
// Per-language generators
// ---------------------------------------------------------------------------

export function generateCurl(i: GenerateInput): GeneratedSnippet {
  const url = `${i.baseUrl}${substitutePath(i.spec, i.path, i.op.parameters)}${queryString(i.op.parameters)}`;
  const body = UNSAFE.has(i.method) ? getRequestBodyExample(i.spec, i.op) : null;
  const lines = [
    `curl -X ${i.method} '${url}' \\`,
    `  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \\`,
    `  -H 'Accept: application/json'`,
  ];
  if (UNSAFE.has(i.method)) {
    lines[lines.length - 1] += ` \\`;
    lines.push(`  -H 'Content-Type: application/json' \\`);
    lines.push(`  -H "Idempotency-Key: $(uuidgen)"${body ? " \\" : ""}`);
    if (body) {
      const json = jsonPretty(body).split("\n").map((l, idx) => (idx === 0 ? l : `    ${l}`)).join("\n");
      lines.push(`  -d '${json}'`);
    }
  }
  return { code: lines.join("\n"), filename: "request.sh" };
}

export function generateNode(i: GenerateInput): GeneratedSnippet {
  const url = `${i.baseUrl}${substitutePath(i.spec, i.path, i.op.parameters)}${queryString(i.op.parameters)}`;
  const body = UNSAFE.has(i.method) ? getRequestBodyExample(i.spec, i.op) : null;
  const opId = i.op.operationId ?? `${i.method.toLowerCase()}Resource`;
  return {
    filename: `${opId}.mjs`,
    code: `// Install: npm install @kangopenbanking/sdk
import { randomUUID } from 'node:crypto';

const ACCESS_TOKEN = process.env.KOB_ACCESS_TOKEN;

const response = await fetch('${url}', {
  method: '${i.method}',
  headers: {
    Authorization: \`Bearer \${ACCESS_TOKEN}\`,
    Accept: 'application/json',${
      UNSAFE.has(i.method)
        ? `\n    'Content-Type': 'application/json',\n    'Idempotency-Key': randomUUID(),`
        : ""
    }
  },${body ? `\n  body: JSON.stringify(${jsonPretty(body, 2).replace(/\n/g, "\n  ")}),` : ""}
});

if (!response.ok) {
  const error = await response.json().catch(() => ({}));
  throw new Error(\`KOB \${response.status}: \${error?.error?.message ?? response.statusText}\`);
}

const data = await response.json();
console.log(data);`,
  };
}

export function generatePython(i: GenerateInput): GeneratedSnippet {
  const url = `${i.baseUrl}${substitutePath(i.spec, i.path, i.op.parameters)}${queryString(i.op.parameters)}`;
  const body = UNSAFE.has(i.method) ? getRequestBodyExample(i.spec, i.op) : null;
  const opId = i.op.operationId ?? "request";
  const pyDict = body ? toPythonLiteral(body, 0) : null;
  return {
    filename: `${opId}.py`,
    code: `# Install: pip install kangopenbanking requests
import os
import uuid
import requests

ACCESS_TOKEN = os.environ["KOB_ACCESS_TOKEN"]

headers = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Accept": "application/json",${
      UNSAFE.has(i.method)
        ? `\n    "Content-Type": "application/json",\n    "Idempotency-Key": str(uuid.uuid4()),`
        : ""
    }
}

response = requests.${i.method.toLowerCase()}(
    "${url}",
    headers=headers,${body ? `\n    json=${pyDict},` : ""}
    timeout=30,
)
response.raise_for_status()
data = response.json()
print(data)`,
  };
}

export function generatePHP(i: GenerateInput): GeneratedSnippet {
  const url = `${i.baseUrl}${substitutePath(i.spec, i.path, i.op.parameters)}${queryString(i.op.parameters)}`;
  const body = UNSAFE.has(i.method) ? getRequestBodyExample(i.spec, i.op) : null;
  const opId = i.op.operationId ?? "request";
  return {
    filename: `${opId}.php`,
    code: `<?php
// Install: composer require kangopenbanking/sdk
$accessToken = getenv('KOB_ACCESS_TOKEN');

$ch = curl_init('${url}');
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${i.method}');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $accessToken,
    'Accept: application/json',${
      UNSAFE.has(i.method)
        ? `\n    'Content-Type: application/json',\n    'Idempotency-Key: ' . bin2hex(random_bytes(16)),`
        : ""
    }
]);${
      body
        ? `\ncurl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(${toPhpLiteral(body, 0)}));`
        : ""
    }

$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($status >= 400) {
    throw new RuntimeException("KOB error $status: $response");
}

$data = json_decode($response, true);
print_r($data);`,
  };
}

export function generateRuby(i: GenerateInput): GeneratedSnippet {
  const url = `${i.baseUrl}${substitutePath(i.spec, i.path, i.op.parameters)}${queryString(i.op.parameters)}`;
  const body = UNSAFE.has(i.method) ? getRequestBodyExample(i.spec, i.op) : null;
  const opId = i.op.operationId ?? "request";
  return {
    filename: `${opId}.rb`,
    code: `# Install: gem install faraday securerandom
require 'faraday'
require 'json'
require 'securerandom'

access_token = ENV.fetch('KOB_ACCESS_TOKEN')

conn = Faraday.new(url: '${i.baseUrl}') do |f|
  f.request :json
  f.response :json
  f.adapter Faraday.default_adapter
end

response = conn.${i.method.toLowerCase()}('${substitutePath(i.spec, i.path, i.op.parameters)}${queryString(i.op.parameters)}') do |req|
  req.headers['Authorization'] = "Bearer #{access_token}"
  req.headers['Accept'] = 'application/json'${
    UNSAFE.has(i.method)
      ? `\n  req.headers['Content-Type'] = 'application/json'\n  req.headers['Idempotency-Key'] = SecureRandom.uuid`
      : ""
  }${body ? `\n  req.body = ${toRubyLiteral(body, 0)}` : ""}
end

raise "KOB error #{response.status}" if response.status >= 400
puts response.body`,
  };
}

export function generateJava(i: GenerateInput): GeneratedSnippet {
  const url = `${i.baseUrl}${substitutePath(i.spec, i.path, i.op.parameters)}${queryString(i.op.parameters)}`;
  const body = UNSAFE.has(i.method) ? getRequestBodyExample(i.spec, i.op) : null;
  const className = (i.op.operationId ?? "KobRequest").replace(/[^a-zA-Z0-9]/g, "");
  const cap = className.charAt(0).toUpperCase() + className.slice(1);
  const bodyJson = body ? jsonPretty(body).replace(/"/g, '\\"').replace(/\n/g, "\\n") : "";
  return {
    filename: `${cap}.java`,
    code: `// Java 11+ (java.net.http)
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

public class ${cap} {
    public static void main(String[] args) throws Exception {
        String token = System.getenv("KOB_ACCESS_TOKEN");
${body ? `        String body = "${bodyJson}";\n` : ""}
        HttpRequest.Builder b = HttpRequest.newBuilder()
            .uri(URI.create("${url}"))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "application/json")${
              UNSAFE.has(i.method)
                ? `\n            .header("Content-Type", "application/json")\n            .header("Idempotency-Key", UUID.randomUUID().toString())`
                : ""
            };

        HttpRequest request = b.${
          i.method === "GET"
            ? "GET()"
            : i.method === "DELETE"
              ? "DELETE()"
              : `method("${i.method}", HttpRequest.BodyPublishers.ofString(${body ? "body" : '""'}))`
        }.build();

        HttpResponse<String> response = HttpClient.newHttpClient()
            .send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.statusCode() + " " + response.body());
    }
}`,
  };
}

export function generateGo(i: GenerateInput): GeneratedSnippet {
  const url = `${i.baseUrl}${substitutePath(i.spec, i.path, i.op.parameters)}${queryString(i.op.parameters)}`;
  const body = UNSAFE.has(i.method) ? getRequestBodyExample(i.spec, i.op) : null;
  const opId = i.op.operationId ?? "request";
  return {
    filename: `${opId}.go`,
    code: `package main

import (
\t"bytes"
\t"crypto/rand"
\t"encoding/hex"
\t"fmt"
\t"io"
\t"net/http"
\t"os"
)

func main() {
\ttoken := os.Getenv("KOB_ACCESS_TOKEN")
${body ? `\tbody := []byte(\`${jsonPretty(body)}\`)\n` : ""}
\treq, _ := http.NewRequest("${i.method}", "${url}", ${body ? "bytes.NewBuffer(body)" : "nil"})
\treq.Header.Set("Authorization", "Bearer "+token)
\treq.Header.Set("Accept", "application/json")
${
  UNSAFE.has(i.method)
    ? `\treq.Header.Set("Content-Type", "application/json")
\tidem := make([]byte, 16)
\trand.Read(idem)
\treq.Header.Set("Idempotency-Key", hex.EncodeToString(idem))
`
    : ""
}
\tres, err := http.DefaultClient.Do(req)
\tif err != nil { panic(err) }
\tdefer res.Body.Close()
\tdata, _ := io.ReadAll(res.Body)
\tfmt.Println(res.StatusCode, string(data))
}`,
  };
}

export function generateDotNet(i: GenerateInput): GeneratedSnippet {
  const url = `${i.baseUrl}${substitutePath(i.spec, i.path, i.op.parameters)}${queryString(i.op.parameters)}`;
  const body = UNSAFE.has(i.method) ? getRequestBodyExample(i.spec, i.op) : null;
  const opId = i.op.operationId ?? "request";
  const bodyJson = body ? jsonPretty(body).replace(/"/g, '""') : "";
  return {
    filename: `${opId}.cs`,
    code: `// .NET 6+
using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        var token = Environment.GetEnvironmentVariable("KOB_ACCESS_TOKEN");
        using var client = new HttpClient();
        var request = new HttpRequestMessage(HttpMethod.${normalizeDotNetMethod(i.method)}, "${url}");
        request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {token}");
        request.Headers.TryAddWithoutValidation("Accept", "application/json");${
          UNSAFE.has(i.method)
            ? `\n        request.Headers.TryAddWithoutValidation("Idempotency-Key", Guid.NewGuid().ToString());`
            : ""
        }${
          body
            ? `\n        request.Content = new StringContent(@"${bodyJson}", Encoding.UTF8, "application/json");`
            : ""
        }

        var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        Console.WriteLine($"{(int)response.StatusCode} {body}");
    }
}`,
  };
}

function normalizeDotNetMethod(m: HttpMethod): string {
  if (m === "GET") return "Get";
  if (m === "POST") return "Post";
  if (m === "PUT") return "Put";
  if (m === "DELETE") return "Delete";
  return "Patch";
}

// ---------------------------------------------------------------------------
// Literal helpers (preserve booleans/numbers)
// ---------------------------------------------------------------------------

function toPythonLiteral(v: any, indent: number): string {
  const pad = "    ".repeat(indent + 1);
  const close = "    ".repeat(indent);
  if (v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return `"${v.replace(/"/g, '\\"')}"`;
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    return `[\n${v.map((x) => `${pad}${toPythonLiteral(x, indent + 1)}`).join(",\n")}\n${close}]`;
  }
  const entries = Object.entries(v);
  if (!entries.length) return "{}";
  return `{\n${entries
    .map(([k, val]) => `${pad}"${k}": ${toPythonLiteral(val, indent + 1)}`)
    .join(",\n")}\n${close}}`;
}

function toPhpLiteral(v: any, indent: number): string {
  const pad = "    ".repeat(indent + 1);
  const close = "    ".repeat(indent);
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return `'${v.replace(/'/g, "\\'")}'`;
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    return `[\n${v.map((x) => `${pad}${toPhpLiteral(x, indent + 1)}`).join(",\n")}\n${close}]`;
  }
  const entries = Object.entries(v);
  if (!entries.length) return "[]";
  return `[\n${entries
    .map(([k, val]) => `${pad}'${k}' => ${toPhpLiteral(val, indent + 1)}`)
    .join(",\n")}\n${close}]`;
}

function toRubyLiteral(v: any, indent: number): string {
  const pad = "  ".repeat(indent + 1);
  const close = "  ".repeat(indent);
  if (v === null) return "nil";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return `'${v.replace(/'/g, "\\'")}'`;
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    return `[\n${v.map((x) => `${pad}${toRubyLiteral(x, indent + 1)}`).join(",\n")}\n${close}]`;
  }
  const entries = Object.entries(v);
  if (!entries.length) return "{}";
  return `{\n${entries
    .map(([k, val]) => `${pad}${k}: ${toRubyLiteral(val, indent + 1)}`)
    .join(",\n")}\n${close}}`;
}

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------

import type { ClientLanguageId } from "@/components/developer/ClientLibraryLogos";

export function generateForLanguage(lang: ClientLanguageId, input: GenerateInput): GeneratedSnippet {
  switch (lang) {
    case "curl": return generateCurl(input);
    case "node": return generateNode(input);
    case "python": return generatePython(input);
    case "php": return generatePHP(input);
    case "ruby": return generateRuby(input);
    case "java": return generateJava(input);
    case "go": return generateGo(input);
    case "dotnet": return generateDotNet(input);
  }
}
