import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Play, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface DemoField {
  name: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  defaultValue?: any;
}

interface DemoEndpoint {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  requiresAuth: boolean;
  fields?: DemoField[];
}

interface InteractiveDemoWidgetProps {
  endpoints: DemoEndpoint[];
  defaultEndpoint?: string;
  title?: string;
  description?: string;
  platform: string;
}

export function InteractiveDemoWidget({
  endpoints,
  defaultEndpoint,
  title = "Try It: Interactive API Demo",
  description = "Test API calls directly from your browser",
  platform
}: InteractiveDemoWidgetProps) {
  const [selectedEndpoint, setSelectedEndpoint] = useState(defaultEndpoint || endpoints[0]?.id);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const currentEndpoint = endpoints.find(e => e.id === selectedEndpoint);

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const generateCurlCommand = () => {
    if (!currentEndpoint) return '';

    const baseUrl = `${window.location.origin}/api-demo`;
    let command = `curl -X ${currentEndpoint.method} "${baseUrl}/${currentEndpoint.path}"`;

    if (currentEndpoint.requiresAuth) {
      command += ' \\\n  -H "Authorization: Bearer YOUR_API_KEY"';
    }

    command += ' \\\n  -H "Content-Type: application/json"';

    if (currentEndpoint.method !== 'GET' && Object.keys(formData).length > 0) {
      command += ` \\\n  -d '${JSON.stringify(formData, null, 2)}'`;
    }

    return command;
  };

  const generateJavaScriptCode = () => {
    if (!currentEndpoint) return '';

    const baseUrl = `${window.location.origin}/api-demo`;
    let code = `const response = await fetch('${baseUrl}/${currentEndpoint.path}', {\n`;
    code += `  method: '${currentEndpoint.method}',\n`;
    code += `  headers: {\n`;
    
    if (currentEndpoint.requiresAuth) {
      code += `    'Authorization': 'Bearer YOUR_API_KEY',\n`;
    }
    
    code += `    'Content-Type': 'application/json'\n`;
    code += `  }`;

    if (currentEndpoint.method !== 'GET' && Object.keys(formData).length > 0) {
      code += `,\n  body: JSON.stringify(${JSON.stringify(formData, null, 2)})`;
    }

    code += `\n});\n\nconst data = await response.json();\nconsole.log(data);`;

    return code;
  };

  const generatePythonCode = () => {
    if (!currentEndpoint) return '';

    const baseUrl = `${window.location.origin}/api-demo`;
    let code = `import requests\n\n`;
    code += `headers = {\n`;
    
    if (currentEndpoint.requiresAuth) {
      code += `    'Authorization': 'Bearer YOUR_API_KEY',\n`;
    }
    
    code += `    'Content-Type': 'application/json'\n`;
    code += `}\n\n`;

    if (currentEndpoint.method !== 'GET' && Object.keys(formData).length > 0) {
      code += `data = ${JSON.stringify(formData, null, 2)}\n\n`;
    }

    code += `response = requests.${currentEndpoint.method.toLowerCase()}(\n`;
    code += `    '${baseUrl}/${currentEndpoint.path}',\n`;
    code += `    headers=headers`;

    if (currentEndpoint.method !== 'GET' && Object.keys(formData).length > 0) {
      code += `,\n    json=data`;
    }

    code += `\n)\n\nprint(response.json())`;

    return code;
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSnippet(id);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopiedSnippet(null), 2000);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const executeDemo = async () => {
    if (!currentEndpoint) return;

    setIsLoading(true);
    setResponse(null);

    try {
      const { data, error } = await supabase.functions.invoke('api-demo-proxy', {
        body: {
          endpoint: currentEndpoint.id,
          method: currentEndpoint.method,
          platform,
          body: formData
        }
      });

      if (error) throw error;

      setResponse(data);
      
      if (data.success) {
        toast.success("Demo request successful!");
      } else {
        toast.error(data.error || "Demo request failed");
      }
    } catch (error: any) {
      console.error('Demo execution error:', error);
      setResponse({
        success: false,
        error: error.message || 'Failed to execute demo',
      });
      toast.error("Failed to execute demo");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({});
    setResponse(null);
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Endpoint Selector */}
        <div className="space-y-2">
          <Label>Select Endpoint</Label>
          <Select value={selectedEndpoint} onValueChange={(value) => {
            setSelectedEndpoint(value);
            resetForm();
          }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {endpoints.map((endpoint) => (
                <SelectItem key={endpoint.id} value={endpoint.id}>
                  <div className="flex items-center gap-2">
                    <Badge variant={endpoint.method === 'GET' ? 'secondary' : 'default'}>
                      {endpoint.method}
                    </Badge>
                    <span>{endpoint.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentEndpoint && (
            <p className="text-sm text-muted-foreground">{currentEndpoint.description}</p>
          )}
        </div>

        {/* Request Builder */}
        {currentEndpoint && currentEndpoint.fields && currentEndpoint.fields.length > 0 && (
          <div className="space-y-4 p-4 border rounded-lg bg-background/50">
            <h4 className="font-medium">Request Parameters</h4>
            {currentEndpoint.fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
                </Label>
                
                {field.type === 'select' && field.options ? (
                  <Select
                    value={formData[field.name] || field.defaultValue}
                    onValueChange={(value) => handleFieldChange(field.name, value)}
                  >
                    <SelectTrigger id={field.name}>
                      <SelectValue placeholder={field.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === 'textarea' ? (
                  <Textarea
                    id={field.name}
                    placeholder={field.placeholder}
                    value={formData[field.name] || field.defaultValue || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    rows={3}
                  />
                ) : (
                  <Input
                    id={field.name}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={formData[field.name] || field.defaultValue || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Code Examples */}
        <Tabs defaultValue="curl" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="curl">cURL</TabsTrigger>
            <TabsTrigger value="javascript">JavaScript</TabsTrigger>
            <TabsTrigger value="python">Python</TabsTrigger>
          </TabsList>
          
          <TabsContent value="curl" className="relative">
            <div className="relative">
              <pre className="bg-secondary/50 p-4 rounded-lg overflow-x-auto text-sm">
                <code>{generateCurlCommand()}</code>
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(generateCurlCommand(), 'curl')}
              >
                {copiedSnippet === 'curl' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="javascript" className="relative">
            <div className="relative">
              <pre className="bg-secondary/50 p-4 rounded-lg overflow-x-auto text-sm">
                <code>{generateJavaScriptCode()}</code>
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(generateJavaScriptCode(), 'js')}
              >
                {copiedSnippet === 'js' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="python" className="relative">
            <div className="relative">
              <pre className="bg-secondary/50 p-4 rounded-lg overflow-x-auto text-sm">
                <code>{generatePythonCode()}</code>
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(generatePythonCode(), 'python')}
              >
                {copiedSnippet === 'python' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Execute Button */}
        <div className="flex gap-2">
          <Button
            onClick={executeDemo}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Execute Demo
              </>
            )}
          </Button>
          <Button variant="outline" onClick={resetForm}>
            Reset
          </Button>
        </div>

        {/* Response Viewer */}
        {response && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Response</Label>
              {response.success ? (
                <Badge variant="default" className="bg-green-500">Success</Badge>
              ) : (
                <Badge variant="destructive">Error</Badge>
              )}
            </div>
            <div className="relative">
              <pre className="bg-secondary/50 p-4 rounded-lg overflow-x-auto text-sm max-h-96">
                <code>{JSON.stringify(response, null, 2)}</code>
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(JSON.stringify(response, null, 2), 'response')}
              >
                {copiedSnippet === 'response' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {response.meta && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>Response time: {response.meta.response_time_ms}ms</span>
                <Badge variant="secondary" className="text-xs">Demo Mode</Badge>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}