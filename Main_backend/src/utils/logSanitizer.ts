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
