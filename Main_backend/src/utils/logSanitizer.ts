const SENSITIVE_KEY_RE =
  /password|passwd|pwd|secret|token|refresh_token|access_token|csrf|totp|backup_codes|encryption_key|pepper|pagerduty_key|slack_webhook|webhook_url|hmac|private_key|api_?key|authorization|cookie|set-cookie|otp/i;

const URL_CREDENTIALS_RE =
  /((?:postgres|postgresql|mysql|redis|rediss|amqp|amqps|mongodb):\/\/[^:\s/@]*:)([^@\s/]+)(@)/gi;

const BEARER_RE = /\b(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi;
const QUERY_SECRET_RE =
  /([?&](?:token|access_token|refresh_token|approval_token|code|secret|password|passwd|api_key|key)=)([^&\s"']+)/gi;
const KV_SECRET_RE =
  /(["']?(?:password|passwd|pwd|secret|token|refresh_token|access_token|csrf_token|totp_secret|backup_codes|encryption_key|pepper|pagerduty_key|slack_webhook_url|hmac_secret|private_key|api_?key|authorization|x-agent-token|x-csrf-token|x-internal-signature|cookie)["']?\s*[:=]\s*["']?)(?!Bearer\b|\[REDACTED)([^"',\s}\]]{3,})/gi;
const PEM_KEY_RE =
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\b/g;
const AGENT_TOKEN_RE = /\bcap_[A-Za-z0-9_-]{8,}\b/g;
const OPENAI_KEY_RE = /\bsk-[A-Za-z0-9_-]{12,}\b/g;

const PG_SQLSTATE_SYSTEM_RE = /^(?:08|28|3D|3F|42|53|54|57|58|XX)[0-9A-Z]{3}$/i;
const PG_DRIVER_ERROR_MSG_RE =
  /password authentication failed|timeout exceeded when trying to connect|econnrefused|enotfound|etimedout|econnreset|connection terminated unexpectedly|could not resize shared memory|no pg_hba\.conf entry/i;

export const SAFE_DB_ERROR_CLIENT_MESSAGE = 'Lỗi kết nối hoặc xác thực cơ sở dữ liệu hệ thống';

/**
 * Nhận diện lỗi thô phát sinh từ PostgreSQL driver hoặc lỗi kết nối mạng DB
 * để không làm rò rỉ tên user/bảng/mật khẩu DB ra HTTP response kể cả ở môi trường dev.
 */
export function isSensitiveDbDriverError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = String((err as any).code || '').trim();
  if (code && PG_SQLSTATE_SYSTEM_RE.test(code)) {
    return true;
  }
  const msg = String((err as any).message || '');
  return PG_DRIVER_ERROR_MSG_RE.test(msg);
}

/**
 * Chuẩn hóa thông điệp lỗi trả về HTTP client cho cả errorHandler và các controller catch trực tiếp.
 */
export function resolveSafeClientErrorMessage(
  err: unknown,
  options: { isDevelopment: boolean; isApiError: boolean; statusCode: number }
): string {
  if (!options.isApiError && options.statusCode >= 500) {
    if (!options.isDevelopment) {
      return 'Internal Server Error';
    }
    if (isSensitiveDbDriverError(err)) {
      return SAFE_DB_ERROR_CLIENT_MESSAGE;
    }
  }
  return redactSensitiveString((err as Error)?.message || 'Internal Server Error');
}

export function maskSecretValue(value?: string | null): string {
  if (!value || typeof value !== 'string') return '***';
  const trimmed = value.trim();
  if (trimmed.length <= 8) return '***';
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-3)}`;
}

export function redactSensitiveString(input: string): string {
  if (!input || typeof input !== 'string') return input;

  return input
    .replace(PEM_KEY_RE, '[REDACTED_PRIVATE_KEY]')
    .replace(URL_CREDENTIALS_RE, '$1[REDACTED]$3')
    .replace(BEARER_RE, '$1[REDACTED_TOKEN]')
    .replace(QUERY_SECRET_RE, '$1[REDACTED]')
    .replace(KV_SECRET_RE, '$1[REDACTED]')
    .replace(AGENT_TOKEN_RE, 'cap_[REDACTED]')
    .replace(OPENAI_KEY_RE, 'sk-[REDACTED]')
    .replace(JWT_RE, '[REDACTED_JWT]');
}

export function sanitizeForLog(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactSensitiveString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveString(value.message || ''),
      ...(typeof (value as any).code === 'string' || typeof (value as any).code === 'number'
        ? { code: (value as any).code }
        : {}),
      ...(typeof (value as any).statusCode === 'number' ? { statusCode: (value as any).statusCode } : {}),
    };
  }

  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = sanitizeForLog(v, seen);
    }
  }
  return out;
}
