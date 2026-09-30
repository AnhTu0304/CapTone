import React from 'react';

export const SectionHeader = ({
  badge,
  title,
  description,
  align = 'center', // 'left' | 'center'
  className = '',
}) => {
  const isCenter = align === 'center';

  return (
    <div
      className={`section-header ${className}`}
      style={{
        textAlign: isCenter ? 'center' : 'left',
        maxWidth: isCenter ? '760px' : '100%',
        margin: isCenter ? '0 auto 48px auto' : '0 0 36px 0',
      }}
    >
      {badge && (
        <div style={{ marginBottom: '12px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              borderRadius: '0px',
              backgroundColor: 'rgba(40, 233, 159, 0.15)',
              color: 'var(--color-primary)',
              border: '1px solid var(--border-default)',
            }}
          >
            {badge}
          </span>
        </div>
      )}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.025em',
          lineHeight: 1.15,
          marginBottom: '14px',
        }}
      >
        {title}
      </h2>
      {description && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.0625rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
};

export default SectionHeader;
