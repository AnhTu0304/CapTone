import crypto from 'crypto';
import { redisClient, isRedisReady } from '../config/redis';

const WS_TICKET_TTL_SECONDS = 30;
const MEMORY_TICKETS = new Map<string, { userId: string; expiresAt: number }>();

const CONSUME_SCRIPT = `
local val = redis.call('GET', KEYS[1])
if val then
  redis.call('DEL', KEYS[1])
end
return val
`;

function hashTicket(rawTicket: string): string {
  return crypto.createHash('sha256').update(rawTicket.trim()).digest('hex');
}

export class WsTicketService {
  /**
   * Issues a single-use, 30-second WebSocket authentication ticket bound to a verified user ID.
   */
  public static async issueTicket(userId: string): Promise<{ ticket: string; expires_in: number }> {
    const ticket = crypto.randomBytes(32).toString('hex');
    const key = `ws:ticket:${hashTicket(ticket)}`;

    if (isRedisReady()) {
      await redisClient.set(key, userId, 'EX', WS_TICKET_TTL_SECONDS);
    } else {
      const now = Date.now();
      for (const [k, v] of MEMORY_TICKETS.entries()) {
        if (v.expiresAt <= now) MEMORY_TICKETS.delete(k);
      }
      MEMORY_TICKETS.set(key, { userId, expiresAt: now + WS_TICKET_TTL_SECONDS * 1000 });
    }

    return { ticket, expires_in: WS_TICKET_TTL_SECONDS };
  }

  /**
   * Atomically validates and consumes a single-use WebSocket ticket.
   */
  public static async consumeTicket(rawTicket: string): Promise<string | null> {
    if (!rawTicket || typeof rawTicket !== 'string' || rawTicket.trim().length < 32) {
      return null;
    }
    const key = `ws:ticket:${hashTicket(rawTicket)}`;

    if (isRedisReady()) {
      const userId = await redisClient.eval(CONSUME_SCRIPT, 1, key);
      return typeof userId === 'string' && userId.length > 0 ? userId : null;
    }

    const entry = MEMORY_TICKETS.get(key);
    MEMORY_TICKETS.delete(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      return null;
    }
    return entry.userId;
  }
}
