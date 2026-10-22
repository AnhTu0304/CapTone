import crypto from 'crypto';
import { redisClient, isRedisReady } from '../config/redis';

/**
 * Service quản lý việc thu hồi phiên làm việc (Session Revocation) và Token Blacklist
 * Sử dụng Redis để lưu trữ danh sách Token bị vô hiệu hóa với TTL phù hợp
 */
export class SessionRevocationService {
  private static readonly BLACKLIST_PREFIX = 'auth:token_blacklist:';
  private static readonly ORG_MEMBER_CACHE_PREFIX = 'org:member:';

  /**
   * Tạo hash bảo mật từ token để không lưu token thô vào Redis
   */
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Thu hồi / Blacklist một JWT Token khi người dùng Đăng xuất (Logout)
   * @param rawToken Bearer token thô
   * @param ttlSeconds Thời gian sống còn lại của token (tính bằng giây)
   */
  public static async revokeToken(rawToken: string, ttlSeconds: number): Promise<void> {
    if (!rawToken || ttlSeconds <= 0) return;

    if (!isRedisReady()) {
      console.warn('⚠️ [SESSION REVOCATION] Redis không sẵn sàng, bỏ qua lưu token blacklist.');
      return;
    }

    try {
      const hash = this.hashToken(rawToken);
      const key = `${this.BLACKLIST_PREFIX}${hash}`;
      // Đặt TTL tối đa bằng thời gian hết hạn của token (tối thiểu 60s)
      const expiry = Math.max(60, Math.floor(ttlSeconds));
      await redisClient.set(key, 'REVOKED', 'EX', expiry);
      console.log(`🔒 [SESSION REVOCATION] Đã thu hồi token (hash: ${hash.slice(0, 8)}..., TTL: ${expiry}s)`);
    } catch (err: any) {
      console.error('❌ [SESSION REVOCATION] Lỗi khi ghi token blacklist vào Redis:', err.message);
    }
  }

  /**
   * Kiểm tra xem Token có nằm trong danh sách đã bị thu hồi (Blacklist) hay không
   */
  public static async isTokenRevoked(rawToken: string): Promise<boolean> {
    if (!rawToken || !isRedisReady()) return false;

    try {
      const hash = this.hashToken(rawToken);
      const key = `${this.BLACKLIST_PREFIX}${hash}`;
      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (err: any) {
      console.warn('⚠️ [SESSION REVOCATION] Lỗi khi kiểm tra token blacklist:', err.message);
      return false; // Fail-open cho Redis error để tránh downtime hệ thống nếu Redis gặp sự cố mạng
    }
  }

  /**
   * Thu hồi quyền của người dùng trong tổ chức cụ thể khi bị thay đổi vai trò hoặc xóa
   */
  public static async revokeUserOrgSessions(orgId: string, userId: string): Promise<void> {
    if (!orgId || !userId || !isRedisReady()) return;

    try {
      const memberKey = `${this.ORG_MEMBER_CACHE_PREFIX}${orgId}:${userId}`;
      await redisClient.del(memberKey);
      console.log(`🔄 [SESSION REVOCATION] Đã vô hiệu hóa cache thành viên ${userId} trong tổ chức ${orgId}`);
    } catch (err: any) {
      console.warn('⚠️ [SESSION REVOCATION] Lỗi khi xóa cache thành viên tổ chức:', err.message);
    }
  }
}
