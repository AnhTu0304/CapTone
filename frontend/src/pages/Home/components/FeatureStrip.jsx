import React from 'react';
import { 
  Activity, 
  Cpu, 
  Search, 
  Zap, 
  UserCheck 
} from 'lucide-react';

export const FeatureStrip = ({ className = '' }) => {
  const features = [
    {
      icon: Activity,
      title: 'Giám sát thời gian thực',
      desc: 'Theo dõi toàn diện tài nguyên, pod và events mọi lúc.',
      iconBg: '#EFF6FF',
      iconColor: '#2563EB',
    },
    {
      icon: Cpu,
      title: 'Dự báo bằng AI',
      desc: 'Phát hiện sớm suy thoái hạ tầng trước khi xảy ra sự cố.',
      iconBg: '#F5F3FF',
      iconColor: '#7C3AED',
    },
    {
      icon: Search,
      title: 'Phân tích nguyên nhân gốc rễ',
      desc: 'Khoanh vùng chính xác vấn đề, không chỉ báo cáo triệu chứng.',
      iconBg: '#ECFDF5',
      iconColor: '#059669',
    },
    {
      icon: Zap,
      title: 'Tự động khắc phục sự cố',
      desc: 'Tự phục hồi dịch vụ theo các chính sách an toàn định sẵn.',
      iconBg: '#F0F9FF',
      iconColor: '#0284C7',
    },
    {
      icon: UserCheck,
      title: 'Con người kiểm soát',
      desc: 'Yêu cầu phê duyệt rõ ràng đối với các tác vụ rủi ro cao.',
      iconBg: '#F0FDF4',
      iconColor: '#16A34A',
    },
  ];

  return (
    <section
      className={`feature-strip-section ${className}`}
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px dashed rgba(61, 59, 79, 0.16)',
        borderBottom: '1px dashed rgba(61, 59, 79, 0.16)',
        padding: '56px 0',
      }}
    >
      <div className="container-custom">
        {/* Header bar */}
        <div style={{ maxWidth: '800px', marginBottom: '36px' }}>
          <div
            style={{
              width: '32px',
              height: '3px',
              backgroundColor: 'var(--color-accent)',
              borderRadius: '0px',
              marginBottom: '14px',
            }}
          ></div>
          <h2
            style={{
              fontSize: 'clamp(1.5rem, 3vw, 1.875rem)',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              color: 'var(--text-primary)',
              letterSpacing: '-0.025em',
              marginBottom: '10px',
              lineHeight: 1.25,
            }}
          >
            Được xây dựng cho hạ tầng doanh nghiệp vừa và nhỏ (SME) dựa trên Kubernetes
          </h2>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.6, margin: 0 }}>
            Các tính năng mạnh mẽ giúp giữ cơ sở hạ tầng của bạn luôn khỏe mạnh, an toàn và liên tục vận hành — ngay cả khi bạn không theo dõi.
          </p>
        </div>

        {/* 5 Core Feature Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '20px',
          }}
        >
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                style={{
                  padding: '20px',
                  backgroundColor: 'var(--bg-canvas)',
                  borderRadius: '0px',
                  border: '1px solid var(--border-default)',
                  transition: 'border-color 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '0px',
                    backgroundColor: 'rgba(40, 233, 159, 0.15)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginBottom: '6px' }}>
                    {feat.title}
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.5, margin: 0 }}>
                    {feat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeatureStrip;
