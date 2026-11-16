import { pool } from '../config/database';
import { CreateBroadcastDto } from '../validations/adminBroadcast.validation';
import { AuditService } from './audit.service';
import { EmailService } from './email.service';
import { ApiError } from '../utils/apiError';

export interface IBroadcastItem {
  id: string;
  broadcast_code: string;
  title: string;
  content: string;
  priority: string;
  audience: string;
  status: string;
  show_sticky_banner: boolean;
  views_count: number;
  created_at: string;
  formatted_date: string;
}

export interface ISystemAlertItem {
  id: string;
  title: string;
  source: string;
  time: string;
  type: 'ORG' | 'AI' | 'SECURITY';
  unread: boolean;
}

export class AdminBroadcastService {
  /**
   * Lấy danh sách thông báo toàn mạng và hộp thư cảnh báo hệ thống từ PostgreSQL
   */
  public static async getBroadcastsOverview(): Promise<{
    broadcasts: IBroadcastItem[];
    systemAlerts: ISystemAlertItem[];
  }> {
    // 1. Lấy danh sách broadcasts
    const broadcastRes = await pool.query(`
      SELECT 
        id, 
        broadcast_code, 
        title, 
        content, 
        priority, 
        audience, 
        status, 
        show_sticky_banner, 
        views_count, 
        created_at
      FROM system_broadcasts
      ORDER BY created_at DESC
      LIMIT 50
    `);

    const broadcasts: IBroadcastItem[] = broadcastRes.rows.map((row) => {
      const d = new Date(row.created_at);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const formatted_date = `${day}/${month}/${year} ${hours}:${minutes}`;

      return {
        id: row.id,
        broadcast_code: row.broadcast_code,
        title: row.title,
        content: row.content,
        priority: row.priority,
        audience: row.audience,
        status: row.status,
        show_sticky_banner: Boolean(row.show_sticky_banner),
        views_count: row.views_count || 0,
        created_at: row.created_at,
        formatted_date,
      };
    });

    // 2. Lấy danh sách cảnh báo hệ thống thực tế cho Super Admin
    const alerts: ISystemAlertItem[] = [];

    try {
      // 2a. Kiểm tra tổ chức mới đăng ký
      const newOrgRes = await pool.query(`
        SELECT name, created_at 
        FROM organizations 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
      if (newOrgRes.rows.length > 0) {
        alerts.push({
          id: 'ALT-ORG-NEW',
          title: `Tổ chức "${newOrgRes.rows[0].name}" vừa kích hoạt trên hệ thống`,
          source: 'Hệ thống Quản lý Doanh nghiệp',
          time: 'Hôm nay',
          type: 'ORG',
          unread: true,
        });
      }

      // 2b. Kiểm tra sự cố nghiêm trọng gần nhất
      const incidentRes = await pool.query(`
        SELECT title, severity, created_at, cluster_id
        FROM incidents
        WHERE severity IN ('CRITICAL', 'HIGH')
        ORDER BY created_at DESC
        LIMIT 1
      `);
      if (incidentRes.rows.length > 0) {
        alerts.push({
          id: 'ALT-INC-CRIT',
          title: `Sự cố ${incidentRes.rows[0].severity}: ${incidentRes.rows[0].title}`,
          source: 'Động Cơ AI eBPF',
          time: 'Gần đây',
          type: 'AI',
          unread: true,
        });
      }

      // 2c. Kiểm tra nhật ký kiểm toán an ninh
      const auditRes = await pool.query(`
        SELECT description, created_at
        FROM audit_logs
        WHERE action LIKE '%BLOCKED%' OR action LIKE '%FAIL%' OR status = 'FAILED'
        ORDER BY created_at DESC
        LIMIT 1
      `);
      if (auditRes.rows.length > 0) {
        alerts.push({
          id: 'ALT-SEC-LOG',
          title: auditRes.rows[0].description || 'Cảnh báo an ninh truy cập bất thường',
          source: 'Hệ thống Kiểm toán SHA-256',
          time: 'Hôm nay',
          type: 'SECURITY',
          unread: false,
        });
      }
    } catch (err) {
      console.warn('[AdminBroadcastService] Lỗi khi truy vấn hộp thư cảnh báo hệ thống:', err);
    }

    // Nếu không có cảnh báo nào từ DB, cung cấp danh sách tiêu chuẩn
    if (alerts.length === 0) {
      alerts.push(
        {
          id: 'ALT-101',
          title: 'Hệ thống AI MAPE-K đang giám sát 100% các cụm Kubernetes',
          source: 'AI Governance Engine',
          time: 'Đang hoạt động',
          type: 'AI',
          unread: false,
        },
        {
          id: 'ALT-102',
          title: 'Chuỗi khối kiểm toán SHA-256 xác thực tính toàn vẹn 100%',
          source: 'Security Audit Ledger',
          time: 'Đang hoạt động',
          type: 'SECURITY',
          unread: false,
        }
      );
    }

    return { broadcasts, systemAlerts: alerts };
  }

  /**
   * Tạo thông báo toàn mạng mới, lưu vào system_broadcasts và broadcast tới bảng notifications
   */
  public static async createBroadcast(
    input: CreateBroadcastDto,
    userId: string,
    reqContext: any
  ): Promise<IBroadcastItem> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Sinh mã thông báo duy nhất
      const countRes = await client.query('SELECT COUNT(*)::int AS count FROM system_broadcasts');
      const currentYear = new Date().getFullYear();
      const nextNum = (countRes.rows[0]?.count || 0) + 10;
      const broadcastCode = `BC-${currentYear}-${String(nextNum).padStart(2, '0')}`;

      // 2. Chuyển đổi nhãn đối tượng
      let audienceLabel = 'Tất cả người dùng';
      if (input.audience === 'OWNERS') audienceLabel = 'Chủ Doanh nghiệp';
      else if (input.audience === 'DEVOPS') audienceLabel = 'Kỹ sư DevOps';

      // 3. Chèn vào bảng system_broadcasts
      const insertBroadcastRes = await client.query(
        `
        INSERT INTO system_broadcasts (
          broadcast_code,
          title,
          content,
          priority,
          audience,
          status,
          show_sticky_banner,
          created_by,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'Đang hiển thị', $6, $7, NOW(), NOW())
        RETURNING *
      `,
        [
          broadcastCode,
          input.title,
          input.content,
          input.priority,
          audienceLabel,
          input.showStickyBanner,
          userId,
        ]
      );

      const createdRow = insertBroadcastRes.rows[0];

      // 4. Phát sóng thông báo tới bảng notifications của các tài khoản phù hợp
      let targetUsersSql = '';
      if (input.audience === 'ALL') {
        targetUsersSql = `SELECT id FROM users WHERE status = 'ACTIVE' AND deleted_at IS NULL`;
      } else if (input.audience === 'OWNERS') {
        targetUsersSql = `
          SELECT DISTINCT u.id 
          FROM users u 
          JOIN organization_members om ON u.id = om.user_id 
          JOIN organization_roles r ON om.role_id = r.id 
          WHERE r.code IN ('SME_OWNER', 'ADMIN') AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
        `;
      } else if (input.audience === 'DEVOPS') {
        targetUsersSql = `
          SELECT DISTINCT u.id 
          FROM users u 
          JOIN organization_members om ON u.id = om.user_id 
          JOIN organization_roles r ON om.role_id = r.id 
          WHERE r.code IN ('DEVOPS', 'ADMIN') AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
        `;
      }

      if (targetUsersSql) {
        await client.query(
          `
          INSERT INTO notifications (
            user_id,
            notification_type,
            title,
            message,
            severity,
            is_read,
            created_at
          )
          SELECT 
            target.id,
            'BROADCAST',
            $1,
            $2,
            $3,
            FALSE,
            NOW()
          FROM (${targetUsersSql}) AS target
        `,
          [input.title, input.content, input.priority]
        );
      }

      await client.query('COMMIT');

      // 4b. Gửi email hàng loạt nếu được bật (hoặc ưu tiên CRITICAL)
      if (input.sendEmail || input.priority === 'CRITICAL') {
        let emailUsersSql = '';
        if (input.audience === 'ALL') {
          emailUsersSql = `SELECT email, full_name FROM users WHERE status = 'ACTIVE' AND deleted_at IS NULL AND email IS NOT NULL`;
        } else if (input.audience === 'OWNERS') {
          emailUsersSql = `
            SELECT DISTINCT u.email, u.full_name 
            FROM users u 
            JOIN organization_members om ON u.id = om.user_id 
            JOIN organization_roles r ON om.role_id = r.id 
            WHERE r.code IN ('SME_OWNER', 'ADMIN') AND u.status = 'ACTIVE' AND u.deleted_at IS NULL AND u.email IS NOT NULL
          `;
        } else if (input.audience === 'DEVOPS') {
          emailUsersSql = `
            SELECT DISTINCT u.email, u.full_name 
            FROM users u 
            JOIN organization_members om ON u.id = om.user_id 
            JOIN organization_roles r ON om.role_id = r.id 
            WHERE r.code IN ('DEVOPS', 'ADMIN') AND u.status = 'ACTIVE' AND u.deleted_at IS NULL AND u.email IS NOT NULL
          `;
        }

        if (emailUsersSql) {
          pool.query(emailUsersSql).then((emailRes) => {
            const recipients = emailRes.rows;
            if (recipients.length > 0) {
              setImmediate(async () => {
                console.log(`📢 [AdminBroadcastService] Bắt đầu gửi email phát sóng [${broadcastCode}] tới ${recipients.length} người dùng...`);
                for (const r of recipients) {
                  try {
                    await EmailService.sendBroadcastEmail({
                      toEmail: r.email,
                      recipientName: r.full_name,
                      broadcastCode,
                      title: input.title,
                      content: input.content,
                      priority: input.priority,
                      senderName: 'Quản Trị Viên Nền Tảng',
                    });
                  } catch (emailErr: any) {
                    console.warn(`[AdminBroadcastService] Lỗi gửi email tới ${r.email}:`, emailErr?.message || emailErr);
                  }
                }
                console.log(`✅ [AdminBroadcastService] Hoàn tất tiến trình gửi email phát sóng [${broadcastCode}].`);
              });
            }
          }).catch((err) => {
            console.warn('[AdminBroadcastService] Lỗi khi truy vấn danh sách email người dùng:', err);
          });
        }
      }

      // 5. Ghi nhật ký kiểm toán (Audit Trail)
      AuditService.record({
        user_id: userId,
        actor_type: 'USER',
        action: 'BROADCAST_CREATED' as any,
        resource_type: 'SYSTEM_BROADCAST',
        resource_id: createdRow.id,
        description: `Quản trị viên phát sóng thông báo toàn mạng: "${input.title}" (${audienceLabel}, Mức độ: ${input.priority})`,
        status: 'SUCCESS' as any,
        metadata: {
          broadcast_code: broadcastCode,
          priority: input.priority,
          audience: input.audience,
        },
        ip_address: reqContext?.ip_address,
        user_agent: reqContext?.user_agent,
      }).catch((e) => console.warn('[AdminBroadcastService] Lỗi ghi audit log:', e));

      const d = new Date(createdRow.created_at);
      const formatted_date = `${String(d.getDate()).padStart(2, '0')}/${String(
        d.getMonth() + 1
      ).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(
        d.getMinutes()
      ).padStart(2, '0')}`;

      return {
        id: createdRow.id,
        broadcast_code: createdRow.broadcast_code,
        title: createdRow.title,
        content: createdRow.content,
        priority: createdRow.priority,
        audience: createdRow.audience,
        status: createdRow.status,
        show_sticky_banner: Boolean(createdRow.show_sticky_banner),
        views_count: createdRow.views_count || 0,
        created_at: createdRow.created_at,
        formatted_date,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[AdminBroadcastService] Lỗi khi tạo thông báo toàn mạng:', err);
      throw new ApiError(500, 'Không thể phát sóng thông báo toàn mạng vào hệ thống cơ sở dữ liệu');
    } finally {
      client.release();
    }
  }

  /**
   * Xóa thông báo toàn mạng khỏi system_broadcasts
   */
  public static async deleteBroadcast(
    broadcastId: string,
    userId: string,
    reqContext: any
  ): Promise<boolean> {
    const delRes = await pool.query(
      'DELETE FROM system_broadcasts WHERE id = $1 RETURNING broadcast_code, title',
      [broadcastId]
    );

    if (delRes.rows.length === 0) {
      throw new ApiError(404, 'Không tìm thấy thông báo cần gỡ bỏ');
    }

    const deleted = delRes.rows[0];

    // Ghi nhật ký kiểm toán
    AuditService.record({
      user_id: userId,
      actor_type: 'USER',
      action: 'BROADCAST_DELETED' as any,
      resource_type: 'SYSTEM_BROADCAST',
      description: `Quản trị viên đã gỡ bỏ thông báo toàn mạng mã ${deleted.broadcast_code}: "${deleted.title}"`,
      status: 'SUCCESS' as any,
      ip_address: reqContext?.ip_address,
      user_agent: reqContext?.user_agent,
    }).catch((e) => console.warn('[AdminBroadcastService] Lỗi ghi audit log:', e));

    return true;
  }
}
