import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { config } from '../config/env';

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

    let attempt = 0;
    const maxRetries = 1;

    while (attempt <= maxRetries) {
      try {
        await transporter.sendMail(mailOptions);
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
    const backendVerifyUrl = `http://localhost:${config.port}${config.apiPrefix}/auth/verify-email?token=${token}`;
    const frontendVerifyUrl = `${config.email.clientUrl}/verify-email?token=${token}`;

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

    // HTML Template email chuyên nghiệp, tương thích tốt với Gmail/Outlook
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Xác thực tài khoản AI Self-Heal</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
        .header p { margin: 8px 0 0; font-size: 14px; color: #94a3b8; }
        .content { padding: 32px 28px; color: #334155; line-height: 1.6; }
        .greeting { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #0f172a; }
        .button-wrapper { text-align: center; margin: 32px 0; }
        .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
        .btn:hover { background-color: #1d4ed8; }
        .token-box { background-color: #f1f5f9; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 4px; font-family: monospace; font-size: 13px; word-break: break-all; margin: 20px 0; }
        .footer { padding: 24px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>AI Self-Heal Platform</h1>
          <p>Hệ thống Giám sát & Tự khắc phục sự cố hệ thống</p>
        </div>
        <div class="content">
          <div class="greeting">Xin chào ${fullName},</div>
          <p>Bạn vừa yêu cầu mã xác thực địa chỉ email trên nền tảng <strong>AI Self-Heal</strong>. Vui lòng sử dụng mã xác thực bên dưới để hoàn tất:</p>
          
          <div style="text-align: center; margin: 28px 0;">
            <p style="margin: 0 0 10px; font-size: 14px; font-weight: 600; color: #475569;">MÃ XÁC THỰC EMAIL CỦA BẠN:</p>
            <div style="display: inline-block; background: #eff6ff; border: 2px dashed #2563eb; color: #1d4ed8; font-size: 34px; font-weight: 800; letter-spacing: 8px; padding: 12px 28px; border-radius: 8px; font-family: monospace;">
              ${token}
            </div>
            <p style="margin: 8px 0 0; font-size: 12px; color: #94a3b8;">(Mã có hiệu lực trong vòng 24 giờ)</p>
          </div>

          <div class="button-wrapper">
            <a href="${backendVerifyUrl}" class="btn" target="_blank">Hoặc Nhấn Vào Đây Để Kích Hoạt Ngay</a>
          </div>

          <p style="font-size: 13px; color: #64748b;">
            Nếu nút phía trên không bấm được, bạn có thể copy link sau và dán trực tiếp vào trình duyệt:
          </p>
          <div class="token-box">
            <a href="${backendVerifyUrl}" style="color: #2563eb; text-decoration: none;">${backendVerifyUrl}</a>
          </div>

          <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">
            Nếu bạn không tạo tài khoản trên AI Self-Heal, vui lòng bỏ qua email này. Tài khoản sẽ tự động hết hạn mà không gây ảnh hưởng gì.
          </p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} AI Self-Heal Platform. Bảo mật và an toàn dữ liệu hàng đầu.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    try {
      await this.sendMailWithRetry({
        from: this.getFromAddress(),
        to: toEmail,
        subject: '🔒 [AI Self-Heal] Xác thực địa chỉ email kích hoạt tài khoản',
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

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Lời mời tham gia tổ chức - CapTone AI Self-Heal</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 32px 28px; color: #334155; line-height: 1.6; }
        .badge { display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 14px; }
        .btn-wrapper { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; background-color: #059669; color: #ffffff !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; }
        .footer { padding: 24px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>CapTone AI Self-Heal Platform</h1>
          <p>Lời mời cộng tác quản trị hạ tầng</p>
        </div>
        <div class="content">
          <p>Xin chào <strong>${recipientName}</strong>,</p>
          <p><strong>${inviterName}</strong> vừa mời bạn tham gia quản trị hệ thống cho tổ chức <strong>${orgName}</strong> trên nền tảng CapTone.</p>
          <p>Vai trò được chỉ định: <span class="badge">${roleName}</span></p>
          <div class="btn-wrapper">
            <a href="${config.email.clientUrl}/portal/dashboard" class="btn" target="_blank">Xem và Chấp Nhận Lời Mời</a>
          </div>
          <p style="font-size: 13px; color: #64748b;">
            Vui lòng đăng nhập vào hệ thống để chấp nhận lời mời và bắt đầu quản lý cụm Kubernetes cùng đồng đội.
          </p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} CapTone AI Self-Heal Platform.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    try {
      await this.sendMailWithRetry({
        from: this.getFromAddress(),
        to: toEmail,
        subject: `🏢 [CapTone] Lời mời tham gia tổ chức ${orgName}`,
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

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Chào mừng bạn đến với CapTone AI Self-Heal</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 32px 28px; color: #334155; line-height: 1.6; }
        .btn-wrapper { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; }
        .footer { padding: 24px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>CapTone AI Self-Heal Platform</h1>
          <p>Chào mừng bạn đã liên kết tài khoản Google</p>
        </div>
        <div class="content">
          <p>Xin chào <strong>${fullName}</strong>,</p>
          <p>Tài khoản của bạn đã được liên kết thành công với tài khoản Google (<strong>${toEmail}</strong>).</p>
          <p>Hệ thống của chúng tôi đã tự động xác thực địa chỉ email từ nhà cung cấp Google. Bạn có thể thiết lập tổ chức và cấu hình giám sát hạ tầng ngay bây giờ.</p>
          <div class="btn-wrapper">
            <a href="${portalUrl}" class="btn" target="_blank">Tiếp Tục Thiết Lập Tổ Chức</a>
          </div>
          <p style="font-size: 13px; color: #64748b;">
            Nếu bạn không thực hiện đăng nhập hoặc đăng ký này, vui lòng liên hệ ngay với đội ngũ bảo mật của chúng tôi.
          </p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} CapTone AI Self-Heal Platform.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    try {
      await this.sendMailWithRetry({
        from: this.getFromAddress(),
        to: toEmail,
        subject: '🎉 [CapTone] Chào mừng bạn - Tài khoản Google đã được kích hoạt',
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
    const clientUrl = config.email.clientUrl.replace(/:3000\b/, ':3001');
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

    const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cảnh Báo Khẩn Cấp - ${this.escapeHtml(incidentCode)}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fef2f2; margin: 0; padding: 0; color: #1e293b; }
        .wrapper { max-width: 660px; margin: 28px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 12px 30px -5px rgba(185, 28, 28, 0.18); border: 1px solid #fecaca; }
        .header { background: linear-gradient(135deg, #991b1b 0%, #dc2626 100%); padding: 26px 28px; color: #ffffff; }
        .header-tag { display: inline-block; background-color: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.45); color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; letter-spacing: 0.6px; margin-bottom: 10px; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 800; line-height: 1.3; }
        .header p { margin: 6px 0 0 0; font-size: 13px; color: #fee2e2; }
        .content { padding: 26px 28px; }
        .urgent-banner { background-color: #fff1f2; border: 1px solid #fda4af; border-left: 5px solid #e11d48; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; font-size: 13px; color: #9f1239; line-height: 1.5; }
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 22px; font-size: 13px; }
        .info-table td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
        .info-table td.label { width: 34%; color: #64748b; font-weight: 600; }
        .info-table td.value { width: 66%; color: #0f172a; font-weight: 600; }
        .badge-crit { display: inline-block; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 3px 9px; border-radius: 5px; font-size: 11px; font-weight: 800; }
        .rca-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 22px; font-size: 13px; color: #334155; line-height: 1.55; }
        .cta-box { text-align: center; margin: 26px 0 18px; }
        .btn-urgent { display: inline-block; background: #dc2626; color: #ffffff !important; font-weight: 800; font-size: 14px; padding: 13px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35); }
        .footer { background-color: #f8fafc; padding: 18px 28px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5; text-align: center; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="header-tag">🚨 CẢNH BÁO KHẨN CẤP (URGENT INCIDENT ALERT)</div>
          <h1>[${this.escapeHtml(incidentCode)}] ${this.escapeHtml(payload.title || 'Sự cố nghiêm trọng hệ thống')}</h1>
          <p>Tổ chức: <strong>${this.escapeHtml(payload.organizationName || 'SME Organization')}</strong> &bull; Thời điểm: <strong>${this.escapeHtml(detectedTime)} (GMT+7)</strong></p>
        </div>

        <div class="content">
          <p style="margin-top: 0; font-size: 14px;">Xin chào <strong>${this.escapeHtml(payload.recipientName || payload.toEmail)}</strong>${payload.recipientRole ? ` (${this.escapeHtml(payload.recipientRole)})` : ''},</p>

          <div class="urgent-banner">
            <strong>Yêu cầu xử lý ngay (${this.escapeHtml(payload.reasonStage)}):</strong><br/>
            ${this.escapeHtml(stageDesc)}
            ${payload.failureMessage ? `<br/><br/><strong>Chi tiết lỗi:</strong> <code>${this.escapeHtml(payload.failureMessage)}</code>` : ''}
          </div>

          <table class="info-table">
            <tr>
              <td class="label">🆔 Mã sự cố</td>
              <td class="value"><code>${this.escapeHtml(incidentCode)}</code> <span class="badge-crit">${this.escapeHtml(sevUpper)}</span>${occCount > 1 ? ` <span class="badge-crit">Lặp lại x${occCount}</span>` : ''}</td>
            </tr>
            <tr>
              <td class="label">📦 Dịch vụ bị ảnh hưởng</td>
              <td class="value" style="color: #dc2626; font-weight: 800;">${this.escapeHtml(payload.serviceName)}</td>
            </tr>
            <tr>
              <td class="label">☸️ Cụm / Namespace / Pod / Node</td>
              <td class="value">
                Cụm: <strong>${this.escapeHtml(payload.clusterName || 'Chưa xác định')}</strong>
                ${payload.namespace ? ` &bull; Namespace: <code>${this.escapeHtml(payload.namespace)}</code>` : ''}
                ${payload.podName ? `<br/>Pod: <code>${this.escapeHtml(payload.podName)}</code>` : ''}
                ${payload.nodeName ? ` &bull; Node: <code>${this.escapeHtml(payload.nodeName)}</code>` : ''}
              </td>
            </tr>
            <tr>
              <td class="label">🔬 Nguyên nhân gốc (RCA)</td>
              <td class="value">${this.escapeHtml(payload.rootCauseType || payload.title)} (Độ tin cậy AI: <strong>${this.escapeHtml(confidenceLabel)}</strong>)</td>
            </tr>
            <tr>
              <td class="label">🛡️ Trạng thái tự phục hồi</td>
              <td class="value"><code>${this.escapeHtml(payload.recommendationAction || 'NO_ACTION')}</code> &mdash; Cần kỹ sư xác minh &amp; can thiệp</td>
            </tr>
          </table>

          ${(payload.rootCauseDescription || (payload.recommendationReason && (!payload.failureMessage || payload.recommendationReason !== payload.failureMessage))) ? `
          <div class="rca-box">
            <strong>📋 Tóm tắt phân tích AI &amp; Khuyến nghị:</strong><br/>
            ${payload.rootCauseDescription ? `<div style="margin-top:6px;">${this.escapeHtml(payload.rootCauseDescription)}</div>` : ''}
            ${(payload.recommendationReason && (!payload.failureMessage || payload.recommendationReason !== payload.failureMessage)) ? `<div style="margin-top:8px; color:#b91c1c;"><strong>Hướng dẫn can thiệp:</strong> ${this.escapeHtml(payload.recommendationReason)}</div>` : ''}
            ${Array.isArray((payload as any).manualPlaybook) && (payload as any).manualPlaybook.length > 0 ? `<div style="margin-top:10px; padding:10px 12px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; color:#166534;"><strong>🛠️ Phương pháp xử lý thủ công đề xuất (Manual Playbook 3 bước):</strong><ul style="margin:6px 0 0 18px; padding:0;">${((payload as any).manualPlaybook as string[]).map((st) => `<li style="margin-bottom:4px;">${this.escapeHtml(st)}</li>`).join('')}</ul></div>` : ''}
          </div>` : ''}

          <div class="cta-box">
            <a href="${dashboardUrl}" class="btn-urgent" target="_blank">
              🔍 Mở Bảng Điều Khiển &amp; Xem Chi Tiết Sự Cố (${this.escapeHtml(incidentCode)})
            </a>
          </div>

          <p style="font-size: 12px; color: #64748b; text-align: center; margin-bottom: 0;">
            Link trực tiếp: <a href="${dashboardUrl}" style="color: #dc2626;">${this.escapeHtml(dashboardUrl)}</a>
          </p>
        </div>

        <div class="footer">
          <p style="margin: 0 0 4px 0;">Email khẩn cấp từ <strong>CapTone AI Self-Healing SRE Platform</strong>.</p>
          <p style="margin: 0;">Hệ thống áp dụng kiểm soát chống spam cảnh báo tự động (Cooldown) và phân quyền nhận tin cho SME_OWNER, DEVOPS &amp; danh sách tùy chỉnh.</p>
        </div>
      </div>
    </body>
    </html>
    `;

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
   * Gửi email thử nghiệm kiểm tra cấu hình kênh nhận cảnh báo khẩn cấp
   */
  public static async sendTestAlertEmail(payload: {
    toEmail: string;
    recipientName?: string;
    organizationName?: string;
    triggeredByEmail?: string;
  }): Promise<boolean> {
    const transporter = this.getTransporter();
    const clientUrl = config.email.clientUrl.replace(/:3000\b/, ':3001');
    const settingsUrl = `${clientUrl}/dashboard/settings`;
    const orgLabel = payload.organizationName || 'Tổ chức SME';

    if (!transporter) {
      console.log('\n============================================================');
      console.log('🧪 [EMAIL SERVICE - DEV MODE] EMAIL KIỂM TRA CẢNH BÁO KHẨN CẤP');
      console.log(`➡️  Gửi tới: ${payload.toEmail}`);
      console.log(`🏢  Tổ chức: ${orgLabel} | Người kích hoạt: ${payload.triggeredByEmail || 'Admin'}`);
      console.log('============================================================\n');
      return true;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head><meta charset="UTF-8"><title>Kiểm tra cấu hình Email cảnh báo</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
      <div style="max-width:600px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
        <div style="background:linear-gradient(135deg,#065f46,#059669); padding:22px 24px; color:#ffffff;">
          <h2 style="margin:0; font-size:18px;">✅ Kiểm Tra Kênh Email Cảnh Báo Khẩn Cấp</h2>
          <p style="margin:6px 0 0; font-size:13px; color:#d1fae5;">Tổ chức: ${this.escapeHtml(orgLabel)}</p>
        </div>
        <div style="padding:24px; font-size:14px; line-height:1.6;">
          <p>Xin chào <strong>${this.escapeHtml(payload.recipientName || payload.toEmail)}</strong>,</p>
          <p>Đây là email kiểm tra kết nối SMTP được kích hoạt bởi <strong>${this.escapeHtml(payload.triggeredByEmail || 'Quản trị viên')}</strong> cho tổ chức <strong>${this.escapeHtml(orgLabel)}</strong>.</p>
          <p>Khi hệ thống AI Self-Heal phát hiện sự cố mức <strong>KHẨN CẤP (CRITICAL)</strong> mà chưa thể tự phục hồi (ví dụ <code>NO_ACTION</code>, Cầu dao ngắt mạch hoặc tự sửa lỗi thất bại), thông báo chi tiết sẽ được gửi ngay tới địa chỉ email này.</p>
          <div style="margin:22px 0; text-align:center;">
            <a href="${settingsUrl}" style="display:inline-block; background:#059669; color:#ffffff; padding:11px 22px; border-radius:8px; text-decoration:none; font-weight:700;">Quản Lý Cấu Hình Cảnh Báo</a>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

    try {
      await this.sendMailWithRetry({
        from: this.getFromAddress(),
        to: payload.toEmail,
        subject: `🧪 [CapTone] Email kiểm tra kênh cảnh báo khẩn cấp - ${orgLabel}`,
        html: htmlContent,
      });
      console.log(`✅ [EMAIL TEST] Đã gửi email kiểm tra cảnh báo tới <${payload.toEmail}>`);
      return true;
    } catch (error) {
      console.error(`❌ [EMAIL TEST ERROR] Gửi email kiểm tra tới ${payload.toEmail} thất bại:`, (error as Error).message);
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
    const quickApproveUrl = `http://localhost:${config.port}${config.apiPrefix}/healing/approvals/quick-approve?token=${encodeURIComponent(payload.token)}`;
    const quickRejectUrl = `http://localhost:${config.port}${config.apiPrefix}/healing/approvals/quick-reject?token=${encodeURIComponent(payload.token)}`;
    const clientUrl = config.email.clientUrl.replace(/:3000\b/, ':3001');
    const dashboardUrl = `${clientUrl}/dashboard/self-healing/approvals`;

    const hitlCode = `REQ-HITL-${payload.approvalId.slice(0, 8).toUpperCase()}`;
    const riskColor = payload.riskLevel?.toUpperCase() === 'CRITICAL' ? '#DC2626' : (payload.riskLevel?.toUpperCase() === 'HIGH' ? '#EA580C' : '#D97706');
    const riskLabel = payload.riskLevel?.toUpperCase() === 'CRITICAL' ? 'NGUY HIỂM (CRITICAL)' : (payload.riskLevel?.toUpperCase() === 'HIGH' ? 'RỦI RO CAO' : 'TRUNG BÌNH');

    if (!transporter) {
      console.log('\n============================================================');
      console.log('🚨 [EMAIL SERVICE - DEV MODE] YÊU CẦU PHÊ DUYỆT TỰ PHỤC HỒI (HITL)');
      console.log(`➡️  Gửi tới: ${payload.recipientName} (${payload.recipientRole || 'SME/DevOps'}) <${payload.toEmail}>`);
      console.log(`🏢  Tổ chức: ${payload.organizationName || 'N/A'} | Cụm K8s: ${payload.clusterName || 'cluster-k8s'}`);
      console.log(`📦  Dịch vụ / Pod: ${payload.targetName} (${payload.targetType})`);
      console.log(`⚡  Hành động: ${payload.actionName} (${payload.actionCode}) | Rủi ro: ${riskLabel}`);
      console.log(`🔬  Nguyên nhân: ${payload.rootCauseType || 'Bất thường dịch vụ'} (Tin cậy: ${payload.confidenceScore || 70}%)`);
      console.log(`🔑  Mã phiếu: ${hitlCode}`);
      console.log(`✅  LINK 1-CLICK PHÊ DUYỆT NGAY: ${quickApproveUrl}`);
      console.log(`❌  LINK 1-CLICK TỪ CHỐI: ${quickRejectUrl}`);
      console.log(`🌐  LINK XEM CHI TIẾT TRÊN WEB: ${dashboardUrl}`);
      console.log('============================================================\n');
      return true;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Yêu Cầu Phê Duyệt Tự Phục Hồi - ${hitlCode}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 0; color: #1e293b; }
        .wrapper { max-width: 640px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 26px 28px; color: #ffffff; border-bottom: 3px solid #3b82f6; }
        .header-tag { display: inline-block; background-color: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; letter-spacing: 0.5px; margin-bottom: 12px; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 800; }
        .header p { margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; }
        .content { padding: 28px; }
        .alert-box { background-color: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px 16px; margin-bottom: 22px; font-size: 13px; color: #991b1b; }
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
        .info-table td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
        .info-table td.label { width: 35%; color: #64748b; font-weight: 600; }
        .info-table td.value { width: 65%; color: #0f172a; font-weight: 700; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
        .actions-box { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }
        .btn-approve { display: inline-block; background: #059669; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 13px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3); margin-right: 8px; }
        .btn-dashboard { display: inline-block; background: #ffffff; color: #2563eb !important; border: 1px solid #bfdbfe; font-weight: 600; font-size: 14px; padding: 12px 22px; border-radius: 8px; text-decoration: none; }
        .footer { background-color: #f8fafc; padding: 20px 28px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="header-tag">🚨 HITL Human-In-The-Loop Cần Phê Duyệt</div>
          <h1>Yêu Cầu Phê Duyệt Hành Động Khắc Phục</h1>
          <p>Mã kiểm toán: <strong>${hitlCode}</strong> &bull; Tổ chức: <strong>${payload.organizationName || 'SME Organization'}</strong></p>
        </div>
        <div class="content">
          <p style="margin-top: 0; font-size: 14px;">Xin chào <strong>${payload.recipientName}</strong> (${payload.recipientRole || 'SME/DevOps'}),</p>
          <div class="alert-box">
            <strong>Cảnh báo giám sát MAPE-K:</strong> Hệ thống tự phục hồi phát hiện nguy cơ bất thường dịch vụ và chuẩn bị thực thi hành động can thiệp có mức độ rủi ro cần sự phê duyệt của con người trước khi áp dụng.
          </div>
          
          <table class="info-table">
            <tr>
              <td class="label">🚨 Sự cố phát hiện</td>
              <td class="value" style="color: #dc2626;">${payload.incidentTitle || 'Pod ứng dụng bất ổn định / CrashLoop'}</td>
            </tr>
            <tr>
              <td class="label">📦 Dịch vụ & Đối tượng</td>
              <td class="value"><span style="color: #2563eb; font-weight: 800;">${payload.targetName}</span> (${payload.targetType || 'POD'})${payload.namespace ? ` &bull; Namespace: <code>${payload.namespace}</code>` : ''}</td>
            </tr>
            <tr>
              <td class="label">🔬 Nguyên nhân gốc (RCA)</td>
              <td class="value">${payload.rootCauseType || 'Pod ứng dụng bất ổn định / CrashLoop'} (Độ tin cậy AI: <strong>${payload.confidenceScore || 70}%</strong>)</td>
            </tr>
            ${payload.actionReasoning ? `
            <tr>
              <td class="label">💡 Lập luận khuyến nghị AI</td>
              <td class="value" style="color: #334155; font-style: italic;">${payload.actionReasoning}</td>
            </tr>` : ''}
            <tr>
              <td class="label">⚡ Hành động tự khắc phục</td>
              <td class="value">
                <span class="badge" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 12px;">
                  ${payload.actionName} (${payload.actionCode})
                </span>
              </td>
            </tr>
            <tr>
              <td class="label">🛡️ Chính sách an toàn</td>
              <td class="value"><code>${payload.policyName || 'POL-SAFETY-DEFAULT'}</code></td>
            </tr>
            <tr>
              <td class="label">⚠️ Mức độ rủi ro</td>
              <td class="value">
                <span class="badge" style="background: #fef2f2; color: ${riskColor}; border: 1px solid #fecaca;">
                  ${riskLabel}
                </span>
              </td>
            </tr>
            <tr>
              <td class="label">☸️ Cụm K8s & Môi trường</td>
              <td class="value">${payload.clusterName || 'Cụm Production K8s'} (${payload.environmentName || 'Production'}) &bull; ${payload.organizationName || 'Tổ chức CapTone'}</td>
            </tr>
            <tr>
              <td class="label">⏱️ Thời hạn xử lý</td>
              <td class="value" style="color: #64748b; font-size: 12px;">Trong vòng 24 giờ kể từ khi kích hoạt</td>
            </tr>
          </table>

          <div class="actions-box">
            <div style="font-size: 14px; font-weight: 700; margin-bottom: 14px; color: #0f172a;">
              ⚡ Kỹ sư có thể phê duyệt hoặc từ chối trực tiếp ngay tại Email này:
            </div>
            <div style="margin-bottom: 12px;">
              <a href="${quickApproveUrl}" class="btn-approve" target="_blank">
                ✅ Phê Duyệt Ngay (1-Click)
              </a>
              <a href="${quickRejectUrl}" style="display: inline-block; background: #dc2626; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 13px 24px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3); margin-right: 8px;" target="_blank">
                ❌ Từ Chối Yêu Cầu
              </a>
              <a href="${dashboardUrl}" class="btn-dashboard" target="_blank">
                🔍 Xem Bảng Chứng & Diff YAML
              </a>
            </div>
            <div style="font-size: 12px; color: #64748b;">
              (Bấm nút phía trên sẽ tự động xác thực và thực thi an toàn mà không cần đăng nhập lại)
            </div>
          </div>

          <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
            * Lưu ý: Nút <strong>Phê Duyệt Ngay</strong> sử dụng liên kết bảo mật có ký số JWT kèm thời hạn TTL. Khi bạn bấm nút, hệ thống sẽ tự động xác thực quyền hạn RBAC của bạn đối với tổ chức <strong>${payload.organizationName}</strong> và thực thi can thiệp lên cụm Kubernetes.
          </p>
        </div>

        <div class="footer">
          <p style="margin: 0 0 6px 0;">
            Email này được gửi tự động từ <strong>CapTone AI Autonomous Self-Healing Platform</strong> theo quy chuẩn an toàn HITL.
          </p>
          <p style="margin: 0;">
            Bảo mật nhiều bên thuê (Multi-Tenancy Isolation) &bull; Kiểm soát truy cập RBAC &bull; Sổ kiểm toán Audit Trails
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    try {
      await this.sendMailWithRetry({
        from: this.getFromAddress(),
        to: payload.toEmail,
        subject: `🚨 [CẢNH BÁO SỰ CỐ & CẦN PHÊ DUYỆT] ${payload.incidentTitle || payload.actionName} trên ${payload.targetName} (${hitlCode})`,
        html: htmlContent,
      });
      console.log(`✅ [EMAIL HITL] Đã gửi thông báo phê duyệt tới ${payload.recipientName} <${payload.toEmail}>`);
      return true;
    } catch (error) {
      console.error(`❌ [EMAIL HITL ERROR] Gửi thông báo phê duyệt tới ${payload.toEmail} thất bại:`, (error as Error).message);
      return false;
    }
  }

}
