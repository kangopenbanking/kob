/**
 * Database logging utility for wrapping Supabase queries with comprehensive logging
 */
import { logger } from './logger';
import type { PostgrestError } from '@supabase/supabase-js';

export interface DatabaseOperation {
  type: 'select' | 'insert' | 'update' | 'delete' | 'rpc';
  table: string;
  description: string;
  filters?: Record<string, any>;
}

export interface DatabaseResult<T> {
  data: T | null;
  error: PostgrestError | null;
  count?: number | null;
}

/**
 * Wrap a Supabase query with comprehensive logging
 * Logs RLS errors, empty results, fetch failures, and successful operations
 */
export async function loggedQuery<T>(
  queryPromise: PromiseLike<{ data: T | null; error: PostgrestError | null; count?: number | null }>,
  operation: DatabaseOperation
): Promise<DatabaseResult<T>> {
  const startTime = Date.now();
  
  try {
    const result = await queryPromise;
    const duration = Date.now() - startTime;
    
    // Check for RLS policy errors (PostgreSQL error code 42501)
    if (result.error?.code === '42501') {
      logger.logRLSError(operation, result.error, { duration });
      return result;
    }
    
    // Check for other errors
    if (result.error) {
      logger.logFetchFailure(operation, result.error, { duration });
      return result;
    }
    
    // Check for empty results (potential RLS filtering or missing data)
    const recordCount = Array.isArray(result.data) 
      ? result.data.length 
      : result.data 
        ? 1 
        : 0;
    
    if (recordCount === 0 && operation.type === 'select') {
      logger.logEmptyResult(operation, { 
        duration, 
        filters: operation.filters 
      });
    }
    
    // Log successful operation
    logger.logDatabaseOperation(operation, true, {
      duration,
      recordCount,
      filters: operation.filters,
    });
    
    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.logFetchFailure(operation, error, { duration });
    throw error;
  }
}

/**
 * Helper for permission checks with logging
 */
export async function loggedPermissionCheck(
  userId: string,
  checkType: 'role' | 'permission',
  checkValue: string,
  checkFn: () => Promise<boolean>
): Promise<boolean> {
  const startTime = Date.now();
  const operation: DatabaseOperation = {
    type: 'rpc',
    table: checkType === 'role' ? 'user_roles' : 'user_permission_overrides',
    description: `Check ${checkType}: ${checkValue}`,
    filters: { userId, checkType, checkValue },
  };
  
  try {
    const hasAccess = await checkFn();
    const duration = Date.now() - startTime;
    
    if (!hasAccess) {
      logger.warn(`Permission denied: ${checkType} ${checkValue} for user ${userId}`, {
        userId,
        checkType,
        checkValue,
        duration,
      });
    } else {
      logger.debug(`Permission granted: ${checkType} ${checkValue}`, {
        userId,
        duration,
      });
    }
    
    return hasAccess;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.logFetchFailure(operation, error, { userId, duration });
    return false;
  }
}

/**
 * Helper for admin access checks with logging
 */
export async function loggedAdminCheck(
  userId: string | undefined,
  checkFn: () => Promise<boolean>
): Promise<boolean> {
  if (!userId) {
    logger.warn('Admin check failed: No user ID provided');
    return false;
  }
  
  return loggedPermissionCheck(userId, 'role', 'admin', checkFn);
}
