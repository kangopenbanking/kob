# Error Boundary Guide

## Overview

The application uses a React Error Boundary component (`src/components/ErrorBoundary.tsx`) to gracefully handle runtime errors and provide a better user experience when unexpected errors occur.

## Features

- ✅ **Graceful degradation**: Shows user-friendly error page instead of blank screen
- ✅ **Development details**: Full error stack traces visible in development mode
- ✅ **Production ready**: Clean error messages without technical details in production
- ✅ **Error tracking**: Ready for integration with monitoring services
- ✅ **User actions**: Provides reload and home navigation options

## How It Works

The Error Boundary wraps the entire application in `src/App.tsx`:

```typescript
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* Rest of app */}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
```

## What Gets Caught

Error Boundaries catch errors during:
- ✅ Rendering
- ✅ Lifecycle methods
- ✅ Constructors of child components

## What Doesn't Get Caught

Error Boundaries **DO NOT** catch:
- ❌ Event handlers (use try-catch)
- ❌ Asynchronous code (setTimeout, promises)
- ❌ Server-side rendering errors
- ❌ Errors in the Error Boundary itself

### Example: Handling Async Errors

```typescript
// ❌ Not caught by Error Boundary
const handleClick = async () => {
  await fetchData(); // If this throws, Error Boundary won't catch it
};

// ✅ Properly handled
const handleClick = async () => {
  try {
    await fetchData();
  } catch (error) {
    logger.error('Failed to fetch data', error);
    toast({
      title: "Error",
      description: "Failed to load data. Please try again.",
      variant: "destructive"
    });
  }
};
```

## Error Boundary UI

### Production View
- Clean error message
- Reload and home navigation buttons
- Support contact information
- No technical details exposed

### Development View
- All production features PLUS:
- Full error message
- Complete stack trace
- Component stack trace
- Expandable error details

## Integration with Error Tracking

The Error Boundary is ready for error tracking service integration:

```typescript
// In ErrorBoundary.tsx
private logErrorToService(error: Error, errorInfo: ErrorInfo) {
  // Example: Sentry integration
  Sentry.captureException(error, {
    contexts: {
      react: {
        componentStack: errorInfo.componentStack
      }
    },
    tags: {
      environment: import.meta.env.MODE,
      url: window.location.href
    }
  });
}
```

## Nested Error Boundaries

For granular error handling, you can nest Error Boundaries:

```typescript
function Dashboard() {
  return (
    <div>
      <ErrorBoundary>
        <CriticalWidget />
      </ErrorBoundary>
      
      <ErrorBoundary>
        <SecondaryWidget />
      </ErrorBoundary>
    </div>
  );
}
```

This way, if one widget fails, the others continue working.

## Testing Error Boundary

### Triggering Errors in Development

```typescript
// Create a test component that throws
function ErrorTest() {
  throw new Error('Test error for Error Boundary');
  return <div>This won't render</div>;
}

// Use it in a route
<Route path="/error-test" element={<ErrorTest />} />
```

### Testing with Jest

```typescript
import { render } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const ThrowError = () => {
  throw new Error('Test error');
};

test('ErrorBoundary catches errors', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  
  const { getByText } = render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );
  
  expect(getByText(/something went wrong/i)).toBeInTheDocument();
  spy.mockRestore();
});
```

## Best Practices

### ✅ Do

- Place Error Boundary high in component tree
- Use multiple boundaries for independent sections
- Log errors to monitoring service
- Provide actionable user feedback
- Test error scenarios regularly

### ❌ Don't

- Don't rely on Error Boundary for async error handling
- Don't catch errors in event handlers without try-catch
- Don't expose sensitive error details in production
- Don't use Error Boundary as replacement for proper error handling
- Don't forget to test error paths

## Monitoring Integration Checklist

When ready to add error monitoring:

1. **Choose a service**: Sentry, LogRocket, Bugsnag, etc.
2. **Install SDK**: `npm install @sentry/react`
3. **Initialize**: Add to `src/main.tsx`
4. **Update ErrorBoundary**: Implement `logErrorToService`
5. **Update Logger**: Implement `sendToMonitoring`
6. **Test**: Verify errors are captured
7. **Configure alerts**: Set up notifications for critical errors

## Example: Sentry Integration

```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay()
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
```

```typescript
// src/components/ErrorBoundary.tsx
private logErrorToService(error: Error, errorInfo: ErrorInfo) {
  Sentry.captureException(error, {
    contexts: {
      react: {
        componentStack: errorInfo.componentStack
      }
    }
  });
}
```

## Recovery Strategies

### Automatic Recovery

```typescript
// Add to ErrorBoundary state
retryCount: 0

// In render
if (this.state.hasError && this.state.retryCount < 3) {
  setTimeout(() => {
    this.setState({ hasError: false, retryCount: this.state.retryCount + 1 });
  }, 2000);
}
```

### Manual Recovery

The current implementation provides:
- **Reload Page**: Full page refresh
- **Go Home**: Navigate to safe state (homepage)

## Common Error Scenarios

### API Failures
```typescript
// Handle in component with try-catch
try {
  await api.call();
} catch (error) {
  logger.error('API call failed', error);
  // Show toast or error message
}
```

### Invalid Data
```typescript
// Validate before rendering
if (!data || !data.requiredField) {
  return <ErrorFallback message="Invalid data" />;
}
```

### Permission Errors
```typescript
// Check permissions before rendering sensitive content
if (!hasPermission) {
  return <AccessDenied />;
}
```

## Support Contact

When users encounter errors, they're directed to:
- **Email**: support@kangopenbanking.com
- **Phone**: +237 6 22 02 25 67

Make sure these contact methods are monitored!
