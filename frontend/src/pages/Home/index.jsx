import React, { useState } from 'react';
import HeroSectionSlot from './HeroSectionSlot';
import SectionHeader from '../../components/common/SectionHeader';
import CapabilityCard from '../../components/marketing/CapabilityCard';
import ProcessStep from '../../components/marketing/ProcessStep';
import IncidentCard from '../../components/marketing/IncidentCard';
import CTASection from '../../components/marketing/CTASection';
import { 
  Activity, 
  Cpu, 
  Search, 
  Zap, 
  UserCheck, 
  ShieldCheck, 
  CheckCircle2, 
  Check
} from 'lucide-react';

export const HomePage = ({ onNavigate }) => {
  const [requireApprovalForProd, setRequireApprovalForProd] = useState(true);

  const capabilities = [
    {
      number: "01",
      icon: Activity,
      title: "Giám sát thời gian thực",
      description: "Liên tục theo dõi sức khỏe cluster, trạng thái pod, mức độ bão hòa tài nguyên, chỉ số mạng và luồng sự kiện Kubernetes control-plane theo chu kỳ 10 giây.",
      tags: ["Prometheus", "eBPF", "K8s Events"]
    },
    {
      number: "02",
      icon: Cpu,
      title: "Dự báo bằng AI",
      description: "Phát hiện sớm rò rỉ bộ nhớ phi tuyến tính, cạn kiệt tài nguyên CPU và các chuỗi lỗi dây chuyền trước khi dẫn đến CrashLoopBackOff hoặc trục xuất pod.",
      tags: ["Chuỗi thời gian", "Phát hiện bất thường", "LSTM"]
    },
    {
      number: "03",
      icon: Search,
      title: "Phân tích nguyên nhân gốc rễ (RCA)",
      description: "Tương quan dữ liệu đo từ xa đa chiều trên cấu hình deployment, các đợt cập nhật image gần nhất và áp lực node nhằm cô lập chính xác nguyên nhân gốc rễ.",
      tags: ["Tương quan tín hiệu", "Log RCA", "Đồ thị topo"]
    },
    {
      number: "04",
      icon: Zap,
      title: "Tự động phục hồi sự cố",
      description: "Thực thi các hành động khắc phục có mục tiêu và tuân thủ chính sách: khởi động lại rolling pod có kiểm soát, co giãn replica, hoàn nguyên cấu hình và giải phóng bộ nhớ đệm.",
      tags: ["Chính sách tất định", "Không gián đoạn", "Rollback"]
    },
    {
      number: "05",
      icon: UserCheck,
      title: "Con người tham gia kiểm soát (HITL)",
      description: "Thực thi ranh giới an toàn nghiêm ngặt. Các thao tác có bán kính ảnh hưởng lớn bắt buộc phải có sự phê duyệt xác thực từ kỹ sư vận hành.",
      tags: ["Phân quyền RBAC", "Nhật ký kiểm toán", "Ghi đè thủ công"]
    }
  ];

  const workflowSteps = [
    { num: "1", title: "Thu thập", desc: "Thu nạp chỉ số đo lường, nhật ký & sự kiện K8s" },
    { num: "2", title: "Phân tích", desc: "Tương quan dữ liệu đo từ xa qua các namespace" },
    { num: "3", title: "Dự báo", desc: "Nhận diện quỹ đạo suy giảm trước khi xảy ra sự cố" },
    { num: "4", title: "Đánh giá", desc: "Tính toán bán kính ảnh hưởng & ma trận an toàn" },
    { num: "5", title: "Khắc phục", desc: "Áp dụng tự phục hồi hoặc yêu cầu phê duyệt" },
    { num: "6", title: "Kiểm chứng", desc: "Xác thực mức độ ổn định SLI sau khắc phục" },
  ];

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
      {/* 1. HERO SECTION (SLOT PRESERVED) */}
      <HeroSectionSlot onNavigate={onNavigate} />

      {/* 2. CORE CAPABILITIES */}
      <section className="section-py" style={{ backgroundColor: 'var(--color-surface)', borderTop: '1px dashed rgba(61, 59, 79, 0.16)', borderBottom: '1px dashed rgba(61, 59, 79, 0.16)' }}>
        <div className="container-custom">
          <SectionHeader
            badge="Lõi Tự Hành"
            title="Xây dựng chuyên biệt cho hạ tầng SME dựa trên Kubernetes"
            description="Khác biệt với các hệ thống APM cồng kềnh dễ gây quá tải cảnh báo, SelfHeal tập trung vào dự báo chủ động và tự động phục hồi tất định, tối ưu riêng cho các đội ngũ kỹ thuật tinh gọn."
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
            }}
          >
            {capabilities.map((item, idx) => (
              <CapabilityCard
                key={idx}
                number={item.number}
                icon={item.icon}
                title={item.title}
                description={item.description}
                tags={item.tags}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 3. HOW SELFHEAL WORKS */}
      <section className="section-py" style={{ backgroundColor: 'var(--color-canvas)', borderBottom: '1px dashed rgba(61, 59, 79, 0.16)' }}>
        <div className="container-custom">
          <SectionHeader
            badge="Vòng Lặp Vận Hành"
            title="Cách thức SelfHeal hoạt động"
            description="Kiến trúc vòng lặp khép kín MAPE-K liên tục quan sát, suy luận và hành động, song song với việc kiểm chứng liên tục sự ổn định của cluster."
          />

          {/* Desktop Horizontal Process Flow */}
          <div
            className="desktop-process-flow"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '8px',
            }}
          >
            {workflowSteps.map((step, idx) => (
              <ProcessStep
                key={idx}
                stepNumber={step.num}
                title={step.title}
                description={step.desc}
                isLast={idx === workflowSteps.length - 1}
                status={idx === 4 ? 'active' : idx === 5 ? 'success' : 'default'}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 4. FROM SIGNAL TO RECOVERY */}
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

      {/* 5. HUMAN CONTROL */}
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

      {/* 6. FINAL CTA */}
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
