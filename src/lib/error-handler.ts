/**
 * Centralized Error Handler for the Application
 * Provides user-friendly error messages and error classification
 */

export type ErrorCode = 
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'INVALID_CREDENTIALS'
  | 'SERVICE_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'AUTH_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'CAPTCHA_INVALID'
  | 'PHONE_INVALID'
  | 'DELIVERY_FAILED'
  | 'UNKNOWN_ERROR';

export interface AppError {
  code: ErrorCode;
  message: string;
  userMessage: string;
  action?: string;
  retryable: boolean;
}

// Error code to user-friendly message mapping
const errorMessages: Record<ErrorCode, { message: string; action?: string; retryable: boolean }> = {
  QUOTA_EXCEEDED: {
    message: 'Our SMS service is temporarily at capacity. Please try again later or use WhatsApp instead.',
    action: 'Try WhatsApp delivery',
    retryable: true,
  },
  RATE_LIMITED: {
    message: 'Too many attempts. Please wait a few minutes before trying again.',
    action: 'Wait 15 minutes',
    retryable: true,
  },
  INVALID_CREDENTIALS: {
    message: 'Service configuration error. Please contact support.',
    retryable: false,
  },
  SERVICE_UNAVAILABLE: {
    message: 'This service is temporarily unavailable. Please try again later.',
    retryable: true,
  },
  NETWORK_ERROR: {
    message: 'Connection error. Please check your internet and try again.',
    action: 'Check connection',
    retryable: true,
  },
  VALIDATION_ERROR: {
    message: 'Please check your input and try again.',
    retryable: true,
  },
  AUTH_REQUIRED: {
    message: 'Please sign in to continue.',
    action: 'Sign in',
    retryable: false,
  },
  PERMISSION_DENIED: {
    message: 'You don\'t have permission to perform this action.',
    retryable: false,
  },
  NOT_FOUND: {
    message: 'The requested resource was not found.',
    retryable: false,
  },
  CAPTCHA_INVALID: {
    message: 'Security verification failed. Please complete the captcha again.',
    action: 'Refresh captcha',
    retryable: true,
  },
  PHONE_INVALID: {
    message: 'Please enter a valid phone number in international format (e.g., +237XXXXXXXXX).',
    retryable: true,
  },
  DELIVERY_FAILED: {
    message: 'Unable to deliver message. Please verify your phone number and try again.',
    retryable: true,
  },
  UNKNOWN_ERROR: {
    message: 'Something went wrong. Please try again or contact support.',
    retryable: true,
  },
};

/**
 * Parse error from edge function response
 */
export function parseEdgeFunctionError(error: any): AppError {
  // Extract error details from various error formats
  const errorBody = error?.context?.body || error?.message || error?.details || '';
  const statusCode = error?.context?.status || error?.status;
  
  let errorCode: ErrorCode = 'UNKNOWN_ERROR';
  let specificMessage = '';

  // Parse JSON error body if present
  let parsedBody: any = {};
  if (typeof errorBody === 'string') {
    try {
      parsedBody = JSON.parse(errorBody);
    } catch {
      parsedBody = { error: errorBody };
    }
  } else {
    parsedBody = errorBody;
  }

  // Check for specific error codes from edge function
  if (parsedBody.error_code) {
    errorCode = parsedBody.error_code as ErrorCode;
    specificMessage = parsedBody.details || parsedBody.error || '';
  } else {
    // Infer error code from message content
    const errorText = (parsedBody.error || parsedBody.details || errorBody || '').toLowerCase();
    
    if (errorText.includes('quota exceeded') || errorText.includes('quota')) {
      errorCode = 'QUOTA_EXCEEDED';
    } else if (errorText.includes('rate limit') || errorText.includes('too many') || statusCode === 429) {
      errorCode = 'RATE_LIMITED';
    } else if (errorText.includes('credentials') || errorText.includes('not configured')) {
      errorCode = 'INVALID_CREDENTIALS';
    } else if (errorText.includes('captcha') || errorText.includes('unverified')) {
      errorCode = 'CAPTCHA_INVALID';
    } else if (errorText.includes('phone') || errorText.includes('invalid') && errorText.includes('format')) {
      errorCode = 'PHONE_INVALID';
    } else if (errorText.includes('delivery failed') || errorText.includes('failed to send')) {
      errorCode = 'DELIVERY_FAILED';
    } else if (statusCode === 401) {
      errorCode = 'AUTH_REQUIRED';
    } else if (statusCode === 403) {
      errorCode = 'PERMISSION_DENIED';
    } else if (statusCode === 404) {
      errorCode = 'NOT_FOUND';
    } else if (statusCode === 503 || errorText.includes('unavailable')) {
      errorCode = 'SERVICE_UNAVAILABLE';
    }
  }

  const errorConfig = errorMessages[errorCode];

  return {
    code: errorCode,
    message: specificMessage || parsedBody.error || 'An error occurred',
    userMessage: errorConfig.message,
    action: errorConfig.action,
    retryable: errorConfig.retryable,
  };
}

/**
 * Format error for display in toast
 */
export function formatErrorForToast(error: any): { title: string; description: string } {
  const appError = parseEdgeFunctionError(error);
  
  return {
    title: getErrorTitle(appError.code),
    description: appError.action 
      ? `${appError.userMessage} ${appError.action}.`
      : appError.userMessage,
  };
}

/**
 * Get a title for the error based on error code
 */
function getErrorTitle(code: ErrorCode): string {
  const titles: Record<ErrorCode, string> = {
    QUOTA_EXCEEDED: 'Service Limit Reached',
    RATE_LIMITED: 'Too Many Requests',
    INVALID_CREDENTIALS: 'Configuration Error',
    SERVICE_UNAVAILABLE: 'Service Unavailable',
    NETWORK_ERROR: 'Connection Error',
    VALIDATION_ERROR: 'Invalid Input',
    AUTH_REQUIRED: 'Authentication Required',
    PERMISSION_DENIED: 'Access Denied',
    NOT_FOUND: 'Not Found',
    CAPTCHA_INVALID: 'Verification Failed',
    PHONE_INVALID: 'Invalid Phone Number',
    DELIVERY_FAILED: 'Delivery Failed',
    UNKNOWN_ERROR: 'Error',
  };
  
  return titles[code] || 'Error';
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: any): boolean {
  const appError = parseEdgeFunctionError(error);
  return appError.retryable;
}

/**
 * Get suggested action for error
 */
export function getSuggestedAction(error: any): string | undefined {
  const appError = parseEdgeFunctionError(error);
  return appError.action;
}
