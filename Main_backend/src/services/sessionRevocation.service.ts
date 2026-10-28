import crypto from 'crypto';
import { redisClient, isRedisReady } from '../config/redis';
import { config } from '../config/env';
import { ApiError } from '../utils/apiError';
import { RedisCacheService } from './redisCache.service';

/**
 * Service quản lý việc thu hồi phiên làm việc (Session Revocation) và Token Blacklist
 * Sử dụng Redis để lưu trữ danh sách Token bị vô hiệu hóa với TTL phù hợp
 * Thiết kế bảo mật Fail-Closed: Khi Redis gián đoạn, từ chối cho phép token đi qua
 */
export class SessionRevocationService {
  private static readonly BLACKLIST_PREFIX = 'auth:token_blacklist:';
  private static readonly ORG_MEMBER_CACHE_PREFIX = 'org:member:';
  private static simulatedOffline = false;

  /**
   * Phương thức hỗ trợ kiểm thử: Giả lập Redis offline (chỉ hoạt động trong môi trường test/development)
   */
  public static setSimulatedOffline(offline: boolean): void {
    if (config.isProduction) return;
    this.simulatedOffline = offline;
  }

  /**
   * Kiểm tra xem Redis có sẵn sàng để xử lý xác thực phiên hay không
   */
  public static isAvailable(): boolean {
    if (this.simulatedOffline) return false;
    return isRedisReady();
  }

  /**
   * Tạo hash bảo mật từ token để không lưu token thô vào Redis
   */
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Thu hồi / Blacklist một JWT Token khi người dùng Đăng xuất (Logout)
   * Fail-Closed: Nếu Redis không khả dụng, ném lỗi 503 để caller không ngộ nhận logout thành công
   * @param rawToken Bearer token thô
   * @param ttlSeconds Thời gian sống còn lại của token (tính bằng giây)
   */
  public static async revokeToken(rawToken: string, ttlSeconds: number): Promise<void> {
    if (!rawToken || ttlSeconds <= 0) return;

    if (!this.isAvailable()) {
      if (!config.isProduction) return;
      throw new ApiError(503, 'Dịch vụ xác thực tạm thời không khả dụng, không thể thu hồi phiên đăng nhập');
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
      throw new ApiError(503, 'Dịch vụ xác thực tạm thời không khả dụng, không thể thu hồi phiên đăng nhập');
    }
  }

  /**
   * Kiểm tra xem Token có nằm trong danh sách đã bị thu hồi (Blacklist) hay không
   * Fail-Closed: Nếu Redis lỗi hoặc không thể kết nối, ném lỗi 503 để từ chối truy cập,
   * ngăn chặn triệt để nguy cơ token đã bị thu hồi tiếp tục lọt qua
   */
  public static async isTokenRevoked(rawToken: string): Promise<boolean> {
    if (!rawToken) return false;

    if (!this.isAvailable()) {
      if (!config.isProduction) return false;
      throw new ApiError(503, 'Dịch vụ xác thực tạm thời không khả dụng, không thể xác minh phiên làm việc');
    }

    try {
      const hash = this.hashToken(rawToken);
      const key = `${this.BLACKLIST_PREFIX}${hash}`;
      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (err: any) {
      console.warn('⚠️ [SESSION REVOCATION] Lỗi khi kiểm tra token blacklist:', err.message);
      throw new ApiError(503, 'Dịch vụ xác thực tạm thời không khả dụng, không thể xác minh phiên làm việc');
    }
  }

  /**
   * Thu hồi quyền của người dùng trong tổ chức cụ thể khi bị thay đổi vai trò hoặc xóa
   * Invalidate cả cache thành viên và cache tổ chức
   */
  public static async revokeUserOrgSessions(orgId: string, userId: string): Promise<void> {
    if (!orgId || !userId) return;

    try {
      if (this.isAvailable()) {
        const memberKey = `${this.ORG_MEMBER_CACHE_PREFIX}${orgId}:${userId}`;
        await redisClient.del(memberKey);
      }
      // Đồng thời invalidate cache chi tiết tổ chức để thông tin thành viên / vai trò cập nhật ngay lập tức
      await RedisCacheService.del(RedisCacheService.organizationKey(orgId));
      console.log(`🔄 [SESSION REVOCATION] Đã vô hiệu hóa cache thành viên ${userId} và tổ chức ${orgId}`);
    } catch (err: any) {
      console.warn('⚠️ [SESSION REVOCATION] Lỗi khi xóa cache thành viên tổ chức:', err.message);
    }
  }
}
