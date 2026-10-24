import { Request } from 'express';
import { pool } from '../config/database';
import { ApiError } from '../utils/apiError';
import {
  AuditAction,
  AuditReasonCode,
  AuditStatus,
  ICreateAuditLogInput,
  IAuditLog,
  IAuditLogFilter,
} from '../models/auditLog.model';

const SENSITIVE_KEYS_REGEX = /password|token|secret|authorization|cookie|jwt|credential|private_key|api_?key/i;

export class AuditService {
  /**
   * Khử thông tin nhạy cảm (Redaction) đệ quy khỏi object trước khi ghi vào audit log
   */
  public static redactSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.redactSensitiveData(item));
    }

    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEYS_REGEX.test(key)) {
        cleaned[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        cleaned[key] = this.redactSensitiveData(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  /**
   * Làm sạch và chuẩn hóa địa chỉ IP phù hợp với kiểu INET trong PostgreSQL
   */
  public static sanitizeIp(rawIp?: string | null): string | null {
    if (!rawIp) return null;
    let ip = rawIp.trim();

    // Nếu là danh sách IP qua proxy (x-forwarded-for: client, proxy1, proxy2) -> lấy client IP đầu tiên
    if (ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }

    // Chuyển IPv4-mapped IPv6 ::ffff:127.0.0.1 -> 127.0.0.1
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }

    // Bỏ port nếu có (e.g. 192.168.1.1:8080)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(ip)) {
      ip = ip.split(':')[0];
    }

    // Kiểm tra định dạng IPv4 hoặc IPv6 hợp lệ
    const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
    const isIpv6 = /^([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}$/.test(ip) || ip === '::1';

    return isIpv4 || isIpv6 ? ip : null;
  }

  /**
   * Ghi một sự kiện kiểm toán bảo mật vào bảng audit_logs
   */
  public static async record(input: ICreateAuditLogInput): Promise<IAuditLog | null> {
    try {
      const sanitizedIp = this.sanitizeIp(input.ip_address);
      const sanitizedBefore = input.before_data ? this.redactSensitiveData(input.before_data) : null;
      const sanitizedAfter = input.after_data ? this.redactSensitiveData(input.after_data) : null;
      const sanitizedMetadata = input.metadata ? this.redactSensitiveData(input.metadata) : {};

      const query = `
        INSERT INTO audit_logs (
          organization_id,
          user_id,
          actor_type,
          action,
          resource_type,
          resource_id,
          target_type,
          target_id,
          description,
          status,
          reason_code,
          request_id,
          user_agent,
          ip_address,
          before_data,
          after_data,
          metadata,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW()
        )
        RETURNING *;
      `;

      const values = [
        input.organization_id || null,
        input.user_id || null,
        input.actor_type || 'USER',
        input.action,
        input.resource_type || null,
        input.resource_id || null,
        input.target_type || null,
        input.target_id || null,
        input.description || null,
        input.status || 'SUCCESS',
        input.reason_code || null,
        input.request_id || null,
        input.user_agent ? input.user_agent.substring(0, 500) : null,
        sanitizedIp,
        sanitizedBefore ? JSON.stringify(sanitizedBefore) : null,
        sanitizedAfter ? JSON.stringify(sanitizedAfter) : null,
        JSON.stringify(sanitizedMetadata),
      ];

      const res = await pool.query(query, values);
      return res.rows[0] as IAuditLog;
    } catch (error: any) {
      // Ghi cảnh báo ra console, không làm sập luồng nghiệp vụ chính
      console.warn('[AuditService] Không thể ghi audit log:', error?.message || error);
      return null;
    }
  }

  /**
   * Helper trích xuất thông tin người dùng, IP, User-Agent, Request ID từ Express Request
   */
  public static async recordFromRequest(
    req: Request,
    input: Partial<ICreateAuditLogInput> & { action: AuditAction | string; status: AuditStatus | string }
  ): Promise<IAuditLog | null> {
    const user = (req as any).user;
    const orgMember = (req as any).orgMember;

    const orgId =
      input.organization_id !== undefined
        ? input.organization_id
        : orgMember?.organizationId ||
          req.params.orgId ||
          req.params.id ||
          (req.headers['x-organization-id'] as string) ||
          null;

    const userId = input.user_id !== undefined ? input.user_id : user?.id || null;
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'] as string;
    const requestId = (req.headers['x-request-id'] as string) || (req as any).id || null;

    return this.record({
      organization_id: orgId,
      user_id: userId,
      actor_type: input.actor_type || 'USER',
      action: input.action,
      resource_type: input.resource_type || null,
      resource_id: input.resource_id || null,
      target_type: input.target_type || null,
      target_id: input.target_id || null,
      description: input.description || null,
      status: input.status,
      reason_code: input.reason_code || null,
      request_id: requestId,
      user_agent: userAgent,
      ip_address: typeof ip === 'string' ? ip : null,
      before_data: input.before_data,
      after_data: input.after_data,
      metadata: input.metadata,
    });
  }

  /**
   * Tra cứu danh sách nhật ký kiểm toán với bộ lọc và bảo đảm Tenant Isolation tuyệt đối
   */
  public static async query(
    filter: IAuditLogFilter,
    context: {
      user: { id: string; roles?: string[] };
      orgMember?: { organizationId: string; roleCode: string };
    }
  ): Promise<{ data: IAuditLog[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const rawRoles = Array.isArray(context.user.roles) ? context.user.roles : [];
    const isPlatformAdmin = rawRoles.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r.trim().toUpperCase()));

    // Tenant Isolation Enforcement:
    // Nếu không phải Platform Admin: bắt buộc phải có ngữ cảnh organization và CHỈ được xem log của organization đó
    let enforcedOrgId: string | null = null;
    if (!isPlatformAdmin) {
      if (!context.orgMember?.organizationId) {
        throw new ApiError(403, 'Từ chối truy cập: Người dùng không thuộc tổ chức hợp lệ để tra cứu audit log');
      }

      enforcedOrgId = context.orgMember.organizationId;

      // Nếu client tự truyền organization_id khác trong filter -> Ngăn chặn IDOR
      if (filter.organization_id && filter.organization_id !== enforcedOrgId) {
        throw new ApiError(403, 'Từ chối truy cập: Bạn không có quyền xem nhật ký kiểm toán của tổ chức khác');
      }
    } else {
      // Platform Admin có thể xem toàn bộ hoặc lọc theo organization_id tùy chọn
      enforcedOrgId = filter.organization_id || null;
    }

    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (enforcedOrgId) {
      conditions.push(`organization_id = $${paramIndex++}`);
      values.push(enforcedOrgId);
    }

    if (filter.user_id) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(filter.user_id);
    }

    if (filter.action) {
      conditions.push(`action = $${paramIndex++}`);
      values.push(filter.action);
    }

    if (filter.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(filter.status);
    }

    if (filter.resource_type) {
      conditions.push(`resource_type = $${paramIndex++}`);
      values.push(filter.resource_type);
    }

    if (filter.resource_id) {
      conditions.push(`resource_id = $${paramIndex++}`);
      values.push(filter.resource_id);
    }

    if (filter.request_id) {
      conditions.push(`request_id = $${paramIndex++}`);
      values.push(filter.request_id);
    }

    if (filter.reason_code) {
      conditions.push(`reason_code = $${paramIndex++}`);
      values.push(filter.reason_code);
    }

    if (filter.start_date) {
      conditions.push(`created_at >= $${paramIndex++}`);
      values.push(filter.start_date);
    }

    if (filter.end_date) {
      conditions.push(`created_at <= $${paramIndex++}`);
      values.push(filter.end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Đếm tổng số bản ghi
    const countSql = `SELECT COUNT(*)::int AS total FROM audit_logs ${whereClause};`;
    const countRes = await pool.query(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    // Lấy dữ liệu trang
    const dataSql = `
      SELECT 
        id,
        organization_id,
        user_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        target_type,
        target_id,
        description,
        status,
        reason_code,
        request_id,
        user_agent,
        ip_address::text,
        before_data,
        after_data,
        metadata,
        created_at
      FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const dataRes = await pool.query(dataSql, [...values, limit, offset]);

    return {
      data: dataRes.rows as IAuditLog[],
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
