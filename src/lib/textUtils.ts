/**
 * Safely extracts text from a value that might be a string or an object
 * Handles cases where AI API returns {type: "text", text: "..."} instead of plain strings
 */
export function safeText(value: unknown, fallback: string = ""): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && value !== null) {
    // Handle {type: "text", text: "..."} format from AI APIs
    if ('text' in value && typeof (value as any).text === 'string') {
      return (value as any).text;
    }
    // Handle nested text object
    if ('text' in value && typeof (value as any).text === 'object') {
      return safeText((value as any).text, fallback);
    }
    // Fallback to JSON serialization
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return String(value);
}

/**
 * Safely extracts an array of strings from values that might be objects
 */
export function safeTextArray(values: unknown[], fallback: string = ""): string[] {
  if (!Array.isArray(values)) return [];
  return values.map(v => safeText(v, fallback));
}
