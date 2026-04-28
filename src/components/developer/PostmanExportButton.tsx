import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface PostmanExportButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function PostmanExportButton({ variant = "outline", size = "sm", className }: PostmanExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      // Fetch OpenAPI spec and convert to Postman Collection v2.1
      const res = await fetch("/openapi.json");
      if (!res.ok) throw new Error("Failed to fetch OpenAPI spec");
      const spec = await res.json();

      const collection = convertToPostmanCollection(spec);
      const blob = new Blob([JSON.stringify(collection, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "KangOpenBanking_Postman_Collection.json";
      a.click();
      URL.revokeObjectURL(url);
      
      setDone(true);
      toast.success("Postman collection downloaded!");
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      toast.error("Failed to generate Postman collection");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : done ? <CheckCircle className="h-4 w-4 mr-2" /> : <Download className="h-4 w-4 mr-2" />}
      {loading ? "Generating..." : done ? "Downloaded!" : "Export Postman Collection"}
    </Button>
  );
}

function convertToPostmanCollection(spec: any) {
  const baseUrl = spec.servers?.[0]?.url || "https://api.kangopenbanking.com/v1/v1";
  
  const items: any[] = [];
  const paths = spec.paths || {};
  
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods as any)) {
      if (["get", "post", "put", "patch", "delete"].includes(method)) {
        const op = operation as any;
        const urlPath = path.replace(/{(\w+)}/g, ":$1");
        
        const item: any = {
          name: op.summary || op.operationId || `${method.toUpperCase()} ${path}`,
          request: {
            method: method.toUpperCase(),
            header: [
              { key: "Authorization", value: "Bearer {{api_key}}", type: "text" },
              { key: "Content-Type", value: "application/json", type: "text" },
            ],
            url: {
              raw: `${baseUrl}${urlPath}`,
              host: [baseUrl.replace(/^https?:\/\//, "")],
              path: urlPath.split("/").filter(Boolean),
            },
          },
          response: [],
        };

        if (op.requestBody?.content?.["application/json"]?.schema) {
          item.request.body = {
            mode: "raw",
            raw: JSON.stringify(generateExampleBody(op.requestBody.content["application/json"].schema), null, 2),
          };
        }

        // Group by tag
        const tag = op.tags?.[0] || "General";
        let folder = items.find(i => i.name === tag);
        if (!folder) {
          folder = { name: tag, item: [] };
          items.push(folder);
        }
        folder.item.push(item);
      }
    }
  }

  return {
    info: {
      name: "Kang Open Banking API",
      description: spec.info?.description?.substring(0, 200) || "KOB API Collection",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      _postman_id: "kob-auto-export",
    },
    item: items,
    variable: [
      { key: "base_url", value: baseUrl },
      { key: "api_key", value: "sbx_your_sandbox_key" },
    ],
  };
}

function generateExampleBody(schema: any): any {
  if (!schema) return {};
  if (schema.example) return schema.example;
  if (schema.type === "string") return schema.enum?.[0] || "string_value";
  if (schema.type === "number" || schema.type === "integer") return schema.example || 0;
  if (schema.type === "boolean") return false;
  if (schema.type === "array") return [generateExampleBody(schema.items)];
  if (schema.type === "object" || schema.properties) {
    const obj: any = {};
    for (const [key, prop] of Object.entries(schema.properties || {})) {
      obj[key] = generateExampleBody(prop);
    }
    return obj;
  }
  return {};
}
