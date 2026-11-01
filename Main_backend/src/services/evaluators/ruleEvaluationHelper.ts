/**
 * Evaluates a value against a threshold using an AlertOperator
 */
export function evaluateOperator(observed: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case 'GREATER_THAN':
      return observed > threshold;
    case 'GREATER_THAN_OR_EQUAL':
      return observed >= threshold;
    case 'LESS_THAN':
      return observed < threshold;
    case 'LESS_THAN_OR_EQUAL':
      return observed <= threshold;
    case 'EQUAL':
      return Math.abs(observed - threshold) < 0.0001;
    case 'NOT_EQUAL':
      return Math.abs(observed - threshold) >= 0.0001;
    default:
      return false;
  }
}

/**
 * Parses duration or window strings such as '30s', '5m', '1h' into seconds
 */
export function parseWindowToSeconds(windowStr: string): number {
  if (!windowStr) return 300;
  const match = windowStr.trim().match(/^(\d+)(s|m|h)$/i);
  if (!match) return 300;
  const val = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit === 's') return val;
  if (unit === 'm') return val * 60;
  if (unit === 'h') return val * 3600;
  return 300;
}

/**
 * Converts metric bytes to specified target units
 */
export function convertBytesToUnit(bytes: number, targetUnit: string): number {
  switch (targetUnit) {
    case 'KB':
      return bytes / 1024;
    case 'MB':
      return bytes / (1024 * 1024);
    case 'GB':
      return bytes / (1024 * 1024 * 1024);
    case 'Bytes':
    default:
      return bytes;
  }
}

/**
 * Converts metric bytes/sec to specified rate units
 */
export function convertRateToUnit(bytesPerSec: number, targetUnit: string): number {
  switch (targetUnit) {
    case 'KB/s':
      return bytesPerSec / 1024;
    case 'MB/s':
      return bytesPerSec / (1024 * 1024);
    case 'GB/s':
      return bytesPerSec / (1024 * 1024 * 1024);
    case 'B/s':
    default:
      return bytesPerSec;
  }
}
