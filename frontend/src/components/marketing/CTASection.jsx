import React from 'react';

export const CTASection = ({
  title = "Sẵn sàng kết nối môi trường Kubernetes của bạn?",
  description = "Triển khai SelfHeal agent nhẹ nhàng chỉ trong vài phút. Dự báo sự cố chủ động và tự động phục hồi an toàn cho doanh nghiệp SME.",
  primaryButtonText = "Bắt đầu ngay",
  secondaryButtonText = "Xem hướng dẫn",
  onPrimaryClick,
  onSecondaryClick,
  className = '',
}) => {
  return (
    <div
      className={`cta-section-wrapper ${className}`}
      style={{
        margin: '64px 0',
        padding: '64px 32px',
        backgroundColor: 'var(--color-primary)',
        border: '1px solid var(--color-primary)',
        borderRadius: '0px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ maxWidth: '680px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.85rem, 4vw, 2.5rem)',
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            marginBottom: '16px',
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.0625rem',
            color: 'rgba(255, 255, 255, 0.82)',
            lineHeight: 1.65,
            marginBottom: '32px',
          }}
        >
          {description}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <a
            href="/get-started"
            onClick={(e) => {
              if (onPrimaryClick) {
                e.preventDefault();
                onPrimaryClick();
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '12px 26px',
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-ink)',
              fontWeight: 700,
              fontSize: '0.9375rem',
              fontFamily: 'var(--font-display)',
              borderRadius: '0px',
              border: '1px solid var(--color-accent)',
              textDecoration: 'none',
              transition: 'transform 0.15s ease, background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(4px)';
              e.currentTarget.style.backgroundColor = '#1fd48f';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.backgroundColor = 'var(--color-accent)';
            }}
          >
            {primaryButtonText}
          </a>
          <a
            href="/guide"
            onClick={(e) => {
              if (onSecondaryClick) {
                e.preventDefault();
                onSecondaryClick();
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '12px 26px',
              backgroundColor: 'transparent',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '0.9375rem',
              fontFamily: 'var(--font-display)',
              borderRadius: '0px',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              textDecoration: 'none',
              transition: 'transform 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(-4px)';
              e.currentTarget.style.borderColor = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            }}
          >
            {secondaryButtonText}
          </a>
        </div>
      </div>
    </div>
  );
};

export default CTASection;
