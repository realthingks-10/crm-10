import { format as dateFnsFormat } from 'date-fns';

// Date format mappings
const dateFormatMap: Record<string, string> = {
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
  'DD-MMM-YYYY': 'dd-MMM-yyyy',
};

// Currency configuration
const currencyConfig: Record<string, { symbol: string; locale: string }> = {
  INR: { symbol: '₹', locale: 'en-IN' },
  USD: { symbol: '$', locale: 'en-US' },
  EUR: { symbol: '€', locale: 'de-DE' },
  GBP: { symbol: '£', locale: 'en-GB' },
  AED: { symbol: 'د.إ', locale: 'ar-AE' },
  SGD: { symbol: 'S$', locale: 'en-SG' },
};

/**
 * Format a date according to the specified format string
 */
export const formatDate = (
  date: Date | string | null | undefined,
  formatString: string = 'DD/MM/YYYY'
): string => {
  if (!date) return '';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const dateFnsFormatStr = dateFormatMap[formatString] || 'dd/MM/yyyy';
    return dateFnsFormat(dateObj, dateFnsFormatStr);
  } catch {
    return '';
  }
};

/**
 * Format a time according to 12h or 24h format
 */
export const formatTime = (
  date: Date | string | null | undefined,
  use24Hour: boolean = false
): string => {
  if (!date) return '';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const formatString = use24Hour ? 'HH:mm' : 'h:mm a';
    return dateFnsFormat(dateObj, formatString);
  } catch {
    return '';
  }
};

/**
 * Format a date and time together
 */
export const formatDateTime = (
  date: Date | string | null | undefined,
  dateFormat: string = 'DD/MM/YYYY',
  use24Hour: boolean = false
): string => {
  if (!date) return '';
  return `${formatDate(date, dateFormat)} ${formatTime(date, use24Hour)}`;
};

/**
 * Format a date with time in the standard CRM format: HH:MM DD-MMM-YYYY
 * Example: 08:30 05-Jan-2026
 */
export const formatDateTimeStandard = (
  date: Date | string | null | undefined
): string => {
  if (!date) return '';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    // Format: HH:mm dd-MMM-yyyy (24-hour time followed by date)
    return dateFnsFormat(dateObj, 'HH:mm dd-MMM-yyyy');
  } catch {
    return '';
  }
};

/**
 * Format a number as currency
 */
export const formatCurrency = (
  amount: number | null | undefined,
  currency: string = 'INR'
): string => {
  if (amount === null || amount === undefined) return '';
  const config = currencyConfig[currency] || currencyConfig.INR;
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Get currency symbol
 */
export const getCurrencySymbol = (currency: string = 'INR'): string => {
  return currencyConfig[currency]?.symbol || '₹';
};

/**
 * Parse a formatted currency string back to number
 */
export const parseCurrency = (value: string): number => {
  // Remove all non-numeric characters except decimal point and minus
  const cleaned = value.replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
};
