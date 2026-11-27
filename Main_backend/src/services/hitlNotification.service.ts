import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { config } from '../config/env';
import { EmailService } from './email.service';
import { LOGO_DATA_URI, PROJECT_BRAND_NAME } from './emailBrandAssets';
import { HealingActionService } from './healingAction.service';
import type { IAuditRequestContext } from './audit.service';
import { runWithTenantContext } from '../config/dbContext';

export interface HitlTokenPayload {
  approvalId: string;
  healingActionId: string;
  userId: string;
  organizationId: string;
  jti?: string;
  type: 'HITL_EMAIL_APPROVAL';
}

function hashHitlToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHttpUrl(urlValue: string): string {
  const trimmed = String(urlValue || '').trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return '/dashboard/self-healing/approvals';
}

export class HitlNotificationService {
  /**
   * Sign a short-lived single-use JWT carrying jti/userId/actionId/orgId binding.
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
      jti: crypto.randomUUID(),
      type: 'HITL_EMAIL_APPROVAL',
    };
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: '24h',
      algorithm: config.jwt.algorithm,
    });
  }

  /**
   * Generate and persist SHA-256 hashed approval token in approval_email_tokens (never stores raw JWT).
   */
  public static async issueApprovalEmailToken(
    approvalId: string,
    healingActionId: string,
    userId: string,
    organizationId: string,
    expiresAt?: Date | string | null
  ): Promise<string> {
    const rawToken = this.generateApprovalToken(approvalId, healingActionId, userId, organizationId);
    const decoded = this.verifyApprovalToken(rawToken);
    if (!decoded || !decoded.jti) {
      throw new Error('Failed to generate valid HITL token claims');
    }
    const tokenHash = hashHitlToken(rawToken);
    const expiryExpr = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    await runWithTenantContext(organizationId, userId, async () => {
      await pool.query(
        `INSERT INTO approval_email_tokens (
          approval_id, healing_action_id, organization_id, user_id, token_jti, token_hash, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [approvalId, healingActionId, organizationId, userId, decoded.jti, tokenHash, expiryExpr]
      );
    });

    return rawToken;
  }

  /**
   * Verify JWT signature and required HITL claims.
   */
  public static verifyApprovalToken(token: string): HitlTokenPayload | null {
    try {
      const decoded = jwt.verify(token, config.jwt.secret, {
        algorithms: [config.jwt.algorithm],
      }) as HitlTokenPayload;
      if (
        decoded &&
        decoded.type === 'HITL_EMAIL_APPROVAL' &&
        decoded.approvalId &&
        decoded.healingActionId &&
        decoded.userId &&
        decoded.organizationId &&
        decoded.jti
      ) {
        return decoded;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Send personalized HITL approval emails to active SME_OWNER / DEVOPS members of the owning org.
   */
  public static async notifyApproversForAction(healingActionId: string): Promise<{ notifiedCount: number }> {
    try {
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
        LEFT JOIN clusters c ON (c.id::text = i.cluster_id::text OR c.cluster_uid = i.cluster_id::text OR c.name = i.cluster_id::text)
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

      if (!orgId) {
        console.warn(`[HitlNotificationService] Hành động ${healingActionId} không xác định được organization_id, bỏ qua gửi email.`);
        return { notifiedCount: 0 };
      }

      const approversRes = await pool.query(
        `SELECT DISTINCT u.id, u.email, u.full_name, r.code AS role_code
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
         JOIN organization_roles r ON r.id = om.role_id
         WHERE om.organization_id = $1
           AND om.status = 'ACTIVE'
           AND u.status = 'ACTIVE'
           AND r.code IN ('SME_OWNER', 'DEVOPS')`,
        [orgId]
      );
      const approvers = approversRes.rows;

      if (approvers.length === 0) {
        console.warn(`[HitlNotificationService] Không tìm thấy approver nào có quyền cho org: ${orgId}`);
        return { notifiedCount: 0 };
      }

      let sentCount = 0;
      for (const approver of approvers) {
        const token = await this.issueApprovalEmailToken(
          info.approval_id,
          info.healing_action_id,
          approver.id,
          orgId,
          info.expires_at
        );

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

      console.log(`✅ [HitlNotificationService] Đã gửi thông báo phê duyệt (hashed multi-approver tokens) tới ${sentCount} kỹ sư cho action ${healingActionId}`);
      return { notifiedCount: sentCount };
    } catch (error: any) {
      console.error('[HitlNotificationService] Lỗi khi gửi thông báo phê duyệt:', error.message);
      return { notifiedCount: 0 };
    }
  }

  public static async processQuickApprove(
    token: string,
    reqContext?: IAuditRequestContext
  ): Promise<{ success: boolean; html: string; statusCode: number }> {
    return this.processQuickDecision('APPROVE', token, reqContext);
  }

  public static async processQuickReject(
    token: string,
    reqContext?: IAuditRequestContext
  ): Promise<{ success: boolean; html: string; statusCode: number }> {
    return this.processQuickDecision('REJECT', token, reqContext);
  }

  private static async processQuickDecision(
    mode: 'APPROVE' | 'REJECT',
    token: string,
    reqContext?: IAuditRequestContext
  ): Promise<{ success: boolean; html: string; statusCode: number }> {
    const clientUrl = config.email.clientUrl.replace(/:3000\b/, ':3001');
    const dashboardUrl = `${clientUrl}/dashboard/self-healing/approvals`;

    const decoded = this.verifyApprovalToken(token);
    if (!decoded || !decoded.organizationId || !decoded.userId || !decoded.jti) {
      return {
        success: false,
        statusCode: 400,
        html: this.renderResponsePage({
          status: 'INVALID_TOKEN',
          title: 'Liên Kết Không Hợp Lệ Hoặc Đã Quá Hạn',
          message:
            'Mã xác thực phê duyệt trong email đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập hệ thống Dashboard để kiểm tra phiếu phê duyệt mới nhất.',
          dashboardUrl,
        }),
      };
    }

    const tokenHash = hashHitlToken(token);

    return await runWithTenantContext(decoded.organizationId, decoded.userId, async () => {
      try {
        const apRes = await pool.query(
          `SELECT 
            ap.id, ap.status, ap.expires_at, ap.healing_action_id,
            (ap.expires_at IS NOT NULL AND ap.expires_at <= NOW()) AS is_expired,
            h.target_name, h.target_type, h.risk_level, h.approval_status AS action_approval_status, h.execution_status,
            t.code AS action_code, t.name AS action_name,
            COALESCE(env.organization_id, i.organization_id) AS organization_id,
            o.name AS organization_name
          FROM approvals ap
          JOIN healing_actions h ON h.id = ap.healing_action_id
          LEFT JOIN environments env ON env.id = h.environment_id
          LEFT JOIN incidents i ON i.id = h.incident_id
          LEFT JOIN organizations o ON o.id = COALESCE(env.organization_id, i.organization_id)
          LEFT JOIN healing_action_types t ON t.id = h.action_type_id
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

        if (
          String(ap.healing_action_id) !== String(decoded.healingActionId) ||
          !ap.organization_id ||
          String(ap.organization_id) !== String(decoded.organizationId)
        ) {
          return {
            success: false,
            statusCode: 403,
            html: this.renderResponsePage({
              status: 'FORBIDDEN',
              title: 'Token Không Khớp Hành Động Hoặc Tổ Chức',
              message: 'Mã xác thực email không thuộc hành động hoặc tổ chức hợp lệ.',
              dashboardUrl,
            }),
          };
        }

        // Strict verification against hashed token store (blocks forged/unissued/legacy plaintext tokens)
        const tokenRes = await pool.query(
          `SELECT id, used_at, revoked_at, expires_at, (expires_at <= NOW()) AS tok_expired
           FROM approval_email_tokens
           WHERE approval_id = $1
             AND token_hash = $2
             AND token_jti = $3
             AND user_id = $4
             AND healing_action_id = $5
           LIMIT 1;`,
          [decoded.approvalId, tokenHash, decoded.jti, decoded.userId, decoded.healingActionId]
        );

        if (tokenRes.rows.length === 0) {
          return {
            success: false,
            statusCode: 403,
            html: this.renderResponsePage({
              status: 'FORBIDDEN',
              title: 'Token Phê Duyệt Không Được Hệ Thống Cấp Phát',
              message: 'Liên kết phê duyệt không tồn tại, đã bị thu hồi trước đó hoặc không khớp chữ ký lưu trữ.',
              dashboardUrl,
            }),
          };
        }

        const tokRow = tokenRes.rows[0];

        if (ap.status === 'EXPIRED' || ap.action_approval_status === 'EXPIRED' || ap.is_expired === true || tokRow.tok_expired === true) {
          await pool.query(
            `UPDATE approvals SET status = 'EXPIRED', decided_at = COALESCE(decided_at, NOW()) WHERE id = $1 AND status = 'PENDING';`,
            [decoded.approvalId]
          ).catch(() => {});
          await pool.query(
            `UPDATE healing_actions
             SET approval_status = 'EXPIRED',
                 execution_status = CASE WHEN execution_status = 'PENDING' THEN 'CANCELLED'::execution_status ELSE execution_status END,
                 completed_at = COALESCE(completed_at, NOW())
             WHERE id = $1 AND approval_status IN ('PENDING', 'EXPIRED');`,
            [ap.healing_action_id]
          ).catch(() => {});
          return {
            success: false,
            statusCode: 409,
            html: this.renderResponsePage({
              status: 'INVALID_TOKEN',
              title: 'Yêu Cầu Phê Duyệt Đã Hết Hạn (EXPIRED)',
              message: 'Liên kết và phiếu phê duyệt đã hết hạn theo thời gian cấu hình.',
              dashboardUrl,
            }),
          };
        }

        if (
          tokRow.used_at !== null ||
          tokRow.revoked_at !== null ||
          ap.status === 'APPROVED' ||
          ap.status === 'REJECTED' ||
          ap.action_approval_status !== 'PENDING' ||
          ap.execution_status !== 'PENDING'
        ) {
          const wasRejected = ap.status === 'REJECTED';
          return {
            success: false,
            statusCode: 409,
            html: this.renderResponsePage({
              status: wasRejected ? 'ALREADY_REJECTED' : 'ALREADY_APPROVED',
              title: wasRejected ? 'Yêu Cầu Này Đã Bị Từ Chối' : 'Yêu Cầu Đã Được Xử Lý Trước Đó',
              message: `Phiếu phê duyệt này đã được xử lý trước đó (${ap.status}/${ap.action_approval_status}). Liên kết 1-Click không thể sử dụng lại.`,
              details: {
                target: ap.target_name,
                action: `${ap.action_name} (${ap.action_code})`,
                organization: ap.organization_name,
              },
              dashboardUrl,
            }),
          };
        }

        const userRes = await pool.query(`SELECT id, email, full_name, status FROM users WHERE id = $1;`, [decoded.userId]);
        if (userRes.rows.length === 0 || userRes.rows[0].status !== 'ACTIVE') {
          return {
            success: false,
            statusCode: 403,
            html: this.renderResponsePage({
              status: 'FORBIDDEN',
              title: 'Tài Khoản Không Hợp Lệ Hoặc Bị Khóa',
              message: 'Tài khoản người dùng liên kết với liên kết này không tồn tại hoặc đã bị vô hiệu hóa.',
              dashboardUrl,
            }),
          };
        }
        const user = userRes.rows[0];

        const rbacCheck = await pool.query(
          `SELECT 1 FROM organization_members om
           JOIN organization_roles r ON r.id = om.role_id
           WHERE om.organization_id = $1 AND om.user_id = $2 AND om.status = 'ACTIVE' AND r.code IN ('SME_OWNER', 'DEVOPS', 'ADMIN');`,
          [ap.organization_id, decoded.userId]
        );
        if (rbacCheck.rows.length === 0) {
          return {
            success: false,
            statusCode: 403,
            html: this.renderResponsePage({
              status: 'FORBIDDEN',
              title: 'Từ Chối Quyền Truy Cập (RBAC)',
              message: `Tài khoản ${user.email} không phải là thành viên ACTIVE có vai trò SME_OWNER hoặc DEVOPS của tổ chức để thực hiện thao tác này.`,
              dashboardUrl,
            }),
          };
        }

        // Single-statement atomic claim prevents concurrent multi-click & replay
        const claimRes = await pool.query(
          `UPDATE approval_email_tokens
           SET used_at = NOW()
           WHERE id = $1
             AND used_at IS NULL
             AND revoked_at IS NULL
             AND expires_at > NOW()
           RETURNING id;`,
          [tokRow.id]
        );
        if (claimRes.rows.length === 0) {
          return {
            success: false,
            statusCode: 409,
            html: this.renderResponsePage({
              status: mode === 'REJECT' ? 'ALREADY_REJECTED' : 'ALREADY_APPROVED',
              title: 'Yêu Cầu Đã Được Xử Lý Trước Đó',
              message: 'Liên kết xác thực này đã được sử dụng hoặc thu hồi bởi một thao tác đồng thời.',
              dashboardUrl,
            }),
          };
        }

        if (mode === 'APPROVE') {
          await HealingActionService.approveAction(
            decoded.healingActionId,
            user.id,
            'Phê duyệt an toàn từ Email thông báo',
            user,
            reqContext,
            String(ap.organization_id)
          );
        } else {
          await HealingActionService.rejectAction(
            decoded.healingActionId,
            user.id,
            'Từ chối an toàn từ Email thông báo',
            user,
            reqContext,
            String(ap.organization_id)
          );
        }

        await pool.query(
          `UPDATE approval_email_tokens SET revoked_at = NOW() WHERE approval_id = $1 AND used_at IS NULL;`,
          [decoded.approvalId]
        ).catch(() => {});

        await pool.query(
          `UPDATE approvals SET approval_channel = 'EMAIL' WHERE id = $1;`,
          [decoded.approvalId]
        ).catch(() => {});

        return {
          success: true,
          statusCode: 200,
          html: this.renderResponsePage({
            status: 'SUCCESS',
            title:
              mode === 'APPROVE'
                ? 'Phê Duyệt Thành Công! (Approved Successfully)'
                : 'Đã Từ Chối Yêu Cầu Can Thiệp (Rejected Successfully)',
            message:
              mode === 'APPROVE'
                ? 'Yêu cầu tự phục hồi đã được xác thực an toàn và chuyển tiếp tới Bộ điều khiển Kubernetes để thực thi can thiệp.'
                : 'Yêu cầu can thiệp tự phục hồi đã được hủy bỏ an toàn. Không có lệnh nào được thực thi lên cụm Kubernetes.',
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
        const code = Number(err?.statusCode);
        const statusCode = [400, 403, 404, 409, 410].includes(code) ? code : 500;
        const safeErrMsg =
          statusCode >= 500 && config.isProduction
            ? 'Lỗi nội bộ khi xử lý xác nhận'
            : String(err?.message || 'Lỗi không xác định');
        console.error(`[HitlNotificationService] Lỗi khi xử lý quick ${mode}:`, err?.message || err);
        return {
          success: false,
          statusCode,
          html: this.renderResponsePage({
            status: statusCode === 403 ? 'FORBIDDEN' : 'ERROR',
            title: mode === 'APPROVE' ? 'Không Thể Hoàn Tất Phê Duyệt' : 'Lỗi Hệ Thống Khi Từ Chối',
            message: `Không thể hoàn tất thao tác: ${safeErrMsg}. Vui lòng kiểm tra trên Dashboard.`,
            dashboardUrl,
          }),
        };
      }
    });
  }

  /**
   * Render intermediate HTML confirmation form (prevents GET auto-execution by email scanners).
   */
  public static renderConfirmationPage(mode: 'APPROVE' | 'REJECT', rawToken: string): string {
    const isApprove = mode === 'APPROVE';
    const actionPath = isApprove
      ? `${config.apiPrefix}/healing/approvals/quick-approve`
      : `${config.apiPrefix}/healing/approvals/quick-reject`;
    const btnColor = isApprove ? '#059669' : '#DC2626';
    const title = isApprove ? 'Xác Nhận Phê Duyệt Tự Phục Hồi' : 'Xác Nhận Từ Chối Hành Động Tự Phục Hồi';

    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - ${PROJECT_BRAND_NAME}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { max-width: 480px; width: 100%; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 36px 30px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
    h1 { font-size: 20px; margin: 0 0 12px; color: #ffffff; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 24px; }
    .btn { display: inline-block; border: none; cursor: pointer; background: ${btnColor}; color: #ffffff; font-weight: 700; font-size: 15px; padding: 13px 28px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <img src="${LOGO_DATA_URI}" alt="${PROJECT_BRAND_NAME}" width="52" height="52" style="display:block; margin:0 auto 14px; border-radius:10px;" />
    <h1>${escapeHtml(title)}</h1>
    <p>Để ngăn trình quét email tự động kích hoạt lệnh trên Kubernetes, vui lòng bấm nút xác nhận bên dưới để hoàn tất thao tác.</p>
    <form method="POST" action="${escapeHtml(actionPath)}">
      <input type="hidden" name="token" value="${escapeHtml(rawToken)}" />
      <button type="submit" class="btn">${isApprove ? 'Xác nhận Phê duyệt' : 'Xác nhận Từ chối'}</button>
    </form>
  </div>
</body>
</html>`;
  }

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

    const iconSvg = isSuccess
      ? `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
      : isWarning
        ? `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
        : `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

    const safeDashUrl = escapeHtml(safeHttpUrl(options.dashboardUrl));

    return `<!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(options.title)} - ${PROJECT_BRAND_NAME}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .card { max-width: 540px; width: 100%; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 36px 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); text-align: center; }
        .icon-box { display: inline-flex; align-items: center; justify-content: center; width: 88px; height: 88px; border-radius: 50%; background: ${isSuccess ? 'rgba(5, 150, 105, 0.15)' : isWarning ? 'rgba(217, 119, 6, 0.15)' : 'rgba(220, 38, 38, 0.15)'}; margin-bottom: 20px; }
        h1 { font-size: 20px; font-weight: 800; margin: 0 0 10px 0; color: #ffffff; }
        p.msg { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 24px 0; }
        .details-table { width: 100%; text-align: left; background: #0f172a; border-radius: 10px; border: 1px solid #334155; padding: 14px 18px; margin-bottom: 26px; font-size: 13px; }
        .details-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #1e293b; }
        .details-row:last-child { border-bottom: none; }
        .details-label { color: #64748b; font-weight: 600; }
        .details-val { color: #e2e8f0; font-weight: 700; text-align: right; }
        .btn-portal { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 8px; }
        .footer-note { font-size: 11px; color: #64748b; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon-box">${iconSvg}</div>
        <h1>${escapeHtml(options.title)}</h1>
        <p class="msg">${escapeHtml(options.message)}</p>
        ${options.details ? `
        <div class="details-table">
          ${options.details.target ? `<div class="details-row"><span class="details-label">Dịch vụ / Pod:</span><span class="details-val">${escapeHtml(options.details.target)}</span></div>` : ''}
          ${options.details.action ? `<div class="details-row"><span class="details-label">Hành động:</span><span class="details-val">${escapeHtml(options.details.action)}</span></div>` : ''}
          ${options.details.organization ? `<div class="details-row"><span class="details-label">Tổ chức:</span><span class="details-val">${escapeHtml(options.details.organization)}</span></div>` : ''}
          ${options.details.approvedBy ? `<div class="details-row"><span class="details-label">Kỹ sư xử lý:</span><span class="details-val">${escapeHtml(options.details.approvedBy)}</span></div>` : ''}
          ${options.details.timestamp ? `<div class="details-row"><span class="details-label">Thời điểm:</span><span class="details-val">${escapeHtml(options.details.timestamp)}</span></div>` : ''}
        </div>
        ` : ''}
        <a href="${safeDashUrl}" class="btn-portal">Mở Bảng Điều Khiển Dashboard</a>
        <div class="footer-note">${PROJECT_BRAND_NAME} &bull; HITL Safe Execution &bull; RBAC Verified</div>
      </div>
    </body>
    </html>`;
  }
}
