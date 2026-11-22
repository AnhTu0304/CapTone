import net from 'net';

const ALLOWED_WEBHOOK_HOSTS = new Set(['hooks.slack.com']);

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const parts = host.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (ipVersion === 6) {
    if (host === '::1' || host === '::' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
      return true;
    }
    if (host.startsWith('::ffff:')) {
      return isPrivateOrLoopbackHost(host.slice(7));
    }
  }

  return false;
}

/**
 * Validates external Slack webhook URL against SSRF (HTTPS only, public host, strict Slack host allowlist).
 */
export function isValidSafeWebhookUrl(rawUrl: string, allowHosts = ALLOWED_WEBHOOK_HOSTS): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || isPrivateOrLoopbackHost(hostname)) return false;
    return allowHosts.has(hostname);
  } catch {
    return false;
  }
}
