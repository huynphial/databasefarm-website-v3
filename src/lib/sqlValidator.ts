/**
 * SQL Query Security Validator for Metric Health Checks
 *
 * NOTE: In production this query will also execute against the target monitored database
 * using an unprivileged, read-only database user account as defense-in-depth —
 * this programmatic validation is not the only safeguard.
 */

const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'TRUNCATE',
  'EXEC',
  'EXECUTE',
  'MERGE',
  'GRANT',
  'REVOKE',
  'CREATE',
];

export interface SqlValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
  hasStandardColumns?: boolean;
}

export function validateMetricSqlQuery(query: string, queryType: 1 | 2 | 3 = 1): SqlValidationResult {
  if (!query || query.trim().length === 0) {
    return { isValid: false, error: 'SQL query cannot be empty.' };
  }

  const cleanQuery = query.trim();

  // 1. Reject multiple statements: semicolon followed by non-whitespace character
  const multipleStatementsRegex = /;[\s]*[^\s]/;
  if (multipleStatementsRegex.test(cleanQuery)) {
    return {
      isValid: false,
      error: 'Multiple SQL statements are prohibited. Remove trailing semicolons chaining secondary queries.',
    };
  }

  // 2. Reject DDL/DML mutation keywords (case-insensitive, matching whole words or inside comment blocks)
  const normalizedQuery = cleanQuery.toUpperCase();

  for (const keyword of FORBIDDEN_KEYWORDS) {
    // Regex matching keyword as independent word boundary or inside comments
    const keywordPattern = new RegExp(`\\b${keyword}\\b`, 'i');
    if (keywordPattern.test(normalizedQuery)) {
      return {
        isValid: false,
        error: `Prohibited SQL keyword detected: "${keyword}". Metric queries must be strictly read-only SELECT / SHOW statements.`,
      };
    }
  }

  // 3. Query should start with standard read queries (SELECT, SHOW, WITH, EXPLAIN)
  const startsWithRead = /^(SELECT|SHOW|WITH|EXPLAIN|INFO|DB|{|\/\*)/i.test(cleanQuery);
  if (!startsWithRead) {
    return {
      isValid: false,
      error: 'Metric queries should begin with a valid read operation.',
    };
  }

  // 4. Schema Column Architecture Check based on queryType
  const hasNameAlias = /\bAS\s+["'`]?name["'`]?\b/i.test(cleanQuery) || /\bname\b/i.test(cleanQuery);
  const hasAttributeAlias = /\bAS\s+["'`]?attribute["'`]?\b/i.test(cleanQuery) || /\battribute\b/i.test(cleanQuery);
  const hasValueAlias = /\bAS\s+["'`]?value["'`]?\b/i.test(cleanQuery) || /\bvalue\b/i.test(cleanQuery);

  let warning: string | undefined;
  if (queryType === 1) {
    if (!hasValueAlias) {
      warning = 'Type 1 Schema notice: Expected 1 column formatted as "AS value" (e.g. "SELECT count(*) AS value FROM ...").';
    }
  } else if (queryType === 2) {
    if (!hasNameAlias || !hasValueAlias) {
      warning = 'Type 2 Schema notice: Expected 2 columns formatted as [name, value] (e.g. "SELECT datname AS name, numbackends AS value FROM ...").';
    }
  } else if (queryType === 3) {
    if (!hasNameAlias || !hasAttributeAlias || !hasValueAlias) {
      warning = 'Type 3 Schema notice: Expected 3 columns formatted as [name, attribute, value] (e.g. "SELECT tablespace_name AS name, \'used_pct\' AS attribute, used_percent AS value FROM ...").';
    }
  }

  return {
    isValid: true,
    warning,
    hasStandardColumns: queryType === 1 ? hasValueAlias : queryType === 2 ? hasNameAlias && hasValueAlias : hasNameAlias && hasAttributeAlias && hasValueAlias,
  };
}
