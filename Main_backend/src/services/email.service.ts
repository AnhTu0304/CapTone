import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { config } from '../config/env';
import { maskSecretValue, redactSensitiveString } from '../utils/logSanitizer';
import { getLogoAttachment, LOGO_CID, PROJECT_BRAND_NAME, renderBrandedEmailLayout } from './emailBrandAssets';

/**
 * Service xử lý việc gửi email thông báo và xác thực tài khoản
 */
export class EmailService {
  private static transporter: Transporter | null = null;

  /**
   * Setter phục vụ việc inject mock transporter trong unit test
   */
  public static setTransporterForTesting(customTransporter: Transporter | null): void {
    if (config.isProduction) {
      throw new Error('SECURITY VIOLATION: setTransporterForTesting is strictly forbidden in production');
    }
    this.transporter = customTransporter;
  }

  /**
   * Phân biệt lỗi tạm thời (Transient) có thể retry vs lỗi vĩnh viễn (Permanent) không được retry
   * - Transient: ETIMEDOUT, ECONNRESET, ECONNREFUSED, ESOCKET, EAI_AGAIN, ENOTFOUND, SMTP 4xx (421, 450, 451, 452)
   * - Permanent: SMTP 535 (Auth Failed), 501 (Syntax), 550 (User Unknown), 553 (Relay Denied)
   */
  public static isTransientError(error: any): boolean {
    if (!error) return false;

    const code = error.code || '';
    const responseCode = Number(error.responseCode);

    // Lỗi mạng hoặc DNS tạm thời
    const transientCodes = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ESOCKET', 'EAI_AGAIN', 'ENOTFOUND'];
    if (transientCodes.includes(code)) {
      return true;
    }

    // SMTP 4xx: Transient negative completion
    if (responseCode >= 400 && responseCode < 500) {
      return true;
    }

    // SMTP 5xx (535 Auth Failed, 501 Syntax, 550 Recipient Rejected) -> Permanent, tuyệt đối không retry
    if (responseCode >= 500 && responseCode < 600) {
      return false;
    }

    return false;
  }

  /**
   * Xác định địa chỉ người gửi (FROM) tuân thủ chặt chẽ chính sách SPF/DMARC của Gmail SMTP
   */
  public static getFromAddress(): string {
    // Nếu sử dụng Gmail SMTP (smtp.gmail.com), địa chỉ email gửi phải trùng với tài khoản xác thực SMTP_USER
    if (config.email.host.includes('gmail.com') && config.email.user) {
      const match = config.email.from.match(/^"?(.*?)"?\s*<.*?>$/);
      const displayName = match && match[1] ? match[1] : 'AI Self-Heal Support';
      return `"${displayName}" <${config.email.user}>`;
    }

    return config.email.from || (config.email.user ? `"AI Self-Heal Support" <${config.email.user}>` : 'noreply@selfheal.io');
  }

  /**
   * Khởi tạo hoặc lấy Transporter hiện tại của nodemailer với cấu hình timeout và STARTTLS
   */
  private static getTransporter(): Transporter | null {
    if (!config.email.user || !config.email.pass) {
      return null;
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        requireTLS: !config.email.secure && config.email.port === 587,
        connectionTimeout: 10000, // 10 giây tránh treo request khi nghẽn mạng
        greetingTimeout: 10000,
        socketTimeout: 15000,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      });
    }

    return this.transporter;
  }

  /**
   * Kiểm tra kết nối tới SMTP Server (dùng cho healthcheck và test)
   */
  public static async verifyConnection(): Promise<{ success: boolean; message: string }> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return { success: false, message: 'SMTP credentials chưa được cấu hình (thiếu SMTP_USER hoặc SMTP_PASS)' };
    }

    try {
      await transporter.verify();
      return { success: true, message: 'Kết nối SMTP thành công và sẵn sàng gửi email' };
    } catch (error: any) {
      return { success: false, message: `Kết nối SMTP thất bại: ${error.message || 'Lỗi không xác định'}` };
    }
  }

  /**
   * Helper gửi email có cơ chế thử lại (1 retry) khi gặp lỗi mạng tạm thời
   */
  private static async sendMailWithRetry(mailOptions: SendMailOptions): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) return;

    // Lọc bỏ các email thử nghiệm / dummy domain không có thật để chống lỗi bounce 550 Mail Delivery Subsystem
    const toStr = String(mailOptions.to || '').toLowerCase().trim();
    const DUMMY_DOMAINS = ['@selfheal.com', '@selfheal.local', '@example.com', '@test.com', '@dummy.com'];
    if (DUMMY_DOMAINS.some((d) => toStr.endsWith(d) || toStr.includes(d))) {
      console.log(`ℹ️ [EMAIL] Bỏ qua gửi email thật tới địa chỉ thử nghiệm / dummy domain: ${mailOptions.to}`);
      return;
    }

    const attachments = Array.isArray(mailOptions.attachments) ? [...mailOptions.attachments] : [];
    if (!attachments.some((att) => att?.cid === LOGO_CID)) {
      attachments.push(getLogoAttachment());
    }
    const enrichedOptions: SendMailOptions = { ...mailOptions, attachments };

    let attempt = 0;
    const maxRetries = 1;

    while (attempt <= maxRetries) {
      try {
        await transporter.sendMail(enrichedOptions);
        return;
      } catch (error: any) {
        attempt++;
        const isTransient = this.isTransientError(error);
        if (attempt <= maxRetries && isTransient) {
          console.warn(`⚠️ [EMAIL] Gửi email gặp sự cố mạng tạm thời (${error.code || error.responseCode || 'TRANSIENT'}), đang thử lại...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Gửi email xác thực tài khoản kèm token kích hoạt
   */
  public static async sendVerificationEmail(toEmail: string, token: string, fullName: string): Promise<boolean> {
    const publicBaseUrl = (process.env.PUBLIC_API_URL || config.email.clientUrl || `http://localhost:${config.port}`).replace(/\/+$/, '');
    const clientBaseUrl = (config.email.clientUrl || publicBaseUrl).replace(/\/+$/, '');
    const backendVerifyUrl = `${publicBaseUrl}${config.apiPrefix}/auth/verify-email?token=${encodeURIComponent(token)}`;
    const frontendVerifyUrl = `${clientBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const safeName = this.escapeHtml(fullName || toEmail);
    const safeToken = this.escapeHtml(token);
    const safeBackendVerifyUrl = this.escapeHtml(backendVerifyUrl);

    const transporter = this.getTransporter();

    // Nếu chưa cấu hình SMTP trong .env -> In link ra terminal cho môi trường phát triển (Mã hóa / Che giấu token nhạy cảm)
    if (!transporter) {
      const maskedToken = token.length > 6 ? `${token.slice(0, 3)}***${token.slice(-3)}` : '***';
      console.log('\n============================================================');
      console.log('✉️  [EMAIL SERVICE - DEV MODE] CHƯA CẤU HÌNH TÀI KHOẢN SMTP');
      console.log(`➡️  Người nhận: ${fullName} <${toEmail}>`);
      console.log(`🔑  Token kích hoạt: ${maskedToken} (Bảo mật: đã ẩn một phần)`);
      console.log(`🔗  Link kích hoạt (Backend): ${backendVerifyUrl.replace(token, maskedToken)}`);
      console.log(`🌐  Link kích hoạt (Frontend): ${frontendVerifyUrl.replace(token, maskedToken)}`);
      console.log('💡  (Để gửi email thật qua Gmail, hãy điền SMTP_USER và SMTP_PASS trong file .env)');
      console.log('============================================================\n');
      return true;
    }

    // HTML Template email đồng bộ nhận diện thương hiệu + logo + mục đích thư
    const htmlContent = renderBrandedEmailLayout({
      pageTitle: `Xác thực tài khoản - ${PROJECT_BRAND_NAME}`,
      headerBg: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
      accentColor: '#3b82f6',
      badgeText: 'Xác Thực Tài Khoản',
      badgeBg: 'rgba(59, 130, 246, 0.28)',
      headerTitle: 'Xác Thực Địa Chỉ Email',
      headerSubtitle: 'Kích hoạt tài khoản mới & bảo vệ quyền truy cập hạ tầng',
      purposeText:
        'Thư này dùng để xác nhận bạn là chủ sở hữu hợp lệ của địa chỉ email đã đăng ký trên AI Self-Heal Platform (hệ thống giám sát eBPF và tự phục hồi cụm Kubernetes), trước khi kích hoạt tài khoản và truy cập không gian làm việc.',
      purposeBg: '#eff6ff',
      purposeBorder: '#2563eb',
      purposeTextColor: '#1e40af',
      bodyHtml: `
        <p style="font-size:17px; font-weight:700; color:#0f172a; margin-top:0;">Xin chào ${safeName},</p>
        <p>Bạn vừa yêu cầu mã kích hoạt tài khoản trên nền tảng <strong>${PROJECT_BRAND_NAME}</strong>. Vui lòng nhập mã xác thực bên dưới để hoàn tất:</p>
        <div style="text-align:center; margin:24px 0;">
          <p style="margin:0 0 10px; font-size:13px; font-weight:700; color:#475569; text-transform:uppercase;">Mã xác thực Email của bạn</p>
          <div style="display:inline-block; background:#eff6ff; border:2px dashed #2563eb; color:#1d4ed8; font-size:32px; font-weight:800; letter-spacing:8px; padding:12px 28px; border-radius:10px; font-family:monospace;">
            ${safeToken}
          </div>
          <p style="margin:8px 0 0; font-size:12px; color:#64748b;">(Mã có hiệu lực trong vòng 24 giờ)</p>
        </div>
        <div style="text-align:center; margin:26px 0;">
          <a href="${safeBackendVerifyUrl}" style="display:inline-block; background-color:#2563eb; color:#ffffff !important; padding:13px 28px; border-radius:8px; text-decoration:none; font-weight:700; font-size:14px;" target="_blank">Hoặc Nhấn Vào Đây Để Kích Hoạt Ngay</a>
        </div>
        <p style="font-size:13px; color:#64748b; margin-bottom:8px;">Nếu nút phía trên không hoạt động, bạn có thể sao chép liên kết sau vào trình duyệt:</p>
        <div style="background-color:#f1f5f9; border-left:4px solid #2563eb; padding:10px 14px; border-radius:6px; font-family:monospace; font-size:12px; word-break:break-all;">
          <a href="${safeBackendVerifyUrl}" style="color:#2563eb; text-decoration:none;">${safeBackendVerifyUrl}</a>
        </div>
        <p style="font-size:12.5px; color:#64748b; margin-top:20px; margin-bottom:0;">
          Nếu bạn không thực hiện đăng ký tài khoản, vui lòng bỏ qua thư này.
        </p>
      `,
    });

    try {
      await this.sendMailWithRetry({
        from: this.getFromAddress(),
        to: toEmail,
        subject: '🔒 [SelfHeal] Xác thực địa chỉ email kích hoạt tài khoản',
        html: htmlContent,
      });

      console.log(`✅ [EMAIL] Đã gửi thành công email xác thực tới: ${toEmail}`);
      return true;
    } catch (error) {
      console.error(`❌ [EMAIL ERROR] Gửi email xác thực tới ${toEmail} thất bại:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Gửi email thông báo mời tham gia tổ chức
   */
  public static async sendInvitationEmail(
    toEmail: string,
    recipientName: string,
    inviterName: string,
    orgName: string,
    roleName: string
  ): Promise<boolean> {
    const transporter = this.getTransporter();

    if (!transporter) {
      console.log('\n============================================================');
      console.log('✉️  [EMAIL SERVICE - DEV MODE] LỜI MỜI THAM GIA TỔ CHỨC');
      console.log(`➡️  Người nhận: ${recipientName} <${toEmail}>`);
      console.log(`🏢  Tổ chức: ${orgName}`);
      console.log(`👤  Người mời: ${inviterName}`);
      console.log(`🛡️  Vai trò cấp: ${roleName}`);
      console.log(`🌐  Đường dẫn: ${config.email.clientUrl}/dashboard`);
      console.log('============================================================\n');
      return true;
    }

    const safeOrg = this.escapeHtml(orgName);
    const safeRole = this.escapeHtml(roleName);
    const portalInviteUrl = `${this.escapeHtml(config.email.clientUrl)}/portal/dashboard`;

    const htmlContent = renderBrandedEmailLayout({
      pageTitle: `Lời mời tham gia tổ chức ${safeOrg} - ${PROJECT_BRAND_NAME}`,
      badgeText: 'Lời Mời Cộng Tác',
      headerTitle: `Lời Mời Tham Gia Tổ Chức ${safeOrg}`,
      headerSubtitle: 'Quản trị cụm Kubernetes, giám sát viễn trắc & tự phục hồi AI',
      purposeText:
        `Thư này được gửi để thông báo tài khoản của bạn đã được mời gia nhập không gian làm việc của tổ chức ${safeOrg} trên AI Self-Heal Platform với quyền truy cập được phân công sẵn. Bạn cần chấp nhận lời mời trong Cổng Cá Nhân để bắt đầu cộng tác.`,
      bodyHtml: `
        <p style="margin-top:0;">Xin chào <strong>${this.escapeHtml(recipientName)}</strong>,</p>
        <p><strong>${this.escapeHtml(inviterName)}</strong> vừa mời bạn tham gia quản trị hạ tầng cho tổ chức <strong>${safeOrg}</strong> trên nền tảng <strong>${PROJECT_BRAND_NAME}</strong>.</p>
        <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px 16px; margin:16px 0;">
          <div style="font-size:12px; color:#64748b; font-weight:600; margin-bottom:6px;">CHI TIẾT PHÂN QUYỀN MỜI:</div>
          <div style="font-size:14px; color:#0f172a; margin-bottom:6px;">🏢 Tổ chức: <strong>${safeOrg}</strong></div>
          <div style="font-size:14px; color:#0f172a;">🛡️ Vai trò được cấp: <span style="display:inline-block; background-color:#e0f2fe; color:#0369a1; padding:3px 10px; border-radius:6px; font-weight:700; font-size:12.5px;">${safeRole}</span></div>
        </div>
        <div style="text-align:center; margin:26px 0;">
          <a href="${portalInviteUrl}" style="display:inline-block; background-color:#059669; color:#ffffff !important; padding:13px 28px; border-radius:8px; text-decoration:none; font-weight:700; font-size:14px;" target="_blank">Xem và Chấp Nhận Lời Mời</a>
        </div>
        <p style="font-size:13px; color:#64748b; margin-bottom:0;">
          Sau khi đăng nhập và nhấn Chấp nhận tại <strong>Cổng Cá Nhân (Portal)</strong>, bạn sẽ có quyền xem chỉ số node, sự cố RCA và chính sách tự phục hồi của tổ chức theo phân quyền RBAC.
        </p>
      `,
    });

    try {
      await this.sendMailWithRetry({
        from: this.getFromAddress(),
        to: toEmail,
        subject: `🏢 [SelfHeal] Lời mời tham gia tổ chức ${orgName}`,
        html: htmlContent,
      });
      console.log(`✅ [EMAIL] Đã gửi thành công email lời mời tới: ${toEmail}`);
      return true;
    } catch (error) {
      console.error(`❌ [EMAIL ERROR] Gửi email lời mời tới ${toEmail} thất bại:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Gửi email chào mừng và bảo mật cho tài khoản đăng ký / đăng nhập lần đầu qua Google
   */
  public static async sendGoogleWelcomeEmail(toEmail: string, fullName: string): Promise<boolean> {
    const transporter = this.getTransporter();
    const portalUrl = `${config.email.clientUrl}/onboarding/organization`;

    if (!transporter) {
      console.log('\n============================================================');
      console.log('✉️  [EMAIL SERVICE - DEV MODE] CHÀO MỪNG TÀI KHOẢN GOOGLE');
      console.log(`➡️  Người nhận: ${fullName} <${toEmail}>`);
      console.log(`🌐  Đường dẫn Onboarding: ${portalUrl}`);
      console.log('============================================================\n');
      return true;
    }

    const htmlContent = renderBrandedEmailLayout({
      pageTitle: `Chào mừng bạn đến với ${PROJECT_BRAND_NAME}`,
      headerBg: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
      accentColor: '#3b82f6',
      badgeText: 'Tài Khoản Google Đã Kích Hoạt',
      badgeBg: 'rgba(59, 130, 246, 0.28)',
      headerTitle: 'Chào Mừng Đến Với AI Self-Heal',
      headerSubtitle: 'Đăng nhập SSO Google thành công • Sẵn sàng kết nối cụm Kubernetes',
      purposeText:
        'Thư này nhằm xác nhận tài khoản Google của bạn đã được liên kết an toàn với AI Self-Heal Platform và cung cấp lối tắt để thiết lập Tổ chức cùng tác tử eBPF Agent.',
      purposeBg: '#eff6ff',
      purposeBorder: '#2563eb',
      purposeTextColor: '#1e40af',
      bodyHtml: `
        <p style="margin-top:0;">Xin chào <strong>${this.escapeHtml(fullName)}</strong>,</p>
        <p>Tài khoản của bạn đã được xác thực và liên kết thành công qua Google (<strong>${this.escapeHtml(toEmail)}</strong>).</p>
        <p>Bạn có thể bắt đầu khởi tạo tổ chức, lấy lệnh cài đặt Self-Heal Agent cho cụm Kubernetes và theo dõi luồng tự phục hồi AI ngay bây giờ.</p>
        <div style="text-align:center; margin:26px 0;">
          <a href="${this.escapeHtml(portalUrl)}" style="display:inline-block; background-color:#2563eb; color:#ffffff !important; padding:13px 28px; border-radius:8px; text-decoration:none; font-weight:700; font-size:14px;" target="_blank">Tiếp Tục Thiết Lập Tổ Chức</a>
        </div>
        <p style="font-size:13px; color:#64748b; margin-bottom:0;">
          Nếu bạn không thực hiện đăng nhập hoặc liên kết này, vui lòng kiểm tra lại bảo mật tài khoản ngay trong Cổng Cá Nhân.
        </p>
      `,
    });

    try {
      await this.sendMailWithRetry({
        from: this.getFromAddress(),
        to: toEmail,
        subject: '🎉 [SelfHeal] Chào mừng bạn - Tài khoản Google đã được kích hoạt',
        html: htmlContent,
      });
      console.log(`✅ [EMAIL] Đã gửi thành công email chào mừng Google tới: ${toEmail}`);
      return true;
    } catch (error) {
      console.error(`❌ [EMAIL ERROR] Gửi email chào mừng Google tới ${toEmail} thất bại:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Gửi email thông báo yêu cầu phê duyệt hành động tự phục hồi (HITL) kèm nút 1-Click Approve
   */
  private static escapeHtml(raw?: string | null): string {
    if (!raw) return '';
    return String(raw)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private static describeCriticalStage(stage?: string): string {
    switch ((stage || '').toUpperCase()) {
      case 'NO_ACTION':
        return 'AI đề xuất NO_ACTION / Cầu dao an toàn (Circuit Breaker) đang ngắt — Hệ thống KHÔNG tự động khởi động lại hay thay đổi hạ tầng, yêu cầu kỹ sư kiểm tra ngay.';
      case 'NO_POLICY':
        return 'Chưa có Chính sách tự phục hồi (Healing Policy) khớp với hành động đề xuất — Sự cố đang ở trạng thái MỞ và chờ can thiệp.';
      case 'POLICY_DISABLED':
        return 'Chính sách tự phục hồi đang tắt (Audit / Dry-Run Mode) — Hệ thống chỉ chẩn đoán và yêu cầu kỹ sư xử lý trực tiếp.';
      case 'HITL_PENDING':
        return 'Hành động tự phục hồi đang chờ phê duyệt con người (HITL Approval Gate).';
      case 'HEALING_FAILED':
        return 'Quá trình tự phục hồi tự động bị thất bại hoặc không có Kubernetes Agent trực tuyến để nhận lệnh.';
      default:
        return 'Phát hiện sự cố mức độ KHẨN CẤP cần đội ngũ SRE / DevOps kiểm tra ngay lập tức.';
    }
  }

  /**
   * Dựng Subject + HTML Email Cảnh báo Sự cố Khẩn cấp (CRITICAL)
   */
  public static buildCriticalIncidentEmailContent(payload: {
    toEmail: string;
    recipientName: string;
    recipientRole?: string;
    incidentId: string;
    incidentCode?: string;
    title: string;
    severity: string;
    serviceName: string;
    podName?: string | null;
    nodeName?: string | null;
    namespace?: string | null;
    clusterName?: string | null;
    organizationName?: string | null;
    rootCauseType?: string | null;
    rootCauseDescription?: string | null;
    confidenceScore?: number | null;
    recommendationAction?: string | null;
    recommendationReason?: string | null;
    reasonStage: string;
    failureMessage?: string | null;
    occurrenceCount?: number | null;
    detectedAt?: Date | string | null;
  }): { subject: string; html: string; dashboardUrl: string; incidentCode: string } {
    const clientUrl = (config.email.clientUrl || 'http://localhost:3002').replace(/\/+$/, '');
    const incidentCode = payload.incidentCode || `INC-${String(payload.incidentId).slice(0, 8).toUpperCase()}`;
    const dashboardUrl = `${clientUrl}/dashboard/incidents?incident=${encodeURIComponent(payload.incidentId)}`;
    const stageDesc = this.describeCriticalStage(payload.reasonStage);
    const sevUpper = (payload.severity || 'CRITICAL').toUpperCase();
    const occCount = Number(payload.occurrenceCount || 1);
    const occSuffix = occCount > 1 ? ` (x${occCount} lần)` : '';
    const confidenceLabel =
      payload.confidenceScore !== null && payload.confidenceScore !== undefined
        ? `${Math.round(Number(payload.confidenceScore) <= 1 ? Number(payload.confidenceScore) * 100 : Number(payload.confidenceScore))}%`
        : 'N/A';

    const subject = `🚨 [KHẨN CẤP - ${incidentCode}]${occSuffix} ${payload.title || 'Sự cố nghiêm trọng'} trên ${payload.serviceName} (${payload.clusterName || 'K8s'})`;

    const detectedTime = payload.detectedAt
      ? new Date(payload.detectedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })
      : new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });

    const html = renderBrandedEmailLayout({
      pageTitle: `Cảnh Báo Khẩn Cấp - ${incidentCode}`,
      headerBg: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)',
      accentColor: '#f87171',
      bodyBg: '#fef2f2',
      containerBorder: '#fecaca',
      maxWidth: 660,
      badgeText: '🚨 CẢNH BÁO KHẨN CẤP (URGENT INCIDENT ALERT)',
      badgeBg: 'rgba(255, 255, 255, 0.2)',
      headerTitle: `[${this.escapeHtml(incidentCode)}] ${this.escapeHtml(payload.title || 'Sự cố nghiêm trọng hệ thống')}`,
      headerSubtitle: `Tổ chức: ${this.escapeHtml(payload.organizationName || 'Tổ chức Quản trị')} • Thời điểm: ${this.escapeHtml(detectedTime)} (GMT+7)`,
      purposeTitle: 'Mục đích thư cảnh báo sự cố khẩn cấp',
      purposeText:
        'Thư này báo động ngay cho đội ngũ kỹ sư SRE/DevOps khi phát hiện sự cố mức CRITICAL trên cụm Kubernetes mà hệ thống AI chưa thể tự động khắc phục (ngắt mạch an toàn, thiếu chính sách hoặc tự sửa thất bại).',
      purposeBg: '#fff1f2',
      purposeBorder: '#e11d48',
      purposeTextColor: '#9f1239',
      bodyHtml: `
        <p style="margin-top:0; font-size:14px;">Xin chào <strong>${this.escapeHtml(payload.recipientName || payload.toEmail)}</strong>${payload.recipientRole ? ` (${this.escapeHtml(payload.recipientRole)})` : ''},</p>

        <div style="background-color:#fff1f2; border:1px solid #fda4af; border-left:5px solid #e11d48; border-radius:8px; padding:14px 16px; margin-bottom:20px; font-size:13px; color:#9f1239; line-height:1.5;">
          <strong>Yêu cầu xử lý ngay (${this.escapeHtml(payload.reasonStage)}):</strong><br/>
          ${this.escapeHtml(stageDesc)}
          ${payload.failureMessage ? `<br/><br/><strong>Chi tiết lỗi:</strong> <code>${this.escapeHtml(payload.failureMessage)}</code>` : ''}
        </div>

        <table style="width:100%; border-collapse:collapse; margin-bottom:22px; font-size:13px;">
          <tr>
            <td style="width:34%; padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#64748b; font-weight:600; vertical-align:top;">🆔 Mã sự cố</td>
            <td style="width:66%; padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#0f172a; font-weight:600;"><code>${this.escapeHtml(incidentCode)}</code> <span style="display:inline-block; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:2px 8px; border-radius:5px; font-size:11px; font-weight:800;">${this.escapeHtml(sevUpper)}</span>${occCount > 1 ? ` <span style="display:inline-block; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:2px 8px; border-radius:5px; font-size:11px; font-weight:800;">Lặp lại x${occCount}</span>` : ''}</td>
          </tr>
          <tr>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#64748b; font-weight:600;">📦 Dịch vụ bị ảnh hưởng</td>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#dc2626; font-weight:800;">${this.escapeHtml(payload.serviceName)}</td>
          </tr>
          <tr>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#64748b; font-weight:600;">☸️ Cụm / Namespace / Pod / Node</td>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#0f172a; font-weight:600;">
              Cụm: <strong>${this.escapeHtml(payload.clusterName || 'Cụm Kubernetes')}</strong>
              ${payload.namespace ? ` &bull; Namespace: <code>${this.escapeHtml(payload.namespace)}</code>` : ''}
              ${payload.podName ? `<br/>Pod: <code>${this.escapeHtml(payload.podName)}</code>` : ''}
              ${payload.nodeName ? ` &bull; Node: <code>${this.escapeHtml(payload.nodeName)}</code>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#64748b; font-weight:600;">🔬 Nguyên nhân gốc (RCA)</td>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#0f172a; font-weight:600;">${this.escapeHtml(payload.rootCauseType || payload.title)} (Độ tin cậy AI: <strong>${this.escapeHtml(confidenceLabel)}</strong>)</td>
          </tr>
          <tr>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#64748b; font-weight:600;">🛡️ Trạng thái tự phục hồi</td>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#0f172a; font-weight:600;"><code>${this.escapeHtml(payload.recommendationAction || 'NO_ACTION')}</code> &mdash; Cần kỹ sư xác minh &amp; can thiệp</td>
          </tr>
        </table>

        ${(payload.rootCauseDescription || (payload.recommendationReason && (!payload.failureMessage || payload.recommendationReason !== payload.failureMessage))) ? `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px 16px; margin-bottom:22px; font-size:13px; color:#334155; line-height:1.55;">
          <strong>📋 Tóm tắt phân tích AI &amp; Khuyến nghị:</strong><br/>
          ${payload.rootCauseDescription ? `<div style="margin-top:6px;">${this.escapeHtml(payload.rootCauseDescription)}</div>` : ''}
          ${(payload.recommendationReason && (!payload.failureMessage || payload.recommendationReason !== payload.failureMessage)) ? `<div style="margin-top:8px; color:#b91c1c;"><strong>Hướng dẫn can thiệp:</strong> ${this.escapeHtml(payload.recommendationReason)}</div>` : ''}
          ${Array.isArray((payload as any).manualPlaybook) && (payload as any).manualPlaybook.length > 0 ? `<div style="margin-top:10px; padding:10px 12px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; color:#166534;"><strong>🛠️ Phương pháp xử lý thủ công đề xuất (Manual Playbook 3 bước):</strong><ul style="margin:6px 0 0 18px; padding:0;">${((payload as any).manualPlaybook as string[]).map((st) => `<li style="margin-bottom:4px;">${this.escapeHtml(st)}</li>`).join('')}</ul></div>` : ''}
        </div>` : ''}

        <div style="text-align:center; margin:24px 0 16px;">
          <a href="${dashboardUrl}" style="display:inline-block; background:#dc2626; color:#ffffff !important; font-weight:800; font-size:14px; padding:13px 28px; border-radius:8px; text-decoration:none; box-shadow:0 4px 14px rgba(220, 38, 38, 0.35);" target="_blank">
            🔍 Mở Bảng Điều Khiển &amp; Xem Chi Tiết Sự Cố (${this.escapeHtml(incidentCode)})
          </a>
        </div>

        <p style="font-size:12px; color:#64748b; text-align:center; margin-bottom:0;">
          Link trực tiếp: <a href="${dashboardUrl}" style="color:#dc2626;">${this.escapeHtml(dashboardUrl)}</a>
        </p>
      `,
      footerExtraHtml: 'Hệ thống áp dụng cơ chế chống spam cảnh báo tự động (Cooldown) và phân quyền nhận tin cho SME_OWNER, DEVOPS &amp; danh sách tùy chỉnh.',
    });

    return { subject, html, dashboardUrl, incidentCode };
  }

  /**
   * Gửi email cảnh báo khẩn cấp sự cố CRITICAL cho kỹ sư / danh sách cảnh báo
   */
  public static async sendCriticalIncidentAlertEmail(payload: {
    toEmail: string;
    recipientName: string;
    recipientRole?: string;
    incidentId: string;
    incidentCode?: string;
    title: string;
    severity: string;
    serviceName: string;
    podName?: string | null;
    nodeName?: string | null;
    namespace?: string | null;
    clusterName?: string | null;
    organizationName?: string | null;
    rootCauseType?: string | null;
    rootCauseDescription?: string | null;
    confidenceScore?: number | null;
    recommendationAction?: string | null;
    recommendationReason?: string | null;
    reasonStage: string;
    failureMessage?: string | null;
    occurrenceCount?: number | null;
    detectedAt?: Date | string | null;
  }): Promise<boolean> {
    const transporter = this.getTransporter();
    const { subject, html, dashboardUrl, incidentCode } = this.buildCriticalIncidentEmailContent(payload);

    if (!transporter) {
      console.log('\n============================================================');
      console.log(`🚨 [EMAIL SERVICE - DEV MODE] CẢNH BÁO KHẨN CẤP ${incidentCode}`);
      console.log(`➡️  Người nhận: ${payload.recipientName} (${payload.recipientRole || 'CUSTOM'}) <${payload.toEmail}>`);
      console.log(`🏢  Tổ chức: ${payload.organizationName || 'N/A'} | Cụm: ${payload.clusterName || 'N/A'}`);
      console.log(`📦  Dịch vụ: ${payload.serviceName} | Mức độ: ${payload.severity} | Giai đoạn: ${payload.reasonStage}`);
      console.log(`🌐  Deep-link: ${dashboardUrl}`);
      console.log('============================================================\n');
      return true;
    }

    try {
      await this.sendMailWithRetry({
        from: this.getFromAddress(),
        to: payload.toEmail,
        subject,
        html,
      });
      console.log(`✅ [EMAIL CRITICAL] Đã gửi email khẩn cấp [${incidentCode}] tới <${payload.toEmail}>`);
      return true;
    } catch (error) {
      console.error(`❌ [EMAIL CRITICAL ERROR] Gửi cảnh báo [${incidentCode}] tới ${payload.toEmail} thất bại:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Chuẩn hóa lỗi SMTP thành thông điệp dễ hiểu cho người quản trị
   */
  private static formatSmtpError(error: any): string {
    const rawMsg = String(error?.message || 'Lỗi kết nối máy chủ SMTP không xác định');
    const code = String(error?.code || '');
    const responseCode = Number(error?.responseCode || 0);

    if (responseCode === 535 || rawMsg.includes('535') || rawMsg.includes('Invalid login') || rawMsg.includes('BadCredentials')) {
      return 'Xác thực SMTP thất bại (535): Sai SMTP_USER hoặc App Password trong cấu hình backend (.env).';
    }
    if (['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ESOCKET', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)) {
      return `Không thể kết nối tới máy chủ SMTP (${code}): ${rawMsg}`;
    }
    return rawMsg;
  }

  /**
   * Gửi email thử nghiệm kèm chi tiết kết quả (ok, error, mode) để API phản hồi chính xác
   */
  public static async sendTestAlertEmailWithResult(payload: {
    toEmail: string;
    recipientName?: string;
    organizationName?: string;
    triggeredByEmail?: string;
  }): Promise<{ ok: boolean; error?: string; skipped?: boolean; mode?: 'smtp' | 'dev_console' }> {
    const transporter = this.getTransporter();
    const clientUrl = (config.email.clientUrl || 'http://localhost:3002').replace(/\/+$/, '');
    const settingsUrl = `${clientUrl}/dashboard/settings`;
    const orgLabel = payload.organizationName || 'Tổ chức Quản trị';

    const cleanTo = String(payload.toEmail || '').toLowerCase().trim();
    const DUMMY_DOMAINS = ['@selfheal.com', '@selfheal.local', '@example.com', '@test.com', '@dummy.com'];
    if (DUMMY_DOMAINS.some((d) => cleanTo.endsWith(d) || cleanTo.includes(d))) {
      return {
        ok: false,
        skipped: true,
        error: `Địa chỉ ${payload.toEmail} thuộc tên miền thử nghiệm nội bộ nên không thể gửi SMTP thật.`,
      };
    }

    if (!transporter) {
      console.log('\n============================================================');
      console.log('🧪 [EMAIL SERVICE - DEV MODE] EMAIL KIỂM TRA CẢNH BÁO KHẨN CẤP');
      console.log(`➡️  Gửi tới: ${payload.toEmail}`);
      console.log(`🏢  Tổ chức: ${orgLabel} | Người kích hoạt: ${payload.triggeredByEmail || 'Admin'}`);
      console.log('============================================================\n');
      return { ok: true, mode: 'dev_console' };
    }

    const htmlContent = renderBrandedEmailLayout({
      pageTitle: `Kiểm tra kênh cảnh báo Email - ${PROJECT_BRAND_NAME}`,
      badgeText: 'Kiểm Tra Cấu Hình SMTP',
      headerTitle: '✅ Kiểm Tra Kênh Email Cảnh Báo Khẩn Cấp',
      headerSubtitle: `Tổ chức: ${this.escapeHtml(orgLabel)}`,
      purposeText:
        `Thư kiểm tra này xác nhận cấu hình SMTP và hộp thư của bạn đã sẵn sàng tiếp nhận cảnh báo sự cố CRITICAL từ AI Self-Heal Platform cho tổ chức ${this.escapeHtml(orgLabel)}.`,
      bodyHtml: `
        <p style="margin-top:0;">Xin chào <strong>${this.escapeHtml(payload.recipientName || payload.toEmail)}</strong>,</p>
        <p>Đây là email kiểm tra kết nối SMTP được kích hoạt bởi <strong>${this.escapeHtml(payload.triggeredByEmail || 'Quản trị viên')}</strong> cho tổ chức <strong>${this.escapeHtml(orgLabel)}</strong>.</p>
        <p>Khi hệ thống AI Self-Heal phát hiện sự cố mức <strong>KHẨN CẤP (CRITICAL)</strong> mà chưa thể tự phục hồi (ví dụ <code>NO_ACTION</code>, Cầu dao ngắt mạch hoặc tự sửa lỗi thất bại), thông báo chi tiết sẽ được gửi ngay tới địa chỉ email này.</p>
        <div style="margin:24px 0; text-align:center;">
          <a href="${settingsUrl}" style="display:inline-block; background:#059669; color:#ffffff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:700;">Quản Lý Cấu Hình Cảnh Báo</a>
        </div>
      `,
    });

    try {
      await this.sendMailWithRetry({
        from: this.getFromAddress(),
        to: payload.toEmail,
        subject: `🧪 [SelfHeal] Email kiểm tra kênh cảnh báo khẩn cấp - ${orgLabel}`,
        html: htmlContent,
      });
      console.log(`✅ [EMAIL TEST] Đã gửi email kiểm tra cảnh báo tới <${payload.toEmail}>`);
      return { ok: true, mode: 'smtp' };
    } catch (error) {
      const friendlyError = this.formatSmtpError(error);
      console.error(`❌ [EMAIL TEST ERROR] Gửi email kiểm tra tới ${payload.toEmail} thất bại:`, (error as Error).message);
      return { ok: false, error: friendlyError };
    }
  }

  /**
   * Gửi email thử nghiệm kiểm tra cấu hình kênh nhận cảnh báo khẩn cấp
   */
  public static async sendTestAlertEmail(payload: {
    toEmail: string;
    recipientName?: string;
    organizationName?: string;
    triggeredByEmail?: string;
  }): Promise<boolean> {
    const res = await this.sendTestAlertEmailWithResult(payload);
    return res.ok;
  }

  /**
   * Gửi email thông báo phát sóng toàn mạng từ Quản trị viên
   */
  public static async sendBroadcastEmail(payload: {
    toEmail: string;
    recipientName?: string;
    broadcastCode: string;
    title: string;
    content: string;
    priority: string;
    senderName?: string;
  }): Promise<boolean> {
    const transporter = this.getTransporter();
    const clientUrl = (config.email.clientUrl || 'http://localhost:3002').replace(/\/+$/, '');
    const dashboardUrl = `${clientUrl}/dashboard`;

    let priorityColor = '#0284c7'; // INFO
    let priorityBg = 'linear-gradient(135deg, #0369a1, #0284c7)';
    let priorityBadge = 'THÔNG BÁO HỆ THỐNG';

    if (payload.priority === 'CRITICAL') {
      priorityColor = '#dc2626';
      priorityBg = 'linear-gradient(135deg, #991b1b, #dc2626)';
      priorityBadge = 'CẢNH BÁO KHẨN CẤP';
    } else if (payload.priority === 'WARNING') {
      priorityColor = '#d97706';
      priorityBg = 'linear-gradient(135deg, #b45309, #f59e0b)';
      priorityBadge = 'CẢNH BÁO BẢO TRÌ';
    }

    if (!transporter) {
      console.log('\n============================================================');
      console.log(`📢 [EMAIL BROADCAST - DEV MODE] [${payload.broadcastCode}] ${payload.title}`);
      console.log(`➡️  Gửi tới: ${payload.toEmail}`);
      console.log(`⚠️  Mức độ: ${payload.priority} | Người gửi: ${payload.senderName || 'Super Admin'}`);
      console.log('============================================================\n');
      return true;
    }

    const htmlContent = renderBrandedEmailLayout({
      pageTitle: `${payload.title} - ${PROJECT_BRAND_NAME}`,
      headerBg: priorityBg,
      accentColor: priorityColor,
      maxWidth: 640,
      badgeText: `${priorityBadge} • ${this.escapeHtml(payload.broadcastCode)}`,
      headerTitle: this.escapeHtml(payload.title),
      headerSubtitle: `Thông báo vận hành từ ${this.escapeHtml(payload.senderName || 'Ban Quản Trị Hệ Thống')}`,
      purposeText:
        'Thư phát sóng (Broadcast) truyền đạt thông tin bảo trì, cập nhật tính năng hoặc cảnh báo vận hành toàn hệ thống tới người dùng trên AI Self-Heal Platform.',
      purposeBg: '#f8fafc',
      purposeBorder: priorityColor,
      purposeTextColor: '#334155',
      bodyHtml: `
        <p style="margin-top:0;">Xin chào <strong>${this.escapeHtml(payload.recipientName || payload.toEmail)}</strong>,</p>
        <p>Ban Quản Trị Hệ Thống <strong>${PROJECT_BRAND_NAME}</strong> vừa phát sóng một thông báo mới tới bạn:</p>
        <div style="margin:18px 0; padding:16px 20px; background:#f8fafc; border-left:4px solid ${priorityColor}; border-radius:6px; font-size:14px; color:#334155; white-space:pre-wrap;">${this.escapeHtml(payload.content)}</div>
        <div style="margin:26px 0 10px; text-align:center;">
          <a href="${dashboardUrl}" style="display:inline-block; background:${priorityColor}; color:#ffffff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:700; font-size:14px;">Mở Bàn Điều Khiển Nền Tảng</a>
        </div>
      `,
    });

    try {
      await this.sendMailWithRetry({
        from: this.getFromAddress(),
        to: payload.toEmail,
        subject: `📢 [SelfHeal] ${payload.title}`,
        html: htmlContent,
      });
      console.log(`✅ [EMAIL BROADCAST] Đã gửi thông báo [${payload.broadcastCode}] tới <${payload.toEmail}>`);
      return true;
    } catch (err: any) {
      console.error(`❌ [EMAIL BROADCAST] Lỗi khi gửi email tới <${payload.toEmail}>:`, err?.message || err);
      return false;
    }
  }

  public static async sendHitlApprovalNotification(payload: {
    toEmail: string;
    recipientName: string;
    recipientRole?: string;
    approvalId: string;
    healingActionId: string;
    targetName: string;
    targetType: string;
    actionCode: string;
    actionName: string;
    riskLevel: string;
    policyName?: string;
    clusterName?: string;
    environmentName?: string;
    organizationName?: string;
    incidentTitle?: string;
    incidentSeverity?: string;
    incidentDescription?: string;
    actionReasoning?: string;
    namespace?: string;
    podName?: string;
    nodeName?: string;
    rootCauseType?: string;
    rootCauseDescription?: string;
    confidenceScore?: number;
    token: string;
    expiresAt?: Date | string;
  }): Promise<boolean> {
    const transporter = this.getTransporter();
    const publicBaseUrl = (process.env.PUBLIC_API_URL || config.email.clientUrl || `http://localhost:${config.port}`).replace(/\/+$/, '');
    const quickApproveUrl = `${publicBaseUrl}${config.apiPrefix}/healing/approvals/quick-approve?token=${encodeURIComponent(payload.token)}`;
    const quickRejectUrl = `${publicBaseUrl}${config.apiPrefix}/healing/approvals/quick-reject?token=${encodeURIComponent(payload.token)}`;
    const clientUrl = (config.email.clientUrl || publicBaseUrl).replace(/\/+$/, '');
    const dashboardUrl = `${clientUrl}/dashboard/self-healing/approvals`;

    const esc = (v?: string | null) => this.escapeHtml(v);
    const hitlCode = `REQ-HITL-${payload.approvalId.slice(0, 8).toUpperCase()}`;
    const riskColor = payload.riskLevel?.toUpperCase() === 'CRITICAL' ? '#DC2626' : (payload.riskLevel?.toUpperCase() === 'HIGH' ? '#EA580C' : '#D97706');
    const riskLabel = payload.riskLevel?.toUpperCase() === 'CRITICAL' ? 'NGUY HIỂM (CRITICAL)' : (payload.riskLevel?.toUpperCase() === 'HIGH' ? 'RỦI RO CAO' : 'TRUNG BÌNH');

    if (!transporter) {
      const maskedToken = maskSecretValue(payload.token);
      const maskedApproveUrl = quickApproveUrl.replace(encodeURIComponent(payload.token), maskedToken).replace(payload.token, maskedToken);
      const maskedRejectUrl = quickRejectUrl.replace(encodeURIComponent(payload.token), maskedToken).replace(payload.token, maskedToken);
      console.log('\n============================================================');
      console.log('🚨 [EMAIL SERVICE - DEV MODE] YÊU CẦU PHÊ DUYỆT TỰ PHỤC HỒI (HITL)');
      console.log(`➡️  Gửi tới: ${payload.recipientName} (${payload.recipientRole || 'SME/DevOps'}) <${payload.toEmail}>`);
      console.log(`🏢  Tổ chức: ${payload.organizationName || 'N/A'} | Cụm K8s: ${payload.clusterName || 'K8s Cluster'}`);
      console.log(`📦  Dịch vụ / Pod: ${payload.targetName} (${payload.targetType})`);
      console.log(`⚡  Hành động: ${payload.actionName} (${payload.actionCode}) | Rủi ro: ${riskLabel}`);
      console.log(`🔬  Nguyên nhân: ${payload.rootCauseType || 'Bất thường dịch vụ'} (Tin cậy: ${payload.confidenceScore || 70}%)`);
      console.log(`🔑  Mã phiếu: ${hitlCode} | Token: ${maskedToken} (đã che giấu)`);
      console.log(`✅  LINK 1-CLICK PHÊ DUYỆT NGAY: ${maskedApproveUrl}`);
      console.log(`❌  LINK 1-CLICK TỪ CHỐI: ${maskedRejectUrl}`);
      console.log(`🌐  LINK XEM CHI TIẾT TRÊN WEB: ${dashboardUrl}`);
      console.log('============================================================\n');
      return true;
    }

    const htmlContent = renderBrandedEmailLayout({
      pageTitle: `Yêu Cầu Phê Duyệt Tự Phục Hồi - ${hitlCode}`,
      headerBg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      accentColor: '#3b82f6',
      maxWidth: 640,
      badgeText: '🚨 HITL Human-In-The-Loop Cần Phê Duyệt',
      badgeBg: 'rgba(239, 68, 68, 0.25)',
      badgeColor: '#fecaca',
      headerTitle: 'Yêu Cầu Phê Duyệt Hành Động Khắc Phục',
      headerSubtitle: `Mã kiểm toán: ${esc(hitlCode)} • Tổ chức: ${esc(payload.organizationName || 'Tổ chức Quản trị')}`,
      purposeTitle: 'Mục đích thư phê duyệt HITL',
      purposeText:
        'Thư này đề nghị kỹ sư vận hành xem xét nguyên nhân gốc (RCA) và xác nhận 1-Click Phê duyệt hoặc Từ chối trước khi Agent thực thi lệnh can thiệp có mức rủi ro cao lên cụm Kubernetes.',
      purposeBg: '#fef2f2',
      purposeBorder: '#ef4444',
      purposeTextColor: '#991b1b',
      bodyHtml: `
        <p style="margin-top:0; font-size:14px;">Xin chào <strong>${esc(payload.recipientName || payload.toEmail)}</strong> (${esc(payload.recipientRole || 'SME/DevOps')}),</p>
        <div style="background-color:#fef2f2; border:1px solid #fee2e2; border-left:4px solid #ef4444; border-radius:6px; padding:12px 14px; margin-bottom:20px; font-size:13px; color:#991b1b;">
          <strong>Cảnh báo giám sát MAPE-K:</strong> Hệ thống tự phục hồi phát hiện nguy cơ bất thường dịch vụ và chuẩn bị thực thi hành động can thiệp có mức độ rủi ro cần sự phê duyệt của con người trước khi áp dụng.
        </div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:22px; font-size:13px;">
          <tr>
            <td style="width:35%; padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#64748b; font-weight:600;">🚨 Sự cố phát hiện</td>
            <td style="width:65%; padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#dc2626; font-weight:700;">${esc(payload.incidentTitle || payload.actionName || 'Sự cố cần can thiệp')}</td>
          </tr>
          <tr>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#64748b; font-weight:600;">📦 Dịch vụ & Đối tượng</td>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#0f172a; font-weight:700;"><span style="color:#2563eb; font-weight:800;">${esc(payload.targetName)}</span> (${esc(payload.targetType || 'POD')})${payload.namespace ? ` &bull; Namespace: <code>${esc(payload.namespace)}</code>` : ''}</td>
          </tr>
          <tr>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#64748b; font-weight:600;">🔬 Nguyên nhân gốc (RCA)</td>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#0f172a; font-weight:700;">${esc(payload.rootCauseType || payload.incidentTitle || 'Bất thường hạ tầng phát hiện bởi AI')} (Độ tin cậy AI: <strong>${Number(payload.confidenceScore || 70)}%</strong>)</td>
          </tr>
          ${payload.actionReasoning ? `
          <tr>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#64748b; font-weight:600;">💡 Lập luận khuyến nghị AI</td>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#334155; font-style:italic;">${esc(payload.actionReasoning)}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#64748b; font-weight:600;">⚡ Hành động tự khắc phục</td>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9;"><span style="display:inline-block; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:3px 8px; border-radius:4px; font-size:12px; font-weight:700;">${esc(payload.actionName)} (${esc(payload.actionCode)})</span></td>
          </tr>
          <tr>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#64748b; font-weight:600;">🛡️ Chính sách an toàn</td>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#0f172a; font-weight:700;"><code>${esc(payload.policyName || 'POL-SAFETY-DEFAULT')}</code></td>
          </tr>
          <tr>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#64748b; font-weight:600;">⚠️ Mức độ rủi ro</td>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9;"><span style="display:inline-block; background:#fef2f2; color:${riskColor}; border:1px solid #fecaca; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:700;">${riskLabel}</span></td>
          </tr>
          <tr>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#64748b; font-weight:600;">☸️ Cụm K8s & Môi trường</td>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#0f172a; font-weight:700;">${esc(payload.clusterName || 'Cụm Kubernetes')} (${esc(payload.environmentName || 'Production')})${payload.organizationName ? ` &bull; ${esc(payload.organizationName)}` : ''}</td>
          </tr>
          <tr>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#64748b; font-weight:600;">⏱️ Thời hạn xử lý</td>
            <td style="padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#64748b; font-size:12px;">Trong vòng 24 giờ kể từ khi kích hoạt</td>
          </tr>
        </table>
        <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:10px; padding:18px; text-align:center; margin:20px 0;">
          <div style="font-size:14px; font-weight:700; margin-bottom:14px; color:#0f172a;">
            ⚡ Kỹ sư có thể phê duyệt hoặc từ chối trực tiếp ngay tại Email này:
          </div>
          <div style="margin-bottom:10px;">
            <a href="${esc(quickApproveUrl)}" style="display:inline-block; background:#059669; color:#ffffff !important; font-weight:700; font-size:14px; padding:12px 22px; border-radius:8px; text-decoration:none; margin:4px;" target="_blank">✅ Phê Duyệt Ngay (1-Click)</a>
            <a href="${esc(quickRejectUrl)}" style="display:inline-block; background:#dc2626; color:#ffffff !important; font-weight:700; font-size:14px; padding:12px 20px; border-radius:8px; text-decoration:none; margin:4px;" target="_blank">❌ Từ Chối Yêu Cầu</a>
            <a href="${esc(dashboardUrl)}" style="display:inline-block; background:#ffffff; color:#2563eb !important; border:1px solid #bfdbfe; font-weight:600; font-size:14px; padding:11px 18px; border-radius:8px; text-decoration:none; margin:4px;" target="_blank">🔍 Xem Chi Tiết</a>
          </div>
          <div style="font-size:12px; color:#64748b;">(Bấm nút phía trên sẽ xác nhận qua trang an toàn ký số JWT có thời hạn)</div>
        </div>
        <p style="font-size:12px; color:#64748b; margin-bottom:0;">
          * Lưu ý: Liên kết 1-Click sử dụng mã ký số JWT kèm quyền RBAC của bạn đối với tổ chức <strong>${esc(payload.organizationName || 'hệ thống')}</strong>.
        </p>
      `,
      footerExtraHtml: 'Bảo mật Multi-Tenancy Isolation &bull; Kiểm soát truy cập RBAC &bull; Nhật ký Audit Trails',
    });

    try {
      await this.sendMailWithRetry({
        from: this.getFromAddress(),
        to: payload.toEmail,
        subject: `🚨 [SelfHeal] [CẦN PHÊ DUYỆT HITL] ${payload.incidentTitle || payload.actionName} trên ${payload.targetName} (${hitlCode})`,
        html: htmlContent,
      });
      console.log(`✅ [EMAIL HITL] Đã gửi thông báo phê duyệt tới ${payload.recipientName} <${payload.toEmail}>`);
      return true;
    } catch (error) {
      console.error(`❌ [EMAIL HITL ERROR] Gửi thông báo phê duyệt tới ${payload.toEmail} thất bại:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Gửi email đặt lại mật khẩu (liên kết an toàn 15 phút qua CLIENT_URL)
   */
  public static async sendPasswordResetEmail(
    toEmail: string,
    fullName: string,
    resetToken: string
  ): Promise<boolean> {
    const safeName = this.escapeHtml(fullName || 'Quý khách');
    const baseUrl = (config.email.clientUrl || 'http://localhost:3000').replace(/\/+$/, '');
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const htmlContent = renderBrandedEmailLayout({
      pageTitle: `Đặt lại mật khẩu - ${PROJECT_BRAND_NAME}`,
      badgeText: 'Khôi Phục Mật Khẩu',
      headerTitle: 'Đặt Lại Mật Khẩu Tài Khoản',
      headerSubtitle: 'Liên kết khôi phục một lần có hiệu lực trong 15 phút',
      purposeText:
        'Thư này cung cấp đường dẫn bảo mật một lần giúp bạn thiết lập mật khẩu mới khi yêu cầu khôi phục quyền truy cập trên AI Self-Heal Platform.',
      bodyHtml: `
        <p style="margin-top:0;">Xin chào <strong>${safeName}</strong>,</p>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn vào nút bên dưới để tạo mật khẩu mới (hiệu lực trong 15 phút, dùng 1 lần):</p>
        <div style="text-align:center; margin:26px 0;">
          <a href="${resetUrl}" style="display:inline-block; background:#059669; color:#ffffff !important; text-decoration:none; padding:13px 26px; border-radius:8px; font-weight:700; font-size:14px;">
            Đặt lại mật khẩu
          </a>
        </div>
        <p style="font-size:13px; color:#64748b; margin-bottom:0;">
          Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này. Tài khoản và phiên đăng nhập hiện tại của bạn vẫn an toàn.
        </p>
      `,
    });

    try {
      await this.sendMailWithRetry({
        from: this.getFromAddress(),
        to: toEmail,
        subject: '🔐 [SelfHeal] Yêu cầu đặt lại mật khẩu',
        html: htmlContent,
      });
      return true;
    } catch (error) {
      console.error(`❌ [EMAIL] Gửi email đặt lại mật khẩu tới ${toEmail} thất bại:`, (error as Error).message);
      return false;
    }
  }
}
