/**
 * Production-safe logging utility
 * Logs to console in development, suppresses or sends to monitoring in production
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LogConfig {
  enableInProduction: boolean;
  sendToMonitoring: boolean;
}

const config: LogConfig = {
  enableInProduction: false, // Disable console logs in production
  sendToMonitoring: true, // Send errors to monitoring service
};

class Logger {
  private isDevelopment = import.meta.env.DEV;

  private shouldLog(level: LogLevel): boolean {
    // Always log errors and warnings
    if (level === 'error' || level === 'warn') {
      return true;
    }
    
    // In development, log everything
    if (this.isDevelopment) {
      return true;
    }
    
    // In production, only log if explicitly enabled
    return config.enableInProduction;
  }

  private sendToMonitoring(level: LogLevel, message: string, data?: any) {
    if (!import.meta.env.PROD || !config.sendToMonitoring) {
      return;
    }

    // Only send errors and critical warnings to monitoring
    if (level !== 'error' && level !== 'warn') {
      return;
    }

    // TODO: Integrate with error tracking service (e.g., Sentry, LogRocket)
    const errorData = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Placeholder for monitoring service
    console.debug('Would send to monitoring:', errorData);
  }

  log(message: string, ...args: any[]) {
    if (this.shouldLog('log')) {
      console.log(message, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.shouldLog('info')) {
      console.info(message, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.shouldLog('warn')) {
      console.warn(message, ...args);
    }
    this.sendToMonitoring('warn', message, args);
  }

  error(message: string, error?: any, ...args: any[]) {
    if (this.shouldLog('error')) {
      console.error(message, error, ...args);
    }
    this.sendToMonitoring('error', message, { error, args });
  }

  debug(message: string, ...args: any[]) {
    if (this.shouldLog('debug')) {
      console.debug(message, ...args);
    }
  }

  /**
   * Group logs together (useful for debugging complex flows)
   */
  group(label: string, callback: () => void) {
    if (this.shouldLog('log')) {
      console.group(label);
      callback();
      console.groupEnd();
    }
  }

  /**
   * Time an operation
   */
  time(label: string) {
    if (this.shouldLog('log')) {
      console.time(label);
    }
  }

  timeEnd(label: string) {
    if (this.shouldLog('log')) {
      console.timeEnd(label);
    }
  }

  /**
   * Table output for structured data
   */
  table(data: any) {
    if (this.shouldLog('log')) {
      console.table(data);
    }
  }

  /**
   * Log RLS policy errors with context
   */
  logRLSError(operation: { type: string; table: string; description: string }, error: any, context?: any) {
    const errorData = {
      message: `RLS Policy Error: ${operation.description}`,
      operation: operation.type,
      table: operation.table,
      errorCode: error?.code,
      errorMessage: error?.message,
      context,
      timestamp: new Date().toISOString(),
    };

    this.error('RLS Policy Violation', errorData);
    this.sendToMonitoring('error', `RLS Error on ${operation.table}`, errorData);
  }

  /**
   * Log when a query returns empty results (potential RLS issue)
   */
  logEmptyResult(operation: { type: string; table: string; description: string; filters?: any }, context?: any) {
    const logData = {
      message: `Empty result for: ${operation.description}`,
      operation: operation.type,
      table: operation.table,
      filters: operation.filters,
      context,
      timestamp: new Date().toISOString(),
    };

    this.warn('Empty Query Result', logData);
  }

  /**
   * Log fetch failures with details
   */
  logFetchFailure(operation: { type: string; table: string; description: string }, error: any, context?: any) {
    const errorData = {
      message: `Fetch failed: ${operation.description}`,
      operation: operation.type,
      table: operation.table,
      errorCode: error?.code,
      errorMessage: error?.message,
      errorDetails: error?.details,
      hint: error?.hint,
      context,
      timestamp: new Date().toISOString(),
    };

    this.error('Database Fetch Failure', errorData);
    this.sendToMonitoring('error', `Fetch failure on ${operation.table}`, errorData);
  }

  /**
   * Log database operations with metadata
   */
  logDatabaseOperation(
    operation: { type: string; table: string; description: string },
    success: boolean,
    metadata?: { duration?: number; recordCount?: number; filters?: any }
  ) {
    const logData = {
      operation: operation.type,
      table: operation.table,
      description: operation.description,
      success,
      duration: metadata?.duration,
      recordCount: metadata?.recordCount,
      filters: metadata?.filters,
      timestamp: new Date().toISOString(),
    };

    if (success) {
      this.debug(`DB Operation: ${operation.description}`, logData);
    } else {
      this.warn(`DB Operation Failed: ${operation.description}`, logData);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for backward compatibility with console.*
export default logger;
