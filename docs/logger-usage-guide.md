# Logger Usage Guide

## Overview

The application uses a production-safe logger utility (`src/lib/logger.ts`) that provides intelligent logging based on environment. This ensures clean production logs while maintaining full debugging capabilities during development.

## Key Features

- ✅ **Environment-aware**: Full logging in development, suppressed in production
- ✅ **Error tracking ready**: Prepared for integration with monitoring services (Sentry, LogRocket, etc.)
- ✅ **Performance-friendly**: Zero overhead in production when disabled
- ✅ **Backward compatible**: Similar API to native console methods

## Usage

### Import the Logger

```typescript
import { logger } from '@/lib/logger';
```

### Basic Logging Methods

```typescript
// Info logging (development only)
logger.log('User logged in successfully');

// Info with context
logger.info('API call initiated', { endpoint: '/api/accounts', method: 'GET' });

// Warnings (always logged + sent to monitoring)
logger.warn('API rate limit approaching', { remaining: 10 });

// Errors (always logged + sent to monitoring)
logger.error('Failed to fetch user data', error);

// Debug (development only)
logger.debug('Component mounted', { props, state });
```

### Advanced Methods

```typescript
// Group related logs
logger.group('Payment Processing', () => {
  logger.log('Validating payment details');
  logger.log('Charging card');
  logger.log('Updating database');
});

// Time operations
logger.time('API Request');
// ... do work ...
logger.timeEnd('API Request'); // Outputs: API Request: 234ms

// Table output for structured data
logger.table([
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 }
]);
```

## Migration from console.*

### Before (Direct Console Usage)

```typescript
// ❌ Old way - logs in production
try {
  const data = await fetchData();
  console.log('Data fetched:', data);
} catch (error) {
  console.error('Fetch failed:', error);
}
```

### After (Using Logger)

```typescript
// ✅ New way - production-safe
import { logger } from '@/lib/logger';

try {
  const data = await fetchData();
  logger.log('Data fetched:', data);
} catch (error) {
  logger.error('Fetch failed:', error);
}
```

## Configuration

Edit `src/lib/logger.ts` to customize behavior:

```typescript
const config: LogConfig = {
  enableInProduction: false,  // Set true to enable console logs in production
  sendToMonitoring: true,     // Set false to disable monitoring service
};
```

## Integration with Error Tracking Services

To integrate with services like Sentry:

```typescript
// In logger.ts sendToMonitoring method:
private sendToMonitoring(level: LogLevel, message: string, data?: any) {
  if (!import.meta.env.PROD || !config.sendToMonitoring) {
    return;
  }

  // Sentry integration example
  if (level === 'error') {
    Sentry.captureException(new Error(message), {
      extra: data,
      level: 'error'
    });
  } else if (level === 'warn') {
    Sentry.captureMessage(message, {
      extra: data,
      level: 'warning'
    });
  }
}
```

## Best Practices

### ✅ Do

- Use `logger.error()` for exceptions and failures
- Use `logger.warn()` for recoverable issues and deprecations
- Use `logger.info()` or `logger.log()` for general information
- Use `logger.debug()` for detailed debugging information
- Include contextual data as additional parameters

### ❌ Don't

- Don't log sensitive data (passwords, tokens, PII)
- Don't log in tight loops (use strategically)
- Don't rely on logs for business logic
- Don't leave excessive debug logs in production code

## Examples by Use Case

### API Calls

```typescript
logger.time('Fetch User Data');
try {
  const response = await supabase.from('users').select('*');
  logger.log('Users fetched successfully', { count: response.data?.length });
  return response.data;
} catch (error) {
  logger.error('Failed to fetch users', error);
  throw error;
} finally {
  logger.timeEnd('Fetch User Data');
}
```

### Component Lifecycle

```typescript
useEffect(() => {
  logger.debug('Component mounted', { userId, permissions });
  
  return () => {
    logger.debug('Component unmounting', { userId });
  };
}, []);
```

### State Changes

```typescript
const handleSubmit = async (formData: FormData) => {
  logger.group('Form Submission', () => {
    logger.log('Validating form data');
    logger.log('Submitting to API');
  });
  
  try {
    await submitForm(formData);
    logger.info('Form submitted successfully', { formType: 'registration' });
  } catch (error) {
    logger.error('Form submission failed', error, { formData });
  }
};
```

## Performance Impact

- **Development**: Minimal impact, similar to native console methods
- **Production**: Zero impact when `enableInProduction: false`
- **Error tracking**: Only errors/warnings sent to monitoring service

## Testing Considerations

In test environments, you may want to suppress all logs:

```typescript
// In test setup
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
```

Or use the logger's methods directly for assertions:

```typescript
const loggerSpy = jest.spyOn(logger, 'error');
// ... trigger error ...
expect(loggerSpy).toHaveBeenCalledWith('Expected error message');
```
