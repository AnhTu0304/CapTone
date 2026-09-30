import React from 'react';
import Breadcrumb from '../../components/common/Breadcrumb';
import Button from '../../components/common/Button';
import { 
  UserPlus, 
  Building2, 
  Layers, 
  Server, 
  Key, 
  Terminal, 
  Activity, 
  ArrowRight,
  BookOpen
} from 'lucide-react';

export const GetStartedPage = ({ onNavigate }) => {
  const steps = [
    {
      num: 1,
      title: "Tạo tài khoản",
      desc: "Đăng ký bằng email công việc của bạn và thiết lập bảo mật xác thực hai yếu tố (MFA).",
      icon: UserPlus
    },
    {
      num: 2,
      title: "Tạo tổ chức",
      desc: "Thiết lập tên miền tổ chức chuyên dụng và mời các kỹ sư trong đội ngũ của bạn.",
      icon: Building2
    },
    {
      num: 3,
      title: "Tạo môi trường",
      desc: "Phân tách các môi trường kiểm thử (staging) khỏi các cụm cluster sản xuất (production) quan trọng.",
      icon: Layers
    },
    {
      num: 4,
      title: "Đăng ký Kubernetes Cluster",
      desc: "Cung cấp định danh cluster và chọn nhà cung cấp hạ tầng đám mây hoặc máy chủ on-prem.",
      icon: Server
    },
    {
      num: 5,
      title: "Tạo Token cho Agent",
      desc: "Khởi tạo mã bí mật cluster chuẩn mã hóa SHA-256 để xác thực mutual TLS an toàn.",
      icon: Key
    },
    {
      num: 6,
      title: "Cài đặt SelfHeal Agent",
      desc: "Chạy một câu lệnh helm install hoặc triển khai file cấu hình YAML độc lập, không phụ thuộc bên ngoài.",
      icon: Terminal
    },
    {
      num: 7,
      title: "Bắt đầu giám sát",
      desc: "Dữ liệu đo từ xa bắt đầu truyền về sau 10 giây. Hệ thống tự động học và thiết lập ngưỡng cơ sở tự hành.",
      icon: Activity
    }
  ];

  return (
    <div className="get-started-page" style={{ backgroundColor: 'var(--color-canvas)', paddingBottom: '80px' }}>
      {/* Header Banner */}
      <div
        style={{
          borderBottom: '1px solid var(--border-default)',
          backgroundColor: 'var(--color-surface)',
          padding: '48px 0 36px 0',
        }}
      >
        <div className="container-custom">
          <Breadcrumb items={[{ label: 'Trang chủ', href: '/' }, { label: 'Bắt đầu' }]} />
          <div style={{ maxWidth: '760px' }}>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2rem, 4vw, 2.75rem)',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.025em',
                marginBottom: '12px',
                lineHeight: 1.2,
              }}
            >
              Bắt đầu với môi trường Kubernetes của bạn.
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '1.0625rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Thực hiện theo lộ trình 7 bước để kết nối cụm cluster và kích hoạt khả năng phát hiện sự cố chủ động cùng tính năng tự động phục hồi an toàn trong chưa đầy 10 phút.
            </p>
          </div>
        </div>
      </div>

      <div className="container-custom" style={{ paddingTop: '56px' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          
          {/* Timeline List of 7 Onboarding Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '48px' }}>
            {steps.map((step) => {
              const StepIcon = step.icon;
              return (
                <div
                  key={step.num}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '20px',
                    padding: '20px 24px',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '0px',
                    boxShadow: 'none',
                    transition: 'border-color 0.15s ease, transform 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '40px',
                      height: '40px',
                      borderRadius: '0px',
                      backgroundColor: 'var(--color-canvas)',
                      color: 'var(--color-primary)',
                      border: '1px solid var(--border-default)',
                      flexShrink: 0,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.9375rem',
                    }}
                  >
                    {step.num}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <StepIcon size={16} color="var(--color-primary)" />
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {step.title}
                      </h3>
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action CTAs */}
          <div
            style={{
              padding: '40px 32px',
              backgroundColor: 'var(--color-surface)',
              borderRadius: '0px',
              border: '1px solid var(--border-default)',
              textAlign: 'center',
            }}
          >
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Sẵn sàng thực hiện bước đầu tiên?
            </h3>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9375rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Thiết lập tổ chức của bạn chỉ trong 60 giây và không yêu cầu thẻ tín dụng.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="lg"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => onNavigate && onNavigate('/login')}
              >
                Tạo tổ chức của bạn
              </Button>
              <Button
                variant="secondary"
                size="lg"
                icon={BookOpen}
                iconPosition="left"
                onClick={() => onNavigate && onNavigate('/guide')}
              >
                Xem hướng dẫn chi tiết
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default GetStartedPage;
