import { useState, useEffect } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Download, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import yaml from 'js-yaml';

const ApiExplorer = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [effectiveUrl, setEffectiveUrl] = useState<string>('');
  const [usingFallback, setUsingFallback] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  
  const primaryUrl = 'https://api.kangopenbanking.com/public-api-spec';
  const fallbackUrl = 'https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1/public-api-spec';

  useEffect(() => {
    const validateUrl = async () => {
      try {
        const response = await fetch(primaryUrl, { method: 'HEAD' });
        if (response.ok) {
          setEffectiveUrl(primaryUrl);
          setUsingFallback(false);
        } else {
          setEffectiveUrl(fallbackUrl);
          setUsingFallback(true);
        }
      } catch (error) {
        setEffectiveUrl(fallbackUrl);
        setUsingFallback(true);
      } finally {
        setIsChecking(false);
      }
    };

    validateUrl();
  }, []);

  const handleDownload = async (format: 'json' | 'yaml') => {
    setLoading(true);
    try {
      let response = await fetch(effectiveUrl);
      
      if (!response.ok) {
        const alternateUrl = effectiveUrl === primaryUrl ? fallbackUrl : primaryUrl;
        response = await fetch(alternateUrl);
      }
      
      if (!response.ok) throw new Error('Failed to fetch API spec');
      
      const spec = await response.json();
      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'yaml') {
        content = yaml.dump(spec);
        filename = 'kang-openbanking-api.yaml';
        mimeType = 'text/yaml';
      } else {
        content = JSON.stringify(spec, null, 2);
        filename = 'kang-openbanking-api.json';
        mimeType = 'application/json';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download Started',
        description: `API specification downloaded as ${filename}`,
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download API specification',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {usingFallback && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Using fallback endpoint. Custom domain temporarily unavailable.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">API Explorer</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Interactive documentation powered by Swagger UI. Test endpoints directly from your browser.
        </p>

        <div className="flex gap-4 flex-wrap">
          <Button
            onClick={() => handleDownload('json')}
            variant="outline"
            disabled={loading}
          >
            <Download className="mr-2 h-4 w-4" />
            Download OpenAPI JSON
          </Button>
          <Button
            onClick={() => handleDownload('yaml')}
            variant="outline"
            disabled={loading}
          >
            <Download className="mr-2 h-4 w-4" />
            Download OpenAPI YAML
          </Button>
          <Button variant="outline" asChild>
            <a
              href={effectiveUrl ? `https://editor.swagger.io/?url=${encodeURIComponent(effectiveUrl)}` : '#'}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in Swagger Editor
            </a>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden swagger-container">
        {isChecking ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <SwaggerUI
            url={effectiveUrl}
            docExpansion="list"
            deepLinking={true}
            displayOperationId={true}
            filter={true}
            tryItOutEnabled={true}
          />
        )}
      </Card>
    </div>
  );
};

export default ApiExplorer;
