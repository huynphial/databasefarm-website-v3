/**
 * Security & Type-Guard Sanitization Utilities
 * Remediates CWE-843: Type Confusion through parameter tampering (HTTP query parameter pollution).
 * Defensively extracts and validates strings, string arrays, numbers, and dates.
 */

/**
 * Safely extracts a single trimmed string from an unknown input value,
 * defending against type confusion, parameter tampering (e.g. repeated query keys producing arrays),
 * or non-primitive object injection.
 */
export function safeExtractString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    // If parameter tampering supplied an array (e.g. ?toDate=x&toDate=y), take first valid string
    for (const item of value) {
      const extracted = safeExtractString(item);
      if (extracted !== undefined) return extracted;
    }
    return undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

/**
 * Safely extracts an array of clean strings from unknown input.
 */
export function safeExtractStringArray(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const result = value
      .map((v) => safeExtractString(v))
      .filter((v): v is string => v !== undefined && v.length > 0);
    return result.length > 0 ? result : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (trimmed.includes(',')) {
      const parts = trimmed
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return parts.length > 0 ? parts : undefined;
    }
    return [trimmed];
  }
  return undefined;
}

/**
 * Safely extracts a finite number from unknown input.
 */
export function safeExtractNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') {
    return isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value.trim());
    return !isNaN(parsed) && isFinite(parsed) ? parsed : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = safeExtractNumber(item);
      if (extracted !== undefined) return extracted;
    }
  }
  return undefined;
}

/**
 * Defensively parses and validates a Start / Greater-Than-or-Equal (GTE) date parameter.
 * Handles ISO timestamps, date-only YYYY-MM-DD strings (expanding to T00:00:00.000Z),
 * and protects against Type Confusion & Invalid Date NaN errors.
 */
export function safeParseDateGte(value: unknown): Date | null {
  const str = safeExtractString(value);
  if (!str) return null;

  // Date-only format (e.g., YYYY-MM-DD)
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(str);
  const dateStr = isDateOnly ? `${str}T00:00:00.000Z` : str;
  const parsed = new Date(dateStr);

  if (isNaN(parsed.getTime())) {
    return null; // Reject malformed dates safely without throwing runtime errors
  }
  return parsed;
}

/**
 * Defensively parses and validates an End / Less-Than-or-Equal (LTE) date parameter.
 * Handles ISO timestamps, date-only YYYY-MM-DD strings (expanding to end-of-day T23:59:59.999Z),
 * and protects against Type Confusion & Invalid Date NaN errors.
 */
export function safeParseDateLte(value: unknown): Date | null {
  const str = safeExtractString(value);
  if (!str) return null;

  // Date-only format (e.g., YYYY-MM-DD)
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(str);
  const dateStr = isDateOnly ? `${str}T23:59:59.999Z` : str;
  const parsed = new Date(dateStr);

  if (isNaN(parsed.getTime())) {
    return null; // Reject malformed dates safely without throwing runtime errors
  }
  return parsed;
}

/**
 * Escapes single quotes for fallback SQL string literals to mitigate SQL injection.
 */
export function safeEscapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Converts a validated Date into a safe, SQL-formatted UTC datetime string (YYYY-MM-DD HH:MM:SS).
 */
export function safeFormatSqlDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
