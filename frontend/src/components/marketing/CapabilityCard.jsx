import React from 'react';

export const CapabilityCard = ({
  number,
  icon: Icon,
  title,
  description,
  tags = [],
  className = '',
}) => {
  return (
    <div
      className={`capability-card ${className}`}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '28px 24px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '0px',
        boxShadow: 'none',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = 'var(--color-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'var(--border-default)';
      }}
    >
      {/* Top row: Number and Icon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '42px',
            height: '42px',
            borderRadius: '0px',
            backgroundColor: 'var(--color-canvas)',
            color: 'var(--color-primary)',
            border: '1px solid var(--border-default)',
          }}
        >
          {Icon && <Icon size={20} />}
        </div>
        {number && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: 'var(--color-primary)',
              backgroundColor: 'var(--color-canvas)',
              padding: '3px 8px',
              borderRadius: '0px',
              border: '1px solid var(--border-default)',
            }}
          >
            {number}
          </span>
        )}
      </div>

      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.125rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '10px',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          flexGrow: 1,
          marginBottom: tags.length ? '16px' : '0',
        }}
      >
        {description}
      </p>

      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
          {tags.map((tag, idx) => (
            <span
              key={idx}
              style={{
                fontSize: '0.6875rem',
                padding: '2px 6px',
                borderRadius: '0px',
                backgroundColor: 'var(--color-canvas)',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                border: '1px solid var(--border-default)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default CapabilityCard;
