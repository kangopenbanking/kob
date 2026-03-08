import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  portalName?: string;
  fallbackPath?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Per-portal error boundary that catches errors within a specific portal
 * without crashing the entire application.
 */
export class PortalErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[${this.props.portalName || 'Portal'}] Error:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleNavigateBack = () => {
    window.location.href = this.props.fallbackPath || '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <Card className="max-w-md w-full border-border/60">
            <CardHeader className="text-center pb-3">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-lg">Something went wrong</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                An error occurred in {this.props.portalName || 'this section'}. Your data is safe.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {import.meta.env.DEV && this.state.error && (
                <details className="cursor-pointer">
                  <summary className="text-xs text-muted-foreground">Error details</summary>
                  <pre className="mt-2 text-xs p-2 bg-muted rounded overflow-auto max-h-32">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
              <div className="flex gap-2 justify-center">
                <Button size="sm" onClick={this.handleRetry} className="gap-2">
                  <RefreshCw className="h-3.5 w-3.5" /> Try Again
                </Button>
                <Button size="sm" variant="outline" onClick={this.handleNavigateBack} className="gap-2">
                  <ArrowLeft className="h-3.5 w-3.5" /> Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
