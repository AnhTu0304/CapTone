import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight, BookOpen } from 'lucide-react';
import './About.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export const AboutPage = ({ onNavigate }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const notebookContainerRef = useRef(null);
  const notebookCanvasRef = useRef(null);

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

    const renderNotebook = () => {
      const nCanvas = notebookCanvasRef.current;
      const nContainer = notebookContainerRef.current;
      if (!nCanvas || !nContainer) return;

      const nCtx = nCanvas.getContext('2d');
      if (!nCtx) return;

      const rect = nContainer.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width === 0 || height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      nCanvas.width = width * dpr;
      nCanvas.height = height * dpr;
      nCanvas.style.width = `${width}px`;
      nCanvas.style.height = `${height}px`;

      nCtx.save();
      nCtx.scale(dpr, dpr);
      nCtx.clearRect(0, 0, width, height);

      const padX = width > 640 ? 12 : 6;
      const padTop = 18;
      const padBottom = 12;
      const bookX = padX;
      const bookY = padTop;
      const bookW = width - padX * 2;
      const bookH = height - padTop - padBottom;
      const radius = 6;

      const drawRoundRect = (x, y, w, h, r) => {
        nCtx.beginPath();
        nCtx.moveTo(x + r, y);
        nCtx.lineTo(x + w - r, y);
        nCtx.arcTo(x + w, y, x + w, y + r, r);
        nCtx.lineTo(x + w, y + h - r);
        nCtx.arcTo(x + w, y + h, x + w - r, y + h, r);
        nCtx.lineTo(x + r, y + h);
        nCtx.arcTo(x, y + h, x, y + h - r, r);
        nCtx.lineTo(x, y + r);
        nCtx.arcTo(x, y, x + r, y, r);
        nCtx.closePath();
      };

      // Bottom page stack layer (thickness)
      drawRoundRect(bookX + 4, bookY + 4, bookW, bookH, radius);
      nCtx.fillStyle = '#D4D4DA';
      nCtx.fill();

      // Middle page stack layer
      drawRoundRect(bookX + 2, bookY + 2, bookW, bookH, radius);
      nCtx.fillStyle = '#E2E2E8';
      nCtx.fill();

      // Main notebook top sheet (matches outer #EEEEEE background)
      drawRoundRect(bookX, bookY, bookW, bookH, radius);
      nCtx.fillStyle = '#EEEEEE';
      nCtx.fill();
      nCtx.strokeStyle = 'rgba(61, 59, 79, 0.22)';
      nCtx.lineWidth = 1;
      nCtx.stroke();

      // Ruled 24px grid on notebook paper (matching outer grid texture)
      nCtx.save();
      drawRoundRect(bookX, bookY, bookW, bookH, radius);
      if (typeof nCtx.clip === 'function') {
        nCtx.clip();
      }

      const gridSize = 24;
      nCtx.strokeStyle = 'rgba(61, 59, 79, 0.05)';
      nCtx.lineWidth = 1;
      nCtx.beginPath();
      for (let gx = bookX; gx <= bookX + bookW; gx += gridSize) {
        nCtx.moveTo(gx + 0.5, bookY);
        nCtx.lineTo(gx + 0.5, bookY + bookH);
      }
      for (let gy = bookY; gy <= bookY + bookH; gy += gridSize) {
        nCtx.moveTo(bookX, gy + 0.5);
        nCtx.lineTo(bookX + bookW, gy + 0.5);
      }
      nCtx.stroke();
      nCtx.restore();

      // Perforation line below spiral rings
      const perfY = bookY + 28;
      nCtx.save();
      if (typeof nCtx.setLineDash === 'function') {
        nCtx.setLineDash([4, 4]);
      }
      nCtx.strokeStyle = 'rgba(61, 59, 79, 0.18)';
      nCtx.beginPath();
      nCtx.moveTo(bookX, perfY + 0.5);
      nCtx.lineTo(bookX + bookW, perfY + 0.5);
      nCtx.stroke();
      nCtx.restore();

      // Spiral wire rings along top edge
      const ringStep = width > 500 ? 36 : 28;
      const ringStart = bookX + 28;
      const ringEnd = bookX + bookW - 24;

      for (let rx = ringStart; rx <= ringEnd; rx += ringStep) {
        // Punch hole
        nCtx.beginPath();
        if (typeof nCtx.ellipse === 'function') {
          nCtx.ellipse(rx, bookY + 14, 3.5, 5, 0, 0, Math.PI * 2);
        } else {
          nCtx.rect(rx - 3, bookY + 9, 6, 10);
        }
        nCtx.fillStyle = '#B8B8C4';
        nCtx.fill();
        nCtx.strokeStyle = '#8E8D9D';
        nCtx.lineWidth = 1;
        nCtx.stroke();

        // Spiral wire loop
        nCtx.beginPath();
        nCtx.moveTo(rx - 3, bookY + 16);
        nCtx.bezierCurveTo(rx - 6, bookY - 10, rx + 6, bookY - 10, rx + 3, bookY + 16);
        nCtx.lineWidth = 2.5;
        nCtx.strokeStyle = '#3D3B4F';
        nCtx.stroke();

        // Highlight
        nCtx.beginPath();
        nCtx.moveTo(rx - 1.5, bookY + 12);
        nCtx.bezierCurveTo(rx - 3.5, bookY - 7, rx + 3.5, bookY - 7, rx + 1.5, bookY + 12);
        nCtx.lineWidth = 0.9;
        nCtx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        nCtx.stroke();
      }

      nCtx.restore();
    };

    renderGridAndSprockets();
    renderNotebook();

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        renderGridAndSprockets();
        renderNotebook();
      });
      observer.observe(container);
      if (notebookContainerRef.current) {
        observer.observe(notebookContainerRef.current);
      }
    }

    const handleResize = () => {
      renderGridAndSprockets();
      renderNotebook();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
    };
  }, []);

  useGSAP(
    () => {
      const sections = gsap.utils.toArray('.about-section');
      sections.forEach((sec) => {
        gsap.from(sec, {
          y: 24,
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

  const handleNavigate = (path) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="about-page-root" data-testid="about-page">
      <header className="about-top-hero" data-testid="about-top-hero">
        <h1 className="about-hero-title">Về Dự án SelfHeal</h1>
        <p className="about-hero-subtitle">
          Nghiên cứu kiến trúc tự phục hồi hạ tầng Kubernetes chủ động dựa trên trí tuệ nhân tạo dành cho doanh nghiệp vừa và nhỏ.
        </p>
      </header>

      <section
        ref={containerRef}
        className="about-sheet-section"
        data-testid="about-sheet-section"
      >
        <canvas
          ref={canvasRef}
          className="about-sheet-canvas"
          data-testid="about-sheet-canvas"
          aria-hidden="true"
        />

        <main className="about-content-container">
          {/* Section 01 – Our Story */}
          <section className="about-section" data-testid="about-section-story">
            <h2 className="about-headline">Vận hành hạ tầng thông minh bắt đầu từ tư duy chủ động.</h2>
            <p className="about-description">
              SelfHeal ra đời nhằm thay đổi cách doanh nghiệp vận hành hạ tầng Kubernetes: chuyển dịch từ phản ứng bị động sang phát hiện rủi ro sớm và phục hồi chủ động.
            </p>
            <p className="about-body-text">
              Trong kỷ nguyên Cloud-Native, Kubernetes đã trở thành tiêu chuẩn công nghiệp cho việc triển khai ứng dụng. Tuy nhiên, việc vận hành các cụm máy chủ phân tán đặt ra những thách thức khổng lồ về độ phức tạp. Phần lớn các công cụ giám sát hiện nay chỉ gửi cảnh báo sau khi sự cố hoặc cạn kiệt tài nguyên đã xảy ra, khiến kỹ sư luôn rơi vào thế &quot;chữa cháy&quot; bị động.
            </p>
            <p className="about-body-text">
              SelfHeal được khởi xướng từ ý tưởng kết hợp ba trụ cột: khả năng quan sát toàn diện (Observability), trí tuệ nhân tạo (AI) và tự động hóa phục hồi có kiểm soát (Self-Healing Automation). Mục tiêu của chúng tôi là giúp các doanh nghiệp vừa và nhỏ (SMEs)—những đơn vị thường không có đội ngũ DevOps/SRE chuyên trách—dễ dàng tiếp cận khả năng quản trị hạ tầng thông minh, an toàn và bền bỉ hơn.
            </p>
          </section>

          {/* Section 02 – The Problem */}
          <section className="about-section" data-testid="about-section-problem">
            <h2 className="about-headline">Sự cố hạ tầng không nên trở thành nguyên nhân gián đoạn kinh doanh.</h2>
            <p className="about-description">
              Doanh nghiệp vừa và nhỏ thường phải đối mặt với áp lực duy trì độ tin cậy của cụm Kubernetes trong điều kiện nguồn lực hạn chế.
            </p>
            <p className="about-body-text">
              <strong>Giám sát bị động (Reactive Monitoring):</strong> Cảnh báo thường chỉ kích hoạt khi dịch vụ đã ngừng hoạt động, khiến thời gian gián đoạn kéo dài và ảnh hưởng trực tiếp đến người dùng cuối.
            </p>
            <p className="about-body-text">
              <strong>Cạn kiệt tài nguyên bất ngờ:</strong> CPU hoặc bộ nhớ RAM tăng đột biến ngoài dự tính dẫn đến lỗi OOMKilled hoặc nghẽn nút mà không có dấu hiệu cảnh báo sớm.
            </p>
            <p className="about-body-text">
              <strong>Sập Pod và gián đoạn dịch vụ:</strong> Lỗi cấu hình hoặc vòng lặp CrashLoopBackOff làm đứt gãy luồng xử lý ứng dụng của doanh nghiệp.
            </p>
            <p className="about-body-text">
              <strong>Thiếu hụt nhân lực DevOps/SRE:</strong> Các doanh nghiệp SMEs hiếm khi có đủ nhân sự chuyên trách túc trực 24/7 để theo dõi và xử lý sự cố hạ tầng.
            </p>
            <p className="about-body-text">
              <strong>Điều tra &amp; phục hồi chậm trễ:</strong> Việc lần tìm nguyên nhân gốc qua hàng nghìn dòng log phân tán làm tiêu tốn thời gian quý báu trước khi đưa ra quyết định khắc phục.
            </p>
          </section>

          {/* Section 03 – Our Mission */}
          <section className="about-section" data-testid="about-section-mission">
            <h2 className="about-headline">Xây dựng hạ tầng thông minh hơn, chủ động hơn và bền bỉ hơn.</h2>
            <p className="about-description">
              SelfHeal hướng tới việc giảm tải gánh nặng vận hành, hỗ trợ phát hiện rủi ro sớm và nâng cao khả năng phục hồi liên tục cho cụm Kubernetes.
            </p>
            <p className="about-body-text">
              <strong>Sứ mệnh (Mission):</strong> Cung cấp giải pháp phát hiện sớm rủi ro, hỗ trợ phân tích nguyên nhân gốc và tự động hóa các bước khắc phục sự cố tiêu chuẩn cho cụm Kubernetes của doanh nghiệp vừa và nhỏ.
            </p>
            <p className="about-body-text">
              <strong>Tầm nhìn (Vision):</strong> Định hướng phát triển một hệ thống tự quản trị hạ tầng đáng tin cậy, nơi AI đóng vai trò như một trợ lý vận hành đắc lực, đồng hành cùng kỹ sư để bảo vệ sự ổn định của hệ thống.
            </p>
            <p className="about-body-text">
              <strong>Giá trị cốt lõi (Value):</strong> Giảm thiểu thời gian gián đoạn dịch vụ, giải phóng nguồn lực cho đội ngũ phát triển tập trung vào sản phẩm, và thiết lập hàng rào bảo vệ vững chắc cho cụm máy chủ.
            </p>
          </section>

          {/* Section 04 – How SelfHeal Works */}
          <section className="about-section" data-testid="about-section-how-it-works">
            <h2 className="about-headline">Từ tín hiệu hạ tầng đến phục hồi thông minh.</h2>
            <p className="about-description">
              Quy trình 3 giai đoạn khép kín giúp giám sát liên tục, dự báo xu hướng suy thoái và kích hoạt hành động khắc phục có kiểm soát.
            </p>
            <p className="about-body-text">
              <strong>01. Quan sát (Observe):</strong> Thu thập số liệu Kubernetes metrics, telemetry và sự kiện hệ thống theo thời gian thực; giám sát tình trạng sức khỏe của Nodes, Pods, Workloads và phát hiện sớm các tín hiệu vi sai, hành vi bất thường.
            </p>
            <p className="about-body-text">
              <strong>02. Dự báo (Predict):</strong> Phân tích dữ liệu vận hành theo chuỗi thời gian của tài nguyên tiêu thụ; ứng dụng mô hình AI mạng nơ-ron hồi quy GRU để hỗ trợ dự đoán suy thoái và phân tích nguyên nhân gốc (RCA).
            </p>
            <p className="about-body-text">
              <strong>03. Phục hồi (Recover):</strong> Đề xuất hoặc thực hiện các biện pháp khắc phục phù hợp (restart Pod, scale replicas, rollback deployment); áp dụng cơ chế Phê duyệt Con người (Human-in-the-Loop) và xác minh lại trạng thái hệ thống sau phục hồi.
            </p>
          </section>

          {/* Section 05 – Our Principles */}
          <section className="about-section" data-testid="about-section-principles">
            <h2 className="about-headline">Tự động hóa cần trí tuệ. Trí tuệ cần sự kiểm soát.</h2>
            <p className="about-description">
              Mọi tính năng của SelfHeal được xây dựng xoay quanh 4 nguyên tắc kỹ thuật không thể thỏa hiệp.
            </p>
            <p className="about-body-text">
              <strong>1. Trí tuệ định hướng bởi AI (AI-driven Intelligence):</strong> Sử dụng học máy để phân tích dữ liệu telemetry phức tạp và hỗ trợ dự báo rủi ro mà con người khó nhận biết thủ công.
            </p>
            <p className="about-body-text">
              <strong>2. An toàn là trên hết (Safety First):</strong> Đảm bảo các hành động phục hồi luôn nằm trong giới hạn an toàn nghiêm ngặt nhằm ngăn chặn sự cố dây chuyền.
            </p>
            <p className="about-body-text">
              <strong>3. Con người làm trung tâm (Human-centered):</strong> Tự động hóa không thay thế con người. Kỹ sư luôn giữ quyền kiểm soát tối cao, có thể xem xét bản diff tác động và phê duyệt trước khi hành động được thực thi.
            </p>
            <p className="about-body-text">
              <strong>4. Thiết kế cho khả năng mở rộng (Built for Scalability):</strong> Hướng đến khả năng mở rộng linh hoạt, thích ứng sâu với chuẩn Cloud-Native và quy mô tăng trưởng của các cụm Kubernetes.
            </p>
          </section>

          {/* Section 06 – Technology & Architecture */}
          <section className="about-section" data-testid="about-section-technology">
            <h2 className="about-headline">Được xây dựng trên nền tảng các công nghệ hạ tầng hiện đại.</h2>
            <p className="about-description">
              Sự kết hợp giữa các giải pháp tiêu chuẩn công nghiệp Cloud-Native và công nghệ trí tuệ nhân tạo tiên tiến.
            </p>
            <p className="about-body-text">
              <strong>Hạ tầng &amp; Đóng gói (Kubernetes, Docker):</strong> Nền tảng điều phối container cốt lõi cho mọi workload và cụm máy chủ phân tán, đảm bảo tính nhất quán giữa các môi trường vận hành.
            </p>
            <p className="about-body-text">
              <strong>Khả năng quan sát (Prometheus, OpenTelemetry):</strong> Thu thập và lưu trữ chuỗi dữ liệu số liệu thời gian thực với hiệu năng cao, cung cấp telemetry phân tán toàn diện trên toàn cụm.
            </p>
            <p className="about-body-text">
              <strong>Trí tuệ nhân tạo &amp; Ứng dụng (Python, GRU, ReactJS, Node.js):</strong> Mô hình mạng nơ-ron hồi quy GRU phục vụ suy luận dự báo suy thoái, kết hợp giao diện web phản hồi nhanh và backend điều phối an toàn.
            </p>
          </section>

          {/* Section 07 – Meet the Team */}
          <section className="about-section" data-testid="about-section-team">
            <h2 className="about-headline">Được phát triển bởi đội ngũ đam mê hạ tầng thông minh.</h2>
            <p className="about-description">
              Dự án nghiên cứu và phát triển sản phẩm với sự phối hợp chặt chẽ giữa các chuyên môn kỹ thuật điện toán đám mây và trí tuệ nhân tạo.
            </p>
            <p className="about-body-text">
              <strong>Quản lý Dự án &amp; Scrum:</strong> Định hướng lộ trình nghiên cứu, điều phối các sprint phát triển và đảm bảo sản phẩm giải quyết đúng bài toán của doanh nghiệp.
            </p>
            <p className="about-body-text">
              <strong>Kỹ thuật Backend &amp; Tích hợp Hệ thống:</strong> Thiết kế API Gateway, kết nối tác tử K8s Agent, đồng bộ telemetry và xây dựng luồng tự động hóa an toàn.
            </p>
            <p className="about-body-text">
              <strong>Trí tuệ Nhân tạo &amp; Học máy:</strong> Xây dựng pipeline xử lý dữ liệu thời gian thực, nghiên cứu và tối ưu hóa mô hình mạng nơ-ron GRU phục vụ dự đoán sự cố.
            </p>
            <p className="about-body-text">
              <strong>Frontend &amp; Trải nghiệm Người dùng:</strong> Phát triển giao diện quản trị trực quan, xây dựng bảng điều khiển telemetry và cổng phê duyệt Human-in-the-Loop liền mạch.
            </p>
          </section>

          {/* Section 08 – Final CTA Notebook */}
          <section className="about-section about-section--cta" data-testid="about-section-cta">
            <div
              ref={notebookContainerRef}
              className="about-notebook-card"
              data-testid="about-notebook-card"
            >
              <canvas
                ref={notebookCanvasRef}
                className="about-notebook-canvas"
                data-testid="about-notebook-canvas"
                aria-hidden="true"
              />
              <div className="about-notebook-content">
                <h2 className="about-cta-headline">Sẵn sàng thay đổi tư duy về độ tin cậy của hạ tầng?</h2>
                <p className="about-cta-desc">
                  Khám phá cách SelfHeal hỗ trợ doanh nghiệp giám sát, dự đoán rủi ro và phục hồi cụm Kubernetes chủ động hơn.
                </p>
                <div className="about-cta-group">
                  <button
                    type="button"
                    className="about-btn-primary"
                    onClick={() => handleNavigate('/get-started')}
                    data-testid="about-cta-explore-btn"
                    title="Khám phá SelfHeal"
                  >
                    <span>Khám phá SelfHeal</span>
                    <ArrowRight size={18} strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    className="about-btn-secondary"
                    onClick={() => handleNavigate('/contact')}
                    data-testid="about-cta-contact-btn"
                    title="Liên hệ Đội ngũ"
                  >
                    <BookOpen size={18} strokeWidth={2.2} color="#2A2A2A" />
                    <span>Liên hệ Đội ngũ</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </section>
    </div>
  );
};

export default AboutPage;
