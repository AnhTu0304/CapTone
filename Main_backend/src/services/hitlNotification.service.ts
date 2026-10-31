import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { config } from '../config/env';
import { EmailService } from './email.service';
import { HealingActionService } from './healingAction.service';

export interface HitlTokenPayload {
  approvalId: string;
  healingActionId: string;
  userId: string;
  organizationId: string;
  type: 'HITL_EMAIL_APPROVAL';
}

export class HitlNotificationService {
  /**
   * Sinh Token ký số bảo mật cho 1-Click Approval trong Email (TTL 24 giờ)
   */
  public static generateApprovalToken(
    approvalId: string,
    healingActionId: string,
    userId: string,
    organizationId: string
  ): string {
    const payload: HitlTokenPayload = {
      approvalId,
      healingActionId,
      userId,
      organizationId,
      type: 'HITL_EMAIL_APPROVAL',
    };
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: '24h',
      algorithm: config.jwt.algorithm,
    });
  }

  /**
   * Xác thực Token từ Email
   */
  public static verifyApprovalToken(token: string): HitlTokenPayload | null {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as HitlTokenPayload;
      if (decoded && decoded.type === 'HITL_EMAIL_APPROVAL' && decoded.approvalId) {
        return decoded;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Tự động gửi Email thông báo tới các kỹ sư có quyền (SME_OWNER, DEVOPS) của tổ chức
   */
  public static async notifyApproversForAction(healingActionId: string): Promise<{ notifiedCount: number }> {
    try {
      // 1. Lấy thông tin chi tiết về hành động và tổ chức
      const actionRes = await pool.query(
        `SELECT 
          ap.id AS approval_id,
          ap.status AS approval_status,
          ap.expires_at,
          h.id AS healing_action_id,
          h.target_name,
          h.target_type,
          h.risk_level,
          COALESCE(t.code, 'RESTART_POD') AS action_code,
          COALESCE(t.name, 'Restart Pod') AS action_name,
          p.name AS policy_name,
          env.id AS environment_id,
          env.name AS environment_name,
          COALESCE(env.organization_id, i.organization_id) AS organization_id,
          o.name AS organization_name,
          c.name AS cluster_name,
          rca.root_cause_type,
          rca.root_cause_description,
          rca.confidence_score,
          i.title AS incident_title,
          i.severity AS incident_severity,
          i.description AS incident_description,
          rec.reasoning AS action_reasoning
        FROM approvals ap
        JOIN healing_actions h ON h.id = ap.healing_action_id
        LEFT JOIN environments env ON env.id = h.environment_id
        LEFT JOIN incidents i ON i.id = h.incident_id
        LEFT JOIN organizations o ON o.id = COALESCE(env.organization_id, i.organization_id)
        LEFT JOIN clusters c ON (c.id::text = i.cluster_id::text OR c.cluster_uid = i.cluster_id OR c.name = i.cluster_id)
        LEFT JOIN healing_action_types t ON t.id = h.action_type_id
        LEFT JOIN healing_policies p ON p.id = h.policy_id
        LEFT JOIN ai_recommendations rec ON rec.id = h.recommendation_id
        LEFT JOIN rca_analyses rca ON rca.id = rec.rca_analysis_id
        WHERE h.id = $1 AND ap.status = 'PENDING'
        LIMIT 1;`,
        [healingActionId]
      );

      if (actionRes.rows.length === 0) {
        console.warn(`[HitlNotificationService] Không tìm thấy approval PENDING cho action: ${healingActionId}`);
        return { notifiedCount: 0 };
      }

      const info = actionRes.rows[0];
      const orgId = info.organization_id;

      // 2. Chỉ gửi email phê duyệt HITL cho đúng 2 vai trò vận hành của tổ chức sở hữu tài nguyên:
      // SME_OWNER và DEVOPS (Không gửi cho ADMIN / SUPER_ADMIN cấp quản trị nền tảng)
      if (!orgId) {
        console.warn(`[HitlNotificationService] Hành động ${healingActionId} không xác định được organization_id, bỏ qua gửi email.`);
        return { notifiedCount: 0 };
      }

      const approversQuery = `
        SELECT DISTINCT u.id, u.email, u.full_name, r.code AS role_code
        FROM organization_members om
        JOIN users u ON u.id = om.user_id
        JOIN roles r ON r.id = om.role_id
        WHERE om.organization_id = $1
          AND om.status = 'ACTIVE'
          AND u.status = 'ACTIVE'
          AND r.code IN ('SME_OWNER', 'DEVOPS')
      `;
      const approversParams: any[] = [orgId];

      const approversRes = await pool.query(approversQuery, approversParams);
      const approvers = approversRes.rows;

      if (approvers.length === 0) {
        console.warn(`[HitlNotificationService] Không tìm thấy approver nào có quyền cho org: ${orgId}`);
        return { notifiedCount: 0 };
      }

      // 3. Gửi email thông báo cho từng người có quyền kèm Token cá nhân hóa
      let sentCount = 0;
      let primaryToken = '';

      for (const approver of approvers) {
        const token = this.generateApprovalToken(
          info.approval_id,
          info.healing_action_id,
          approver.id,
          orgId || 'platform'
        );

        if (!primaryToken) primaryToken = token;

        await EmailService.sendHitlApprovalNotification({
          toEmail: approver.email,
          recipientName: approver.full_name || approver.email,
          recipientRole: approver.role_code,
          approvalId: info.approval_id,
          healingActionId: info.healing_action_id,
          targetName: info.target_name,
          targetType: info.target_type || 'POD',
          actionCode: info.action_code,
          actionName: info.action_name,
          riskLevel: info.risk_level || 'HIGH',
          policyName: info.policy_name,
          clusterName: info.cluster_name,
          environmentName: info.environment_name,
          organizationName: info.organization_name,
          incidentTitle: info.incident_title,
          incidentSeverity: info.incident_severity,
          incidentDescription: info.incident_description,
          actionReasoning: info.action_reasoning,
          rootCauseType: info.root_cause_type,
          rootCauseDescription: info.root_cause_description,
          confidenceScore: info.confidence_score ? Math.round(Number(info.confidence_score) * 100) : 75,
          token,
          expiresAt: info.expires_at,
        });

        sentCount++;
      }

      // Lưu lại primary token vào bản ghi approvals để dễ đối soát
      if (primaryToken) {
        await pool.query(
          `UPDATE approvals SET approval_token = $1 WHERE id = $2;`,
          [primaryToken, info.approval_id]
        );
      }

      console.log(`✅ [HitlNotificationService] Đã gửi thông báo phê duyệt tới ${sentCount} kỹ sư cho action ${healingActionId}`);
      return { notifiedCount: sentCount };
    } catch (error: any) {
      console.error('[HitlNotificationService] Lỗi khi gửi thông báo phê duyệt:', error.message);
      return { notifiedCount: 0 };
    }
  }

  /**
   * Xử lý khi kỹ sư click "Phê Duyệt Ngay" từ Email (1-Click Approval)
   */
  public static async processQuickApprove(token: string): Promise<{ success: boolean; html: string; statusCode: number }> {
    const clientUrl = config.email.clientUrl.replace(/:3000\b/, ':3001');
    const dashboardUrl = `${clientUrl}/dashboard/self-healing/approvals`;

    // 1. Xác thực Token
    const decoded = this.verifyApprovalToken(token);
    if (!decoded) {
      return {
        success: false,
        statusCode: 400,
        html: this.renderResponsePage({
          status: 'INVALID_TOKEN',
          title: 'Liên Kết Không Hợp Lệ Hoặc Đã Quá Hạn',
          message: 'Mã xác thực phê duyệt trong email đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập hệ thống Dashboard để kiểm tra phiếu phê duyệt mới nhất.',
          dashboardUrl,
        }),
      };
    }

    try {
      // 2. Tra cứu phiếu phê duyệt và thông tin liên quan
      const apRes = await pool.query(
        `SELECT 
          ap.id, ap.status, ap.expires_at, ap.healing_action_id,
          h.target_name, h.target_type, h.risk_level,
          t.code AS action_code, t.name AS action_name,
          o.name AS organization_name,
          u.full_name AS approved_by_name,
          u.email AS approved_by_email
        FROM approvals ap
        JOIN healing_actions h ON h.id = ap.healing_action_id
        LEFT JOIN environments env ON env.id = h.environment_id
        LEFT JOIN incidents i ON i.id = h.incident_id
        LEFT JOIN organizations o ON o.id = COALESCE(env.organization_id, i.organization_id)
        LEFT JOIN healing_action_types t ON t.id = h.action_type_id
        LEFT JOIN users u ON u.id = ap.approved_by
        WHERE ap.id = $1;`,
        [decoded.approvalId]
      );

      if (apRes.rows.length === 0) {
        return {
          success: false,
          statusCode: 404,
          html: this.renderResponsePage({
            status: 'NOT_FOUND',
            title: 'Không Tìm Thấy Phiếu Phê Duyệt',
            message: 'Phiếu yêu cầu phê duyệt này không tồn tại hoặc đã bị xóa khỏi hệ thống.',
            dashboardUrl,
          }),
        };
      }

      const ap = apRes.rows[0];

      // 3. Nếu đã được xử lý trước đó
      if (ap.status === 'APPROVED') {
        return {
          success: true,
          statusCode: 200,
          html: this.renderResponsePage({
            status: 'ALREADY_APPROVED',
            title: 'Yêu Cầu Đã Được Phê Duyệt Trước Đó',
            message: `Hành động này đã được phê duyệt thành công bởi ${ap.approved_by_email || 'Kỹ sư phụ trách'}. Hệ thống tự phục hồi đã hoặc đang thực thi can thiệp trên hạ tầng.`,
            details: {
              target: ap.target_name,
              action: `${ap.action_name} (${ap.action_code})`,
              organization: ap.organization_name,
            },
            dashboardUrl,
          }),
        };
      }

      if (ap.status === 'REJECTED') {
        return {
          success: false,
          statusCode: 400,
          html: this.renderResponsePage({
            status: 'ALREADY_REJECTED',
            title: 'Yêu Cầu Này Đã Bị Từ Chối',
            message: 'Yêu cầu tự phục hồi này đã bị từ chối phê duyệt trước đó và không thể thực thi.',
            dashboardUrl,
          }),
        };
      }

      // 4. Kiểm tra quyền hạn RBAC của người bấm duyệt
      const userRes = await pool.query(
        `SELECT id, email, full_name, status FROM users WHERE id = $1;`,
        [decoded.userId]
      );
      if (userRes.rows.length === 0 || userRes.rows[0].status !== 'ACTIVE') {
        return {
          success: false,
          statusCode: 403,
          html: this.renderResponsePage({
            status: 'FORBIDDEN',
            title: 'Tài Khoản Không Hợp Lệ Hoặc Bị Khóa',
            message: 'Tài khoản người dùng liên kết với liên kết phê duyệt này không tồn tại hoặc đã bị vô hiệu hóa.',
            dashboardUrl,
          }),
        };
      }
      const user = userRes.rows[0];

      // Kiểm tra xem user có phải là SME_OWNER / DEVOPS của org hoặc SUPER_ADMIN
      const rbacCheck = await pool.query(
        `SELECT 1 FROM organization_members om
         JOIN roles r ON r.id = om.role_id
         WHERE om.organization_id = $1 AND om.user_id = $2 AND om.status = 'ACTIVE' AND r.code IN ('SME_OWNER', 'DEVOPS')
         UNION
         SELECT 1 FROM user_system_roles usr
         JOIN system_roles sr ON sr.id = usr.system_role_id
         WHERE usr.user_id = $2 AND sr.name IN ('SUPER_ADMIN', 'ADMIN');`,
        [decoded.organizationId, decoded.userId]
      );

      if (rbacCheck.rows.length === 0) {
        return {
          success: false,
          statusCode: 403,
          html: this.renderResponsePage({
            status: 'FORBIDDEN',
            title: 'Từ Chối Quyền Truy Cập (RBAC)',
            message: `Tài khoản ${user.email} không có vai trò SME_OWNER hoặc DEVOPS được cấp phép để phê duyệt hành động này.`,
            dashboardUrl,
          }),
        };
      }

      // 5. Thực hiện phê duyệt thông qua HealingActionService (Tự động kích hoạt K8s can thiệp)
      await HealingActionService.approveAction(
        decoded.healingActionId,
        user.id,
        'Phê duyệt nhanh 1-Click an toàn từ Email thông báo',
        user
      );

      // Cập nhật kênh phê duyệt là EMAIL
      await pool.query(
        `UPDATE approvals SET approval_channel = 'EMAIL' WHERE id = $1;`,
        [decoded.approvalId]
      );

      console.log(`🎉 [HitlNotificationService] Đã phê duyệt 1-Click từ Email thành công bởi ${user.email} cho action ${decoded.healingActionId}`);

      return {
        success: true,
        statusCode: 200,
        html: this.renderResponsePage({
          status: 'SUCCESS',
          title: 'Phê Duyệt Thành Công! (Approved Successfully)',
          message: 'Yêu cầu tự phục hồi đã được xác thực an toàn và chuyển tiếp tới Bộ điều khiển Kubernetes để thực thi can thiệp.',
          details: {
            target: ap.target_name,
            action: `${ap.action_name} (${ap.action_code})`,
            approvedBy: `${user.full_name} (${user.email})`,
            organization: ap.organization_name,
            timestamp: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
          },
          dashboardUrl,
        }),
      };
    } catch (err: any) {
      console.error('[HitlNotificationService] Lỗi khi xử lý quick approve:', err);
      return {
        success: false,
        statusCode: 500,
        html: this.renderResponsePage({
          status: 'ERROR',
          title: 'Lỗi Hệ Thống Khi Phê Duyệt',
          message: `Không thể hoàn tất phê duyệt: ${err.message || 'Lỗi không xác định'}. Vui lòng thử lại trên giao diện Dashboard.`,
          dashboardUrl,
        }),
      };
    }
  }


  /**
   * Xử lý khi kỹ sư click "Từ Chối" từ Email (1-Click Reject)
   */
  public static async processQuickReject(token: string): Promise<{ success: boolean; html: string; statusCode: number }> {
    const clientUrl = config.email.clientUrl.replace(/:3000\b/, ':3001');
    const dashboardUrl = `${clientUrl}/dashboard/self-healing/approvals`;

    // 1. Xác thực Token
    const decoded = this.verifyApprovalToken(token);
    if (!decoded) {
      return {
        success: false,
        statusCode: 400,
        html: this.renderResponsePage({
          status: 'INVALID_TOKEN',
          title: 'Liên Kết Không Hợp Lệ Hoặc Đã Quá Hạn',
          message: 'Mã xác thực phê duyệt trong email đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập hệ thống Dashboard để kiểm tra phiếu phê duyệt mới nhất.',
          dashboardUrl,
        }),
      };
    }

    try {
      // 2. Tra cứu phiếu phê duyệt và thông tin liên quan
      const apRes = await pool.query(
        `SELECT 
          ap.id, ap.status, ap.expires_at, ap.healing_action_id,
          h.target_name, h.target_type, h.risk_level,
          t.code AS action_code, t.name AS action_name,
          o.name AS organization_name,
          u.full_name AS approved_by_name,
          u.email AS approved_by_email
        FROM approvals ap
        JOIN healing_actions h ON h.id = ap.healing_action_id
        LEFT JOIN environments env ON env.id = h.environment_id
        LEFT JOIN incidents i ON i.id = h.incident_id
        LEFT JOIN organizations o ON o.id = COALESCE(env.organization_id, i.organization_id)
        LEFT JOIN healing_action_types t ON t.id = h.action_type_id
        LEFT JOIN users u ON u.id = ap.approved_by
        WHERE ap.id = $1;`,
        [decoded.approvalId]
      );

      if (apRes.rows.length === 0) {
        return {
          success: false,
          statusCode: 404,
          html: this.renderResponsePage({
            status: 'NOT_FOUND',
            title: 'Không Tìm Thấy Phiếu Phê Duyệt',
            message: 'Phiếu yêu cầu phê duyệt này không tồn tại hoặc đã bị xóa khỏi hệ thống.',
            dashboardUrl,
          }),
        };
      }

      const ap = apRes.rows[0];

      if (ap.status === 'REJECTED') {
        return {
          success: true,
          statusCode: 200,
          html: this.renderResponsePage({
            status: 'ALREADY_REJECTED',
            title: 'Yêu Cầu Này Đã Bị Từ Chối Trước Đó',
            message: 'Yêu cầu tự phục hồi này đã được từ chối trước đó và không thể thực thi.',
            details: {
              target: ap.target_name,
              action: `${ap.action_name} (${ap.action_code})`,
              organization: ap.organization_name,
            },
            dashboardUrl,
          }),
        };
      }

      if (ap.status === 'APPROVED') {
        return {
          success: false,
          statusCode: 400,
          html: this.renderResponsePage({
            status: 'ALREADY_APPROVED',
            title: 'Yêu Cầu Đã Được Phê Duyệt Trước Đó',
            message: 'Hành động này đã được phê duyệt và không thể từ chối.',
            dashboardUrl,
          }),
        };
      }

      // 3. Tra cứu người dùng
      const userRes = await pool.query(
        `SELECT id, email, full_name, status FROM users WHERE id = $1;`,
        [decoded.userId]
      );
      if (userRes.rows.length === 0 || userRes.rows[0].status !== 'ACTIVE') {
        return {
          success: false,
          statusCode: 403,
          html: this.renderResponsePage({
            status: 'FORBIDDEN',
            title: 'Tài Khoản Không Hợp Lệ Hoặc Bị Khóa',
            message: 'Tài khoản người dùng liên kết với liên kết từ chối này không tồn tại hoặc đã bị vô hiệu hóa.',
            dashboardUrl,
          }),
        };
      }
      const user = userRes.rows[0];

      // 4. Từ chối thông qua HealingActionService
      await HealingActionService.rejectAction(
        decoded.healingActionId,
        user.id,
        'Từ chối 1-Click an toàn từ Email thông báo'
      );

      // Cập nhật kênh phê duyệt là EMAIL
      await pool.query(
        `UPDATE approvals SET approval_channel = 'EMAIL' WHERE id = $1;`,
        [decoded.approvalId]
      );

      console.log(`❌ [HitlNotificationService] Đã từ chối 1-Click từ Email bởi ${user.email} cho action ${decoded.healingActionId}`);

      return {
        success: true,
        statusCode: 200,
        html: this.renderResponsePage({
          status: 'SUCCESS',
          title: 'Đã Từ Chối Yêu Cầu Can Thiệp (Rejected Successfully)',
          message: 'Yêu cầu can thiệp tự phục hồi đã được hủy bỏ an toàn. Không có lệnh nào được thực thi lên cụm Kubernetes.',
          details: {
            target: ap.target_name,
            action: `${ap.action_name} (${ap.action_code})`,
            approvedBy: `${user.full_name} (${user.email})`,
            organization: ap.organization_name,
            timestamp: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
          },
          dashboardUrl,
        }),
      };
    } catch (err: any) {
      console.error('[HitlNotificationService] Lỗi khi xử lý quick reject:', err);
      return {
        success: false,
        statusCode: 500,
        html: this.renderResponsePage({
          status: 'ERROR',
          title: 'Lỗi Hệ Thống Khi Từ Chối',
          message: `Không thể hoàn tất từ chối: ${err.message || 'Lỗi không xác định'}.`,
          dashboardUrl,
        }),
      };
    }
  }

  /**
   * Render Trang Web HTML Phản Hồi Khi Kỹ Sư Click Vào Link Trong Email
   */
  private static renderResponsePage(options: {
    status: 'SUCCESS' | 'ALREADY_APPROVED' | 'ALREADY_REJECTED' | 'INVALID_TOKEN' | 'FORBIDDEN' | 'NOT_FOUND' | 'ERROR';
    title: string;
    message: string;
    details?: {
      target?: string;
      action?: string;
      approvedBy?: string;
      organization?: string;
      timestamp?: string;
    };
    dashboardUrl: string;
  }): string {
    const isSuccess = options.status === 'SUCCESS' || options.status === 'ALREADY_APPROVED';
    const isWarning = options.status === 'ALREADY_APPROVED' || options.status === 'ALREADY_REJECTED';
    
    const themeColor = isSuccess ? '#059669' : (isWarning ? '#D97706' : '#DC2626');
    const iconSvg = isSuccess
      ? `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
      : (isWarning
        ? `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
        : `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`);

    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${options.title} - CapTone AI Self-Healing</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .card { max-width: 540px; width: 100%; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 36px 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); text-align: center; }
        .icon-box { display: inline-flex; align-items: center; justify-content: center; width: 88px; height: 88px; border-radius: 50%; background: ${isSuccess ? 'rgba(5, 150, 105, 0.15)' : (isWarning ? 'rgba(217, 119, 6, 0.15)' : 'rgba(220, 38, 38, 0.15)')}; margin-bottom: 20px; }
        h1 { font-size: 20px; font-weight: 800; margin: 0 0 10px 0; color: #ffffff; }
        p.msg { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 24px 0; }
        .details-table { width: 100%; text-align: left; background: #0f172a; border-radius: 10px; border: 1px solid #334155; padding: 14px 18px; margin-bottom: 26px; font-size: 13px; }
        .details-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #1e293b; }
        .details-row:last-child { border-bottom: none; }
        .details-label { color: #64748b; font-weight: 600; }
        .details-val { color: #e2e8f0; font-weight: 700; text-align: right; }
        .btn-portal { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); transition: background 0.2s; }
        .btn-portal:hover { background: #1d4ed8; }
        .footer-note { font-size: 11px; color: #64748b; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon-box">${iconSvg}</div>
        <h1>${options.title}</h1>
        <p class="msg">${options.message}</p>

        ${options.details ? `
        <div class="details-table">
          ${options.details.target ? `<div class="details-row"><span class="details-label">📦 Dịch vụ / Pod:</span><span class="details-val">${options.details.target}</span></div>` : ''}
          ${options.details.action ? `<div class="details-row"><span class="details-label">⚡ Hành động:</span><span class="details-val">${options.details.action}</span></div>` : ''}
          ${options.details.organization ? `<div class="details-row"><span class="details-label">🏢 Tổ chức:</span><span class="details-val">${options.details.organization}</span></div>` : ''}
          ${options.details.approvedBy ? `<div class="details-row"><span class="details-label">👤 Kỹ sư phê duyệt:</span><span class="details-val">${options.details.approvedBy}</span></div>` : ''}
          ${options.details.timestamp ? `<div class="details-row"><span class="details-label">⏱️ Thời điểm:</span><span class="details-val">${options.details.timestamp}</span></div>` : ''}
        </div>
        ` : ''}

        <a href="${options.dashboardUrl}" class="btn-portal">
          🚀 Mở Bảng Điều Khiển Dashboard
        </a>

        <div class="footer-note">
          CapTone AI Autonomous Self-Healing Platform &bull; HITL Safe Execution &bull; RBAC Verified
        </div>
      </div>
    </body>
    </html>
    `;
  }
}
