import { describe, it, expect } from "vitest";
import { generateCodeExamples } from "@/components/developer/ApiEndpoint";
import fs from "fs";
import path from "path";

const LANGUAGES = ["curl", "nodejs", "python", "php", "go", "java"];

const LANGUAGE_MARKERS: Record<string, string[]> = {
  curl: ["curl", "-H"],
  nodejs: ["fetch", "Authorization"],
  python: ["requests.", "headers"],
  php: ["curl_init", "curl_exec"],
  go: ["http.NewRequest", "http.DefaultClient"],
  java: ["HttpURLConnection", "openConnection"],
};

describe("generateCodeExamples", () => {
  it("produces snippets for all 6 languages (GET)", () => {
    const examples = generateCodeExamples("GET", "/v1/accounts");
    expect(examples).toHaveLength(6);
    LANGUAGES.forEach((lang) => {
      const match = examples.find((e) => e.language === lang);
      expect(match, `Missing language: ${lang}`).toBeDefined();
      expect(match!.code.length).toBeGreaterThan(20);
    });
  });

  it("produces snippets for all 6 languages (POST with body)", () => {
    const body = `{\n  "amount": 5000,\n  "currency": "XAF"\n}`;
    const examples = generateCodeExamples("POST", "/v1/payments", body);
    expect(examples).toHaveLength(6);
    LANGUAGES.forEach((lang) => {
      const match = examples.find((e) => e.language === lang);
      expect(match, `Missing language: ${lang}`).toBeDefined();
      expect(match!.code).toContain("5000");
    });
  });

  it("includes correct language-specific markers", () => {
    const examples = generateCodeExamples("POST", "/v1/test", '{"key":"val"}');
    examples.forEach((ex) => {
      const markers = LANGUAGE_MARKERS[ex.language];
      markers?.forEach((marker) => {
        expect(ex.code, `${ex.language} missing marker: ${marker}`).toContain(marker);
      });
    });
  });

  it("includes Authorization header in all languages", () => {
    const examples = generateCodeExamples("GET", "/v1/banks");
    examples.forEach((ex) => {
      expect(ex.code, `${ex.language} missing auth`).toContain("sk_test_");
    });
  });

  it("includes Idempotency-Key for POST methods", () => {
    const examples = generateCodeExamples("POST", "/v1/charges", '{"amount":100}');
    examples.forEach((ex) => {
      expect(ex.code.toLowerCase(), `${ex.language} missing idempotency`).toContain("idempotency");
    });
  });

  it("uses correct base URL", () => {
    const examples = generateCodeExamples("GET", "/v1/accounts");
    examples.forEach((ex) => {
      expect(ex.code).toContain("api.kangopenbanking.com");
    });
  });
});

describe("Developer page file coverage", () => {
  const devPagesDir = path.resolve(__dirname, "../pages/developer");

  it("all developer pages import ApiEndpoint or CodeBlock", () => {
    const files = fs.readdirSync(devPagesDir).filter((f) => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThan(10);

    const exceptions = [
      "DeveloperPortal.tsx",
      "DeveloperDocs.tsx",
      "SwaggerDocs.tsx",
    ];

    const missing: string[] = [];
    files.forEach((file) => {
      if (exceptions.some((ex) => file.includes(ex))) return;
      const content = fs.readFileSync(path.join(devPagesDir, file), "utf-8");
      const hasApiEndpoint = content.includes("ApiEndpoint");
      const hasCodeBlock = content.includes("CodeBlock");
      const hasPre = content.includes("<pre");
      if (!hasApiEndpoint && !hasCodeBlock && !hasPre) {
        missing.push(file);
      }
    });

    if (missing.length > 0) {
      console.warn("Pages without code examples:", missing);
    }
    // Allow up to 5 content-only pages (overview, changelog, etc.)
    expect(missing.length).toBeLessThanOrEqual(5);
  });
});
