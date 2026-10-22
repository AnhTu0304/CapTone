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
}
