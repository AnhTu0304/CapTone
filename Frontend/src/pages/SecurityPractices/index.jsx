import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import './SecurityPractices.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export const SecurityPracticesPage = () => {
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
      const sections = gsap.utils.toArray('.security-content-container section');
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
    <div className="security-page-root" data-testid="security-practices-page">
      <header className="security-top-hero" data-testid="security-top-hero">
        <h1 className="security-hero-title">Thực tiễn &amp; Chính sách Bảo mật</h1>
        <p className="security-hero-subtitle">
          Tìm hiểu về kiến trúc an ninh đa tầng, các biện pháp kiểm soát kỹ thuật và cơ chế bảo vệ hạ tầng của SelfHeal
        </p>
      </header>

      <section
        ref={containerRef}
        className="security-sheet-section"
        data-testid="security-sheet-section"
      >
        <canvas
          ref={canvasRef}
          className="security-sheet-canvas"
          data-testid="security-sheet-canvas"
          aria-hidden="true"
        />

        <main className="security-content-container">
          <div className="security-last-updated" data-testid="security-last-updated">
            Cập nhật lần cuối: 14 Tháng 11, 2026 (Last updated: November 14, 2026)
          </div>

          <p className="security-intro-paragraph">
            Trang này mô tả các biện pháp kiểm soát kỹ thuật, kiến trúc an toàn và quy trình quản trị nhằm bảo vệ dữ liệu và hạ tầng của khách hàng tại SelfHeal. Chúng tôi áp dụng nguyên tắc bảo mật đa tầng từ mã nguồn ứng dụng, lớp mạng, cơ sở dữ liệu cho tới tác tử K8s Agent vận hành trực tiếp trong cụm Kubernetes của doanh nghiệp.
          </p>

          {/* Section 01: Security Overview */}
          <section id="security-overview" data-testid="security-section-overview">
            <h2 className="security-heading-1">Bảo mật được xây dựng trong mọi lớp của SelfHeal</h2>
            <p className="security-body-paragraph">
              SelfHeal tiếp cận bảo mật hạ tầng dựa trên mô hình phòng thủ theo chiều sâu (Defense-in-Depth). Mỗi tầng trong kiến trúc—bao gồm giao diện Frontend, API Gateway, cơ sở dữ liệu PostgreSQL, mô hình AI dự báo suy thoái và tác tử Kubernetes Agent—đều được trang bị các ranh giới kiểm soát an toàn nghiêm ngặt.
            </p>
            <p className="security-body-paragraph">
              Chúng tôi cam kết bảo vệ toàn vẹn hệ thống ứng dụng của doanh nghiệp, thực thi chính sách đặc quyền tối thiểu, bảo mật dữ liệu số liệu vận hành và đảm bảo mọi hành động phục hồi sự cố đều nằm dưới sự giám sát và phê duyệt có kiểm soát của kỹ sư vận hành.
            </p>
          </section>

          {/* Section 02: Application Security */}
          <section id="application-security" data-testid="security-section-app">
            <h2 className="security-heading-1">Bảo vệ từng tương tác (Application Security)</h2>
            <p className="security-body-paragraph">
              Tầng ứng dụng web và API Gateway của SelfHeal được xây dựng với các cơ chế phòng vệ chống lại các lỗ hổng bảo mật phổ biến:
            </p>
            <h3 className="security-heading-2">Phòng chống SQL Injection &amp; Xác thực Dữ liệu</h3>
            <p className="security-body-paragraph">
              Toàn bộ các thao tác truy vấn cơ sở dữ liệu đều sử dụng kỹ thuật truy vấn tham số hóa (Parameterized Queries) thông qua trình điều khiển PostgreSQL, loại trừ hoàn toàn nguy cơ chèn mã SQL trái phép. Mọi yêu cầu gửi tới API đều được xác thực và chuẩn hóa cấu trúc nghiêm ngặt thông qua Zod Schema Validation trước khi chuyển vào tầng xử lý nghiệp vụ.
            </p>
            <h3 className="security-heading-2">Secure Headers, CORS &amp; Rate Limiting</h3>
            <p className="security-body-paragraph">
              Hệ thống tích hợp Helmet để thiết lập các tiêu đề HTTP bảo mật nâng cao nhằm ngăn ngừa các cuộc tấn công Cross-Site Scripting (XSS) và clickjacking. Chính sách chia sẻ tài nguyên nguồn gốc chéo (CORS) được áp dụng theo danh sách cho phép (Allowlist) nghiêm ngặt, chặn đứng các yêu cầu từ tên miền không được cấp quyền.
            </p>
            <p className="security-body-paragraph">
              Các endpoint nhạy cảm (như đăng nhập, xác thực tài khoản) được bảo vệ bởi cơ chế giới hạn tần suất yêu cầu (Rate Limiting), phòng ngừa hiệu quả các cuộc tấn công brute-force và gửi kèm tiêu đề Retry-After khi chạm ngưỡng giới hạn. Cơ chế xử lý lỗi tập trung ngăn chặn việc để lộ vết ngăn xếp (stack traces) hay cấu trúc hệ thống nội bộ ra bên ngoài.
            </p>
          </section>

          {/* Section 03: Authentication & Access Control */}
          <section id="auth-access-control" data-testid="security-section-auth">
            <h2 className="security-heading-1">Mọi hành động đều bắt đầu từ truy cập được xác minh</h2>
            <p className="security-body-paragraph">
              SelfHeal thiết lập hệ thống định danh vững chắc nhằm đảm bảo chỉ những người dùng và dịch vụ được ủy quyền mới có thể truy cập tài nguyên:
            </p>
            <h3 className="security-heading-2">Xác thực Token &amp; Băm Mật khẩu</h3>
            <p className="security-body-paragraph">
              Phiên làm việc của người dùng được bảo vệ bởi JSON Web Token (JWT) có thời hạn xác định, mã hóa khóa bí mật an toàn và hỗ trợ thu hồi token. Toàn bộ mật khẩu người dùng được băm một chiều bằng thuật toán Bcrypt với salt rounds tiêu chuẩn công nghiệp, tuyệt đối không bao giờ lưu trữ mật khẩu ở dạng văn bản rõ (plaintext).
            </p>
            <h3 className="security-heading-2">Phân quyền Dựa trên Vai trò (RBAC) &amp; Cô lập Tổ chức</h3>
            <p className="security-body-paragraph">
              Quyền hạn trong hệ thống được quản lý thông qua ma trận RBAC chặt chẽ (Admin, SRE/DevOps, Viewer), phân tách rõ ràng quyền xem số liệu, cấp phát token và phê duyệt hành động phục hồi. Dữ liệu giữa các tổ chức và môi trường (Environments) được cô lập triệt để ở tầng cơ sở dữ liệu (Tenant Isolation), ngăn chặn hoàn toàn rủi ro truy cập chéo dữ liệu giữa các doanh nghiệp.
            </p>
          </section>

          {/* Section 04: Kubernetes & Agent Security */}
          <section id="kubernetes-agent-security" data-testid="security-section-k8s">
            <h2 className="security-heading-1">Hạ tầng của bạn luôn nằm dưới sự kiểm soát chặt chẽ</h2>
            <p className="security-body-paragraph">
              Tác tử SelfHeal Kubernetes Agent là thành phần kết nối trực tiếp với cụm máy chủ của doanh nghiệp, được thiết kế tuân thủ các quy tắc an toàn cao nhất:
            </p>
            <h3 className="security-heading-2">Đặc quyền Tối thiểu (Least Privilege RBAC)</h3>
            <p className="security-body-paragraph">
              Agent tuyệt đối không yêu cầu và không sử dụng quyền quản trị tối cao cluster-admin. Agent chỉ sử dụng ServiceAccount với quyền chỉ đọc (get, list, watch) trên các tài nguyên cần thiết để thu thập số liệu vận hành và logs. Chức năng tự động phục hồi (restart pod, scale deployment) mặc định bị vô hiệu hóa (ENABLE_HEALING_ACTIONS=false) và chỉ được kích hoạt khi doanh nghiệp chủ động cấu hình quyền ghi (patch) có giới hạn.
            </p>
            <h3 className="security-heading-2">Bảo vệ Tiến trình &amp; Chuẩn Pod Security Standards</h3>
            <p className="security-body-paragraph">
              Container Agent chạy dưới tài khoản người dùng phi đặc quyền appuser (UID 10001, GID 10001), kích hoạt hệ thống tệp chỉ đọc (read-only root filesystem), vô hiệu hóa hoàn toàn khả năng leo thang đặc quyền (allowPrivilegeEscalation: false) và loại bỏ toàn bộ Linux capabilities (capabilities.drop: [&quot;ALL&quot;]). Cấu hình này tuân thủ cấp độ Nghiêm ngặt (Restricted) của chuẩn Pod Security Standards trên Kubernetes.
            </p>
            <h3 className="security-heading-2">Không mở cổng Inbound &amp; Quản lý Token An toàn</h3>
            <p className="security-body-paragraph">
              Agent chỉ thiết lập kết nối hướng ra ngoài (outbound-only) tới Main Backend qua giao thức bảo mật WebSocket over TLS (wss://). Cụm Kubernetes của doanh nghiệp không cần mở bất kỳ cổng firewall hay gán IP Public nào. Token định danh của Agent được bảo vệ trong Kubernetes Secret, được băm một chiều SHA-256 trên cơ sở dữ liệu và có thể được thu hồi ngay lập tức để ngắt kết nối khi nghi ngờ có rủi ro rò rỉ.
            </p>
          </section>

          {/* Section 05: Data Protection */}
          <section id="data-protection" data-testid="security-section-data">
            <h2 className="security-heading-1">Dữ liệu vận hành của bạn xứng đáng được bảo vệ</h2>
            <p className="security-body-paragraph">
              Chúng tôi bảo vệ thông tin của doanh nghiệp trong suốt vòng đời dữ liệu với các nguyên tắc minh bạch:
            </p>
            <h3 className="security-heading-2">Mã hóa trên Đường truyền (Encryption in Transit)</h3>
            <p className="security-body-paragraph">
              Toàn bộ dữ liệu trao đổi giữa trình duyệt người dùng, API Backend, mô hình AI và Kubernetes Agent đều bắt buộc phải đi qua các kênh truyền được mã hóa TLS/HTTPS và WSS, loại trừ nguy cơ nghe lén hoặc tấn công xen giữa (Man-in-the-Middle).
            </p>
            <h3 className="security-heading-2">Ẩn Thông tin Nhạy cảm &amp; Phạm vi Thu thập</h3>
            <p className="security-body-paragraph">
              Hệ thống ghi log tự động nhận diện và ẩn đi ([REDACTED]) các trường nhạy cảm như khóa xác thực, mật khẩu, và token trong log vận hành. SelfHeal chỉ thu thập các thông số đo lường hiệu năng (CPU, Memory, Network) và sự kiện trạng thái của cụm Kubernetes; nền tảng tuyệt đối không thu thập hay lưu trữ nội dung dữ liệu nghiệp vụ kinh doanh của ứng dụng khách hàng.
            </p>
          </section>

          {/* Section 06: AI & Remediation Security */}
          <section id="ai-remediation-security" data-testid="security-section-ai">
            <h2 className="security-heading-1">Tự động hóa với sự an toàn tích hợp trong mọi quyết định</h2>
            <p className="security-body-paragraph">
              SelfHeal ứng dụng trí tuệ nhân tạo nhằm nâng cao hiệu quả vận hành nhưng luôn đặt yếu tố an toàn và quyền kiểm soát của con người lên hàng đầu:
            </p>
            <h3 className="security-heading-2">Cơ chế Phê duyệt Con người (Human-in-the-Loop - HITL)</h3>
            <p className="security-body-paragraph">
              Các khuyến nghị từ mô hình AI (GRU / RCA Engine) không tự ý kích hoạt các thay đổi nhạy cảm trên hạ tầng. Đối với các thao tác có khả năng gây ảnh hưởng đến tính sẵn sàng của ứng dụng (như khởi động lại Pod, thay đổi số lượng bản sao Deployment hay Rollback phiên bản), hệ thống bắt buộc phải thông qua cổng phê duyệt có xác nhận của kỹ sư vận hành.
            </p>
            <h3 className="security-heading-2">Xác minh Sau Phục hồi &amp; Nhật ký Kiểm toán (Audit Trails)</h3>
            <p className="security-body-paragraph">
              Mọi hành động khắc phục sự cố—dù được kích hoạt thủ công hay tự động hóa có kiểm soát—đều được ghi lại chi tiết trong nhật ký kiểm toán (người phê duyệt, thời điểm, đối tượng tác động, bản ghi chênh lệch cấu hình). Ngay sau khi thực hiện hành động, Agent sẽ tự động kiểm tra lại trạng thái sức khỏe của Workload để đảm bảo dịch vụ đã trở về trạng thái ổn định.
            </p>
          </section>

          {/* Section 07: Monitoring & Incident Response */}
          <section id="monitoring-incident-response" data-testid="security-section-monitoring">
            <h2 className="security-heading-1">Khả năng quan sát giúp chúng tôi đón đầu rủi ro</h2>
            <p className="security-body-paragraph">
              Hệ thống giám sát vận hành liên tục cung cấp khả năng quan sát toàn diện và hỗ trợ ứng phó sự cố nhanh chóng:
            </p>
            <h3 className="security-heading-2">Thu thập Telemetry &amp; Cảnh báo Đa kênh</h3>
            <p className="security-body-paragraph">
              Tích hợp chuẩn quan sát OpenTelemetry và Prometheus cho phép thu thập số liệu chuỗi thời gian độ trễ thấp trên từng Node và Pod. Khi phát hiện dấu hiệu suy thoái tài nguyên hoặc lỗi CrashLoopBackOff, hệ thống lập tức thông báo qua kênh cảnh báo được chỉ định để đội ngũ kỹ sư kịp thời xử lý.
            </p>
            <h3 className="security-heading-2">Quy trình Điều tra &amp; Nhật ký Hệ thống</h3>
            <p className="security-body-paragraph">
              Khi xảy ra sự cố, kỹ sư có thể tra cứu nhanh nguyên nhân gốc thông qua luồng nhật ký sự kiện Kubernetes Events và phân tích tương quan từ mô hình học máy, giúp rút ngắn thời gian điều tra từ hàng giờ xuống còn vài phút mà không cần truy cập trực tiếp bằng lệnh ssh vào máy chủ.
            </p>
          </section>

          {/* Section 08: Vulnerability Management & Reporting */}
          <section id="vulnerability-management" data-testid="security-section-vulnerability">
            <h2 className="security-heading-1">Bảo mật đòi hỏi sự cải tiến liên tục</h2>
            <p className="security-body-paragraph">
              Chúng tôi duy trì quy trình kiểm tra an ninh liên tục xuyên suốt chu trình phát triển sản phẩm:
            </p>
            <h3 className="security-heading-2">Rà soát Thư viện &amp; Quét Ảnh Container</h3>
            <p className="security-body-paragraph">
              Mã nguồn và các gói phụ thuộc (dependencies) của Frontend, Backend và Agent thường xuyên được rà soát để phát hiện các lỗ hổng đã biết (CVE). Các ảnh Docker Container được tối ưu hóa dung lượng, sử dụng hình ảnh cơ sở tối giản (minimal base images) và loại bỏ các công cụ gỡ lỗi không cần thiết trước khi đóng gói phát hành.
            </p>
            <h3 className="security-heading-2">Kênh Tiếp nhận Báo cáo Lỗ hổng</h3>
            <p className="security-body-paragraph">
              Nếu bạn phát hiện một vấn đề bảo mật hoặc có câu hỏi liên quan đến kiến trúc an toàn của SelfHeal, vui lòng thông báo cho chúng tôi qua địa chỉ email chuyên trách: <span className="security-contact-highlight">security@selfheal.dev</span>. Đội ngũ an ninh cam kết tiếp nhận, phân loại và phản hồi kịp thời đối với mọi báo cáo mang tính xây dựng.
            </p>
          </section>
        </main>
      </section>
    </div>
  );
};

export default SecurityPracticesPage;
