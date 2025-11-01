import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Log to monitoring service in production
    if (import.meta.env.PROD) {
      this.logErrorToService(error, errorInfo);
    }
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // Placeholder for error tracking service integration
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.error('Error logged to service:', errorData);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-2xl w-full">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-destructive/10">
                  <AlertTriangle className="h-12 w-12 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-2xl">Something went wrong</CardTitle>
              <CardDescription className="text-base">
                We encountered an unexpected error. Our team has been notified and we're working to fix it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {import.meta.env.DEV && this.state.error && (
                <div className="space-y-2">
                  <details className="cursor-pointer">
                    <summary className="text-sm font-semibold text-muted-foreground hover:text-foreground">
                      Error Details (Development Mode)
                    </summary>
                    <div className="mt-4 p-4 bg-muted rounded-lg overflow-auto">
                      <p className="text-sm font-mono text-destructive mb-2">
                        {this.state.error.message}
                      </p>
                      {this.state.error.stack && (
                        <pre className="text-xs text-muted-foreground overflow-x-auto">
                          {this.state.error.stack}
                        </pre>
                      )}
                      {this.state.errorInfo && (
                        <pre className="text-xs text-muted-foreground overflow-x-auto mt-4">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      )}
                    </div>
                  </details>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={this.handleReload} variant="default" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Reload Page
                </Button>
                <Button onClick={this.handleGoHome} variant="outline" className="gap-2">
                  <Home className="h-4 w-4" />
                  Go to Homepage
                </Button>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                <p>If the problem persists, please contact support at:</p>
                <a 
                  href="mailto:support@kangopenbanking.com" 
                  className="text-primary hover:underline font-medium"
                >
                  support@kangopenbanking.com
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
