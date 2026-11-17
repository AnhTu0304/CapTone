import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import './Terms.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export const TermsPage = () => {
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
      const sections = gsap.utils.toArray('.terms-content-container section');
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
    <div className="terms-page-root" data-testid="terms-page">
      <header className="terms-top-hero" data-testid="terms-top-hero">
        <h1 className="terms-hero-title">Điều Khoản Dịch Vụ &amp; Sử Dụng Hệ Thống</h1>
        <p className="terms-hero-subtitle">
          Quy chuẩn vận hành, giới hạn trách nhiệm và cam kết an toàn khi ứng dụng nền tảng tự phục hồi hạ tầng SelfHeal cho cụm máy chủ doanh nghiệp
        </p>
      </header>

      <section
        ref={containerRef}
        className="terms-sheet-section"
        data-testid="terms-sheet-section"
      >
        <canvas
          ref={canvasRef}
          className="terms-sheet-canvas"
          data-testid="terms-sheet-canvas"
          aria-hidden="true"
        />

        <main className="terms-content-container">
          <div className="terms-last-updated" data-testid="terms-last-updated">
            Cập nhật lần cuối: 14 Tháng 11, 2026 (Last updated: November 14, 2026)
          </div>

          <p className="terms-intro-paragraph">
            Chào mừng bạn đến với SelfHeal (&quot;chúng tôi&quot;, &quot;nền tảng&quot;). Văn bản Điều khoản Dịch vụ này (&quot;Điều khoản&quot;) xác định các quyền, nghĩa vụ và trách nhiệm pháp lý giữa doanh nghiệp của bạn và SelfHeal khi truy cập bảng điều khiển quản trị, sử dụng giao diện lập trình ứng dụng (API) hoặc kết nối tác tử SelfHeal Kubernetes Agent vào hạ tầng máy chủ của bạn.
          </p>

          <section id="terms-acceptance" data-testid="terms-section-acceptance">
            <h2 className="terms-heading-1">1. Giới thiệu &amp; Chấp thuận Điều khoản</h2>
            <p className="terms-body-paragraph">
              SelfHeal cung cấp giải pháp giám sát chủ động và tự phục hồi hạ tầng máy chủ dựa trên trí tuệ nhân tạo (AI-Driven Proactive Self-Healing) dành riêng cho các doanh nghiệp vừa và nhỏ (SMEs). Hệ thống kết hợp phân tích chuỗi thời gian (time-series telemetry) và điều phối khắc phục sự cố trong môi trường container hóa (Docker và Kubernetes).
            </p>
            <p className="terms-body-paragraph">
              Bằng việc đăng ký tài khoản, đăng nhập vào bảng điều khiển, hoặc kích hoạt lệnh kết nối tác tử K8s Agent vào cụm máy chủ, bạn xác nhận đã đọc, hiểu và đồng ý bị ràng buộc bởi các Điều khoản này cùng Chính sách Bảo mật của chúng tôi. Nếu bạn đăng ký thay mặt cho một công ty hoặc tổ chức, bạn cam kết rằng mình có đầy đủ thẩm quyền pháp lý để đại diện cho tổ chức đó chấp thuận văn bản này.
            </p>
          </section>

          <section id="terms-license" data-testid="terms-section-license">
            <h2 className="terms-heading-1">2. Quyền &amp; Phạm vi Cấp phép Sử dụng</h2>
            <p className="terms-body-paragraph">
              Theo các Điều khoản này, SelfHeal cấp cho bạn quyền sử dụng dịch vụ dưới hình thức phần mềm dịch vụ (SaaS) có giới hạn, có thể hủy bỏ, không độc quyền và không thể chuyển nhượng, nhằm mục đích giám sát và tự phục hồi hạ tầng nội bộ của doanh nghiệp bạn.
            </p>
            <h3 className="terms-heading-2">Hành vi bị nghiêm cấm</h3>
            <ul className="terms-list">
              <li>Đảo ngược kỹ thuật (reverse engineer), dịch ngược (decompile) hoặc cố gắng trích xuất mã nguồn độc quyền của mô hình học máy (GRU Neural Network), thuật toán phân tích nguyên nhân gốc rễ (RCA) hoặc tác tử SelfHeal Agent.</li>
              <li>Lạm dụng API, phát tán mã độc, hoặc thực hiện các hành vi tấn công từ chối dịch vụ nhằm vượt qua ranh giới rate limit và các biện pháp bảo vệ của cổng dịch vụ.</li>
              <li>Sử dụng dịch vụ để theo dõi, thu thập dữ liệu hoặc can thiệp vào các cụm máy chủ hạ tầng mà bạn không có quyền sở hữu hoặc quyền quản trị hợp pháp.</li>
              <li>Bán lại, cho thuê lại, phân phối lại hoặc cấp phép lại dịch vụ cho bất kỳ bên thứ ba nào mà không có sự đồng ý trước bằng văn bản của SelfHeal.</li>
            </ul>
          </section>

          <section id="terms-intellectual-property" data-testid="terms-section-intellectual-property">
            <h2 className="terms-heading-1">3. Quyền Sở hữu Trí tuệ &amp; Dữ liệu Khách hàng</h2>
            <p className="terms-body-paragraph">
              <strong>Dữ liệu của Khách hàng:</strong> Khách hàng giữ toàn bộ quyền sở hữu trí tuệ và quyền kiểm soát đối với mã nguồn ứng dụng, cấu hình dịch vụ, biến môi trường (Secrets/ConfigMaps) và số liệu telemetry phát sinh từ cụm máy chủ của mình. SelfHeal không tuyên bố quyền sở hữu đối với dữ liệu của bạn và chỉ xử lý dữ liệu này trong phạm vi cần thiết để cung cấp tính năng phân tích và tự động hóa.
            </p>
            <p className="terms-body-paragraph">
              <strong>Tài sản của SelfHeal:</strong> Toàn bộ nhãn hiệu, giao diện đồ họa, mã nguồn nền tảng, thiết kế bảng điều khiển, bộ tác tử SelfHeal Agent, tài liệu hướng dẫn và các mô hình dự báo AI đều thuộc quyền sở hữu trí tuệ độc quyền của SelfHeal và được bảo vệ bởi luật sở hữu trí tuệ hiện hành.
            </p>
          </section>

          <section id="terms-agent-infrastructure" data-testid="terms-section-agent-infrastructure">
            <h2 className="terms-heading-1">4. Triển khai Tác tử K8s &amp; Trách nhiệm Hạ tầng</h2>
            <p className="terms-body-paragraph">
              <strong>Nguyên tắc Đặc quyền Tối thiểu (Least Privilege RBAC):</strong> Tác tử SelfHeal Agent được thiết kế để vận hành với quyền hạn tối thiểu cần thiết bên trong cụm máy chủ Kubernetes. Khách hàng chịu trách nhiệm xác thực và áp dụng đúng cấu hình ClusterRole và RoleBinding do SelfHeal cung cấp, đảm bảo tác tử không bị cấp phát quyền hạn vượt quá phạm vi giám sát cần thiết.
            </p>
            <div className="terms-highlight-box">
              <p className="terms-body-paragraph" style={{ margin: 0, fontWeight: 500 }}>
                Quản lý Khóa Bí mật: Khách hàng có trách nhiệm bảo mật các khóa xác thực Agent Token và thông tin xác thực JWT. Trường hợp phát hiện token bị lộ lọt, khách hàng cần chủ động thu hồi token trên bảng điều khiển hoặc thông báo ngay lập tức cho đội ngũ kỹ thuật của SelfHeal.
              </p>
            </div>
            <p className="terms-body-paragraph">
              <strong>Chi phí &amp; Tài nguyên Cụm:</strong> Khách hàng chịu trách nhiệm về chi phí tài nguyên phần cứng (CPU, Memory, Băng thông mạng) do tác tử Agent và các hành động phục hồi (scaling, restart) tiêu thụ trên hạ tầng đám mây của khách hàng.
            </p>
          </section>

          <section id="terms-ai-hitl" data-testid="terms-section-ai-hitl">
            <h2 className="terms-heading-1">5. Tính năng AI &amp; Phê duyệt Human-in-the-Loop (HITL)</h2>
            <p className="terms-body-paragraph">
              <strong>Bản chất của Đề xuất AI:</strong> Các dự báo suy giảm tài nguyên và khuyến nghị hành động tự phục hồi được tính toán dựa trên mô hình mạng nơ-ron GRU và các mẫu dữ liệu lịch sử. Mặc dù chúng tôi không ngừng tối ưu hóa độ chuẩn xác, các dự báo này mang tính chất cảnh báo hỗ trợ kỹ thuật và không thể đảm bảo ngăn chặn 100% mọi sự cố bất khả kháng.
            </p>
            <p className="terms-body-paragraph">
              <strong>Cơ chế Phê duyệt Human-in-the-Loop (HITL):</strong> Nhằm đảm bảo kiểm soát an toàn tối đa cho hạ tầng doanh nghiệp, mọi thao tác phục hồi nhạy cảm (như tái khởi động Deployment, scale tài nguyên pod hoặc chỉnh sửa cấu hình chạy) đều yêu cầu sự xác nhận và phê duyệt có chủ đích từ kỹ sư quản trị của khách hàng thông qua bảng điều khiển, ngoại trừ các kịch bản đã được khách hàng cấu hình tự động hóa toàn phần một cách rõ ràng.
            </p>
          </section>

          <section id="terms-liability-disclaimer" data-testid="terms-section-liability-disclaimer">
            <h2 className="terms-heading-1">6. Giới hạn Trách nhiệm &amp; Khước từ Bảo đảm</h2>
            <p className="terms-body-paragraph">
              <strong>Cung cấp theo Nguyên trạng:</strong> Dịch vụ được cung cấp trên nguyên tắc &quot;nguyên trạng&quot; (as is) và &quot;như sẵn có&quot; (as available). SelfHeal khước từ mọi cam kết hoặc bảo đảm ngầm định về việc dịch vụ sẽ hoàn toàn không gặp gián đoạn, không có lỗi hoặc tương thích với mọi bản phân phối Kubernetes tùy biến.
            </p>
            <p className="terms-body-paragraph">
              <strong>Loại trừ Thiệt hại Hậu quả:</strong> Trong giới hạn tối đa được pháp luật cho phép, SelfHeal sẽ không chịu trách nhiệm đối với bất kỳ thiệt hại gián tiếp, đặc biệt, ngẫu nhiên hoặc có tính chất trừng phạt nào, bao gồm nhưng không giới hạn ở: mất mát dữ liệu sản xuất, gián đoạn kinh doanh, mất lợi nhuận, hoặc chi phí khôi phục hạ tầng phát sinh từ các quyết định phục hồi do khách hàng phê duyệt.
            </p>
            <p className="terms-body-paragraph">
              <strong>Giới hạn Bồi thường Tối đa:</strong> Tổng trách nhiệm bồi thường tích lũy của SelfHeal đối với mọi yêu cầu bồi thường phát sinh từ hoặc liên quan đến việc sử dụng dịch vụ sẽ không vượt quá tổng số tiền phí dịch vụ mà bạn đã chi trả cho SelfHeal trong sáu (06) tháng gần nhất trước khi sự kiện gây thiệt hại phát sinh.
            </p>
          </section>

          <section id="terms-termination" data-testid="terms-section-termination">
            <h2 className="terms-heading-1">7. Tạm ngừng &amp; Chấm dứt Dịch vụ</h2>
            <p className="terms-body-paragraph">
              <strong>Quyền Tạm ngừng Dịch vụ:</strong> SelfHeal có quyền tạm ngừng hoặc chấm dứt quyền truy cập dịch vụ của bạn bất kỳ lúc nào nếu:
            </p>
            <ul className="terms-list">
              <li>Bạn vi phạm nghiêm trọng bất kỳ điều khoản nào trong văn bản này.</li>
              <li>Hành vi sử dụng của bạn tạo ra rủi ro an ninh mạng hoặc gây cản trở sự ổn định của cụm dịch vụ SelfHeal dùng chung.</li>
              <li>Hết hạn thanh toán phí dịch vụ định kỳ mà không được khắc phục sau khi nhận được thông báo nhắc nhở.</li>
            </ul>
            <p className="terms-body-paragraph">
              <strong>Hậu quả khi Chấm dứt:</strong> Khi dịch vụ chấm dứt, bạn phải gỡ bỏ toàn bộ tác tử SelfHeal Agent khỏi cụm máy chủ của mình. Quyền truy cập bảng điều khiển và API sẽ lập tức bị vô hiệu hóa, và việc bảo lưu hoặc tiêu hủy dữ liệu lịch sử sẽ tuân thủ quy trình quy định trong Chính sách Bảo mật.
            </p>
          </section>

          <section id="terms-governing-law" data-testid="terms-section-governing-law">
            <h2 className="terms-heading-1">8. Luật Điều chỉnh &amp; Kênh Tiếp nhận Khiếu nại</h2>
            <p className="terms-body-paragraph">
              Các Điều khoản Dịch vụ này được điều chỉnh và diễn giải theo pháp luật của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam. Mọi tranh chấp phát sinh sẽ trước hết được thương lượng giải quyết trên tinh thần hòa giải thiện chí. Nếu không giải quyết được bằng hòa giải trong vòng ba mươi (30) ngày, tranh chấp sẽ được phân xử tại Tòa án có thẩm quyền tại Thành phố Hồ Chí Minh.
            </p>
            <p className="terms-body-paragraph">
              Mọi ý kiến đóng góp, thắc mắc pháp lý hoặc thông báo liên quan đến Điều khoản Dịch vụ, xin vui lòng gửi thư điện tử về cho ban pháp chế của chúng tôi:
            </p>
            <p className="terms-body-paragraph">
              <strong>Email Pháp chế &amp; Khiếu nại:</strong>{' '}
              <a href="mailto:legal@selfheal.dev" className="terms-email-link">
                legal@selfheal.dev
              </a>
            </p>
          </section>
        </main>
      </section>
    </div>
  );
};

export default TermsPage;
