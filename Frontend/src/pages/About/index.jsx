import React from 'react';
import Breadcrumb from '../../components/common/Breadcrumb';

export const AboutPage = ({ onNavigate }) => {
  return (
    <div className="about-page" style={{ backgroundColor: 'var(--color-canvas)', paddingBottom: '80px' }}>
      {/* Header Banner */}
      <div
        style={{
          borderBottom: '1px solid var(--border-default)',
          backgroundColor: 'var(--color-surface)',
          padding: '48px 0 36px 0',
        }}
      >
        <div className="container-custom">
          <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Giới thiệu dự án' }]} />
          <div style={{ maxWidth: '820px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 10px',
                borderRadius: '0px',
                backgroundColor: 'var(--color-canvas)',
                color: 'var(--color-primary)',
                fontSize: '0.75rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                border: '1px solid var(--border-default)',
                marginBottom: '12px',
              }}
            >
              SÁNG KIẾN NGHIÊN CỨU &amp; KỸ THUẬT
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2rem, 4vw, 2.75rem)',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.025em',
                marginBottom: '14px',
                lineHeight: 1.2,
              }}
            >
              Về Dự án SelfHeal
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Nghiên cứu kiến trúc điện toán tự hành vòng lặp khép kín, dự báo sự cố và khắc phục tất định cho môi trường Kubernetes Cloud-Native.
            </p>
          </div>
        </div>
      </div>

      <div className="container-custom" style={{ paddingTop: '56px' }}>
        <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '56px' }}>

          {/* 1. About SelfHeal */}
          <section>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Sứ mệnh Dự án
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              SelfHeal bắt nguồn từ một đề tài nghiên cứu ứng dụng nhằm kiểm chứng tính khả thi của khả năng tự phục hồi chủ động trong hệ thống điều phối container phân tán. Trong khi các tập đoàn công nghệ lớn duy trì các đội ngũ SRE (Site Reliability Engineering) trực 24/7, các doanh nghiệp vừa và nhỏ (SMEs) thường gặp khó khăn với gánh nặng vận hành lớn, tình trạng quá tải cảnh báo và việc xử lý sự cố thụ động chỉ sau khi gián đoạn đã ảnh hưởng đến khách hàng.
            </p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Mục tiêu của chúng tôi là xây dựng một hệ thống điều khiển tự hành mở, đáng tin cậy và mang tính tất định, giúp các Kubernetes cluster có thể tự chẩn đoán và tự phục hồi các dạng lỗi phổ biến với sự can thiệp thủ công tối thiểu và không có rủi ro từ các thuật toán hộp đen.
            </p>
          </section>

          {/* 2. The Problem */}
          <section style={{ backgroundColor: 'var(--color-surface)', padding: '28px', borderRadius: '0px', border: '1px solid var(--border-default)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
              Vấn đề: Cạm bẫy Vận hành Thụ động
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '14px' }}>
              Hệ thống giám sát hạ tầng truyền thống vốn dĩ mang tính chất <em>thụ động</em>. Các cảnh báo chỉ được kích hoạt khi các ngưỡng giới hạn cao (ví dụ: CPU &gt; 90% hoặc CrashLoopBackOff) đã vi phạm cam kết SLO. Khi các kỹ sư trực nhận được cảnh báo, phân tích nhật ký và tìm ra container gây lỗi, dịch vụ đã rơi vào tình trạng chậm chạp kéo dài hoặc sập hoàn toàn.
            </p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
              Hơn nữa, các công cụ APM doanh nghiệp hiện nay thường quá cồng kềnh, đắt đỏ và chủ yếu tập trung vào các bảng điều khiển chẩn đoán thay vì tự động hóa quy trình phục hồi khép kín.
            </p>
          </section>

          {/* 3. Why SMEs Need Proactive Infrastructure Monitoring */}
          <section>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Tại sao doanh nghiệp SME cần Giám sát Hạ tầng Chủ động
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              Các tổ chức kỹ thuật quy mô vừa và nhỏ phải đối mặt với những thực tế vận hành rất đặc thù:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
              <div style={{ padding: '20px', border: '1px solid var(--border-default)', borderRadius: '0px', backgroundColor: 'var(--color-surface)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9375rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Nguồn lực SRE hạn chế</div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  Các kỹ sư phần mềm thường phải kiêm nhiệm luôn việc vận hành cluster bên cạnh áp lực phát triển tính năng sản phẩm.
                </p>
              </div>
              <div style={{ padding: '20px', border: '1px solid var(--border-default)', borderRadius: '0px', backgroundColor: 'var(--color-surface)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9375rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Tình trạng quá tải cảnh báo</div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  Hàng trăm cảnh báo không hành động được khiến kỹ sư tắt thông báo, dẫn đến việc bỏ lỡ các dấu hiệu suy giảm hệ thống thực sự.
                </p>
              </div>
              <div style={{ padding: '20px', border: '1px solid var(--border-default)', borderRadius: '0px', backgroundColor: 'var(--color-surface)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9375rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Chi phí gián đoạn nghiêm trọng</div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  Chỉ 30 phút gián đoạn tại cổng thanh toán hoặc hệ thống xác thực cũng đe dọa trực tiếp đến doanh thu và uy tín doanh nghiệp.
                </p>
              </div>
            </div>
          </section>

          {/* 4. Research Direction & System Approach */}
          <section>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Định hướng Nghiên cứu &amp; Hướng tiếp cận Hệ thống
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              SelfHeal được xây dựng trên các nguyên tắc điện toán tự hành nguyên bản do IBM đề xuất (vòng lặp MAPE-K: Monitor - Giám sát, Analyze - Phân tích, Plan - Lập kế hoạch, Execute - Thực thi, trên nền tảng Knowledge - Tri thức dùng chung). Chúng tôi tối ưu hóa mô hình này chuyên biệt cho các thành phần của Kubernetes:
            </p>
            <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.9375rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li>
                <strong>Dự báo Quỹ đạo Sớm:</strong> Tận dụng ngoại suy độ dốc nhẹ và bộ lọc bất thường thống kê để nhận diện các mô hình tiêu thụ tài nguyên phi tuyến tính từ rất sớm trước khi chạm ngưỡng trần.
              </li>
              <li>
                <strong>Các khối lệnh khắc phục tất định:</strong> Thay vì để AI tự sinh các shell script tùy ý khó kiểm soát, các hành động phục hồi được giới hạn nghiêm ngặt trong các lệnh gọi Kubernetes API tiêu chuẩn đã được kiểm chứng (như rolling restart, HPA scaling, hoàn nguyên rollout).
              </li>
              <li>
                <strong>Cổng kiểm chứng hậu khắc phục:</strong> Mọi hành động khắc phục đã thực thi đều phải vượt qua các khẳng định kiểm chứng trong khoảng thời gian làm mát 5 phút, nếu không hệ thống sẽ tự động hoàn nguyên.
              </li>
            </ul>
          </section>

          {/* 5. Technology Overview & Project Scope */}
          <section style={{ borderTop: '1px solid var(--border-default)', paddingTop: '40px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Tổng quan Công nghệ &amp; Ranh giới Hệ thống
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              Hệ sinh thái SelfHeal được phân chia thành ba thành phần cốt lõi:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '16px 20px', backgroundColor: 'var(--color-surface)', borderRadius: '0px', border: '1px solid var(--border-default)' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>1. In-Cluster Telemetry Agent:</span> Daemon viết bằng Go nhẹ nhàng, đọc dữ liệu từ cgroups v2, endpoint Prometheus và luồng Kubernetes Watch.
              </div>
              <div style={{ padding: '16px 20px', backgroundColor: 'var(--color-surface)', borderRadius: '0px', border: '1px solid var(--border-default)' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>2. Inference &amp; Policy Engine:</span> Xử lý dữ liệu đo từ xa tần suất cao, tương quan nguyên nhân gốc rễ, đánh giá ma trận rủi ro và điều phối phê duyệt.
              </div>
              <div style={{ padding: '16px 20px', backgroundColor: 'var(--color-surface)', borderRadius: '0px', border: '1px solid var(--border-default)' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>3. Operator Control Plane:</span> Cổng web chuẩn White-first cung cấp dữ liệu đo từ xa thời gian thực, cơ chế phê duyệt của con người và nhật ký kiểm toán bất biến.
              </div>
            </div>
          </section>

          {/* 6. Future Development */}
          <section style={{ borderTop: '1px solid var(--border-default)', paddingTop: '40px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Định hướng Phát triển Tương lai
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
              Các đề tài nghiên cứu đang tiếp tục được mở rộng trong các lĩnh vực:
            </p>
            <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.9375rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Hỗ trợ đồng bộ hóa chính sách liên cụm (multi-cluster federated).</li>
              <li>Tương quan tỷ lệ rớt gói mạng qua tầng kernel eBPF cho kiến trúc microservices.</li>
              <li>Tích hợp trace span OpenTelemetry để xác định nguyên nhân gốc rễ phân tán với độ trễ dưới mili-giây.</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
};

export default AboutPage;
