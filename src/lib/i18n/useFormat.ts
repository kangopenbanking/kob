import { useMemo } from 'react';
import { useLanguage } from './LanguageContext';

/**
 * Locale-aware formatting helpers bound to the current UI language.
 *
 * Maps internal language codes to BCP-47 locales:
 *   en -> en-US (default)   fr -> fr-FR
 *
 * Use this everywhere instead of bare `.toLocaleString()` /
 * `Intl.NumberFormat()` so numbers, dates, currencies and lists
 * follow the user's chosen language without further plumbing.
 */
export function useFormat() {
  const { language } = useLanguage();

  return useMemo(() => {
    const locale = language === 'fr' ? 'fr-FR' : 'en-US';

    const number = (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value);

    const currency = (
      value: number,
      currencyCode = 'XAF',
      options?: Intl.NumberFormatOptions,
    ) => {
      // XAF is a zero-decimal currency in our domain — match server behaviour.
      const isZeroDecimal = ['XAF', 'XOF', 'JPY', 'KRW'].includes(currencyCode);
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: isZeroDecimal ? 0 : 2,
        maximumFractionDigits: isZeroDecimal ? 0 : 2,
        ...options,
      }).format(value);
    };

    const percent = (value: number, fractionDigits = 1) =>
      new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(value);

    const date = (
      value: Date | string | number,
      options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
    ) => new Intl.DateTimeFormat(locale, options).format(new Date(value));

    const dateTime = (value: Date | string | number) =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value));

    const relativeTime = (
      value: Date | string | number,
      now: Date = new Date(),
    ) => {
      const target = new Date(value).getTime();
      const diffSec = Math.round((target - now.getTime()) / 1000);
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ['year', 60 * 60 * 24 * 365],
        ['month', 60 * 60 * 24 * 30],
        ['week', 60 * 60 * 24 * 7],
        ['day', 60 * 60 * 24],
        ['hour', 60 * 60],
        ['minute', 60],
        ['second', 1],
      ];
      for (const [unit, sec] of units) {
        if (Math.abs(diffSec) >= sec || unit === 'second') {
          return rtf.format(Math.round(diffSec / sec), unit);
        }
      }
      return rtf.format(0, 'second');
    };

    const list = (
      items: string[],
      type: 'conjunction' | 'disjunction' = 'conjunction',
    ) => new Intl.ListFormat(locale, { style: 'long', type }).format(items);

    return { locale, number, currency, percent, date, dateTime, relativeTime, list };
  }, [language]);
}
