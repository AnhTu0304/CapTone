import React, { useState } from 'react';
import HeroSectionSlot from './HeroSectionSlot';
import HowItWorksSection from './components/HowItWorksSection';
import SectionHeader from '../../components/common/SectionHeader';
import IncidentCard from '../../components/marketing/IncidentCard';
import CTASection from '../../components/marketing/CTASection';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Check
} from 'lucide-react';

export const HomePage = ({ onNavigate }) => {
  const [requireApprovalForProd, setRequireApprovalForProd] = useState(true);

  const incidentTimeline = [
    {
      stage: "Bước 1: Trạng thái chuẩn",
      title: "Vận hành bình thường",
      timestamp: "14:20:00 UTC",
      metricLabel: "Bộ nhớ RSS",
      metricValue: "412MB / 1024MB",
      status: "healthy",
      workload: "deployment/order-processor",
      actionNote: "Hệ thống ổn định"
    },
    {
      stage: "Bước 2: Dấu hiệu suy giảm",
      title: "Mức sử dụng bộ nhớ tăng",
      timestamp: "14:26:30 UTC",
      metricLabel: "Bộ nhớ RSS",
      metricValue: "788MB (+12MB/phút)",
      status: "warning",
      workload: "deployment/order-processor",
      actionNote: "Tốc độ tăng bất thường"
    },
    {
      stage: "Bước 3: AI suy luận",
      title: "AI phát hiện nguy cơ sự cố",
      timestamp: "14:28:10 UTC",
      metricLabel: "Thời gian đến khi OOM",
      metricValue: "Dự kiến 6,4 phút",
      status: "critical",
      workload: "deployment/order-processor",
      actionNote: "Độ tin cậy: 98,4%"
    },
    {
      stage: "Bước 4: Kiểm tra an toàn",
      title: "Đánh giá rủi ro & Chính sách",
      timestamp: "14:28:45 UTC",
      metricLabel: "Ma trận chính sách",
      metricValue: "Cho phép khởi động lại Rolling tự động",
      status: "pending",
      workload: "deployment/order-processor",
      actionNote: "Cổng sẵn sàng hợp lệ"
    },
    {
      stage: "Bước 5: Thực thi",
      title: "Tiến hành khắc phục",
      timestamp: "14:29:15 UTC",
      metricLabel: "Hành động",
      metricValue: "kubectl rollout restart",
      status: "remediated",
      workload: "deployment/order-processor",
      actionNote: "0 yêu cầu người dùng bị rớt"
    },
    {
      stage: "Bước 6: Khôi phục",
      title: "Dịch vụ phục hồi & Xác minh",
      timestamp: "14:31:00 UTC",
      metricLabel: "Kiểm tra sức khỏe",
      metricValue: "Cả 3 Replicas Sẵn sàng (200 OK)",
      status: "healthy",
      workload: "deployment/order-processor",
      actionNote: "Đã ngăn chặn sự cố thành công"
    }
  ];

  return (
    <div className="home-page">
      {/* 1. HERO SECTION + [ AGENT ] BRIDGE BANNER */}
      <HeroSectionSlot onNavigate={onNavigate} />

      {/* 2. [ HOW IT WORKS ] 3-STEP CYBERNETIC BLUEPRINT SECTION */}
      <HowItWorksSection />

      {/* 3. FROM SIGNAL TO RECOVERY */}
      <section className="section-py" style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px dashed rgba(61, 59, 79, 0.16)' }}>
        <div className="container-custom">
          <SectionHeader
            badge="Tiến Trình Sự Cố"
            title="Từ tín hiệu đầu tiên đến khi phục hồi"
            description="Xem cách một nguy cơ tràn bộ nhớ (OOM) được phát hiện ngay từ quỹ đạo tăng ban đầu và được xử lý triệt để trước khi người dùng gặp lỗi."
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            {incidentTimeline.map((item, idx) => (
              <IncidentCard
                key={idx}
                stage={item.stage}
                title={item.title}
                timestamp={item.timestamp}
                metricLabel={item.metricLabel}
                metricValue={item.metricValue}
                status={item.status}
                workload={item.workload}
                actionNote={item.actionNote}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 4. HUMAN CONTROL */}
      <section className="section-py" style={{ backgroundColor: 'var(--color-canvas)', borderBottom: '1px dashed rgba(61, 59, 79, 0.16)' }}>
        <div className="container-custom">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '48px',
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '0px',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  marginBottom: '16px',
                  border: '1px solid var(--border-default)',
                }}
              >
                <ShieldCheck size={14} />
                KIẾN TRÚC AN TOÀN HÀNG ĐẦU
              </div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.75rem, 3.5vw, 2.375rem)',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.25,
                  marginBottom: '16px',
                }}
              >
                AI khuyến nghị. <span style={{ color: 'var(--color-primary)', textDecoration: 'underline', textDecorationColor: 'var(--color-accent)' }}>Bạn nắm quyền kiểm soát.</span>
              </h2>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '1rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  marginBottom: '24px',
                }}
              >
                SelfHeal nói không với tự động hóa hộp đen mờ ám. Mọi hành động tự động đều vận hành nghiêm ngặt trong khuôn khổ chính sách do chính đội ngũ kỹ thuật của bạn thiết lập. Các thao tác có độ rủi ro cao sẽ tự động tạm dừng để chờ phê duyệt từ con người.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={16} color="var(--color-primary)" />
                  <span>Ngưỡng rủi ro có thể cấu hình linh hoạt theo từng namespace (Production vs Staging)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={16} color="var(--color-primary)" />
                  <span>Nhật ký kiểm toán bất biến ghi nhận tín hiệu kích hoạt, lý do và danh tính người phê duyệt</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={16} color="var(--color-primary)" />
                  <span>Công tắc tạm dừng tức thì cho phép đình chỉ mọi thao tác tự hành chỉ với 1 thao tác</span>
                </div>
              </div>
            </div>

            {/* Interactive Policy & Approval Simulation Card */}
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: '0px',
                padding: '24px',
                boxShadow: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-default)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                    Chính sách quản trị tự hành
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Cluster: prod-k8s-cluster-01
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: 'var(--color-canvas)',
                    color: 'var(--color-primary)',
                    padding: '3px 8px',
                    borderRadius: '0px',
                    border: '1px solid var(--border-default)',
                    fontWeight: 700,
                  }}
                >
                  ĐANG ÁP DỤNG
                </span>
              </div>

              {/* Policy Chain */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'var(--color-canvas)', borderRadius: '0px', border: '1px solid var(--border-default)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>1. Phát hiện bằng AI</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>Phát hiện độ dốc bộ nhớ tăng cao</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'var(--color-canvas)', borderRadius: '0px', border: '1px solid var(--border-default)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>2. Đánh giá rủi ro</span>
                  <span style={{ color: 'var(--warning-text)', fontWeight: 600, backgroundColor: 'var(--warning-bg)', padding: '2px 6px', borderRadius: '0px', fontFamily: 'var(--font-mono)' }}>
                    Trung bình (Khởi động lại Pod Replica)
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'var(--color-canvas)', borderRadius: '0px', border: '1px solid var(--border-default)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>3. Rào chắn Production</span>
                  <button
                    type="button"
                    onClick={() => setRequireApprovalForProd(!requireApprovalForProd)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: requireApprovalForProd ? 'var(--color-primary)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '0px',
                        border: '1px solid var(--color-primary)',
                        backgroundColor: requireApprovalForProd ? 'var(--color-primary)' : 'transparent',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                      }}
                    >
                      {requireApprovalForProd && <Check size={10} />}
                    </span>
                    {requireApprovalForProd ? 'Bắt buộc phê duyệt' : 'Tự động phê duyệt'}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'var(--color-canvas)', borderRadius: '0px', border: '1px solid var(--border-default)' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>4. Cổng kiểm chứng</span>
                  <span style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>HTTP 200 &amp; Độ trễ &lt; 50ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FINAL CTA */}
      <section style={{ backgroundColor: 'var(--color-canvas)', borderTop: '1px dashed rgba(61, 59, 79, 0.16)' }}>
        <div className="container-custom">
          <CTASection
            title="Sẵn sàng kết nối môi trường Kubernetes của bạn?"
            description="Cài đặt SelfHeal agent nhẹ nhàng vào cluster của bạn trong chưa đầy 3 phút bằng file helm hoặc kubectl manifest tiêu chuẩn. Không bị khóa vào bất kỳ nhà cung cấp nào."
            primaryButtonText="Bắt đầu ngay"
            secondaryButtonText="Xem hướng dẫn"
            onPrimaryClick={() => onNavigate && onNavigate('/get-started')}
            onSecondaryClick={() => onNavigate && onNavigate('/guide')}
          />
        </div>
      </section>
    </div>
  );
};

export default HomePage;
