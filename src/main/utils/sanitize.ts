/**
 * Utility functions for sanitizing sensitive data from logs and reports
 */

/**
 * List of sensitive keys that should be sanitized
 */
const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'api_key',
  'apikey',
  'api-key',
  'auth',
  'authorization',
  'credentials',
  'private_key',
  'privatekey',
  'access_token',
  'refresh_token',
  'session',
  'cookie',
];

/**
 * Check if a key name indicates sensitive data
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some(sensitiveKey => lowerKey.includes(sensitiveKey));
}

/**
 * Sanitize an object by replacing sensitive values with [REDACTED]
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize a string by replacing common patterns that might contain sensitive data
 */
export function sanitizeString(text: string): string {
  if (!text) {
    return text;
  }

  let sanitized = text;

  // Sanitize authorization headers
  sanitized = sanitized.replace(
    /authorization:\s*[^\s,}]+/gi,
    'authorization: [REDACTED]'
  );

  // Sanitize bearer tokens
  sanitized = sanitized.replace(
    /bearer\s+[A-Za-z0-9_-]+/gi,
    'bearer [REDACTED]'
  );

  // Sanitize API keys in URLs
  sanitized = sanitized.replace(
    /([?&])(api[-_]?key|token|auth)=[^&\s]+/gi,
    '$1$2=[REDACTED]'
  );

  // Sanitize passwords in connection strings
  sanitized = sanitized.replace(
    /(password|pwd)=([^;,\s&]+)/gi,
    '$1=[REDACTED]'
  );

  // Sanitize basic auth in URLs
  sanitized = sanitized.replace(
    /:\/\/([^:]+):([^@]+)@/g,
    '://$1:[REDACTED]@'
  );

  return sanitized;
}

/**
 * Sanitize environment variables by removing sensitive ones
 */
export function sanitizeEnvVars(env: Record<string, string | undefined>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      continue;
    }

    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize .env file content
 */
export function sanitizeEnvFileContent(content: string): string {
  const lines = content.split('\n');
  const sanitizedLines = lines.map(line => {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) {
      return line;
    }

    // Parse key=value pairs
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();

      if (isSensitiveKey(key)) {
        return `${key}=[REDACTED]`;
      }
    }

    return line;
  });

  return sanitizedLines.join('\n');
}

/**
 * Sanitize log content by removing sensitive information
 */
export function sanitizeLogContent(content: string): string {
  return sanitizeString(content);
}
