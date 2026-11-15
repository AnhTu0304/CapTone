import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import './Privacy.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export const PrivacyPage = () => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderGridAndSprockets = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width === 0 || height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.save();
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#EEEEEE';
      ctx.fillRect(0, 0, width, height);

      const gridSize = 24;
      ctx.strokeStyle = 'rgba(61, 59, 79, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x += gridSize) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
      }
      for (let y = 0; y <= height; y += gridSize) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
      }
      ctx.stroke();

      if (width > 640) {
        const holeW = 16;
        const holeH = 20;
        const radius = 5;
        const stepY = 36;
        const leftX = 26;
        const rightX = width - 26 - holeW;

        const drawHole = (x, y) => {
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.arcTo(x + holeW, y, x + holeW, y + holeH, radius);
          ctx.arcTo(x + holeW, y + holeH, x, y + holeH, radius);
          ctx.arcTo(x, y + holeH, x, y, radius);
          ctx.arcTo(x, y, x + holeW, y, radius);
          ctx.closePath();
          ctx.fillStyle = '#E0E0E6';
          ctx.fill();
          ctx.strokeStyle = '#B8B8C2';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        };

        for (let y = 8; y < height; y += stepY) {
          drawHole(leftX, y);
          drawHole(rightX, y);
        }
      }

      ctx.restore();
    };

    renderGridAndSprockets();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => renderGridAndSprockets());
      observer.observe(container);
      return () => observer.disconnect();
    }
  }, []);

  useGSAP(
    () => {
      const sections = gsap.utils.toArray('.privacy-content-container section');
      sections.forEach((sec) => {
        gsap.from(sec, {
          y: 20,
          opacity: 0,
          duration: 0.65,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: sec,
            start: 'top 88%',
            toggleActions: 'play none none none',
          },
        });
      });
    },
    { scope: containerRef }
  );

  return (
    <div className="privacy-page-root" data-testid="privacy-page">
      <header className="privacy-top-hero" data-testid="privacy-top-hero">
        <h1 className="privacy-hero-title">Chính sách Bảo mật &amp; Quyền riêng tư</h1>
        <p className="privacy-hero-subtitle">
          Cam kết minh bạch của SelfHeal về nguyên tắc thu thập, xử lý và bảo vệ dữ liệu cá nhân cùng an toàn thông tin hạ tầng doanh nghiệp
        </p>
      </header>

      <section
        ref={containerRef}
        className="privacy-sheet-section"
        data-testid="privacy-sheet-section"
      >
        <canvas
          ref={canvasRef}
          className="privacy-sheet-canvas"
          data-testid="privacy-sheet-canvas"
          aria-hidden="true"
        />

        <main className="privacy-content-container">
          <div className="privacy-last-updated" data-testid="privacy-last-updated">
            Cập nhật lần cuối: 14 Tháng 11, 2026 (Last updated: November 14, 2026)
          </div>

          <p className="privacy-intro-paragraph">
            SelfHeal (&quot;chúng tôi&quot;, &quot;nền tảng&quot;) tôn trọng quyền riêng tư của người dùng và các tổ chức đối tác. Văn bản này quy định rõ các loại dữ liệu được thu thập, mục đích xử lý, các biện pháp an ninh kỹ thuật áp dụng và quyền hạn của bạn đối với dữ liệu khi tương tác với cổng thông tin quản trị và triển khai tác tử SelfHeal Kubernetes Agent.
          </p>

          {/* Section 01: Scope & Principles */}
          <section id="privacy-scope" data-testid="privacy-section-scope">
            <h2 className="privacy-heading-1">1. Giới thiệu &amp; Phạm vi Áp dụng</h2>
            <p className="privacy-body-paragraph">
              Chính sách này áp dụng cho toàn bộ các dịch vụ do SelfHeal cung cấp, bao gồm ứng dụng web bảng điều khiển, giao diện lập trình ứng dụng (API), và tác tử K8s Agent được cài đặt trong môi trường cụm máy chủ của khách hàng.
            </p>
            <p className="privacy-body-paragraph">
              Chúng tôi hoạt động trên nguyên tắc <strong>Tối thiểu hóa Dữ liệu (Data Minimization)</strong>: hệ thống chỉ thu thập những thông tin cần thiết nhất để phục vụ công tác giám sát, phân tích nguyên nhân gốc (RCA) và hỗ trợ tự động phục hồi hạ tầng.
            </p>
          </section>

          {/* Section 02: Information Collected */}
          <section id="privacy-data-collected" data-testid="privacy-section-data-collected">
            <h2 className="privacy-heading-1">2. Dữ liệu Chúng tôi Thu thập</h2>
            <p className="privacy-body-paragraph">
              Để cung cấp các dịch vụ dự báo và khôi phục hạ tầng, SelfHeal phân loại dữ liệu tiếp nhận thành hai nhóm chính:
            </p>
            <h3 className="privacy-heading-2">Thông tin Tài khoản &amp; Định danh Tổ chức</h3>
            <p className="privacy-body-paragraph">
              Khi đăng ký và quản lý tài khoản, chúng tôi thu thập tên người dùng, địa chỉ email, ảnh đại diện (nếu có), vai trò trong tổ chức (Role) và mật khẩu đã được băm một chiều bằng thuật toán Bcrypt. Chúng tôi cũng ghi nhận định danh môi trường (Environment ID) và tên cụm Kubernetes mà bạn kết nối.
            </p>
            <h3 className="privacy-heading-2">Số liệu Đo lường Hạ tầng (Telemetry Data)</h3>
            <p className="privacy-body-paragraph">
              Tác tử Kubernetes Agent chỉ thu thập các số liệu vận hành kỹ thuật theo chuỗi thời gian: mức tiêu thụ CPU, RAM, băng thông mạng, số lượng bản sao Pod, trạng thái vòng đời Workload (như CrashLoopBackOff hay OOMKilled) và nhật ký sự kiện hệ thống Kubernetes Events.
            </p>
            <p className="privacy-body-paragraph">
              <strong>Cam kết không thu thập dữ liệu nghiệp vụ:</strong> SelfHeal tuyệt đối không đọc, không ghi nhận và không lưu trữ nội dung dữ liệu kinh doanh của ứng dụng khách hàng (database records, tin nhắn người dùng, dữ liệu thanh toán hay các file ứng dụng nội bộ).
            </p>
          </section>

          {/* Section 03: Purpose of Use */}
          <section id="privacy-usage" data-testid="privacy-section-usage">
            <h2 className="privacy-heading-1">3. Mục đích Sử dụng Thông tin</h2>
            <p className="privacy-body-paragraph">
              Dữ liệu thu thập được sử dụng riêng biệt cho các mục tiêu kỹ thuật cụ thể sau:
            </p>
            <p className="privacy-body-paragraph">
              <strong>Cung cấp &amp; Duy trì Dịch vụ:</strong> Hiển thị bảng điều khiển trực quan thời gian thực, quản lý cụm máy chủ và điều phối luồng phê duyệt phục hồi sự cố.
            </p>
            <p className="privacy-body-paragraph">
              <strong>Hỗ trợ Suy luận &amp; Phân tích AI:</strong> Mô hình chuỗi thời gian GRU sử dụng dữ liệu số liệu CPU/Memory để dự đoán xu hướng cạn kiệt tài nguyên trước khi sự cố xảy ra. Quá trình phân tích sử dụng dữ liệu telemetry ẩn danh (de-identified).
            </p>
            <p className="privacy-body-paragraph">
              <strong>Cảnh báo &amp; Thông tin Kỹ thuật:</strong> Gửi thông báo tức thời khi hệ thống phát hiện các bất thường hoặc cần kỹ sư phê duyệt hành động khôi phục.
            </p>
          </section>

          {/* Section 04: Storage & Protection */}
          <section id="privacy-security" data-testid="privacy-section-security">
            <h2 className="privacy-heading-1">4. Cơ chế Lưu trữ &amp; Bảo vệ Dữ liệu</h2>
            <p className="privacy-body-paragraph">
              Chúng tôi áp dụng các chuẩn mực an toàn cao nhất trong toàn bộ chu kỳ sống của dữ liệu:
            </p>
            <p className="privacy-body-paragraph">
              <strong>Phân vùng Đa người thuê (Tenant Isolation):</strong> Dữ liệu giữa các tổ chức và môi trường được phân tách vật lý hoặc logic nghiêm ngặt trong cơ sở dữ liệu PostgreSQL, loại trừ hoàn toàn khả năng truy cập chéo.
            </p>
            <p className="privacy-body-paragraph">
              <strong>Mã hóa Toàn diện trên Đường truyền:</strong> Mọi liên lạc giữa giao diện web, API backend và Kubernetes Agent đều được bảo vệ bởi giao thức HTTPS và WebSocket an toàn (wss:// over TLS).
            </p>
            <p className="privacy-body-paragraph">
              <strong>Tự động Ẩn Thông tin Nhạy cảm:</strong> Mọi thông tin định danh như khóa xác thực, token và mật khẩu đều được tự động gắn nhãn [REDACTED] trước khi ghi vào log giám sát hệ thống.
            </p>
          </section>

          {/* Section 05: Data Sharing */}
          <section id="privacy-sharing" data-testid="privacy-section-sharing">
            <h2 className="privacy-heading-1">5. Chia sẻ &amp; Chuyển giao Thông tin</h2>
            <p className="privacy-body-paragraph">
              <strong>Nguyên tắc Không Bán Dữ liệu:</strong> SelfHeal khẳng định không bao giờ bán, cho thuê hay thương mại hóa dữ liệu cá nhân hoặc số liệu hạ tầng của khách hàng cho bất kỳ bên thứ ba nào vì mục đích quảng cáo.
            </p>
            <p className="privacy-body-paragraph">
              Thông tin chỉ được chia sẻ trong phạm vi cần thiết với các nhà cung cấp dịch vụ hạ tầng cốt lõi (như dịch vụ gửi email thông báo hoặc nhà cung cấp hạ tầng máy chủ) theo các thỏa thuận bảo mật thông tin nghiêm ngặt, hoặc khi có yêu cầu bằng văn bản hợp pháp từ cơ quan có thẩm quyền theo luật định.
            </p>
          </section>

          {/* Section 06: Your Rights */}
          <section id="privacy-rights" data-testid="privacy-section-rights">
            <h2 className="privacy-heading-1">6. Quyền của Doanh nghiệp &amp; Người dùng</h2>
            <p className="privacy-body-paragraph">
              Bạn luôn nắm quyền kiểm soát đối với dữ liệu của mình trên nền tảng SelfHeal:
            </p>
            <p className="privacy-body-paragraph">
              <strong>Quyền Truy cập &amp; Cập nhật:</strong> Người dùng có thể kiểm tra và chỉnh sửa thông tin hồ sơ cá nhân hoặc cấu hình tổ chức thông qua trang Cài đặt.
            </p>
            <p className="privacy-body-paragraph">
              <strong>Quyền Yêu cầu Xóa Dữ liệu (Right to Erasure):</strong> Quản trị viên có quyền yêu cầu xóa bỏ tổ chức và toàn bộ dữ liệu lịch sử telemetry tương ứng khỏi hệ thống sản xuất.
            </p>
            <p className="privacy-body-paragraph">
              <strong>Quyền Thu hồi Token Kết nối:</strong> Doanh nghiệp có thể thu hồi Agent Token bất cứ lúc nào từ bảng điều khiển để ngay lập tức ngắt liên kết của tác tử Agent khỏi hạ tầng SelfHeal.
            </p>
          </section>

          {/* Section 07: Cookies & Sessions */}
          <section id="privacy-cookies" data-testid="privacy-section-cookies">
            <h2 className="privacy-heading-1">7. Cookie &amp; Quản lý Phiên làm việc</h2>
            <p className="privacy-body-paragraph">
              SelfHeal chỉ sử dụng các cookie kỹ thuật thiết yếu phục vụ việc xác thực và duy trì phiên đăng nhập an toàn của người dùng (JWT session). Chúng tôi không cài đặt các cookie theo dõi hành vi xuyên trang hoặc cookie quảng cáo của các mạng tiếp thị bên thứ ba.
            </p>
          </section>

          {/* Section 08: Contact & Inquiries */}
          <section id="privacy-contact" data-testid="privacy-section-contact">
            <h2 className="privacy-heading-1">8. Liên hệ &amp; Tiếp nhận Thắc mắc</h2>
            <p className="privacy-body-paragraph">
              Nếu bạn có bất kỳ câu hỏi, yêu cầu thực thi quyền riêng tư hoặc phản hồi nào liên quan đến chính sách bảo vệ dữ liệu của chúng tôi, vui lòng liên hệ trực tiếp với bộ phận phụ trách qua địa chỉ email: <span className="privacy-contact-highlight">privacy@selfheal.dev</span>. Chúng tôi cam kết phản hồi các yêu cầu hợp lệ trong thời gian sớm nhất.
            </p>
          </section>
        </main>
      </section>
    </div>
  );
};

export default PrivacyPage;
