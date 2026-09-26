import React from 'react';
import { Check, Building2, Layers, Server, Activity, CheckCircle2 } from 'lucide-react';
import { useOnboarding } from '../../context/OnboardingContext';

export const STEPS_METADATA = [
  {
    step: 1,
    title: 'Tạo Tổ chức',
    path: '/onboarding/organization',
    icon: Building2,
    explanation: 'Thiết lập không gian làm việc và ranh giới phân quyền.',
  },
  {
    step: 2,
    title: 'Khởi tạo Môi trường',
    path: '/onboarding/environment',
    icon: Layers,
    explanation: 'Phân lập tài nguyên giữa cụm Sản xuất, Thử nghiệm và Phát triển.',
  },
  {
    step: 3,
    title: 'Kết nối Kubernetes',
    path: '/onboarding/kubernetes',
    icon: Server,
    explanation: 'Cài đặt tác tử siêu nhẹ SelfHeal với quyền RBAC chỉ đọc an toàn.',
  },
  {
    step: 4,
    title: 'Xác thực Tác tử',
    path: '/onboarding/verify-agent',
    icon: Activity,
    explanation: 'Kiểm tra dòng viễn trắc thời gian thực và bắt tay kết nối thành công.',
  },
  {
    step: 5,
    title: 'Hoàn tất Thiết lập',
    path: '/onboarding/complete',
    icon: CheckCircle2,
    explanation: 'Hệ thống giám sát và tự phục hồi sự cố đã sẵn sàng hoạt động.',
  },
];

export const OnboardingProgress = ({ currentStep = 1, onStepClick }) => {
  const { organization, environment, cluster } = useOnboarding();

  return (
    <div className="onboarding-progress-container" style={{ width: '100%', userSelect: 'none' }}>
      {/* ================= DESKTOP VERTICAL STEPPER ================= */}
      <div className="hidden lg:block">
        <div style={{ marginBottom: '24px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            Quy Trình Thiết Lập
          </span>
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.125rem',
              fontWeight: 800,
              color: 'var(--color-ink)',
              letterSpacing: '-0.02em',
            }}
          >
            Bước {currentStep} trên {STEPS_METADATA.length}
          </h3>
        </div>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {STEPS_METADATA.map((item, idx) => {
            const isCompleted = item.step < currentStep;
            const isActive = item.step === currentStep;

            return (
              <div
                key={item.step}
                onClick={() => {
                  // Only allow jumping to previously completed steps or current step
                  if (item.step <= currentStep && onStepClick) {
                    onStepClick(item.step, item.path);
                  }
                }}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '12px 14px',
                  backgroundColor: isActive ? 'var(--color-surface)' : 'transparent',
                  border: isActive
                    ? '1px solid var(--border-strong)'
                    : '1px solid transparent',
                  borderRadius: '0px',
                  cursor: item.step <= currentStep ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Connecting vertical hairline between steps */}
                {idx < STEPS_METADATA.length - 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '27px',
                      top: '40px',
                      bottom: '-12px',
                      width: '2px',
                      backgroundColor: isCompleted ? 'var(--color-accent)' : 'rgba(61, 59, 79, 0.12)',
                      zIndex: 1,
                    }}
                  />
                )}

                {/* Step indicator badge */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    width: '28px',
                    height: '28px',
                    backgroundColor: isCompleted
                      ? 'var(--color-accent)'
                      : isActive
                        ? 'var(--color-primary)'
                        : 'var(--color-surface)',
                    color: isCompleted
                      ? '#000000'
                      : isActive
                        ? '#FFFFFF'
                        : 'var(--text-muted)',
                    border: isCompleted
                      ? '1px solid var(--color-accent)'
                      : isActive
                        ? '1px solid var(--color-primary)'
                        : '1px solid var(--border-default)',
                    borderRadius: '0px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {isCompleted ? <Check size={14} strokeWidth={3} /> : item.step}
                </div>

                {/* Step text info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '2px',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '0.875rem',
                        fontWeight: isActive ? 800 : 600,
                        color: isActive ? 'var(--color-ink)' : isCompleted ? 'var(--color-primary)' : 'var(--text-muted)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {item.title}
                    </span>
                  </div>

                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.75rem',
                      color: isActive ? 'var(--color-body)' : 'var(--text-muted)',
                      lineHeight: 1.35,
                      margin: 0,
                    }}
                  >
                    {item.explanation}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Workspace Context Summary in sidebar */}
        <div
          style={{
            marginTop: '32px',
            padding: '16px',
            backgroundColor: 'var(--color-surface)',
            border: '1px dashed var(--border-default)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '10px',
            }}
          >
            Môi Trường Mục Tiêu
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Tổ chức:</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                {organization?.name || 'Đang chờ...'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Môi trường:</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                {environment?.name ? `${environment.name} (${environment.type})` : 'Đang chờ...'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Cụm K8s:</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
                {cluster?.name || 'Chưa cấu hình'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= MOBILE / TABLET COMPACT STEPPER ================= */}
      <div className="block lg:hidden" style={{ marginBottom: '24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--border-default)',
            marginBottom: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '24px',
                height: '24px',
                backgroundColor: 'var(--color-primary)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              {currentStep}
            </span>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                {STEPS_METADATA[currentStep - 1]?.title}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                Bước {currentStep} trên {STEPS_METADATA.length}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            {STEPS_METADATA.map((s) => (
              <div
                key={s.step}
                style={{
                  width: '16px',
                  height: '4px',
                  backgroundColor:
                    s.step < currentStep
                      ? 'var(--color-accent)'
                      : s.step === currentStep
                        ? 'var(--color-primary)'
                        : 'var(--border-default)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingProgress;
