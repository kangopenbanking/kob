/**
 * useAccountValidation — Inline account identifier validation hook
 * 
 * Validates RIB, IBAN, BIC, and generic account identifiers
 * against POST /v1/standards/validate/* endpoints on blur
 * 
 * Standards: CEMAC RIB (23-digit), ISO 13616 (IBAN), ISO 9362 (BIC)
 */

import { useState, useCallback } from 'react';
import { kobApi, KOBApiError } from '@/lib/kob-api-client';

type ValidationType = 'rib' | 'iban' | 'bic' | 'account';

interface ValidationResult {
  valid: boolean;
  error?: string;
  loading: boolean;
}

interface ValidationState {
  [fieldKey: string]: ValidationResult;
}

export function useAccountValidation() {
  const [validations, setValidations] = useState<ValidationState>({});

  const setFieldState = (key: string, result: Partial<ValidationResult>) => {
    setValidations(prev => ({
      ...prev,
      [key]: { ...prev[key], loading: false, valid: false, ...result },
    }));
  };

  /**
   * Validate an account identifier on field blur
   */
  const validate = useCallback(async (
    fieldKey: string,
    type: ValidationType,
    value: string
  ): Promise<boolean> => {
    const trimmed = value.replace(/[\s\-]/g, '');
    if (!trimmed) {
      setFieldState(fieldKey, { valid: false, error: undefined, loading: false });
      return false;
    }

    setFieldState(fieldKey, { loading: true, error: undefined });

    try {
      let endpoint: string;
      let body: Record<string, string>;

      switch (type) {
        case 'rib':
          endpoint = 'standards/validate/rib';
          body = { rib: trimmed };
          break;
        case 'iban':
          endpoint = 'standards/validate/iban';
          body = { iban: trimmed };
          break;
        case 'bic':
          endpoint = 'standards/validate/bic';
          body = { bic: trimmed };
          break;
        default:
          endpoint = 'standards/validate/account-identifier';
          body = { type: type, value: trimmed };
      }

      await kobApi.post(endpoint, body);
      setFieldState(fieldKey, { valid: true, loading: false });
      return true;
    } catch (err) {
      const message = err instanceof KOBApiError
        ? err.problem.detail || 'Invalid identifier'
        : 'Validation failed';
      setFieldState(fieldKey, { valid: false, error: message, loading: false });
      return false;
    }
  }, []);

  /**
   * Get validation state for a specific field
   */
  const getFieldValidation = useCallback((fieldKey: string): ValidationResult => {
    return validations[fieldKey] || { valid: false, loading: false };
  }, [validations]);

  /**
   * Check if all specified fields are valid
   */
  const allValid = useCallback((fieldKeys: string[]): boolean => {
    return fieldKeys.every(key => validations[key]?.valid === true);
  }, [validations]);

  /**
   * Reset validation state for a field or all fields
   */
  const resetField = useCallback((fieldKey?: string) => {
    if (fieldKey) {
      setValidations(prev => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    } else {
      setValidations({});
    }
  }, []);

  return {
    validate,
    getFieldValidation,
    allValid,
    resetField,
    validations,
  };
}
