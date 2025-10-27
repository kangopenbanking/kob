import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CodeExample {
  language: string;
  code: string;
  label?: string;
}

interface CodeBlockProps {
  examples: CodeExample[];
  title?: string;
}

export function CodeBlock({ examples, title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (examples.length === 1) {
    return (
      <div className="my-4 rounded-lg border bg-card overflow-hidden">
        {title && (
          <div className="px-4 py-2 border-b bg-muted/50 font-mono text-sm">
            {title}
          </div>
        )}
        <div className="relative">
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 h-8 w-8"
            onClick={() => copyToClipboard(examples[0].code)}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <pre className="p-4 overflow-x-auto">
            <code className="text-sm font-mono">{examples[0].code}</code>
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 rounded-lg border bg-card overflow-hidden">
      {title && (
        <div className="px-4 py-2 border-b bg-muted/50 font-mono text-sm">
          {title}
        </div>
      )}
      <Tabs defaultValue={examples[0].language}>
        <div className="flex items-center justify-between border-b px-4">
          <TabsList className="h-12 bg-transparent">
            {examples.map((example) => (
              <TabsTrigger key={example.language} value={example.language}>
                {example.label || example.language}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {examples.map((example) => (
          <TabsContent key={example.language} value={example.language} className="m-0">
            <div className="relative">
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 h-8 w-8 z-10"
                onClick={() => copyToClipboard(example.code)}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <pre className="p-4 overflow-x-auto">
                <code className="text-sm font-mono">{example.code}</code>
              </pre>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
