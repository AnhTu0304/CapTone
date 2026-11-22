import crypto from 'crypto';
import { config } from '../config/env';

/**
 * Generates HMAC-SHA256 authentication headers for internal Main_backend -> AI_backend requests.
 */
export function buildAiInternalAuthHeaders(
  method: string,
  path: string,
  body: string | Buffer = ''
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const bodySha256 = crypto.createHash('sha256').update(body).digest('hex');
  const canonical = `${timestamp}\n${nonce}\n${method.toUpperCase()}\n${path}\n${bodySha256}`;
  const signature = crypto
    .createHmac('sha256', config.aiInternalHmacSecret)
    .update(canonical)
    .digest('hex');

  return {
    'X-Internal-Timestamp': timestamp,
    'X-Internal-Nonce': nonce,
    'X-Internal-Body-Sha256': bodySha256,
    'X-Internal-Signature': signature,
  };
}
