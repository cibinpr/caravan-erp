/**
 * Formatting utilities for Caravan Accounting
 * Conforms to SRS Section 2.6 (Indian Rupee, DD-MM-YYYY) and Section 4.1.2 (UI-D3)
 */

/**
 * Format currency in Indian numbering system (e.g., ₹ 1,25,000.00)
 */
export function formatCurrency(amount, includeSymbol = true) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return includeSymbol ? '₹ 0.00' : '0.00';
  }

  const num = Number(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  return includeSymbol ? `₹ ${formatted}` : formatted;
}

/**
 * Format compact currency for tight spaces (e.g. ₹ 1.25 L, ₹ 2.50 Cr)
 */
export function formatCompactCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹ 0';
  }

  const num = Math.abs(Number(amount));
  const sign = Number(amount) < 0 ? '-' : '';

  if (num >= 10000000) {
    return `${sign}₹ ${(num / 10000000).toFixed(2)} Cr`;
  }
  if (num >= 100000) {
    return `${sign}₹ ${(num / 100000).toFixed(2)} L`;
  }
  if (num >= 1000) {
    return `${sign}₹ ${(num / 1000).toFixed(1)} K`;
  }

  return formatCurrency(amount);
}

/**
 * Format date as DD-MM-YYYY (SRS Section 2.6)
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Format date and time as DD-MM-YYYY hh:mm A
 */
export function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return '—';
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return dateTimeStr;

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${day}-${month}-${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  } catch {
    return dateTimeStr;
  }
}
